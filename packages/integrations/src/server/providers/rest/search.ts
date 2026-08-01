import { z } from "zod";

import type { IntegrationProviderPack } from "../../provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "./pack";

/** Shared review: none of these providers publishes a maintained Node SDK. */
function noSdk(provider: string, note = ""): string {
  return `${provider} publishes no maintained Node SDK; its HTTP API is the supported integration surface.${note ? ` ${note}` : ""}`;
}

const Query = z.string().min(1).max(2_000);
const Limit = z.number().int().min(1).max(100).optional();

// --------------------------------------------------------------- Perplexity

const PERPLEXITY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "chat",
    name: "Chat",
    description: "Runs a chat completion against a Perplexity model.",
    method: "POST",
    url: "/chat/completions",
    input: z
      .object({
        model: z.string().min(1).max(128).optional(),
        messages: z
          .array(
            z
              .object({
                role: z.enum(["system", "user", "assistant"]),
                content: z.string().min(1).max(100_000),
              })
              .strict(),
          )
          .min(1)
          .max(64),
        maxTokens: z.number().int().min(1).max(8_192).optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .strict(),
    body: (i) => ({
      model: i.model ?? "sonar",
      messages: i.messages,
      ...(i.maxTokens ? { max_tokens: i.maxTokens } : {}),
      ...(i.temperature === undefined ? {} : { temperature: i.temperature }),
    }),
  },
  {
    action: "search",
    name: "Search",
    description: "Runs a web search and returns cited results.",
    method: "POST",
    url: "/chat/completions",
    input: z
      .object({
        query: Query,
        model: z.string().min(1).max(128).optional(),
        recency: z.enum(["hour", "day", "week", "month", "year"]).optional(),
      })
      .strict(),
    body: (i) => ({
      model: i.model ?? "sonar",
      messages: [{ role: "user", content: i.query }],
      ...(i.recency ? { search_recency_filter: i.recency } : {}),
      return_citations: true,
    }),
  },
];

export function createPerplexityPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "perplexity",
    sdkReview: noSdk("Perplexity"),
    transportKind: "api_key",
    actions: PERPLEXITY_ACTIONS,
  });
}

// --------------------------------------------------------------------- Jina

const JINA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "read-url",
    name: "Read URL",
    description: "Fetches a page and returns it as clean, LLM-ready text.",
    method: "POST",
    url: "/",
    input: z
      .object({
        url: z.string().url().max(2_000),
        withImages: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({ url: i.url }),
    headers: (i) => ({
      "content-type": "application/json",
      // Reader returns markdown unless asked otherwise.
      "x-return-format": "markdown",
      ...(i.withImages ? {} : { "x-retain-images": "none" }),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "search",
    name: "Search",
    description: "Searches the web and returns readable result content.",
    method: "POST",
    url: "/",
    input: z.object({ query: Query }).strict(),
    body: (i) => ({ q: i.query }),
    headers: () => ({ "content-type": "application/json" }),
    maxResponseBytes: 1_048_576,
  },
];

export function createJinaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "jina",
    sdkReview: noSdk(
      "Jina AI",
      "Reader and Search are host-differentiated endpoints on the same key.",
    ),
    transportKind: "api_key",
    actions: JINA_ACTIONS,
  });
}

// ------------------------------------------------------------------- Tavily

