import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "./database";
import { ADMIN_EMAIL, isOwnerEmail } from "../shared/admin-access";

/** Single-owner login. Recovery is intentionally unavailable until email is configured. */
export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, disableSignUp: true, autoSignIn: false },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const allowed = new Set([
        "/sign-in/email", "/sign-out", "/get-session", "/list-sessions",
        "/revoke-session", "/revoke-sessions", "/revoke-other-sessions",
      ]);
      // Deny signup, email changes, account linking and password changes/resets.
      // No alternative password-recovery path while the mailbox is inactive.
      if (!allowed.has(ctx.path)) {
        throw new APIError("FORBIDDEN", { message: "This authentication operation is unavailable." });
      }
      if (ctx.path === "/sign-in/email") {
        if (!isOwnerEmail(ctx.body?.email)) {
          throw new APIError("UNAUTHORIZED", { message: "Invalid email or password" });
        }
        ctx.body.email = ADMIN_EMAIL;
      }
    }),
  },
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "staff", input: false },
    },
  },
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [bearer()],
});
