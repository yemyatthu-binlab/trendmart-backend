import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserInputError } from "apollo-server-express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";

import { prisma } from "../../prismaClient";
import { OtpEmailTemplate } from "../../emails/OtpEmail";

const generateOtp = () => crypto.randomInt(100000, 999999).toString();
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key";

// --- Nodemailer Configuration ---
// We configure a "transporter" which is the object that will send the emails.
// We're using Gmail here. You'll need to set up an "App Password" for your
// Gmail account for this to work.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address from .env file
    pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password from .env file
  },
});
// ------------------------------

export default {
  Query: {
    /**
     * Retrieves the currently authenticated user from the context.
     * The user ID is added to the context by your server's auth middleware.
     */
    me: async (_: any, __: any, { userId }: { userId?: number }) => {
      if (!userId) {
        return null; // No user is logged in
      }
      return prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
        },
      });
    },
  },
  User: {
    // Ensure addresses resolve correctly
    addresses: async (parent: any) => {
      return prisma.address.findMany({
        where: { userId: parent.id },
        orderBy: { id: "desc" }, // or createdAt
        take: 1,
      });
    },
  },
  Mutation: {
    requestRegistrationOtp: async (
      _: any,
      { fullName, email, password }: any
    ) => {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.emailVerifiedAt) {
        throw new UserInputError("An account with this email already exists.");
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const otp = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      if (existingUser && existingUser.emailVerifiedAt) {
        throw new UserInputError(
          "This email is already verified. Please login."
        );
      }
      // Upsert: Create user if not exist, or update OTP for unverified user
      await prisma.user.upsert({
        where: { email },
        update: {
          passwordHash: hashedPassword,
          fullName,
          otpSecret: otp,
          otpExpiresAt,
        },
        create: {
          email,
          fullName,
          passwordHash: hashedPassword,
          otpSecret: otp,
          otpExpiresAt,
        },
      });

      // --- Send the email using Nodemailer ---
      try {
        // First, we render the React email template to a static HTML string.
        const emailHtml = await render(OtpEmailTemplate({ otp }));

        // Now, we use the transporter to send the email.
        await transporter.sendMail({
          from: `"TrendMart" <${process.env.GMAIL_USER}>`, // Sender address (shows up as TrendMart)
          to: email, // List of receivers
          subject: "Your TrendMart Verification Code", // Subject line
          html: emailHtml, // The rendered HTML body of the email
        });
      } catch (error) {
        console.error("Email sending failed:", error);
        throw new Error("Could not send verification email. Please try again.");
      }
      // ------------------------------------

      return "Verification code sent to your email.";
    },

    /**
     * Verifies the OTP and finalizes the user registration.
     */
    verifyOtpAndCompleteRegistration: async (_: any, { email, otp }: any) => {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.otpSecret || !user.otpExpiresAt) {
        throw new UserInputError("Invalid request. Please sign up again.");
      }
      if (user.emailVerifiedAt) {
        throw new UserInputError("This email has already been verified.");
      }
      if (user.otpSecret !== otp) {
        throw new UserInputError("Invalid OTP. Please check your code.");
      }
      if (new Date() > user.otpExpiresAt) {
        throw new UserInputError("OTP has expired. Please request a new one.");
      }

      // Success! Update the user record.
      const verifiedUser = await prisma.user.update({
        where: { email },
        data: {
          emailVerifiedAt: new Date(),
          otpSecret: null, // Clear OTP fields for security
          otpExpiresAt: null,
        },
      });

      // Log the user in immediately by creating a token
      const token = jwt.sign(
        { userId: verifiedUser.id, role: verifiedUser.role },
        JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      return { token, user: verifiedUser };
    },

    /**
     * Logs in an existing customer.
     */
    customerLogin: async (
      _: any,
      { email, password }: { email: string; password: string }
    ) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new UserInputError("Invalid credentials.");
      }

      // Important: Ensure only customers can use this login
      if (user.role !== UserRole.CUSTOMER) {
        throw new UserInputError(
          "Access denied. Please use the admin login page."
        );
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        throw new UserInputError("Invalid credentials.");
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: "7d",
      });

      return { token, user };
    },
  },
};
