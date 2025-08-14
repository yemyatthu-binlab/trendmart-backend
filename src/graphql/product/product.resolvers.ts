import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";
import { v4 as uuidv4 } from "uuid";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

// Helper to convert dollars to cents
const toCents = (price: number) => Math.round(price * 100);

const s3Client = new S3Client({
  endpoint: "https://s3.filebase.com",
  region: "us-east-1", // This is standard for Filebase
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
});

export default {
  Query: {
    // Fetches a list of all products with their variants, categories, etc.
    getProducts: async () => {
      const products = await prisma.product.findMany({
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
      console.log(products);

      return products;
    },
    // Fetches all categories, useful for dropdowns in the UI
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
          isDeletable: false,
        },
      });
    },
    // Fetches all sizes
    getSizes: async () => {
      return prisma.size.findMany();
    },
    // Fetches all colors
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
                sku,
                price: toCents(price), // Convert to cents
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

    createPresignedPost: async (
      _: any,
      { filename, fileType }: { filename: string; fileType: string }
    ) => {
      const uniqueFilename = `${uuidv4()}-${filename}`;
      const post = await createPresignedPost(s3Client, {
        Bucket: process.env.FILEBASE_BUCKET!,
        Key: uniqueFilename,
        Fields: {
          "Content-Type": fileType,
        },
        Conditions: [
          ["content-length-range", 0, 10485760], // up to 10 MB
          { "Content-Type": fileType },
        ],
        Expires: 600, // 10 minutes
      });

      return {
        url: post.url,
        fields: JSON.stringify(post.fields), // Stringify fields for easier transport
      };
    },
  },
};
