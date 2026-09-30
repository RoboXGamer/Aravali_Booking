export async function hashAccessToken(token: string): Promise<string> {
  if (!/^[a-f0-9-]{72}$/.test(token)) throw new Error("Invalid private ticket link.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
