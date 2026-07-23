import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type DatabaseCtx = QueryCtx | MutationCtx;

export async function requireAdmin(ctx: DatabaseCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email?.trim().toLowerCase();
  if (!identity || !email) throw new Error("Administrator access required.");
  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (!admin?.isAdmin) throw new Error("Administrator access required.");
  return { email, tokenIdentifier: identity.tokenIdentifier };
}

export async function getSettings(ctx: DatabaseCtx) {
  return await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", "booking"))
    .unique();
}

export async function ensureSettings(ctx: MutationCtx) {
  const existing = await getSettings(ctx);
  if (existing) return existing;
  const id = await ctx.db.insert("appSettings", {
    key: "booking",
    maxSeatsPerBooking: 6,
    seatHoldMinutes: 10,
    razorpayFeePercentage: 2,
  });
  const created = await ctx.db.get("appSettings", id);
  if (!created) throw new Error("Unable to initialize application settings.");
  return created;
}

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function auditoriumDate(now: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function moviePosterUrl(ctx: DatabaseCtx, movie: Doc<"movies">) {
  return movie.posterStorageId
    ? await ctx.storage.getUrl(movie.posterStorageId)
    : null;
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function publicId(value: string) {
  return value;
}
