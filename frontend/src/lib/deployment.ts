const configuredConvexUrl = import.meta.env.VITE_CONVEX_URL?.trim();

if (!configuredConvexUrl) {
  throw new Error("VITE_CONVEX_URL is required.");
}

export const convexUrl = configuredConvexUrl;

const configuredConvexSiteUrl =
  import.meta.env.VITE_CONVEX_SITE_URL?.trim();
const inferredConvexSiteUrl = convexUrl.replace(
  /\.convex\.cloud$/,
  ".convex.site",
);

if (!configuredConvexSiteUrl && inferredConvexSiteUrl === convexUrl) {
  throw new Error(
    "VITE_CONVEX_SITE_URL is required when VITE_CONVEX_URL does not use convex.cloud.",
  );
}

export const convexSiteUrl =
  configuredConvexSiteUrl || inferredConvexSiteUrl;
