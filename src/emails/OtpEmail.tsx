import * as React from "react";

interface OtpEmailTemplateProps {
  otp: string;
}

export const OtpEmailTemplate: React.FC<Readonly<OtpEmailTemplateProps>> = ({
  otp,
}) => (
  <div style={styles.container}>
    <h1 style={styles.logo}>TrendMart</h1>
    <h2 style={styles.title}>Your Verification Code</h2>
    <p style={styles.text}>
      Welcome! Please use the following code to complete your registration. This
      code is valid for 10 minutes.
    </p>
    <div style={styles.otpContainer}>
      <p style={styles.otp}>{otp}</p>
    </div>
    <p style={styles.footer}>
      If you did not request this code, please ignore this email.
    </p>
  </div>
);

const styles = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    backgroundColor: "#ffffff",
    margin: "auto",
    padding: "40px 20px",
    maxWidth: "465px",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    textAlign: "center" as const,
  },
  logo: {
    color: "#000000",
    fontSize: "28px",
    fontWeight: 800,
    margin: "0 0 20px",
  },
  title: {
    color: "#000000",
    fontSize: "24px",
    fontWeight: 600,
    margin: "0 0 15px",
  },
  text: {
    color: "#555555",
    fontSize: "14px",
    lineHeight: "24px",
    margin: "0 0 20px",
  },
  otpContainer: {
    padding: "20px 0",
  },
  otp: {
    color: "#000000",
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "0.5em",
    margin: 0,
    padding: "0 1em",
  },
  footer: {
    color: "#999999",
    fontSize: "12px",
    lineHeight: "22px",
    marginTop: "20px",
  },
};
