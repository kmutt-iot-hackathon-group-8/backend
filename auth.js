import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

const isProd = process.env.NODE_ENV === "production";

const FRONTEND_URL = isProd
  ? process.env.FRONTEND_URL
  : "http://localhost:5173";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  baseURL: `${FRONTEND_URL}/api/auth`,
  trustedOrigins: [FRONTEND_URL],
});
