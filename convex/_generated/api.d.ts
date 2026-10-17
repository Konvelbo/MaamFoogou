/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as designs from "../designs.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as likes from "../likes.js";
import type * as orders from "../orders.js";
import type * as paymentProvider from "../paymentProvider.js";
import type * as referrals from "../referrals.js";
import type * as seed from "../seed.js";
import type * as stock from "../stock.js";
import type * as users from "../users.js";
import type * as xpConfig from "../xpConfig.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  comments: typeof comments;
  crons: typeof crons;
  designs: typeof designs;
  helpers: typeof helpers;
  http: typeof http;
  likes: typeof likes;
  orders: typeof orders;
  paymentProvider: typeof paymentProvider;
  referrals: typeof referrals;
  seed: typeof seed;
  stock: typeof stock;
  users: typeof users;
  xpConfig: typeof xpConfig;
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

export declare const components: {};
