import { prisma } from "../../prismaClient";
import { comparePassword, generateToken } from "../../util/auth";

export default {
  Mutation: {
    login: async (_parent: any, args: any) => {
      const { email, password } = args;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("Invalid credentials");
      }
      const isPasswordValid = await comparePassword(
        password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        throw new Error("Invalid credentials");
      }
      const token = generateToken(user.id, user.role);
      return { token, user };
    },
  },
};
