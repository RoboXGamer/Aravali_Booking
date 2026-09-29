import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";
import { trustedOrigins } from "./authOrigins";
import { webhook } from "./payments";

const http = httpRouter();
http.route({ path: "/razorpay/webhook", method: "POST", handler: webhook });

authComponent.registerRoutesLazy(http, createAuth, {
  cors: true,
  trustedOrigins,
});

export default http;
