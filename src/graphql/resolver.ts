// // src/graphql/resolvers.ts
// import { prisma } from "../prismaClient";
// import { comparePassword, generateToken } from "./../util/auth";

// export const resolvers = {
//   Query: {
//     _empty: () => "Hello!",
//   },
//   Mutation: {
//     login: async (_parent: any, args: any) => {
//       const { email, password } = args;

//       // 1. Find the user by email
//       const user = await prisma.user.findUnique({ where: { email } });
//       if (!user) {
//         throw new Error("Invalid credentials");
//       }

//       // 2. Check if the user is an admin (optional, but good for an admin login)
//       // if (user.role !== UserRole.ADMIN) {
//       //   throw new Error('Access denied. Not an admin.');
//       // }

//       // 3. Compare the provided password with the stored hash
//       const isPasswordValid = await comparePassword(
//         password,
//         user.password_hash
//       );
//       if (!isPasswordValid) {
//         throw new Error("Invalid credentials");
//       }

//       // 4. Generate a JWT
//       const token = generateToken(user.id, user.role);

//       // 5. Return the token and user data
//       return {
//         token,
//         user,
//       };
//     },
//   },
// };
