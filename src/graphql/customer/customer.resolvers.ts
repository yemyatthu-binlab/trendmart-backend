import { prisma } from "../../prismaClient";
import { GraphQLError } from "graphql";

export default {
  Query: {
    // ... your existing getCustomers resolver
    getCustomers: async (
      _: any,
      { skip = 0, take = 10 }: { skip?: number; take?: number }
    ) => {
      const [prismaCustomers, totalCount] = await prisma.$transaction([
        prisma.user.findMany({
          where: { role: "CUSTOMER" },
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: { addresses: true },
        }),
        prisma.user.count({ where: { role: "CUSTOMER" } }),
      ]);

      const customers = prismaCustomers.map((customer) => ({
        ...customer,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      }));

      return { customers, totalCount };
    },

    // ✨ NEW: Resolver for fetching a single customer
    getCustomerById: async (_: any, { id }: { id: string }) => {
      const customer = await prisma.user.findUnique({
        where: {
          id: Number(id),
          role: "CUSTOMER", // Ensure the user is a customer
        },
        include: {
          addresses: true, // Include their addresses
        },
      });

      if (!customer) {
        throw new GraphQLError("Customer not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Format dates
      return {
        ...customer,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      };
    },
  },
};
