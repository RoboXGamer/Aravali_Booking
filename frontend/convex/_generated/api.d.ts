/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as authOrigins from "../authOrigins.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as maintenance from "../maintenance.js";
import type * as migrationAuditoriumLayout from "../migrationAuditoriumLayout.js";
import type * as migrationMovieMetadataAndAdminRoles from "../migrationMovieMetadataAndAdminRoles.js";
import type * as migrationRemoveBronze from "../migrationRemoveBronze.js";
import type * as migrationSeatSections from "../migrationSeatSections.js";
import type * as payments from "../payments.js";
import type * as paymentState from "../paymentState.js";
import type * as polls from "../polls.js";
import type * as seatLayout from "../seatLayout.js";
import type * as seed from "../seed.js";
import type * as test from "../test.js";
import type * as tickets from "../tickets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  authOrigins: typeof authOrigins;
  bookings: typeof bookings;
  crons: typeof crons;
  events: typeof events;
  http: typeof http;
  lib: typeof lib;
  maintenance: typeof maintenance;
  migrationAuditoriumLayout: typeof migrationAuditoriumLayout;
  migrationMovieMetadataAndAdminRoles: typeof migrationMovieMetadataAndAdminRoles;
  migrationRemoveBronze: typeof migrationRemoveBronze;
  migrationSeatSections: typeof migrationSeatSections;
  payments: typeof payments;
  paymentState: typeof paymentState;
  polls: typeof polls;
  seatLayout: typeof seatLayout;
  seed: typeof seed;
  test: typeof test;
  tickets: typeof tickets;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
