import { prisma } from "../src/prismaClient";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🚀 Starting the seeding process...");

  // --- 1. Seed Admins ---
  const admins = [
    {
      fullName: "Admin One",
      phoneNumber: "0912345678",
      email: "admin1@gmail.com",
      passwordHash: await bcrypt.hash("password", 10),
      role: "ADMIN" as const,
    },
  ];
  for (const admin of admins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: admin,
    });
  }
  console.log("✅ Admin users seeded.");

  // --- 2. Seed Colors ---
  const colors = [
    { name: "Black", hexCode: "#000000" },
    { name: "White", hexCode: "#FFFFFF" },
    { name: "Red", hexCode: "#FF0000" },
    { name: "Blue", hexCode: "#0000FF" },
    { name: "Green", hexCode: "#008000" },
    { name: "Yellow", hexCode: "#FFFF00" },
    { name: "Gray", hexCode: "#808080" },
    { name: "Pink", hexCode: "#FFC0CB" },
  ];
  await prisma.color.createMany({ data: colors, skipDuplicates: true });
  console.log("✅ Colors seeded.");

  // --- 3. Seed Sizes (with clean values) ---
  const sizeGroups = {
    Shoes: ["US-6", "US-7", "US-8", "US-9", "US-10"],
    Apparel: ["S", "M", "L", "XL", "XXL"], // For Hoodies, Shirts
    Pants: ["28", "30", "32", "34", "36"],
    Accessories: ["One Size"],
  };

  const allSizes = [
    ...new Set([
      ...sizeGroups.Shoes,
      ...sizeGroups.Apparel,
      ...sizeGroups.Pants,
      ...sizeGroups.Accessories,
    ]),
  ].map((value) => ({ value }));

  await prisma.size.createMany({ data: allSizes, skipDuplicates: true });
  console.log("✅ Sizes seeded.");

  // --- 4. Seed Categories ---
  const mainCategories = ["Women", "Men", "Kids", "Unisex"];
  const subCategoryTypes = {
    Shoes: sizeGroups.Shoes,
    Hoodie: sizeGroups.Apparel,
    Pant: sizeGroups.Pants,
    Shirt: sizeGroups.Apparel,
    Accessories: sizeGroups.Accessories,
    Others: sizeGroups.Accessories, // Default to 'One Size'
  };

  for (const mainCatName of mainCategories) {
    const parentCategory = await prisma.category.upsert({
      where: { name: mainCatName },
      update: {},
      create: { name: mainCatName, isDeletable: false },
    });

    for (const [subCatName, sizesToLink] of Object.entries(subCategoryTypes)) {
      const uniqueSubCatName = `${mainCatName} ${subCatName}`;
      const subCategory = await prisma.category.upsert({
        where: { name: uniqueSubCatName },
        update: {},
        create: {
          name: uniqueSubCatName,
          parentId: parentCategory.id,
          isDeletable: true, // Sub-categories can be deleted
        },
      });

      // --- 5. Create Category-Size Relationships ---
      const sizesFromDb = await prisma.size.findMany({
        where: { value: { in: sizesToLink } },
      });

      const categorySizeData = sizesFromDb.map((size) => ({
        categoryId: subCategory.id,
        sizeId: size.id,
      }));

      await prisma.categorySize.createMany({
        data: categorySizeData,
        skipDuplicates: true,
      });
    }
  }
  console.log("✅ Categories seeded and linked to sizes.");

  // --- 6. Seed Example Products ---
  const exampleProducts = [
    {
      name: "Classic Unisex Hoodie",
      description: "A warm and stylish black hoodie for everyday wear.",
      categories: ["Unisex", "Unisex Hoodie"],
      variants: [
        { size: "M", color: "Black", price: 4999, stock: 50 },
        { size: "L", color: "Black", price: 4999, stock: 40 },
        { size: "S", color: "White", price: 4999, stock: 30 },
      ],
    },
    {
      name: "Women's Running Shoes",
      description: "Comfortable and durable sneakers for casual use.",
      categories: ["Women", "Women Shoes"],
      variants: [
        { size: "US-8", color: "White", price: 6999, stock: 30 },
        { size: "US-9", color: "Pink", price: 6999, stock: 20 },
      ],
    },
  ];

  for (const productData of exampleProducts) {
    // Check if a product with the same name already exists to avoid duplicates on re-seed
    const existingProduct = await prisma.product.findFirst({
      where: { name: productData.name },
    });
    if (existingProduct) continue;

    await prisma.product.create({
      data: {
        name: productData.name,
        description: productData.description,
        categories: {
          connect: productData.categories.map((cat) => ({ name: cat })),
        },
        variants: {
          create: await Promise.all(
            productData.variants.map(async (variant) => {
              const size = await prisma.size.findUniqueOrThrow({
                where: { value: variant.size },
              });
              const color = await prisma.color.findUniqueOrThrow({
                where: { name: variant.color },
              });
              return {
                sizeId: size.id,
                colorId: color.id,
                price: variant.price,
                stock: variant.stock,
              };
            })
          ),
        },
      },
    });
  }
  console.log("✅ Example products seeded.");
  console.log("🎉 Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
