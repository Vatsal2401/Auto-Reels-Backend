import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface PaymentSuccessEmailProps {
  userFirstname?: string;
  planName?: string;
  amount?: string;
  currency?: string;
  orderId?: string;
}

export const PaymentSuccessEmail = ({
  userFirstname = 'there',
  planName = 'Credits',
  amount = '0.00',
  currency = 'USD',
  orderId = '',
}: PaymentSuccessEmailProps) => (
  <Html>
    <Head />
    <Preview>Payment Receipt - Auto Reels</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment Successful! 🎉</Heading>
        <Text style={text}>Hi {userFirstname},</Text>
        <Text style={text}>
          Thank you for your purchase. We've successfully processed your payment for the **{planName}** plan. 
          Your credits have been added to your account and are ready to use!
        </Text>
        <Section style={receiptContainer}>
          <Text style={receiptTitle}>Order Summary</Text>
          <Hr style={hr} />
          <Text style={receiptRow}>
            <strong>Plan:</strong> {planName}
          </Text>
          <Text style={receiptRow}>
            <strong>Amount Paid:</strong> {amount} {currency}
          </Text>
          <Text style={receiptRow}>
            <strong>Order ID:</strong> {orderId}
          </Text>
        </Section>
        <Text style={text}>
          You can now go back to Auto Reels and start creating more amazing videos.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          © {new Date().getFullYear()} Auto Reels. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default PaymentSuccessEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#4f46e5',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  padding: '0 40px',
};

const receiptContainer = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '32px 40px',
  padding: '24px',
  border: '1px solid #e5e7eb',
};

const receiptTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#111827',
  margin: '0 0 12px 0',
};

const receiptRow = {
  fontSize: '14px',
  color: '#4b5563',
  margin: '8px 0',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  padding: '0 40px',
};
