import { gql } from "apollo-server-express";

export default gql`
  # We need a base Query and Mutation type for others to extend
  type Query {
    _empty: String
    # Fetches the currently logged-in user (customer or admin)
    me: User
  }

  type Mutation {
    _empty: String
  }

  enum UserRole {
    ADMIN
    CUSTOMER
  }

  type User {
    id: ID!
    email: String!
    phoneNumber: String
    fullName: String!
    role: UserRole!
    createdAt: String!
  }

  # A standard payload to return after authentication
  type AuthPayload {
    token: String!
    user: User!
  }

  # Add customer-specific mutations by extending the base Mutation type
  extend type Mutation {
    requestRegistrationOtp(
      fullName: String!
      email: String!
      password: String!
    ): String! # Returns a success message
    
    verifyOtpAndCompleteRegistration(email: String!, otp: String!): AuthPayload!

    customerLogin(email: String!, password: String!): AuthPayload!
  }
`;
