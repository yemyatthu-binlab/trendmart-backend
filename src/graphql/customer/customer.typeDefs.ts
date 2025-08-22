export default `#graphql
  # ... your existing enums and object types (User, Address, etc.)

  enum UserRole {
    ADMIN
    CUSTOMER
  }

  type User {
    id: ID!
    fullName: String!
    email: String!
    phoneNumber: String
    role: UserRole!
    createdAt: String!
    updatedAt: String!
    addresses: [Address!]
  }

  type Address {
    id: ID!
    fullName: String!
    phoneNumber: String!
    addressLine1: String!
    addressLine2: String
    city: String!
    state: String!
    postalCode: String!
    isDefault: Boolean
  }

  type CustomerListResponse {
    customers: [User!]!
    totalCount: Int!
  }

  # Extend the main Query type
  extend type Query {
    getCustomers(skip: Int, take: Int): CustomerListResponse
    # ✨ NEW: Query definition for a single customer
    getCustomerById(id: ID!): User
  }
`;
