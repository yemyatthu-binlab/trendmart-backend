export default `#graphql
  # ENUMS
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  scalar Upload

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

  # Add this type for the paginated response
  type ProductListResponse {
    products: [Product!]!
    totalCount: Int!
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
    sizes: [Size!]
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

  type UploadedImage {
    url: String!
    filename: String!
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
    price: Float!
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

  # --- Add Input Types for Update ---
  input UpdateProductImageInput {
    id: ID # Required for existing images
    imageUrl: String!
    altText: String
    isPrimary: Boolean!
  }

  input UpdateProductVariantInput {
    id: ID # Required for existing variants
    sizeId: Int!
    colorId: Int!
    sku: String
    price: Float!
    stock: Int!
    discountPercentage: Float
    images: [UpdateProductImageInput!]!
  }

  input UpdateProductInput {
    name: String
    description: String
    categoryIds: [Int!]
    variants: [UpdateProductVariantInput!]
  }


  # QUERIES & MUTATIONS
  type Query {
    getProducts(skip: Int, take: Int): ProductListResponse
    getProductById(id: ID!): Product
    getCategories: [Category!]
    getSizes: [Size!]
    getColors: [Color!]
    getMainSubCategories: [Category!]!
  }

  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    # --- Add Update and Delete Mutations ---
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Product!
    createCategory(name: String!, parentId: Int): Category!
    createColor(name: String!, hexCode: String!): Color!
    uploadImage(file: Upload!): UploadedImage!
  }
`;
