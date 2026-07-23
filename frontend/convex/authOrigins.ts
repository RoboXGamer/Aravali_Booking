function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export const siteUrl = normalizeOrigin(process.env.SITE_URL!);

const additionalOrigins = (
  process.env.TRUSTED_ORIGINS ?? "http://localhost:5173"
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

export const trustedOrigins = [...new Set([siteUrl, ...additionalOrigins])];
