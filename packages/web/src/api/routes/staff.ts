import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { adminProcedure, staffProcedure } from "../lib/guards";
import { ADMIN_EMAIL } from "../../shared/admin-access";

export const staff = {
  /** Compatibility endpoint: account creation is no longer permitted. */
  register: base
    .input(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email().max(160),
        password: z.string().min(8).max(200),
        inviteCode: z.string().max(120),
      }),
    )
    .handler(async () => {
      throw new ORPCError("FORBIDDEN", { message: "Account registration is disabled" });
    }),

  /** Who am I — drives the admin layout and the role-gated menu items. */
  me: staffProcedure.handler(async ({ context }) => context.staff),

  list: adminProcedure.handler(async () => {
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.email, ADMIN_EMAIL));
    return rows;
  }),

  setRole: adminProcedure
    .input(z.object({ id: z.string(), role: z.enum(["admin", "staff"]) }))
    .handler(async () => {
      throw new ORPCError("FORBIDDEN", { message: "Single-owner access cannot be changed here" });
    }),

  remove: adminProcedure.input(z.object({ id: z.string() })).handler(async () => {
    throw new ORPCError("FORBIDDEN", { message: "Single-owner access cannot be changed here" });
  }),
};
