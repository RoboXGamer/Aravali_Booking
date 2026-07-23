import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { convexSiteUrl } from "./deployment";

export const authClient = createAuthClient({
  baseURL: convexSiteUrl,
  plugins: [convexClient(), crossDomainClient()],
});
