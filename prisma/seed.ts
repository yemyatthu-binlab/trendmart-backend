import { prisma } from "../src/prismaClient";
import bcrypt from "bcryptjs";

// Helper function to get a random item from an array
// Added a non-null assertion (!) to fix the TypeScript error,
// as we ensure the array is not empty before calling this.
const getRandomItem = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)]!;
};

const CustomerNameList = [
  "Mg Mg",
  "Ag Ag",
  "Kg Kg",
  "Zaw Zaw",
  "Nay Nay",
  "Hla Hla",
];

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
    { name: "Navy", hexCode: "#000080" },
    { name: "Maroon", hexCode: "#800000" },
  ];
  await prisma.color.createMany({ data: colors, skipDuplicates: true });
  console.log("✅ Colors seeded.");

  // --- 3. Seed Sizes ---
  const sizeGroups = {
    Shoes: ["US-6", "US-7", "US-8", "US-9", "US-10"],
    Apparel: ["S", "M", "L", "XL", "XXL"],
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
    Others: sizeGroups.Accessories,
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
          isDeletable: true,
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

  // --- 6. Seed NEW Men's Hoodies ---
  console.log("👕 Seeding new Men's Hoodies...");
  const hoodieImageUrl =
    "https://thirsty-jade-mollusk.myfilebase.com/ipfs/QmbfqA4JVUxfNY3NPEuPpg2XuAtm73a6NeYmbHKAgq72ny";
  const menHoodieCategory = await prisma.category.findUniqueOrThrow({
    where: { name: "Men Hoodie" },
  });
  const sizeL = await prisma.size.findUniqueOrThrow({ where: { value: "L" } });
  const hoodieColors = await prisma.color.findMany({
    where: { name: { in: ["Black", "Gray", "Navy", "Maroon", "Blue"] } },
  });

  const hoodieProducts = [
    { name: "Essential Urban Hoodie", color: "Black", price: 4999 },
    { name: "Premium Fleece Hoodie", color: "Gray", price: 5999 },
    { name: "Street Style Pullover", color: "Navy", price: 5499 },
    { name: "Athletic Tech Hoodie", color: "Black", price: 6500 },
    { name: "Minimalist Comfort Hoodie", color: "Maroon", price: 4999 },
    { name: "Classic Logo Hoodie", color: "Blue", price: 5250 },
    { name: "All-Season Zip Hoodie", color: "Gray", price: 6999 },
    { name: "Heavyweight Graphic Hoodie", color: "Black", price: 7500 },
    { name: "Everyday Performance Hoodie", color: "Navy", price: 5800 },
    { name: "Vintage Wash Hoodie", color: "Maroon", price: 6299 },
  ];

  for (const productData of hoodieProducts) {
    const color = hoodieColors.find((c) => c.name === productData.color);
    if (!color) {
      console.warn(`Color ${productData.color} not found. Skipping product.`);
      continue;
    }

    // FIXED: Changed from upsert to findFirst/create because 'name' is not a unique field.
    const existingProduct = await prisma.product.findFirst({
      where: { name: productData.name },
    });

    if (existingProduct) {
      console.log(`- Product "${productData.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: productData.name,
        description: `A high-quality and comfortable ${productData.name}. Perfect for any occasion.`,
        categories: {
          connect: [
            { id: menHoodieCategory.id },
            { id: menHoodieCategory.parentId! },
          ],
        },
        variants: {
          create: {
            sizeId: sizeL.id,
            colorId: color.id,
            price: productData.price, // Using Int as per your schema
            stock: 100,
            images: {
              create: {
                imageUrl: hoodieImageUrl,
                isPrimary: true,
                altText: productData.name,
              },
            },
          },
        },
      },
    });
  }
  console.log("✅ 10 new Men's Hoodies seeded.");

  // --- 7. Seed Customers and Addresses ---
  console.log("👨‍👩‍👧‍👦 Seeding customers...");
  const customers: {
    id: number;
    fullName: string;
    email: string;
    passwordHash: string;
    phoneNumber: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  for (let i = 1; i <= 5; i++) {
    const customer = {
      email: `customer${i}@example.com`,
      fullName: `${CustomerNameList[i]}`,
      passwordHash: await bcrypt.hash("password123", 10),
      phoneNumber: `0998765432${i}`,
      role: "CUSTOMER" as const,
      addresses: {
        create: {
          fullName: `${CustomerNameList[i] || "Customer"} ${i}`,
          phoneNumber: `0998765432${i}`,
          addressLine1: `${i * 123} Main St`,
          city: "Yangon",
          state: "Yangon Region",
          postalCode: `${11100 + i}`,
          isDefault: true,
        },
      },
    };

    const newCustomer = await prisma.user.upsert({
      where: { email: customer.email },
      update: {},
      create: customer,
    });
    customers.push(newCustomer);
  }
  console.log("✅ 5 new customers with addresses seeded.");

  // --- 8. Seed Orders ---
  console.log("🛒 Seeding orders...");
  const createdUsers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    include: { addresses: true },
  });
  const availableVariants = await prisma.productVariant.findMany();

  if (createdUsers.length > 0 && availableVariants.length > 0) {
    for (let i = 0; i < 7; i++) {
      const user = getRandomItem(createdUsers);
      const shippingAddress =
        user.addresses.find((a) => a.isDefault) || user.addresses[0];
      if (!shippingAddress) continue;

      const variant = getRandomItem(availableVariants);
      const quantity = Math.floor(Math.random() * 2) + 1;
      // FIXED: Removed Prisma.Decimal and used plain integer multiplication
      const orderTotal = variant.price * quantity;

      await prisma.order.create({
        data: {
          userId: user.id,
          shippingAddressId: shippingAddress.id,
          orderTotal: orderTotal, // Stored as a Decimal in DB, but input is number
          orderStatus: getRandomItem(["PROCESSING", "SHIPPED", "DELIVERED"]),
          items: {
            create: {
              productVariantId: variant.id,
              quantity: quantity,
              priceAtPurchase: variant.price,
            },
          },
          payment: {
            create: {
              amount: orderTotal, // This is an Int in your schema
              paymentMethod: getRandomItem(["STRIPE", "MANUAL_UPLOAD"]),
              paymentStatus: "COMPLETED",
            },
          },
        },
      });
    }
    console.log("✅ 7 new orders seeded.");
  } else {
    console.warn(
      "Could not seed orders because no customers or product variants were found."
    );
  }

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
