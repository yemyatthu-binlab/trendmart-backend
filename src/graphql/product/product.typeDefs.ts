
export default `#graphql
  # ENUMS
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  # OBJECT TYPES
  type Product {
    id: ID!
    name: String!
    description: String
    createdAt: String!
    updatedAt: String!
    variants: [ProductVariant]
    categories: [Category!]
  }

  type ProductVariant {
    id: ID!
    sku: String
    price: Float!
    stock: Int!
    discountPercentage: Float
    size: Size!
    color: Color!
    images: [ProductImage!]
  }

  type ProductImage {
    id: ID!
    imageUrl: String!
    altText: String
    isPrimary: Boolean!
  }

  type Category {
    id: ID!
    name: String!
    parent: Category
    children: [Category!]
  }

  type Size {
    id: ID!
    value: String!
  }

  type Color {
    id: ID!
    name: String!
    hexCode: String
  }

  # INPUT TYPES for Mutations
  input CreateProductImageInput {
    imageUrl: String!
    altText: String
    isPrimary: Boolean!
  }

  input CreateProductVariantInput {
    sizeId: Int!
    colorId: Int!
    sku: String
    price: Float! # We'll handle conversion to cents in the resolver
    stock: Int!
    discountPercentage: Float
    images: [CreateProductImageInput!]!
  }

  input CreateProductInput {
    name: String!
    description: String
    categoryIds: [Int!]!
    variants: [CreateProductVariantInput!]!
  }

  # QUERIES & MUTATIONS
  type Query {
    getProducts: [Product]
    getCategories: [Category!]
    getSizes: [Size!]
    getColors: [Color!]
  }

  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    createCategory(name: String!, parentId: Int): Category!
  }
`;
