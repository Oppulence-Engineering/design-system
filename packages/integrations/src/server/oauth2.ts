import type { IntegrationId } from "../contracts";
import {
  IntegrationOAuthCredentialSchema,
  type IntegrationOAuthCredential,
} from "./credentials";

export interface OAuth2ProviderConfiguration {
  integrationId: IntegrationId;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  apiBaseUrl?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: readonly string[];
  /** OAuth providers such as Slack require comma-delimited scopes. */
  scopeDelimiter?: " " | ",";
  authorizationParameters?: Readonly<Record<string, string>>;
  /** Maps a safe output field to a provider callback query parameter. */
  callbackMetadata?: Readonly<Record<string, string>>;
  tokenParameters?: Readonly<Record<string, string>>;
  clientAuthentication?: "basic" | "body";
  /** Defaults to 15 seconds; it bounds token exchange/refresh and API response headers. */
  requestTimeoutMs?: number;
  /** Defaults to 64 KiB and bounds the provider token JSON response. */
  maxTokenResponseBytes?: number;
}

export interface OAuth2AuthorizationInput {
  state: string;
  codeChallenge: string;
}

export interface OAuth2ApiRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export class OAuth2ProviderError extends Error {
  readonly code:
    | "OAUTH2_AUTHORIZATION_FAILED"
    | "OAUTH2_TOKEN_EXCHANGE_FAILED"
    | "OAUTH2_REFRESH_FAILED"
    | "OAUTH2_API_BASE_UNAVAILABLE"
    | "OAUTH2_INVALID_API_PATH"
    | "OAUTH2_API_REQUEST_FAILED"
    | "OAUTH2_CONFIGURATION_INVALID";

  constructor(code: OAuth2ProviderError["code"]) {
    super("The provider authorization could not be completed.");
    this.name = "OAuth2ProviderError";
    this.code = code;
  }
}

function base64(value: string): string {
  return btoa(value);
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function scopes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((scope): scope is string => typeof scope === "string")
    : typeof value === "string"
      ? value.split(/[\s,]+/u).filter(Boolean)
      : [];
}

function parseTokenResponse(
  value: unknown,
  failureCode: "OAUTH2_TOKEN_EXCHANGE_FAILED" | "OAUTH2_REFRESH_FAILED",
): IntegrationOAuthCredential {
  if (!value || typeof value !== "object") {
    throw new OAuth2ProviderError(failureCode);
  }
  const response = value as Record<string, unknown>;
  if (typeof response.access_token !== "string" || !response.access_token) {
    throw new OAuth2ProviderError(failureCode);
  }
  const expiresIn = positiveNumber(response.expires_in);
  return IntegrationOAuthCredentialSchema.parse({
    accessToken: response.access_token,
    refreshToken:
      typeof response.refresh_token === "string"
        ? response.refresh_token
        : undefined,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1_000).toISOString()
      : undefined,
    scope: scopes(response.scope ?? response.scopes),
    tokenType:
      typeof response.token_type === "string" ? response.token_type : "Bearer",
  });
}

const RESERVED_AUTHORIZATION_PARAMETERS = new Set([
  "client_id",
  "code_challenge",
  "code_challenge_method",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
]);

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function validateSecureUrl(value: string, allowLoopbackHttp = false): void {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" &&
        !(
          allowLoopbackHttp &&
          url.protocol === "http:" &&
          isLoopbackHost(url.hostname)
        )) ||
      url.username ||
      url.password
    ) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new OAuth2ProviderError("OAUTH2_CONFIGURATION_INVALID");
  }
}

function validateAuthorizationParameters(
  parameters: Readonly<Record<string, string>> | undefined,
): void {
  for (const [key, value] of Object.entries(parameters ?? {})) {
    if (
      !key ||
      key.length > 160 ||
      typeof value !== "string" ||
      value.length > 2_000 ||
      RESERVED_AUTHORIZATION_PARAMETERS.has(key.toLocaleLowerCase("en-US"))
    ) {
      throw new OAuth2ProviderError("OAUTH2_CONFIGURATION_INVALID");
    }
  }
}

function ensureRelativeApiPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("#")) {
    throw new OAuth2ProviderError("OAUTH2_INVALID_API_PATH");
  }
  return path;
}

function providerApiUrl(apiBaseUrl: string, path: string): URL {
  try {
    const base = new URL(apiBaseUrl);
    const relative = new URL(
      ensureRelativeApiPath(path),
      "https://integration.invalid",
    );
    const basePath = base.pathname.replace(/\/+$/u, "");
    const relativePath = relative.pathname.replace(/^\/+/, "");
    base.pathname = `${basePath}/${relativePath}`.replace(/\/+/gu, "/");
    base.search = relative.search;
    base.hash = "";
    return base;
  } catch (error) {
    if (error instanceof OAuth2ProviderError) {
      throw error;
    }
    throw new OAuth2ProviderError("OAUTH2_INVALID_API_PATH");
  }
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Provider request timed out."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function readJsonBody(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("Token response exceeds configured size.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Token response body is missing.");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new Error("Token response exceeds configured size.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export interface OAuth2ProviderSdk {
  configuration: OAuth2ProviderConfiguration;
  createAuthorizationUrl(input: OAuth2AuthorizationInput): string;
  extractCallbackMetadata(
    parameters: URLSearchParams,
  ): Readonly<Record<string, string>>;
  exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<IntegrationOAuthCredential>;
  refresh(
    refreshToken: string,
    previousCredential: IntegrationOAuthCredential,
  ): Promise<IntegrationOAuthCredential>;
  request(
    credential: IntegrationOAuthCredential,
    request: OAuth2ApiRequest,
  ): Promise<Response>;
}

const SLACK_DEFAULT_SCOPES = [
  "channels:read",
  "channels:history",
  "channels:manage",
  "groups:read",
  "groups:history",
  "groups:write",
  "chat:write",
  "chat:write.public",
  "im:write",
  "im:read",
  "users:read",
  "files:write",
  "files:read",
  "canvases:read",
  "canvases:write",
  "reactions:write",
  "reactions:read",
] as const;

export interface SlackOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /**
   * Defaults to the public Slack scopes required by the package's regular
   * messaging, files, reactions, views, and canvas operations. Add approval-
   * gated scopes (for example assistant:write) only after Slack grants them.
   */
  scopes?: readonly string[];
}

const HUBSPOT_DEFAULT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
  "crm.objects.users.read",
  "crm.objects.marketing_events.read",
  "crm.objects.line_items.read",
  "crm.objects.line_items.write",
  "crm.objects.quotes.read",
  "crm.objects.appointments.read",
  "crm.objects.appointments.write",
  "crm.objects.carts.read",
  "sales-email-read",
  "crm.lists.read",
  "crm.lists.write",
  "tickets",
  "oauth",
] as const;

export interface HubSpotOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted HubSpot app. */
  scopes?: readonly string[];
}

/**
 * HubSpot's current OAuth V3 flow. Access and refresh tokens never leave the
 * integration runtime; products supply only their HubSpot app registration.
 */
export function createHubSpotOAuth2Provider(
  input: HubSpotOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "hubspot",
    authorizationEndpoint: "https://app.hubspot.com/oauth/authorize",
    tokenEndpoint: "https://api.hubapi.com/oauth/v3/token",
    apiBaseUrl: "https://api.hubapi.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? HUBSPOT_DEFAULT_SCOPES,
    clientAuthentication: "body",
  };
}

/**
 * Slack's V2 OAuth flow uses comma-delimited bot scopes and exchanges at
 * oauth.v2.access. The product supplies app registration values only.
 */
export function createSlackOAuth2Provider(
  input: SlackOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "slack",
    authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.access",
    apiBaseUrl: "https://slack.com/api",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? SLACK_DEFAULT_SCOPES,
    scopeDelimiter: ",",
    clientAuthentication: "body",
  };
}

const LINEAR_DEFAULT_SCOPES = [
  "read",
  "write",
  "customer:read",
  "customer:write",
] as const;

const AIRTABLE_DEFAULT_SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
] as const;

