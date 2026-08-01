import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Kalshi's published OpenAPI document:
 * https://docs.kalshi.com/openapi.yaml
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Kalshi publishes no maintained Node SDK; its OpenAPI document at https://docs.kalshi.com/openapi.yaml is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-markets",
    name: "Get Markets",
    description:
      "Retrieve a list of prediction markets from Kalshi with optional filtering",
    method: "GET",
    url: (i) =>
      `/markets${restQuery({ limit: i.limit, cursor: i.cursor, event_ticker: i.eventTicker, series_ticker: i.seriesTicker, min_created_ts: i.minCreatedTs, max_created_ts: i.maxCreatedTs, min_updated_ts: i.minUpdatedTs, max_close_ts: i.maxCloseTs, min_close_ts: i.minCloseTs, min_settled_ts: i.minSettledTs, max_settled_ts: i.maxSettledTs, status: i.status, tickers: i.tickers, mve_filter: i.mveFilter })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        eventTicker: z.string().max(4_000).optional(),
        seriesTicker: z.string().max(4_000).optional(),
        minCreatedTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxCreatedTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minUpdatedTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxCloseTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minCloseTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minSettledTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxSettledTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        status: z
          .enum(["unopened", "open", "paused", "closed", "settled"])
          .optional(),
        tickers: z.string().max(4_000).optional(),
        mveFilter: z.enum(["only", "exclude"]).optional(),
      })
      .strict(),
  },
  {
    action: "get-market",
    name: "Get Market",
    description: "Retrieve details of a specific prediction market by ticker",
    method: "GET",
    url: (i) => `/markets/${restSegment(i.ticker)}`,
    input: z
      .object({
        ticker: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "get-events",
    name: "Get Events",
    description:
      "Retrieve a list of events from Kalshi with optional filtering",
    method: "GET",
    url: (i) =>
      `/events${restQuery({ limit: i.limit, cursor: i.cursor, with_nested_markets: i.withNestedMarkets, with_milestones: i.withMilestones, status: i.status, series_ticker: i.seriesTicker, tickers: i.tickers, min_close_ts: i.minCloseTs, min_updated_ts: i.minUpdatedTs })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        withNestedMarkets: z.boolean().optional(),
        withMilestones: z.boolean().optional(),
        status: z.enum(["unopened", "open", "closed", "settled"]).optional(),
        seriesTicker: z.string().max(4_000).optional(),
        tickers: z.string().max(4_000).optional(),
        minCloseTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        minUpdatedTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-event",
    name: "Get Event",
    description: "Retrieve details of a specific event by ticker",
    method: "GET",
    url: (i) =>
      `/events/${restSegment(i.eventTicker)}${restQuery({ with_nested_markets: i.withNestedMarkets })}`,
    input: z
      .object({
        eventTicker: z.string().max(4_000),
        withNestedMarkets: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-positions",
    name: "Get Positions",
    description: "Retrieve your open positions from Kalshi",
    method: "GET",
    url: (i) =>
      `/portfolio/positions${restQuery({ cursor: i.cursor, limit: i.limit, count_filter: i.countFilter, ticker: i.ticker, event_ticker: i.eventTicker, subaccount: i.subaccount })}`,
    input: z
      .object({
        cursor: z.string().max(4_000).optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        countFilter: z.string().max(4_000).optional(),
        ticker: z.string().max(4_000).optional(),
        eventTicker: z.string().max(4_000).optional(),
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-orders",
    name: "Get Orders",
    description: "Retrieve your orders from Kalshi with optional filtering",
    method: "GET",
    url: (i) =>
      `/portfolio/orders${restQuery({ ticker: i.ticker, event_ticker: i.eventTicker, min_ts: i.minTs, max_ts: i.maxTs, status: i.status, limit: i.limit, cursor: i.cursor, subaccount: i.subaccount })}`,
    input: z
      .object({
        ticker: z.string().max(4_000).optional(),
        eventTicker: z.string().max(4_000).optional(),
        minTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        status: z.string().max(4_000).optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-order",
    name: "Get Order",
    description: "Retrieve details of a specific order by ID from Kalshi",
    method: "GET",
    url: (i) => `/portfolio/orders/${restSegment(i.orderId)}`,
    input: z
      .object({
        orderId: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "get-trades",
    name: "Get Trades",
    description: "Retrieve recent trades across all markets",
    method: "GET",
    url: (i) =>
      `/markets/trades${restQuery({ limit: i.limit, cursor: i.cursor, ticker: i.ticker, min_ts: i.minTs, max_ts: i.maxTs, is_block_trade: i.isBlockTrade })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        ticker: z.string().max(4_000).optional(),
        minTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        isBlockTrade: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-candlesticks",
    name: "Get Candlesticks",
    description: "Retrieve OHLC candlestick data for a specific market",
    method: "GET",
    url: (i) =>
      `/markets/candlesticks${restQuery({ market_tickers: i.marketTickers, start_ts: i.startTs, end_ts: i.endTs, period_interval: i.periodInterval, include_latest_before_start: i.includeLatestBeforeStart })}`,
    input: z
      .object({
        marketTickers: z.string().max(4_000),
        startTs: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        endTs: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        periodInterval: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        includeLatestBeforeStart: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-event-candlesticks",
    name: "Get Event Candlesticks",
    description:
      "Retrieve OHLC candlestick data aggregated across all markets in an event",
    method: "GET",
    url: (i) =>
      `/series/${restSegment(i.seriesTicker)}/events/${restSegment(i.ticker)}/candlesticks${restQuery({ start_ts: i.startTs, end_ts: i.endTs, period_interval: i.periodInterval })}`,
    input: z
      .object({
        ticker: z.string().max(4_000),
        seriesTicker: z.string().max(4_000),
        startTs: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        endTs: z.number().int().min(-1_000_000_000).max(1_000_000_000),
        periodInterval: z.number().int().min(-1_000_000_000).max(1_000_000_000),
      })
      .strict(),
  },
  {
    action: "get-fills",
    name: "Get Fills",
    description: "Retrieve your portfolio's fills/trades from Kalshi",
    method: "GET",
    url: (i) =>
      `/portfolio/fills${restQuery({ ticker: i.ticker, order_id: i.orderId, min_ts: i.minTs, max_ts: i.maxTs, limit: i.limit, cursor: i.cursor, subaccount: i.subaccount })}`,
    input: z
      .object({
        ticker: z.string().max(4_000).optional(),
        orderId: z.string().max(4_000).optional(),
        minTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-settlements",
    name: "Get Settlements",
    description: "Retrieve your portfolio settlement history from Kalshi",
    method: "GET",
    url: (i) =>
      `/portfolio/settlements${restQuery({ limit: i.limit, cursor: i.cursor, ticker: i.ticker, event_ticker: i.eventTicker, min_ts: i.minTs, max_ts: i.maxTs, subaccount: i.subaccount })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        cursor: z.string().max(4_000).optional(),
        ticker: z.string().max(4_000).optional(),
        eventTicker: z.string().max(4_000).optional(),
        minTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        maxTs: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
  },
  {
    action: "get-series-list",
    name: "Get Series List",
    description:
      "Retrieve a list of market series from Kalshi with optional filtering",
    method: "GET",
    url: (i) =>
      `/series/${restSegment(i.seriesTicker)}${restQuery({ include_volume: i.includeVolume })}`,
    input: z
      .object({
        seriesTicker: z.string().max(4_000),
        includeVolume: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-exchange-status",
    name: "Get Exchange Status",
    description:
      "Retrieve the current status of the Kalshi exchange (trading and exchange activity)",
    method: "GET",
    url: "/exchange/status",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "create-order",
    name: "Create Order",
    description: "Create a new order on a Kalshi prediction market",
    method: "POST",
    url: "/portfolio/order_groups/create",
    input: z
      .object({
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        contractsLimit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        contractsLimitFp: z.string().max(4_000).optional(),
        exchangeIndex: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.subaccount !== undefined ? { subaccount: i.subaccount } : {}),
      ...(i.contractsLimit !== undefined
        ? { contracts_limit: i.contractsLimit }
        : {}),
      ...(i.contractsLimitFp !== undefined
        ? { contracts_limit_fp: i.contractsLimitFp }
        : {}),
      ...(i.exchangeIndex !== undefined
        ? { exchange_index: i.exchangeIndex }
        : {}),
    }),
  },
  {
    action: "amend-order",
    name: "Amend Order",
    description: "Modify the price or quantity of an existing order on Kalshi",
    method: "POST",
    url: (i) =>
      `/portfolio/events/orders/${restSegment(i.orderId)}/amend${restQuery({ subaccount: i.subaccount })}`,
    input: z
      .object({
        orderId: z.string().max(4_000),
        subaccount: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        ticker: z.string().max(4_000),
        side: z.enum(["bid", "ask"]),
        price: z.string().max(4_000),
        count: z.string().max(4_000),
        clientOrderId: z.string().max(4_000).optional(),
        updatedClientOrderId: z.string().max(4_000).optional(),
        exchangeIndex: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ticker: i.ticker,
      side: i.side,
      price: i.price,
      count: i.count,
      ...(i.clientOrderId !== undefined
        ? { client_order_id: i.clientOrderId }
        : {}),
      ...(i.updatedClientOrderId !== undefined
        ? { updated_client_order_id: i.updatedClientOrderId }
        : {}),
      ...(i.exchangeIndex !== undefined
        ? { exchange_index: i.exchangeIndex }
        : {}),
    }),
  },
];

export function createKalshiPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "kalshi",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
    deferrals: {
      "get-balance":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-orderbook":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-series-by-ticker":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-exchange-schedule":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "get-exchange-announcements":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
      "cancel-order":
        "The provider's published OpenAPI document declares no operation matching this action, so no request is mapped rather than one being guessed at.",
    },
  });
}
