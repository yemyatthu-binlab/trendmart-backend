import { gql } from "apollo-server-express";

// Use 'export default' instead of 'export const'
export default gql`
  # We need a base Query and Mutation type for others to extend
  type Query {
    _empty: String
  }

  enum UserRole {
    ADMIN
    CUSTOMER
  }

  type User {
    id: ID!
    email: String!
    phoneNumber: String!
    fullName: String!
    role: UserRole!
  }
`;