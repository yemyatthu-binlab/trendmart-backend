import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";
import { UserInputError, AuthenticationError } from "apollo-server-express";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import type { FileUpload } from "graphql-upload-ts";
import OrderNotificationTemplate from "../../emails/OrderNotificationTemplate";

const s3Client = new S3Client({
  endpoint: "https://s3.filebase.com",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
  },
});

// Helper to convert a readable stream to a buffer
const streamToBuffer = (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address from .env file
    pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password from .env file
  },
});

const shippingCosts: { [key: string]: number } = {
  ninjavan: 3500,
  royal: 3000,
  bee: 3200,
};

export default {
  Query: {
    getOrders: async (
      _: any,
      {
        skip = 0,
        take = 10,
        status,
      }: { skip?: number; take?: number; status?: string }
    ) => {
      const whereClause = status ? { orderStatus: status as OrderStatus } : {};

      const [orders, totalCount] = await prisma.$transaction([
        prisma.order.findMany({
          skip,
          take,
          where: whereClause,
          orderBy: { createdAt: "desc" },
          include: {
            user: true, // Fetch the user associated with the order
            items: true, // Fetch the order items
          },
        }),
        prisma.order.count({ where: whereClause }),
      ]);

      // Convert Decimal to Float for GraphQL response
      const formattedOrders = orders.map((order) => ({
        ...order,
        orderTotal: parseFloat(order.orderTotal.toString()),
      }));

      return {
        orders: formattedOrders,
        totalCount,
      };
    },

    getOrderById: async (_: any, { id }: { id: string }) => {
      const order = await prisma.order.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
          user: true,
          shippingAddress: true,
          payment: true,
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                  size: true,
                  color: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new GraphQLError("Order not found.", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Convert all Decimal/Int price fields to Float for GraphQL
      return {
        ...order,
        orderTotal: parseFloat(order.orderTotal.toString()),
        payment: order.payment
          ? {
              ...order.payment,
              amount: order.payment.amount, // Convert cents to dollars
            }
          : null,
        items: order.items.map((item) => ({
          ...item,
          priceAtPurchase: item.priceAtPurchase, // Convert cents to dollars
        })),
      };
    },
    getMyOrders: async (
      _: any,
      { skip = 0, take = 10 }: { skip?: number; take?: number },
      context: { userId?: number } // Assuming userId is in context after login
    ) => {
      // 1. Authentication Check
      if (!context.userId) {
        throw new GraphQLError("You must be logged in to view your orders.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // 2. Database Query
      const whereClause = { userId: context.userId };

      const [orders, totalCount] = await prisma.$transaction([
        prisma.order.findMany({
          skip,
          take,
          where: whereClause,
          orderBy: { createdAt: "desc" },
          include: {
            // We only need a few details for the list view
            items: {
              select: { id: true }, // Just to get a count of items
            },
          },
        }),
        prisma.order.count({ where: whereClause }),
      ]);

      // 3. Format Response
      const formattedOrders = orders.map((order) => ({
        ...order,
        orderTotal: parseFloat(order.orderTotal.toString()),
      }));

      return {
        orders: formattedOrders,
        totalCount,
      };
    },
    getMyOrderById: async (
      _: any,
      { id }: { id: string },
      context: { userId?: number } // Assuming userId is in context
    ) => {
      // 1. Authentication Check
      if (!context.userId) {
        throw new GraphQLError("You must be logged in to view your order.", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // 2. Database Query
      const order = await prisma.order.findUnique({
        where: {
          id: parseInt(id, 10),
          // SECURITY: Ensure the order belongs to the logged-in user
          userId: context.userId,
        },
        include: {
          user: true,
          shippingAddress: true,
          payment: true,
          items: {
            include: {
              productVariant: {
                include: {
                  product: true,
                  size: true,
                  color: true,
                  images: {
                    take: 1, // Get one representative image
                  },
                },
              },
            },
          },
        },
      });

      // 3. Not Found Check
      if (!order) {
        throw new GraphQLError(
          "Order not found or you do not have permission to view it.",
          {
            extensions: { code: "NOT_FOUND" },
          }
        );
      }

      // 4. Format Response (same as your admin getOrderById)
      return {
        ...order,
        orderTotal: parseFloat(order.orderTotal.toString()),
        payment: order.payment
          ? {
              ...order.payment,
              amount: order.payment.amount,
            }
          : null,
        items: order.items.map((item) => ({
          ...item,
          priceAtPurchase: item.priceAtPurchase,
        })),
      };
    },
  },
  OrderItem: {
    product: (parent: any) => {
      return parent.productVariant.product;
    },
  },
  Mutation: {
    /**
     * Handles the file upload to Filebase S3-compatible storage.
     */
    uploadPaymentScreenshot: async (
      _: any,
      { file }: { file: Promise<FileUpload> }
    ) => {
      const { createReadStream, filename, mimetype } = await file;
      if (!mimetype.startsWith("image/")) {
        throw new UserInputError("File must be an image.");
      }

      const stream = createReadStream();
      const uniqueFilename = `${uuidv4()}-${filename}`;
      const buffer = await streamToBuffer(stream);

      const command = new PutObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET!,
        Key: uniqueFilename,
        Body: buffer,
        ContentType: mimetype,
      });

      try {
        await s3Client.send(command);
        const url = `https://${process.env.FILEBASE_BUCKET}.s3.filebase.com/${uniqueFilename}`;
        return { url };
      } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload payment screenshot.");
      }
    },

    /**
     * Creates the order in the database within a transaction.
     */
    createOrder: async (
      _: any,
      { input }: any,
      { userId }: { userId?: number }
    ) => {
      if (!userId) {
        throw new AuthenticationError(
          "You must be logged in to place an order."
        );
      }

      const {
        items,
        shippingAddress,
        shippingMethod,
        paymentMethod,
        paymentScreenshotUrl,
        saveAddress,
      } = input;

      if (!items || items.length === 0) {
        throw new UserInputError("Cannot create an order with no items.");
      }

      try {
        const newOrder = await prisma.$transaction(async (tx) => {
          // 1. Fetch variants, validate stock, and calculate subtotal
          const variantIds = items.map((item: any) =>
            parseInt(item.productVariantId)
          );
          const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
          });

          let subtotal = 0;
          for (const item of items) {
            const variant = variants.find(
              (v) => v.id === parseInt(item.productVariantId)
            );
            if (!variant) {
              throw new UserInputError(
                `Product variant with ID ${item.productVariantId} not found.`
              );
            }
            if (variant.stock < item.quantity) {
              throw new UserInputError(
                `Not enough stock for variant. Available: ${variant.stock}, Requested: ${item.quantity}.`
              );
            }
            subtotal += variant.price * item.quantity;
          }

          const orderTotal = subtotal;
          let shippingAddressRecord;

          const lastAddress = await tx.address.findFirst({
            where: { userId },
            orderBy: { id: "desc" }, // or createdAt if you add it
          });
          if (lastAddress) {
            shippingAddressRecord = await tx.address.update({
              where: { id: lastAddress.id },
              data: {
                fullName: shippingAddress.fullName,
                phoneNumber: shippingAddress.phoneNumber,
                addressLine1: shippingAddress.addressLine1,
                city: shippingAddress.city,
                state: shippingAddress.state || null,
                postalCode: shippingAddress.postalCode,
                isDefault: saveAddress ?? false,
              },
            });
          } else {
            shippingAddressRecord = await tx.address.create({
              data: {
                userId,
                fullName: shippingAddress.fullName,
                phoneNumber: shippingAddress.phoneNumber,
                addressLine1: shippingAddress.addressLine1,
                city: shippingAddress.city,
                state: shippingAddress.state || null,
                postalCode: shippingAddress.postalCode,
                isDefault: saveAddress ?? false,
              },
            });
          }

          // 3. Create the Order, OrderItems, and Payment records
          const order = await tx.order.create({
            data: {
              userId,
              shippingAddressId: shippingAddressRecord.id,
              orderTotal,
              orderStatus: "PENDING_PAYMENT",
              items: {
                create: items.map((item: any) => {
                  const variant = variants.find(
                    (v) => v.id === parseInt(item.productVariantId)
                  );
                  return {
                    productVariantId: parseInt(item.productVariantId),
                    quantity: item.quantity,
                    priceAtPurchase: variant!.price,
                  };
                }),
              },
              payment: {
                create: {
                  amount: orderTotal,
                  paymentMethod: "MANUAL_UPLOAD",
                  paymentStatus: "VERIFICATION_PENDING",
                  manualPaymentScreenshotUrl: paymentScreenshotUrl,
                },
              },
            },
            include: {
              items: { include: { productVariant: true } },
              payment: true,
              shippingAddress: true,
            },
          });

          // 4. Decrement stock for each variant
          for (const item of items) {
            await tx.productVariant.update({
              where: { id: parseInt(item.productVariantId) },
              data: { stock: { decrement: item.quantity } },
            });
          }

          // 5. Clear ordered items from the user's cart
          await tx.cartItem.deleteMany({
            where: { userId: userId, productVariantId: { in: variantIds } },
          });

          return order;
        });
        const emailHtml = await render(
          OrderNotificationTemplate({
            orderId: newOrder.id,
            orderTotal: parseFloat(newOrder.orderTotal.toString()),
            customerName: shippingAddress.fullName,
          })
        );

        await transporter.sendMail({
          from: `"TrendMart" <${process.env.GMAIL_USER}>`,
          to: process.env.ADMIN_MAIL,
          subject: `New Order #${newOrder.id} Received`,
          html: emailHtml,
        });

        return newOrder;
      } catch (error) {
        console.error("Order creation failed:", error);
        if (error instanceof UserInputError) throw error;
        throw new Error("Could not place your order. Please try again.");
      }
    },
    updateOrderStatus: async (
      _: any,
      { orderId, status }: { orderId: number; status: string },
      { userId }: { userId?: number }
    ) => {
      if (!userId) {
        throw new AuthenticationError(
          "You must be logged in to update an order."
        );
      }

      try {
        // 1. Fetch the order
        const order = await prisma.order.findUnique({
          where: { id: Number(orderId) },
          include: {
            items: { include: { productVariant: true } },
            payment: true,
            shippingAddress: true,
          },
        });

        if (!order) {
          throw new UserInputError(`Order with ID ${orderId} not found.`);
        }

        const updatedOrder = await prisma.order.update({
          where: { id: Number(orderId) },
          data: { orderStatus: status as OrderStatus },
          include: {
            items: { include: { productVariant: true } },
            payment: true,
            shippingAddress: true,
          },
        });

        // 3. Optional: If status is CANCELLED, you may want to restore stock
        if (status === "CANCELLED") {
          for (const item of updatedOrder.items) {
            await prisma.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        return updatedOrder;
      } catch (error) {
        console.error("Order status update failed:", error);
        if (error instanceof UserInputError) throw error;
        throw new Error("Could not update order status. Please try again.");
      }
    },
  },
};
