// src/graphql/schemas/order.typeDefs.ts

export default `#graphql
  # ENUMS (from your Prisma schema)
  enum OrderStatus {
    PENDING_PAYMENT
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
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
  # Note: User, Address, ProductVariant, etc., should be defined in their own typeDefs
  # and merged at the server level. We are defining the core Order types here.

  type Order {
    id: ID!
    orderTotal: Float! # We'll send this as a float (e.g., 59.99)
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
    priceAtPurchase: Float! # Price in cents from DB, converted to float
    productVariant: ProductVariant!
    product: Product! # <-- Add this line
  }

  type Payment {
    id: ID!
    amount: Float! # Amount in cents from DB, converted to float
    paymentMethod: PaymentMethod!
    paymentStatus: PaymentStatus!
    stripePaymentIntentId: String
    manualPaymentScreenshotUrl: String
    createdAt: String!
  }

  # Response type for paginated queries
  type OrderListResponse {
    orders: [Order!]!
    totalCount: Int!
  }

  # QUERIES
  type Query {
    getOrders(skip: Int, take: Int, status: OrderStatus): OrderListResponse!
    getOrderById(id: ID!): Order
  }
`;
