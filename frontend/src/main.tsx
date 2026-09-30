import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import App from "./App";
import { authClient } from "./lib/auth-client";
import { convex } from "./lib/convex";
import "./index.css";

// Discard checkout/contact data left by the previous booking flow.
for (let index = sessionStorage.length - 1; index >= 0; index--) {
  const key = sessionStorage.key(index);
  if (key?.startsWith("aravalli.booking.email.")) sessionStorage.removeItem(key);
}
const previousCheckout = sessionStorage.getItem("aravalli.checkout");
if (previousCheckout && /"customer_(name|email|phone)"/.test(previousCheckout)) {
  sessionStorage.removeItem("aravalli.checkout");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <App />
    </ConvexBetterAuthProvider>
  </React.StrictMode>,
);
