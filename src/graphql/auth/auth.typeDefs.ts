import { gql } from "apollo-server-express";

// Use 'export default' instead of 'export const'
export default gql`
  # This is what the login mutation will return
  type AuthPayload {
    token: String!
    user: User!
  }

  type Mutation {
    # Takes email and password, returns a token and user info
    login(email: String!, password: String!): AuthPayload!
  }
`;
