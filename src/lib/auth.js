import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    generateId: () => {
      // Return undefined to let the database handle autoincrement
      return undefined;
    },
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
      userPassword: {
        type: "string",
        required: true,
        defaultValue: "",
        input: false,
      },
    },
    modelName: "User",
    id: { generateId: false },
    fields: {
      id: "uid",
      email: "email",
      emailVerified: "emailVerified",
      name: "name",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      image: "image",
    },
  },
  session: {
    modelName: "Session",
    fields: {
      sessionToken: "token",
      userId: "userId",
      expiresAt: "expiresAt",
    },
  },
  account: {
    modelName: "Account",
    fields: {
      accountId: "accountId",
      providerId: "providerId",
      userId: "userId",
      accessToken: "accessToken",
      refreshToken: "refreshToken",
      idToken: "idToken",
      expiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      scope: "scope",
    },
    accountLinking: {
      enabled: true,
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
          user.fname = user.fname || "def fn";
          user.lname = user.lname || "def ln";

          // Set userPassword field for the User model
          // Better Auth will handle password in Account model, but we need a placeholder
          user.userPassword = user.userPassword || "def";

          // Remove id field since database auto-increments uid
          if (user.id) {
            delete user.id;
          }

          return user;
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // Ensure session has required fields
          if (!session.token) {
            session.token = session.sessionToken || session.id;
          }
          return session;
        },
      },
    },
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
