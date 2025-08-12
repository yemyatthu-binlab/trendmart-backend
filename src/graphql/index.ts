import path from "path";
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";

// Point to the directory where your GraphQL files are
const typesArray = loadFilesSync(path.join(__dirname, "**/*.typeDefs.ts"));
const resolversArray = loadFilesSync(path.join(__dirname, "**/*.resolvers.ts"));


// Merge them
export const typeDefs = mergeTypeDefs(typesArray);
export const resolvers = mergeResolvers(resolversArray);