export interface AirtableOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Airtable app. */
  scopes?: readonly string[];
}

/** Airtable OAuth registration for the package-owned Airtable SDK adapter. */
export function createAirtableOAuth2Provider(
  input: AirtableOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "airtable",
    authorizationEndpoint: "https://airtable.com/oauth2/v1/authorize",
    tokenEndpoint: "https://airtable.com/oauth2/v1/token",
    apiBaseUrl: "https://api.airtable.com/v0",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? AIRTABLE_DEFAULT_SCOPES,
  };
}

const ASANA_DEFAULT_SCOPES = [
  "projects:read",
  "projects:write",
  "tasks:read",
  "tasks:write",
  "tasks:delete",
  "workspaces:read",
] as const;

export interface AsanaOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Asana app. */
  scopes?: readonly string[];
}

/** Asana OAuth registration for the package-owned official Node SDK adapter. */
export function createAsanaOAuth2Provider(
  input: AsanaOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "asana",
    authorizationEndpoint: "https://app.asana.com/-/oauth_authorize",
    tokenEndpoint: "https://app.asana.com/-/oauth_token",
    apiBaseUrl: "https://app.asana.com/api/1.0",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? ASANA_DEFAULT_SCOPES,
    clientAuthentication: "body",
  };
}

const DROPBOX_DEFAULT_SCOPES = [
  "files.content.read",
  "files.content.write",
  "sharing.read",
  "sharing.write",
] as const;

export interface DropboxOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Dropbox app. */
  scopes?: readonly string[];
}

/** Dropbox OAuth registration for the package-owned official JavaScript SDK. */
export function createDropboxOAuth2Provider(
  input: DropboxOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "dropbox",
    authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
    tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
    apiBaseUrl: "https://api.dropboxapi.com/2",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? DROPBOX_DEFAULT_SCOPES,
    clientAuthentication: "basic",
    authorizationParameters: { token_access_type: "offline" },
  };
}

export interface LinearOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Linear app. */
  scopes?: readonly string[];
}

const GOOGLE_CALENDAR_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
] as const;

export interface GoogleCalendarOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Google app. */
  scopes?: readonly string[];
}

/**
 * Google's OAuth 2.0 registration for the package-owned Calendar adapter.
 * `access_type=offline` requests a refresh token so token refresh remains
 * inside the encrypted integration runtime rather than product code.
 */
export function createGoogleCalendarOAuth2Provider(
  input: GoogleCalendarOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-calendar",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_CALENDAR_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_DRIVE_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/drive",
] as const;

