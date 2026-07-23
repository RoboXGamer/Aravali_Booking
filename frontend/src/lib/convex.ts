import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
if (!convexUrl) throw new Error("VITE_CONVEX_URL is required.");

export const convex = new ConvexReactClient(convexUrl, { expectAuth: true });
