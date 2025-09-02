import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Heading,
  Section,
} from "@react-email/components";

interface OrderNotificationTemplateProps {
  orderId: number;
  orderTotal: number;
  customerName: string;
}

export default function OrderNotificationTemplate({
  orderId,
  orderTotal,
  customerName,
}: OrderNotificationTemplateProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>New Order Received!</Heading>
          <Section>
            <Text>Order ID: #{orderId}</Text>
            <Text>Customer: {customerName}</Text>
            <Text>Total Amount: ${(orderTotal / 100).toFixed(2)}</Text>
            <Text>
              Please check the admin dashboard to verify the payment screenshot.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
