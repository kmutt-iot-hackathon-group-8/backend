import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const adapter = prismaAdapter(prisma, {
  provider: "postgresql",
  generateId: false,
});

// Monkey patch the adapter to handle ID conversion
const originalCreateUser = adapter.createUser;
adapter.createUser = async (user) => {
  // Remove the ID field so Prisma can auto-generate the integer ID
  const { id, ...userWithoutId } = user;
  const createdUser = await originalCreateUser(userWithoutId);
  // Convert the integer ID back to string for Better Auth
  return {
    ...createdUser,
    id: createdUser.id.toString(),
  };
};

const originalGetUser = adapter.getUser;
adapter.getUser = async (id) => {
  // Convert string ID to integer for database query
  const user = await originalGetUser(parseInt(id));
  if (user) {
    // Convert integer ID back to string for Better Auth
    return {
      ...user,
      id: user.id.toString(),
    };
  }
  return user;
};

const originalGetUserByEmail = adapter.getUserByEmail;
adapter.getUserByEmail = async (email) => {
  const user = await originalGetUserByEmail(email);
  if (user) {
    // Convert integer ID back to string for Better Auth
    return {
      ...user,
      id: user.id.toString(),
    };
  }
  return user;
};

const originalUpdateUser = adapter.updateUser;
adapter.updateUser = async (id, updates) => {
  // Convert string ID to integer for database query
  const user = await originalUpdateUser(parseInt(id), updates);
  if (user) {
    // Convert integer ID back to string for Better Auth
    return {
      ...user,
      id: user.id.toString(),
    };
  }
  return user;
};

export const auth = betterAuth({
  database: adapter,
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
