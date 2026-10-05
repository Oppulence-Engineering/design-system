/**
 * @module @oppulence/events/identity
 * @file Session-driven identify helpers. The implementation lives in
 *   `client.tsx` so it shares `AnalyticsContext` with `AnalyticsProvider`;
 *   the `./identity` export resolves to the same `client.js` bundle.
 */

export { AnalyticsIdentify, useAnalyticsIdentify } from "./client";
