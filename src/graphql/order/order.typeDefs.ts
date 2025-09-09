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
  # Note: Assuming User, Product, Address, and ProductVariant are defined elsewhere or here.

  # This Address type is required by the 'Order' type below.
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
    addresses: [Address!]!   # <-- NEW FIELD
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

  # Response type for your existing paginated queries
  type OrderListResponse {
    orders: [Order!]!
    totalCount: Int!
  }

  # NEW: Response type for the file upload mutation
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
  }

  # NEW: MUTATIONS for creating an order
  type Mutation {
    """
    Uploads a payment screenshot file and returns its public URL.
    """
    uploadPaymentScreenshot(file: Upload!): UploadedFileResponse!

    """
    Creates a new order after validating stock, address, and payment info.
    """
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    createReturnRequest(input: CreateReturnRequestInput!): Boolean!
    uploadReturnImage(file: Upload!): UploadedFileResponse!
  }
`;
