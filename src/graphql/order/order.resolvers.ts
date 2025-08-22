// src/graphql/resolvers/order.resolvers.ts

import { OrderStatus } from "@prisma/client";
import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";

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
  },
  OrderItem: {
    product: (parent) => {
      // 'parent' is the 'item' object returned from your Prisma query.
      // The product data is already nested inside it. We just point to it.
      return parent.productVariant.product;
    },
  },
};
