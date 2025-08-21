// src/graphql/category.resolver.ts

import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";

export default {
  Query: {
    getCategoriesForManagement: async () => {
      return prisma.category.findMany({
        where: { parentId: null },
        include: {
          children: {
            include: {
              sizes: {
                include: { size: true },
                orderBy: { size: { value: "asc" } },
              },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });
    },

    // Note: I renamed the param to subCategoryId for clarity
    getUnassignedSizesForCategory: async (
      _: any,
      { subCategoryId }: { subCategoryId: string }
    ) => {
      const assignedSizes = await prisma.categorySize.findMany({
        where: { categoryId: parseInt(subCategoryId) },
        select: { sizeId: true },
      });
      const assignedSizeIds = assignedSizes.map((s) => s.sizeId);

      return prisma.size.findMany({
        where: { id: { notIn: assignedSizeIds } },
        orderBy: { value: "asc" },
      });
    },

    getColorsForManagement: async () => {
      return prisma.color.findMany({ orderBy: { name: "asc" } });
    },
  },

  Mutation: {
    // --- CATEGORY ---
    createCategory: async (
      _: any,
      { name, parentId }: { name: string; parentId?: number }
    ) => {
      if (!name.trim()) {
        throw new GraphQLError("Name cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return prisma.category.create({
        data: { name, parentId },
      });
    },

    updateCategory: async (
      _: any,
      { id, name }: { id: string; name: string }
    ) => {
      if (!name.trim()) {
        throw new GraphQLError("Name cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return prisma.category.update({
        where: { id: parseInt(id, 10) },
        data: { name },
      });
    },

    deleteCategory: async (_: any, { id }: { id: string }) => {
      const categoryId = parseInt(id, 10);
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: { children: true },
      });

      if (!category) {
        throw new GraphQLError("Category not found.", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Check if it's a parent category or a sub-category
      if (category.parentId === null) {
        // --- Deleting a PARENT category ---
        if (!category.isDeletable) {
          throw new GraphQLError("This category cannot be deleted.", {
            extensions: { code: "FORBIDDEN" },
          });
        }
        await prisma.$transaction(async (tx) => {
          const childIds = category.children.map((child) => child.id);
          const allIds = [categoryId, ...childIds];
          await tx.categorySize.deleteMany({
            where: { categoryId: { in: allIds } },
          });
          await tx.category.deleteMany({ where: { parentId: categoryId } });
          await tx.category.delete({ where: { id: categoryId } });
        });
      } else {
        // --- Deleting a SUB-category ---
        const productInUse = await prisma.product.findFirst({
          where: {
            categories: {
              some: {
                id: categoryId,
              },
            },
          },
        });

        if (productInUse) {
          throw new GraphQLError(
            "Cannot delete sub-category. It is in use by a product.",
            { extensions: { code: "CONFLICT" } }
          );
        }
        await prisma.$transaction(async (tx) => {
          await tx.categorySize.deleteMany({ where: { categoryId } });
          await tx.category.delete({ where: { id: categoryId } });
        });
      }

      return { success: true, message: "Category deleted successfully." };
    },

    // --- SIZE ---
    createSize: async (_: any, { value }: { value: string }) => {
      if (!value.trim()) {
        throw new GraphQLError("Size value cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return prisma.size.create({ data: { value } });
    },

    updateSize: async (
      _: any,
      { id, value }: { id: string; value: string }
    ) => {
      if (!value.trim()) {
        throw new GraphQLError("Size value cannot be empty.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return prisma.size.update({
        where: { id: parseInt(id, 10) },
        data: { value },
      });
    },

    deleteSize: async (_: any, { id }: { id: string }) => {
      const sizeId = parseInt(id, 10);
      const variantInUse = await prisma.productVariant.findFirst({
        where: { sizeId },
      });
      if (variantInUse) {
        throw new GraphQLError(
          "Cannot delete size. It is in use by a product.",
          { extensions: { code: "CONFLICT" } }
        );
      }
      await prisma.size.delete({ where: { id: sizeId } });
      return { success: true, message: "Size deleted successfully." };
    },

    // --- COLOR ---
    createColor: async (
      _: any,
      { name, hexCode }: { name: string; hexCode: string }
    ) => {
      if (!name.trim() || !hexCode.trim()) {
        throw new GraphQLError("Name and hex code are required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const existingColor = await prisma.color.findFirst({
        where: {
          OR: [
            { name: { equals: name, mode: "insensitive" } },
            { hexCode: { equals: hexCode, mode: "insensitive" } },
          ],
        },
      });
      if (existingColor) {
        throw new GraphQLError(
          "A color with this name or hex code already exists.",
          { extensions: { code: "CONFLICT" } }
        );
      }
      return prisma.color.create({ data: { name, hexCode } });
    },

    updateColor: async (
      _: any,
      { id, name, hexCode }: { id: string; name?: string; hexCode?: string }
    ) => {
      const colorId = parseInt(id, 10);
      const dataToUpdate: { name?: string; hexCode?: string } = {};
      if (name) dataToUpdate.name = name;
      if (hexCode) dataToUpdate.hexCode = hexCode;

      if (Object.keys(dataToUpdate).length === 0) {
        throw new GraphQLError("No update data provided.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      return prisma.color.update({
        where: { id: colorId },
        data: dataToUpdate,
      });
    },

    deleteColor: async (_: any, { id }: { id: string }) => {
      const colorId = parseInt(id, 10);
      const variantInUse = await prisma.productVariant.findFirst({
        where: { colorId },
      });
      if (variantInUse) {
        throw new GraphQLError(
          "Cannot delete color. It is in use by a product.",
          { extensions: { code: "CONFLICT" } }
        );
      }
      await prisma.color.delete({ where: { id: colorId } });
      return { success: true, message: "Color deleted successfully." };
    },

    // --- ASSIGNMENTS ---
    assignSizesToSubCategory: async (
      _: any,
      { subCategoryId, sizeIds }: { subCategoryId: string; sizeIds: number[] }
    ) => {
      const catId = parseInt(subCategoryId, 10);
      await prisma.categorySize.createMany({
        data: sizeIds.map((sizeId) => ({ categoryId: catId, sizeId })),
        skipDuplicates: true,
      });
      return prisma.category.findUniqueOrThrow({
        where: { id: catId },
      });
    },

    removeSizeFromSubCategory: async (
      _: any,
      { subCategoryId, sizeId }: { subCategoryId: string; sizeId: string }
    ) => {
      const catId = parseInt(subCategoryId, 10);
      const sId = parseInt(sizeId, 10);
      await prisma.categorySize.delete({
        where: { categoryId_sizeId: { categoryId: catId, sizeId: sId } },
      });
      return prisma.category.findUniqueOrThrow({
        where: { id: catId },
      });
    },
  },

  Category: {
    sizes: async (parent: { id: number }) => {
      const categorySizes = await prisma.categorySize.findMany({
        where: { categoryId: parent.id },
        include: { size: true },
        orderBy: { size: { value: "asc" } },
      });
      // The shape from your frontend expects `Size[]`, not `CategorySize[]`
      return categorySizes.map((cs) => ({
        id: cs.size.id.toString(), // Ensure IDs are strings
        value: cs.size.value,
      }));
    },
  },
};
