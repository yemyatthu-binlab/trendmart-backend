import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";
import { v4 as uuidv4 } from "uuid";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { GraphQLUpload } from "graphql-upload-ts";
import type { FileUpload } from "graphql-upload-ts";

const streamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

const s3Client = new S3Client({
  endpoint: "https://s3.filebase.com",
  region: "us-east-1", // This is standard for Filebase
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
});

export default {
  Upload: GraphQLUpload,
  Query: {
    getProducts: async (
      _: any,
      { skip = 0, take = 10 }: { skip?: number; take?: number }
    ) => {
      const [prismaProducts, totalCount] = await prisma.$transaction([
        prisma.product.findMany({
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            categories: true,
            variants: {
              include: {
                size: true,
                color: true,
                images: true,
              },
            },
          },
        }),
        prisma.product.count(),
      ]);

      const products = prismaProducts.map((product) => ({
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      }));

      return {
        products,
        totalCount,
      };
    },

    getProductById: async (_: any, { id }: { id: string }) => {
      try {
        const product = await prisma.product.findUniqueOrThrow({
          where: { id: parseInt(id, 10) },
          include: {
            categories: true,
            variants: {
              include: {
                size: true,
                color: true,
                images: true,
              },
              orderBy: { id: "asc" },
            },
          },
        });
        return product;
      } catch (error) {
        console.error("Failed to get product by id:", error);
        throw new GraphQLError("Product not found.", {
          extensions: { code: "NOT_FOUND" },
        });
      }
    },

    getCategories: async () => {
      return prisma.category.findMany({
        where: { parentId: null }, // Fetch only top-level categories
        include: { children: true }, // Include their sub-categories
      });
    },
    getMainSubCategories: async () => {
      return prisma.category.findMany({
        where: {
          parentId: { not: null },
        },
        include: {
          // This is the new part that fetches the linked sizes
          sizes: {
            include: {
              size: true, // Include the actual Size object
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    },
    getSizes: async () => {
      return prisma.size.findMany();
    },
    getColors: async () => {
      return prisma.color.findMany();
    },
  },

  Mutation: {
    /**
     * Creates a new category. Can be a parent or a child category.
     * This is useful for the "Add New Category" feature on your product page.
     */
    createCategory: async (
      _: any,
      { name, parentId }: { name: string; parentId?: number }
    ) => {
      return prisma.category.create({
        data: {
          name,
          parentId,
        },
      });
    },

    /**
     * Creates a new product along with its variants and images in a single transaction.
     */
    createProduct: async (_: any, { input }: { input: any }) => {
      const { name, description, categoryIds, variants } = input;

      if (!variants || variants.length === 0) {
        throw new GraphQLError("Product must have at least one variant.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        // Use a transaction to ensure all or nothing is created
        const newProduct = await prisma.$transaction(async (tx) => {
          // 1. Create the base product and connect it to categories
          const product = await tx.product.create({
            data: {
              name,
              description,
              categories: {
                connect: categoryIds.map((id: number) => ({ id })),
              },
            },
          });

          // 2. Create each variant and its images
          for (const variant of variants) {
            const {
              sizeId,
              colorId,
              sku,
              price,
              stock,
              discountPercentage,
              images,
            } = variant;

            const newVariant = await tx.productVariant.create({
              data: {
                productId: product.id,
                sizeId,
                colorId,
                sku: sku?.trim() ? sku : uuidv4(),
                price: price,
                stock,
                discountPercentage,
                images: {
                  create: images.map((img: any) => ({
                    imageUrl: img.imageUrl,
                    altText: img.altText,
                    isPrimary: img.isPrimary,
                  })),
                },
              },
            });
          }
          return product;
        });

        // 3. Re-fetch the product with all its relations to return the complete object
        return prisma.product.findUniqueOrThrow({
          where: { id: newProduct.id },
          include: {
            categories: true,
            variants: {
              include: {
                size: true,
                color: true,
                images: true,
              },
            },
          },
        });
      } catch (error) {
        console.error("Failed to create product:", error);
        throw new GraphQLError(
          "Could not create product. Please check your input.",
          {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          }
        );
      }
    },

    updateProduct: async (
      _: any,
      { id, input }: { id: string; input: any }
    ) => {
      const productId = parseInt(id, 10);
      const { name, description, categoryIds, variants } = input;

      try {
        const updatedProduct = await prisma.$transaction(async (tx) => {
          // 1. Update product's basic details and categories
          const product = await tx.product.update({
            where: { id: productId },
            data: {
              name,
              description,
              categories: categoryIds
                ? { set: categoryIds.map((cid: number) => ({ id: cid })) }
                : undefined,
            },
          });

          if (variants && variants.length > 0) {
            // Get current variants and images to compare
            const currentVariants = await tx.productVariant.findMany({
              where: { productId: productId },
              select: { id: true },
            });
            const currentVariantIds = currentVariants.map((v) => v.id);
            const incomingVariantIds = variants
              .filter((v: any) => v.id)
              .map((v: any) => parseInt(v.id, 10));

            // 2. Delete variants that are no longer present
            const variantsToDelete = currentVariantIds.filter(
              (vid) => !incomingVariantIds.includes(vid)
            );
            if (variantsToDelete.length > 0) {
              await tx.productVariant.deleteMany({
                where: { id: { in: variantsToDelete } },
              });
            }

            // 3. Upsert variants (update existing, create new)
            for (const variant of variants) {
              const { images, ...variantData } = variant;
              const variantId = variant.id
                ? parseInt(variant.id, 10)
                : undefined;

              const upsertedVariant = await tx.productVariant.upsert({
                where: { id: variantId || -1 }, // -1 ensures it doesn't find a match for new variants
                update: {
                  ...variantData,
                  id: undefined, // Don't try to update the ID
                  price: variantData.price,
                },
                create: {
                  ...variantData,
                  id: undefined,
                  productId: product.id,
                  price: variantData.price,
                  sku: variantData.sku?.trim() ? variantData.sku : uuidv4(),
                },
              });

              // Handle images for the variant
              if (images && images.length > 0) {
                const currentImages = await tx.productImage.findMany({
                  where: { productVariantId: upsertedVariant.id },
                  select: { id: true },
                });
                const currentImageIds = currentImages.map((img) => img.id);
                const incomingImageIds = images
                  .filter((img: any) => img.id)
                  .map((img: any) => parseInt(img.id, 10));

                const imagesToDelete = currentImageIds.filter(
                  (imgId) => !incomingImageIds.includes(imgId)
                );
                if (imagesToDelete.length > 0) {
                  await tx.productImage.deleteMany({
                    where: { id: { in: imagesToDelete } },
                  });
                }

                for (const image of images) {
                  await tx.productImage.upsert({
                    where: { id: image.id ? parseInt(image.id, 10) : -1 },
                    update: { ...image, id: undefined },
                    create: {
                      ...image,
                      id: undefined,
                      productVariantId: upsertedVariant.id,
                    },
                  });
                }
              }
            }
          }

          return product;
        });

        // Re-fetch the fully updated product to return
        return prisma.product.findUniqueOrThrow({
          where: { id: updatedProduct.id },
          include: {
            categories: true,
            variants: { include: { size: true, color: true, images: true } },
          },
        });
      } catch (error) {
        console.error("Failed to update product:", error);
        throw new GraphQLError("Could not update product.", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    deleteProduct: async (_: any, { id }: { id: string }) => {
      const productId = parseInt(id, 10);
      try {
        // Prisma's cascading delete will handle related variants and images if the schema is set up correctly.
        const deletedProduct = await prisma.product.delete({
          where: { id: productId },
        });
        return deletedProduct;
      } catch (error: any) {
        // Handle case where product is not found
        if (error.code === "P2025") {
          throw new GraphQLError("Product not found.", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        console.error("Failed to delete product:", error);
        throw new GraphQLError("Could not delete product.", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    createColor: async (
      _: any,
      { name, hexCode }: { name: string; hexCode: string }
    ) => {
      // Basic validation
      if (!name || !hexCode) {
        throw new Error("Name and hex code are required.");
      }
      // Check if color already exists (optional but good practice)
      const existingColor = await prisma.color.findFirst({
        where: { OR: [{ name }, { hexCode }] },
      });
      if (existingColor) {
        throw new Error("A color with this name or hex code already exists.");
      }

      return prisma.color.create({
        data: {
          name,
          hexCode,
        },
      });
    },

    uploadImage: async (_: any, { file }: { file: Promise<FileUpload> }) => {
      const { createReadStream, filename, mimetype } = await file;

      // Create a readable stream from the uploaded file
      const stream = createReadStream();

      // Generate a unique filename to prevent overwriting files in the bucket
      const uniqueFilename = `${uuidv4()}-${filename}`;

      // Convert the stream to a buffer to upload
      const buffer = await streamToBuffer(stream);

      const command = new PutObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET!,
        Key: uniqueFilename,
        Body: buffer,
        ContentType: mimetype,
      });

      try {
        await s3Client.send(command);

        const headCommand = new HeadObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET!,
          Key: uniqueFilename,
        });

        const headResult = await s3Client.send(headCommand);
        const cid =
          headResult.Metadata?.cid || headResult.Metadata?.["ipfs-hash"];

        if (!cid) {
          throw new Error("CID not found in file metadata.");
        }

        const gatewayUrl = `https://${process.env.FILEBASE_GATEWAY_NAME}.myfilebase.com/ipfs/${cid}`;

        return {
          url: gatewayUrl,
          filename: uniqueFilename,
        };
      } catch (error) {
        console.error("Failed to upload image to S3:", error);
        throw new GraphQLError("Image upload failed.", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
};