const TAVILY_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search",
    name: "Search",
    description: "Runs a Tavily web search.",
    method: "POST",
    url: "/search",
    input: z
      .object({
        query: Query,
        searchDepth: z.enum(["basic", "advanced"]).optional(),
        maxResults: Limit,
        includeDomains: z.array(z.string().max(256)).max(50).optional(),
        excludeDomains: z.array(z.string().max(256)).max(50).optional(),
        includeAnswer: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      query: i.query,
      search_depth: i.searchDepth ?? "basic",
      max_results: i.maxResults ?? 5,
      include_answer: i.includeAnswer ?? false,
      ...(i.includeDomains ? { include_domains: i.includeDomains } : {}),
      ...(i.excludeDomains ? { exclude_domains: i.excludeDomains } : {}),
    }),
  },
  {
    action: "extract-content",
    name: "Extract Content",
    description: "Extracts readable content from one or more URLs.",
    method: "POST",
    url: "/extract",
    input: z
      .object({
        urls: z.array(z.string().url().max(2_000)).min(1).max(20),
        extractDepth: z.enum(["basic", "advanced"]).optional(),
      })
      .strict(),
    body: (i) => ({
      urls: i.urls,
      extract_depth: i.extractDepth ?? "basic",
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "crawl-website",
    name: "Crawl Website",
    description: "Crawls a site from a starting URL.",
    method: "POST",
    url: "/crawl",
    input: z
      .object({
        url: z.string().url().max(2_000),
        maxDepth: z.number().int().min(1).max(5).optional(),
        limit: Limit,
        instructions: z.string().max(2_000).optional(),
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      max_depth: i.maxDepth ?? 1,
      limit: i.limit ?? 20,
      ...(i.instructions ? { instructions: i.instructions } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "map-website",
    name: "Map Website",
    description: "Lists the URLs reachable from a starting URL.",
    method: "POST",
    url: "/map",
    input: z
      .object({
        url: z.string().url().max(2_000),
        maxDepth: z.number().int().min(1).max(5).optional(),
        limit: Limit,
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      max_depth: i.maxDepth ?? 1,
      limit: i.limit ?? 50,
    }),
  },
];

export function createTavilyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "tavily",
    sdkReview: noSdk("Tavily"),
    transportKind: "api_key",
    actions: TAVILY_ACTIONS,
  });
}

// ---------------------------------------------------------------------- Exa

const EXA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search",
    name: "Search",
    description: "Runs an Exa neural or keyword search.",
    method: "POST",
    url: "/search",
    input: z
      .object({
        query: Query,
        type: z.enum(["neural", "keyword", "auto"]).optional(),
        numResults: Limit,
        includeDomains: z.array(z.string().max(256)).max(50).optional(),
        startPublishedDate: z.string().max(64).optional(),
      })
      .strict(),
    body: (i) => ({
      query: i.query,
      type: i.type ?? "auto",
      numResults: i.numResults ?? 10,
      ...(i.includeDomains ? { includeDomains: i.includeDomains } : {}),
      ...(i.startPublishedDate
        ? { startPublishedDate: i.startPublishedDate }
        : {}),
    }),
  },
  {
    action: "get-contents",
    name: "Get Contents",
    description: "Fetches the contents of Exa result IDs or URLs.",
    method: "POST",
    url: "/contents",
    input: z
      .object({
        ids: z.array(z.string().min(1).max(2_000)).min(1).max(50),
        text: z.boolean().optional(),
        highlights: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ids: i.ids,
      text: i.text ?? true,
      ...(i.highlights ? { highlights: true } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
  {
    action: "answer",
    name: "Answer",
    description: "Answers a question with cited sources.",
    method: "POST",
    url: "/answer",
    input: z.object({ query: Query, text: z.boolean().optional() }).strict(),
    body: (i) => ({ query: i.query, text: i.text ?? false }),
  },
  {
    action: "find-similar-links",
    name: "Find Similar Links",
    description: "Finds pages similar to a given URL.",
    method: "POST",
    url: "/findSimilar",
    input: z
      .object({
        url: z.string().url().max(2_000),
        numResults: Limit,
        excludeSourceDomain: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      url: i.url,
      numResults: i.numResults ?? 10,
      excludeSourceDomain: i.excludeSourceDomain ?? true,
    }),
  },
  {
    action: "agent",
    name: "Agent",
    description: "Runs an Exa research agent task.",
    method: "POST",
    url: "/research/v1",
    input: z
      .object({
        instructions: z.string().min(1).max(10_000),
        model: z.string().max(128).optional(),
      })
      .strict(),
    body: (i) => ({
      instructions: i.instructions,
      ...(i.model ? { model: i.model } : {}),
    }),
    maxResponseBytes: 1_048_576,
  },
];

export function createExaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "exa",
    sdkReview: noSdk("Exa"),
    transportKind: "api_key",
    actions: EXA_ACTIONS,
  });
}

