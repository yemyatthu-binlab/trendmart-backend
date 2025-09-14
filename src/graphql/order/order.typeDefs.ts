export default `#graphql
  # ENUMS (from your Prisma schema)
  enum OrderStatus {
      PENDING_PAYMENT
      PROCESSING
      SHIPPED
      DELIVERED
      CANCELLED
  }

  enum ReturnReason {
    DAMAGED
    WRONG_ITEM
    SIZE_ISSUE
    OTHER
  }

  enum ReturnStatus {
    REQUESTED
    APPROVED
    REJECTED
    RETURNED
    REFUNDED
  }

  enum PaymentMethod {
    STRIPE
    MANUAL_UPLOAD
  }

  enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
    VERIFICATION_PENDING
  }

  # OBJECT TYPES
  type Address {
    id: ID!
    fullName: String!
    phoneNumber: String!
    addressLine1: String!
    city: String!
    postalCode: String!
  }

  type User {
    id: ID!
    email: String!
    phoneNumber: String
    fullName: String!
    role: UserRole!
    createdAt: String!
    addresses: [Address!]!
  }

  type Order {
    id: ID!
    orderTotal: Float!
    orderStatus: OrderStatus!
    createdAt: String!
    updatedAt: String!
    user: User!
    shippingAddress: Address!
    items: [OrderItem!]!
    payment: Payment
  }

  type OrderItem {
    id: ID!
    quantity: Int!
    priceAtPurchase: Float!
    productVariant: ProductVariant!
    product: Product!
    # NEW: Include the order it belongs to for easier traversal
    order: Order!
  }

  type Payment {
    id: ID!
    amount: Float!
    paymentMethod: PaymentMethod!
    paymentStatus: PaymentStatus!
    stripePaymentIntentId: String
    manualPaymentScreenshotUrl: String
    createdAt: String!
  }

  # NEW: Types for Return Requests
  type ReturnRequestImage {
    id: ID!
    imageUrl: String!
  }

  type ReturnRequest {
    id: ID!
    reason: ReturnReason!
    status: ReturnStatus!
    description: String
    createdAt: String!
    updatedAt: String!
    orderItem: OrderItem!
    images: [ReturnRequestImage!]!
  }

  # Response types for paginated queries
  type OrderListResponse {
    orders: [Order!]!
    totalCount: Int!
  }

  # NEW: Response type for paginated return requests
  type ReturnRequestListResponse {
    returnRequests: [ReturnRequest!]!
    totalCount: Int!
  }
  
  type UploadedFileResponse {
    url: String!
  }


  # INPUT TYPES
  input OrderItemInput {
    productVariantId: ID!
    quantity: Int!
  }

  input ShippingAddressInput {
    fullName: String!
    phoneNumber: String!
    addressLine1: String!
    city: String!
    postalCode: String!
  }

  input CreateOrderInput {
    items: [OrderItemInput!]!
    shippingAddress: ShippingAddressInput!
    shippingMethod: String!
    paymentMethod: String! # Frontend payment choice (e.g., "kpay")
    paymentScreenshotUrl: String!
    saveAddress: Boolean
  }

  input ReturnRequestItemInput {
    orderItemId: ID!
    reason: ReturnReason!
    description: String
    imageUrls: [String!]!
  }

  input CreateReturnRequestInput {
    items: [ReturnRequestItemInput!]!
    phoneNumber: String!
  }

  # QUERIES (Your existing queries are preserved)
  type Query {
    getOrders(skip: Int, take: Int, status: OrderStatus): OrderListResponse!
    getOrderById(id: ID!): Order
    getMyOrders(skip: Int, take: Int): OrderListResponse!
    getMyOrderById(id: ID!): Order
    findMyOrderForReturn(orderId: String!): Order

    # NEW: Queries for admin to manage returns
    getReturnRequests(skip: Int, take: Int, status: ReturnStatus): ReturnRequestListResponse!
    getReturnRequestById(id: ID!): ReturnRequest
    getMyReturnRequests(skip: Int, take: Int): ReturnRequestListResponse!
  }

  # MUTATIONS
  type Mutation {
    uploadPaymentScreenshot(file: Upload!): UploadedFileResponse!
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    createReturnRequest(input: CreateReturnRequestInput!): Boolean!
    uploadReturnImage(file: Upload!): UploadedFileResponse!
    # NEW: Mutation for admin to update return status
    updateReturnRequestStatus(returnRequestId: ID!, status: ReturnStatus!): ReturnRequest!
  }
`;
