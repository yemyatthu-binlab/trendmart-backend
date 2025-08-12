import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";

// Helper to convert dollars to cents
const toCents = (price: number) => Math.round(price * 100);

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
  },
};