// ---------------------------------------------------------------- Wikipedia

const WIKIPEDIA_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-page-summary",
    name: "Get Page Summary",
    description: "Reads the summary extract of a Wikipedia page.",
    method: "GET",
    url: (i) => `/api/rest_v1/page/summary/${restSegment(i.title)}`,
    input: z.object({ title: z.string().min(1).max(512) }).strict(),
  },
  {
    action: "get-page-content",
    name: "Get Page Content",
    description: "Reads the full HTML content of a Wikipedia page.",
    method: "GET",
    url: (i) => `/api/rest_v1/page/html/${restSegment(i.title)}`,
    input: z.object({ title: z.string().min(1).max(512) }).strict(),
    // A long article's HTML is well past the shared default.
    maxResponseBytes: 1_048_576,
    output: z.object({ html: z.string() }).strict(),
  },
  {
    action: "search-pages",
    name: "Search Pages",
    description: "Searches Wikipedia article titles and text.",
    method: "GET",
    url: (i) =>
      `/w/api.php${restQuery({
        action: "query",
        list: "search",
        srsearch: i.query,
        srlimit: i.limit ?? 10,
        format: "json",
        origin: "*",
      })}`,
    input: z.object({ query: Query, limit: Limit }).strict(),
  },
  {
    action: "random-page",
    name: "Random Page",
    description: "Returns a random Wikipedia article summary.",
    method: "GET",
    url: "/api/rest_v1/page/random/summary",
    input: z.object({}).strict(),
  },
];

export function createWikipediaPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "wikipedia",
    sdkReview: noSdk(
      "Wikipedia",
      "The MediaWiki and REST v1 APIs are both public and unauthenticated.",
    ),
    transportKind: "none",
    actions: WIKIPEDIA_ACTIONS,
  });
}

// -------------------------------------------------------------------- arXiv

/**
 * arXiv answers with Atom XML rather than JSON, so these actions transform to
 * a text projection instead of the shared document schema.
 */
