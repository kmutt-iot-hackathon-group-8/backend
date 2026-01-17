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
    minPasswordLength: 3,
  },
  user: {
    additionalFields: {
      fname: {
        type: "string",
        required: true,
        defaultValue: "",
        input: true,
      },
      lname: {
        type: "string",
        required: true,
        defaultValue: "",
        input: true,
      },
    },
  },
  hooks: {
    user: {
      create: {
        before: async (user) => {
          // If fname/lname not provided but name is, split the name
          if ((!user.fname || !user.lname) && user.name) {
            const nameParts = user.name.trim().split(/\s+/);
            if (!user.fname) {
              user.fname = nameParts[0] || "";
            }
            if (!user.lname) {
              user.lname = nameParts.slice(1).join(" ") || "";
            }
          }

          // Ensure fname and lname are never undefined
          user.fname = user.fname || "";
          user.lname = user.lname || "";

          return user;
        },
      },
    },
  },
  advanced: {
    disableOriginCheck: true,
    crossContext: true,
    cookie: {
      secure: true, // Force secure cookies (since Render is HTTPS)
      sameSite: "none", // Allow cross-site usage (essential for different domains)
    },
  },
  trustedOrigins: [`${FRONTEND_URL}`],
  baseURL: process.env.BETTER_AUTH_URL || "https://backend-h6j3.onrender.com",
  defaultRedirectURL: FRONTEND_URL,
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