export interface GoogleDriveOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Google app. */
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Drive SDK execution. */
export function createGoogleDriveOAuth2Provider(
  input: GoogleDriveOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-drive",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_DRIVE_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_SHEETS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export interface GoogleSheetsOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Override the complete requested scope set for a restricted Google app. */
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Sheets SDK execution. */
export function createGoogleSheetsOAuth2Provider(
  input: GoogleSheetsOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-sheets",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_SHEETS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_DOCS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export interface GoogleDocsOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Docs and Drive execution. */
export function createGoogleDocsOAuth2Provider(
  input: GoogleDocsOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-docs",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_DOCS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_SLIDES_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export interface GoogleSlidesOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Slides and Drive execution. */
export function createGoogleSlidesOAuth2Provider(
  input: GoogleSlidesOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-slides",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_SLIDES_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GMAIL_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export interface GmailOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Gmail execution. */
export function createGmailOAuth2Provider(
  input: GmailOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "gmail",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://gmail.googleapis.com/gmail/v1",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GMAIL_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_FORMS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
] as const;

export interface GoogleFormsOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Forms SDK execution. */
export function createGoogleFormsOAuth2Provider(
  input: GoogleFormsOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-forms",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_FORMS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_TASKS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/tasks",
] as const;

export interface GoogleTasksOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Tasks SDK execution. */
export function createGoogleTasksOAuth2Provider(
  input: GoogleTasksOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-tasks",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://www.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_TASKS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_CONTACTS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
] as const;

export interface GoogleContactsOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned People API execution. */
export function createGoogleContactsOAuth2Provider(
  input: GoogleContactsOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-contacts",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://people.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_CONTACTS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_MEET_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
] as const;

export interface GoogleMeetOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Meet SDK execution. */
export function createGoogleMeetOAuth2Provider(
  input: GoogleMeetOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-meet",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://meet.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_MEET_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

const GOOGLE_GROUPS_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.group",
  "https://www.googleapis.com/auth/admin.directory.group.member",
  "https://www.googleapis.com/auth/apps.groups.settings",
] as const;

export interface GoogleGroupsOAuth2ProviderInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
}

/** Google's OAuth registration for package-owned Workspace Groups execution. */
export function createGoogleGroupsOAuth2Provider(
  input: GoogleGroupsOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "google-groups",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    apiBaseUrl: "https://admin.googleapis.com",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? GOOGLE_GROUPS_DEFAULT_SCOPES,
    authorizationParameters: { access_type: "offline", prompt: "consent" },
    clientAuthentication: "body",
  };
}

/**
 * Linear's OAuth flow uses comma-delimited scopes and refresh tokens. The
 * default covers the package-owned Linear SDK actions, including its customer
 * operations; callers may provide a narrower scope set when they expose only
 * a subset of those operations.
 */
export function createLinearOAuth2Provider(
  input: LinearOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  return {
    integrationId: "linear",
    authorizationEndpoint: "https://linear.app/oauth/authorize",
    tokenEndpoint: "https://api.linear.app/oauth/token",
    apiBaseUrl: "https://api.linear.app",
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? LINEAR_DEFAULT_SCOPES,
    scopeDelimiter: ",",
    clientAuthentication: "body",
  };
}

const UNSAFE_CALLBACK_PARAMETERS = new Set([
  "access_token",
  "code",
  "error",
  "error_description",
  "id_token",
  "refresh_token",
  "state",
]);
const CALLBACK_METADATA_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;

function extractCallbackMetadata(
  configuration: OAuth2ProviderConfiguration,
  parameters: URLSearchParams,
): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {};
  for (const [field, parameter] of Object.entries(
    configuration.callbackMetadata ?? {},
  )) {
    if (
      !CALLBACK_METADATA_KEY.test(field) ||
      UNSAFE_CALLBACK_PARAMETERS.has(parameter.toLowerCase())
    ) {
      continue;
    }
    const value = parameters.get(parameter);
    if (value && value.length <= 512) {
      metadata[field] = value;
    }
  }
  return metadata;
}

export function createOAuth2ProviderSdk(
  configuration: OAuth2ProviderConfiguration,
  fetcher: typeof fetch = fetch,
): OAuth2ProviderSdk {
  const clientAuthentication = configuration.clientAuthentication ?? "basic";
  const requestTimeoutMs = configuration.requestTimeoutMs ?? 15_000;
  const maxTokenResponseBytes =
    configuration.maxTokenResponseBytes ?? 64 * 1024;
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 120_000
  ) {
    throw new Error("OAuth2 provider requestTimeoutMs must be 100–120000ms.");
  }
  if (
    configuration.scopeDelimiter !== undefined &&
    configuration.scopeDelimiter !== " " &&
    configuration.scopeDelimiter !== ","
  ) {
    throw new Error("OAuth2 provider scopeDelimiter must be a space or comma.");
  }
  if (
    !Number.isSafeInteger(maxTokenResponseBytes) ||
    maxTokenResponseBytes < 1_024 ||
    maxTokenResponseBytes > 1_048_576
  ) {
    throw new Error(
      "OAuth2 provider maxTokenResponseBytes must be 1024–1048576.",
    );
  }
  validateSecureUrl(configuration.authorizationEndpoint);
  validateSecureUrl(configuration.tokenEndpoint);
  validateSecureUrl(configuration.redirectUri, true);
  if (configuration.apiBaseUrl) {
    validateSecureUrl(configuration.apiBaseUrl);
  }
  validateAuthorizationParameters(configuration.authorizationParameters);

  async function requestToken(
    parameters: Record<string, string>,
    failureCode: "OAUTH2_TOKEN_EXCHANGE_FAILED" | "OAUTH2_REFRESH_FAILED",
  ): Promise<IntegrationOAuthCredential> {
    const body = new URLSearchParams({
      ...configuration.tokenParameters,
      ...parameters,
    });
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    if (clientAuthentication === "basic" && configuration.clientSecret) {
      headers.set(
        "Authorization",
        `Basic ${base64(`${configuration.clientId}:${configuration.clientSecret}`)}`,
      );
    } else {
      body.set("client_id", configuration.clientId);
      if (configuration.clientSecret) {
        body.set("client_secret", configuration.clientSecret);
      }
    }
    try {
      return await withTimeout(requestTimeoutMs, async (signal) => {
        const response = await fetcher(configuration.tokenEndpoint, {
          method: "POST",
          headers,
          body,
          signal,
        });
        if (!response.ok) {
          throw new OAuth2ProviderError(failureCode);
        }
        return parseTokenResponse(
          await readJsonBody(response, maxTokenResponseBytes),
          failureCode,
        );
      });
    } catch (error) {
      if (error instanceof OAuth2ProviderError) {
        throw error;
      }
      throw new OAuth2ProviderError(failureCode);
    }
  }

  return {
    configuration,

    createAuthorizationUrl(input) {
      try {
        const url = new URL(configuration.authorizationEndpoint);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", configuration.clientId);
        url.searchParams.set("redirect_uri", configuration.redirectUri);
        url.searchParams.set(
          "scope",
          configuration.scopes.join(configuration.scopeDelimiter ?? " "),
        );
        url.searchParams.set("state", input.state);
        url.searchParams.set("code_challenge", input.codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        for (const [key, value] of Object.entries(
          configuration.authorizationParameters ?? {},
        )) {
          url.searchParams.set(key, value);
        }
        return url.toString();
      } catch {
        throw new OAuth2ProviderError("OAUTH2_AUTHORIZATION_FAILED");
      }
    },

    extractCallbackMetadata(parameters) {
      return extractCallbackMetadata(configuration, parameters);
    },

    exchangeAuthorizationCode(code, codeVerifier) {
      return requestToken(
        {
          grant_type: "authorization_code",
          code,
          code_verifier: codeVerifier,
          redirect_uri: configuration.redirectUri,
        },
        "OAUTH2_TOKEN_EXCHANGE_FAILED",
      );
    },

    async refresh(refreshToken, previousCredential) {
      const refreshed = await requestToken(
        { grant_type: "refresh_token", refresh_token: refreshToken },
        "OAUTH2_REFRESH_FAILED",
      );
      return IntegrationOAuthCredentialSchema.parse({
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? previousCredential.refreshToken,
        scope:
          refreshed.scope.length > 0
            ? refreshed.scope
            : previousCredential.scope,
      });
    },

    async request(credential, request) {
      if (!configuration.apiBaseUrl) {
        throw new OAuth2ProviderError("OAUTH2_API_BASE_UNAVAILABLE");
      }
      const url = providerApiUrl(configuration.apiBaseUrl, request.path);
      const headers = new Headers(request.headers);
      headers.set(
        "Authorization",
        `${credential.tokenType} ${credential.accessToken}`,
      );
      try {
        return await withTimeout(requestTimeoutMs, (signal) =>
          fetcher(url, {
            method: request.method ?? "GET",
            headers,
            body: request.body,
            signal,
          }),
        );
      } catch {
        throw new OAuth2ProviderError("OAUTH2_API_REQUEST_FAILED");
      }
    },
  };
}

export function createQuickBooksOAuth2Provider(
  input: Omit<
    OAuth2ProviderConfiguration,
    | "integrationId"
    | "authorizationEndpoint"
    | "tokenEndpoint"
    | "apiBaseUrl"
    | "scopes"
    | "clientAuthentication"
  > & {
    environment?: "sandbox" | "production";
  },
): OAuth2ProviderConfiguration {
  const { environment, ...configuration } = input;
  return {
    ...configuration,
    integrationId: "quickbooks",
    authorizationEndpoint: "https://appcenter.intuit.com/connect/oauth2",
    tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    apiBaseUrl:
      environment === "sandbox"
        ? "https://sandbox-quickbooks.api.intuit.com"
        : "https://quickbooks.api.intuit.com",
    scopes: [
      "com.intuit.quickbooks.accounting",
      "openid",
      "profile",
      "email",
      "offline_access",
    ],
    callbackMetadata: {
      ...configuration.callbackMetadata,
      companyId: "realmId",
    },
    clientAuthentication: "basic",
  };
}

export function createXeroOAuth2Provider(
  input: Omit<
    OAuth2ProviderConfiguration,
    | "integrationId"
    | "authorizationEndpoint"
    | "tokenEndpoint"
    | "apiBaseUrl"
    | "scopes"
    | "clientAuthentication"
  >,
): OAuth2ProviderConfiguration {
  return {
    ...input,
    integrationId: "xero",
    authorizationEndpoint: "https://login.xero.com/identity/connect/authorize",
    tokenEndpoint: "https://identity.xero.com/connect/token",
    apiBaseUrl: "https://api.xero.com/api.xro/2.0",
    scopes: [
      "openid",
      "profile",
      "email",
      "accounting.transactions",
      "accounting.attachments",
      "accounting.settings",
      "accounting.contacts.read",
      "offline_access",
    ],
    clientAuthentication: "basic",
  };
}

/**
 * Every Microsoft provider authenticates against the same Entra ID endpoints
 * and calls the same Graph host; only the requested scopes differ. The tenant
 * is deployment configuration, so a single-tenant app can restrict it rather
 * than accepting the multi-tenant `common` authority.
 */
const MICROSOFT_GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0";

const MICROSOFT_BASE_SCOPES = ["openid", "profile", "offline_access"] as const;

const MICROSOFT_DEFAULT_SCOPES: Readonly<Record<string, readonly string[]>> = {
  "azure-ad": ["User.ReadWrite.All", "Group.ReadWrite.All"],
  outlook: [
    "Mail.ReadWrite",
    "Mail.Send",
    "MailboxSettings.Read",
    "Calendars.ReadWrite",
  ],
  onedrive: ["Files.ReadWrite.All"],
  sharepoint: ["Sites.ReadWrite.All", "Files.ReadWrite.All"],
  "microsoft-planner": ["Tasks.ReadWrite", "Group.ReadWrite.All"],
  "microsoft-teams": [
    "Chat.ReadWrite",
    "ChannelMessage.Send",
    "ChannelMessage.ReadWrite",
    "Team.ReadBasic.All",
    "TeamMember.Read.All",
  ],
  "microsoft-excel": ["Files.ReadWrite.All"],
};

export interface MicrosoftGraphOAuth2ProviderInput {
  integrationId: keyof typeof MICROSOFT_DEFAULT_SCOPES;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** Directory authority: a tenant ID, `organizations`, or `common`. */
  tenant?: string;
  /** Override the complete requested scope set for a restricted app. */
  scopes?: readonly string[];
}

/** OAuth registration shared by the package-owned Microsoft Graph adapters. */
export function createMicrosoftGraphOAuth2Provider(
  input: MicrosoftGraphOAuth2ProviderInput,
): OAuth2ProviderConfiguration {
  const defaults = MICROSOFT_DEFAULT_SCOPES[input.integrationId];
  if (!defaults) {
    throw new Error(
      `No Microsoft Graph scope profile for ${input.integrationId}.`,
    );
  }
  const tenant = input.tenant ?? "common";
  if (!/^[A-Za-z0-9.-]{1,128}$/u.test(tenant)) {
    throw new Error("Microsoft tenant must be a tenant ID or authority name.");
  }
  return {
    integrationId:
      input.integrationId as OAuth2ProviderConfiguration["integrationId"],
    authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    apiBaseUrl: MICROSOFT_GRAPH_API_BASE_URL,
    clientId: input.clientId,
    ...(input.clientSecret ? { clientSecret: input.clientSecret } : {}),
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? [...MICROSOFT_BASE_SCOPES, ...defaults],
  };
}