const ARXIV_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "search-papers",
    name: "Search Papers",
    description: "Searches arXiv for papers matching a query.",
    method: "GET",
    url: (i) =>
      `/api/query${restQuery({
        search_query: i.query,
        start: i.start ?? 0,
        max_results: i.limit ?? 10,
        sortBy: i.sortBy ?? "relevance",
      })}`,
    input: z
      .object({
        query: Query,
        start: z.number().int().min(0).max(10_000).optional(),
        limit: Limit,
        sortBy: z
          .enum(["relevance", "lastUpdatedDate", "submittedDate"])
          .optional(),
      })
      .strict(),
    maxResponseBytes: 1_048_576,
    output: z.object({ atom: z.string() }).strict(),
  },
  {
    action: "get-paper-details",
    name: "Get Paper Details",
    description: "Reads one arXiv paper by its identifier.",
    method: "GET",
    url: (i) => `/api/query${restQuery({ id_list: i.arxivId })}`,
    input: z
      .object({
        arxivId: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[\w./-]+$/u),
      })
      .strict(),
    output: z.object({ atom: z.string() }).strict(),
  },
  {
    action: "get-author-papers",
    name: "Get Author Papers",
    description: "Lists papers by an author.",
    method: "GET",
    url: (i) =>
      `/api/query${restQuery({
        search_query: `au:"${String(i.author).replace(/"/gu, "")}"`,
        max_results: i.limit ?? 10,
        sortBy: "submittedDate",
      })}`,
    input: z
      .object({ author: z.string().min(1).max(256), limit: Limit })
      .strict(),
    maxResponseBytes: 1_048_576,
    output: z.object({ atom: z.string() }).strict(),
  },
];

export function createArxivPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "arxiv",
    sdkReview: noSdk(
      "arXiv",
      "Its public API answers with Atom XML, which the lane returns as text.",
    ),
    transportKind: "none",
    actions: ARXIV_ACTIONS,
  });
}

// --------------------------------------------------------------- Brandfetch

const BRANDFETCH_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "get-brand",
    name: "Get Brand",
    description: "Reads brand assets and metadata for a domain.",
    method: "GET",
    url: (i) => `/v2/brands/${restSegment(i.domain)}`,
    input: z
      .object({
        domain: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[A-Za-z0-9.-]+$/u),
      })
      .strict(),
  },
  {
    action: "search-brands",
    name: "Search Brands",
    description: "Searches brands by name.",
    method: "GET",
    url: (i) => `/v2/search/${restSegment(i.query)}`,
    input: z.object({ query: z.string().min(1).max(256) }).strict(),
  },
];

export function createBrandfetchPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "brandfetch",
    sdkReview: noSdk("Brandfetch"),
    transportKind: "api_key",
    actions: BRANDFETCH_ACTIONS,
  });
}

// ----------------------------------------------------------------- Hunter.io

const HUNTER_ACTIONS: readonly RestAction<any>[] = [
  {
    action: "domain-search",
    name: "Domain Search",
    description: "Finds email addresses associated with a domain.",
    method: "GET",
    url: (i) =>
      `/v2/domain-search${restQuery({
        domain: i.domain,
        company: i.company,
        limit: i.limit,
        type: i.type,
      })}`,
    input: z
      .object({
        domain: z.string().max(253).optional(),
        company: z.string().max(256).optional(),
        limit: Limit,
        type: z.enum(["personal", "generic"]).optional(),
      })
      .strict()
      .refine((value) => Boolean(value.domain ?? value.company), {
        message: "A domain search needs a domain or a company name.",
      }),
  },
  {
    action: "email-finder",
    name: "Email Finder",
    description: "Finds the most likely email address for a person.",
    method: "GET",
    url: (i) =>
      `/v2/email-finder${restQuery({
        domain: i.domain,
        first_name: i.firstName,
        last_name: i.lastName,
        full_name: i.fullName,
      })}`,
    input: z
      .object({
        domain: z.string().min(1).max(253),
        firstName: z.string().max(128).optional(),
        lastName: z.string().max(128).optional(),
        fullName: z.string().max(256).optional(),
      })
      .strict(),
  },
  {
    action: "email-verifier",
    name: "Email Verifier",
    description: "Verifies the deliverability of an email address.",
    method: "GET",
    url: (i) => `/v2/email-verifier${restQuery({ email: i.email })}`,
    input: z.object({ email: z.string().email().max(320) }).strict(),
  },
  {
    action: "email-count",
    name: "Email Count",
    description: "Counts the email addresses known for a domain.",
    method: "GET",
    url: (i) =>
      `/v2/email-count${restQuery({ domain: i.domain, company: i.company })}`,
    input: z
      .object({
        domain: z.string().max(253).optional(),
        company: z.string().max(256).optional(),
      })
      .strict(),
  },
  {
    action: "discover-companies",
    name: "Discover Companies",
    description: "Finds companies matching a natural-language description.",
    method: "POST",
    url: "/v2/discover",
    input: z
      .object({
        query: z.string().max(2_000).optional(),
        organization: z.record(z.string(), z.unknown()).optional(),
        limit: Limit,
      })
      .strict(),
    body: (i) => ({
      ...(i.query ? { query: i.query } : {}),
      ...(i.organization ? { organization: i.organization } : {}),
      limit: i.limit ?? 10,
    }),
  },
  {
    action: "find-company",
    name: "Find Company",
    description: "Reads company details for a domain.",
    method: "GET",
    url: (i) => `/v2/companies/find${restQuery({ domain: i.domain })}`,
    input: z.object({ domain: z.string().min(1).max(253) }).strict(),
  },
];

export function createHunterIoPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "hunter-io",
    sdkReview: noSdk("Hunter.io"),
    transportKind: "api_key",
    actions: HUNTER_ACTIONS,
  });
}
