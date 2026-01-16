import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    disableOriginCheck: true,
    crossContext: true,
  },
  trustedOrigins: [`${FRONTEND_URL}`],
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      // Optional
      // tenantId: process.env.MICROSOFT_TENANT_ID,
      authority: "https://login.microsoftonline.com",
      prompt: "select_account",
    },
  },
});
