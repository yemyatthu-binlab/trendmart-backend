// src/index.ts
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./graphql/index";
import { resolvers } from "./graphql/index";
import dotenv from "dotenv";
import cors from "cors";
import { graphqlUploadExpress } from "graphql-upload-ts";

// Load environment variables
dotenv.config();

const startServer = async () => {
  const app = express();
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();
  app.use(cors());
  app.use(express.json());

  server.applyMiddleware({ app, path: "/graphql" });

  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(
      `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    console.log(
      `🚀 
      pr`,
      process.env.DATABASE_URL
    );
  });
};

startServer();
