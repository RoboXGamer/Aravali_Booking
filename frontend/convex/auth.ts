import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { siteUrl, trustedOrigins } from "./authOrigins";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.CONVEX_SITE_URL!,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  });

export const getCurrentAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user?.email) return null;
    const email = user.email.trim().toLowerCase();
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!admin?.isAdmin) return null;
    return {
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      role: admin.role ?? "super_admin",
    };
  },
});
