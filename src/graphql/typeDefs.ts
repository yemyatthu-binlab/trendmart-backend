// src/graphql/typeDefs.ts
import { gql } from "apollo-server-express";

export const typeDefs = gql`
  # We only define what's needed for login for now
  enum UserRole {
    ADMIN
    CUSTOMER
  }

  type User {
    id: ID!
    email: String!
    fullName: String!
    role: UserRole!
    phone_number: string!
  }

  # This is what the login mutation will return
  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    # Placeholder query, Apollo Server needs at least one
    _empty: String
  }

  type Mutation {
    # Takes email and password, returns a token and user info
    login(email: String!, password: String!): AuthPayload!
  }
`;
