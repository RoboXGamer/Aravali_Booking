import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    SITE_URL: v.string(),
    RAZORPAY_KEY_ID: v.string(),
    RAZORPAY_SECRET: v.string(),
  },
});

app.use(betterAuth);

export default app;
