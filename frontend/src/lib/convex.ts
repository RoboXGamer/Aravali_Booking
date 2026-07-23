import { ConvexReactClient } from "convex/react";
import { convexUrl } from "./deployment";

export const convex = new ConvexReactClient(convexUrl, { expectAuth: true });
