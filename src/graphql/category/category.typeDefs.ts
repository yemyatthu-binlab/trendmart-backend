export default `#graphql
  type Category {
    id: ID!
    name: String!
    isDeletable: Boolean!
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

  type SuccessResponse {
    success: Boolean!
    message: String!
  }

  type Query {
    getCategoriesForManagement: [Category!]!
    getUnassignedSizesForCategory(subCategoryId: ID!): [Size!]! # Changed to subCategoryId for clarity
    getColorsForManagement: [Color!]!
  }

  type Mutation {
    # CATEGORY MUTATIONS
    createCategory(name: String!, parentId: Int): Category!
    updateCategory(id: ID!, name: String!): Category!
    deleteCategory(id: ID!): SuccessResponse!

    # SIZE MUTATIONS
    createSize(value: String!): Size!
    updateSize(id: ID!, value: String!): Size!
    deleteSize(id: ID!): SuccessResponse!
    
    # COLOR MUTATIONS
    createColor(name: String!, hexCode: String!): Color! # Made hexCode required
    updateColor(id: ID!, name: String, hexCode: String): Color!
    deleteColor(id: ID!): SuccessResponse!

    # SIZE ASSIGNMENT MUTATIONS
    assignSizesToSubCategory(subCategoryId: ID!, sizeIds: [Int!]!): Category!
    removeSizeFromSubCategory(subCategoryId: ID!, sizeId: ID!): Category!
  }
`;
