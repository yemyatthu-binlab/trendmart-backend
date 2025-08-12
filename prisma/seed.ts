import { prisma } from "../src/prismaClient";
import bcrypt from "bcryptjs";

async function main() {
  // Your desired admin users
  const admins = [
    {
      fullName: "Admin One",
      phoneNumber: "0912345678",
      email: "admin1@gmail.com",
      passwordHash: await bcrypt.hash("password", 10),
      role: "ADMIN" as const,
    },
    {
      fullName: "Admin Two",
      phoneNumber: "0998765432",
      email: "admin2@example.com",
      passwordHash: await bcrypt.hash("password", 10),
      role: "ADMIN" as const,
    },
  ];

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {}, // no update — keep existing
      create: admin,
    });
  }

  console.log("✅ User seeded.");

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
  await prisma.color.createMany({
    data: colors,
    skipDuplicates: true, // Avoid errors on re-running the seed
  });

  console.log("✅ Colors seeded.");

  const sizes = [
    // Shoes
    "SHOES_US_6",
    "SHOES_US_7",
    "SHOES_US_8",
    "SHOES_US_9",
    "SHOES_US_10",
    // Apparel
    "HOODIE_S",
    "HOODIE_M",
    "HOODIE_L",
    "HOODIE_XL",
    "PANT_28",
    "PANT_30",
    "PANT_32",
    "PANT_34",
    "SHIRT_S",
    "SHIRT_M",
    "SHIRT_L",
    "SHIRT_XL",
    // Accessories
    "ACCESSORIES_XS",
    "ACCESSORIES_S",
    "ACCESSORIES_M",
    "ACCESSORIES_L",
    "ACCESSORIES_XL",
  ].map((value) => ({ value }));

  await prisma.size.createMany({
    data: sizes,
    skipDuplicates: true,
  });
  console.log("✅ Sizes seeded.");

  const mainCategories = ["Women", "Men", "Kids"];
  const subCategories = [
    "Shoes",
    "Hoodie",
    "Pant",
    "Shirt",
    "Accessories",
    "Others",
  ];

  for (const mainCatName of mainCategories) {
    let parentCategory = await prisma.category.findUnique({
      where: { name: mainCatName },
    });
    if (!parentCategory) {
      parentCategory = await prisma.category.create({
        data: { name: mainCatName },
      });
      console.log(`Created parent category: ${mainCatName}`);
    }

    for (const subCatName of subCategories) {
      const uniqueSubCatName = `${mainCatName} ${subCatName}`; // e.g., "Women Shoes"
      await prisma.category.upsert({
        where: { name: uniqueSubCatName },
        update: {},
        create: {
          name: uniqueSubCatName,
          parentId: parentCategory.id,
        },
      });
    }
    console.log(`✅ Seeded subcategories for ${mainCatName}.`);
  }
  console.log("✅ Categories seeded.");

  const exampleProducts = [
    {
      name: "Classic Black Hoodie",
      description: "A warm and stylish black hoodie for everyday wear.",
      categories: ["Men Hoodie"],
      variants: [
        { size: "HOODIE_M", color: "Black", price: 4999, stock: 50 },
        { size: "HOODIE_L", color: "Black", price: 4999, stock: 40 },
      ],
    },
    {
      name: "White Sneakers",
      description: "Comfortable and durable sneakers for casual use.",
      categories: ["Women Shoes"],
      variants: [
        { size: "SHOES_US_8", color: "White", price: 6999, stock: 30 },
        { size: "SHOES_US_9", color: "White", price: 6999, stock: 20 },
      ],
    },
  ];

  for (const product of exampleProducts) {
    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        categories: {
          connect: product.categories.map((cat) => ({ name: cat })),
        },
        variants: {
          create: await Promise.all(
            product.variants.map(async (variant) => {
              const size = await prisma.size.findUnique({
                where: { value: variant.size },
              });
              const color = await prisma.color.findUnique({
                where: { name: variant.color },
              });
              return {
                sizeId: size!.id,
                colorId: color!.id,
                price: variant.price,
                stock: variant.stock,
              };
            })
          ),
        },
      },
    });
    console.log("✅ Added one product");
  }

  console.log("✅ Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
