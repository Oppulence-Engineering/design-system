import { Buffer } from "node:buffer";
import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "../shared/sdk";

type GmailSdkClient = Record<string, unknown>;

type GmailClientFactory = (accessToken: string) => GmailSdkClient;

export interface GmailProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GmailClientFactory;
  /** Source email files must resolve to this portable in-memory shape. */
  maxAttachmentBytes?: number;
}

function createGmailClient(accessToken: string): GmailSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { gmail: google.gmail({ version: "v1", auth }) };
}

const GMAIL_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "gmail",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GmailSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function gmailRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GmailSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function gmailHeader(value: string): string {
  return value.replace(/[\r\n]+/gu, " ");
}

function gmailSubject(value: string): string {
  const normalized = gmailHeader(value);
  return /^[\x00-\x7F]*$/u.test(normalized)
    ? normalized
    : `=?UTF-8?B?${Buffer.from(normalized, "utf8").toString("base64")}?=`;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

interface GmailReplyHeaders {
  inReplyTo?: string;
  references?: string;
}

function gmailAttachments(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): GmailAttachment[] {
  const rawAttachments = input.attachments;
  if (rawAttachments === undefined) return [];
  if (!Array.isArray(rawAttachments)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  let totalBytes = 0;
  return rawAttachments.map((rawAttachment) => {
    if (!rawAttachment || typeof rawAttachment !== "object") {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    const attachment = rawAttachment as Record<string, unknown>;
    const filename =
      optionalInputString(attachment, "filename") ??
      requiredInputString(attachment, "name");
    const data =
      optionalInputString(attachment, "data") ??
      requiredInputString(attachment, "content");
    if (!/^[A-Za-z0-9+/_=-]*$/u.test(data)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    const content = Buffer.from(data, "base64");
    totalBytes += content.byteLength;
    if (totalBytes > maximumBytes) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return {
      filename: gmailHeader(filename),
      mimeType:
        optionalInputString(attachment, "mimeType") ??
        optionalInputString(attachment, "contentType") ??
        "application/octet-stream",
      content,
    };
  });
}

function gmailBase64Lines(value: Buffer | string): string[] {
  return value.toString("base64").match(/.{1,76}/gu) ?? [""];
}

function gmailEscapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function gmailPlainTextFallback(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function gmailBodyAlternatives(
  body: string,
  contentType: "text" | "html",
): { plain: string; html: string } {
  if (contentType === "html") {
    return { plain: gmailPlainTextFallback(body) || body, html: body };
  }
  return {
    plain: body,
    html: `<!DOCTYPE html><html><body>${gmailEscapeHtml(body).replace(/\r?\n/gu, "<br>")}</body></html>`,
  };
}

function gmailAlternativeParts(
  body: string,
  contentType: "text" | "html",
  boundary: string,
): string[] {
  const { plain, html } = gmailBodyAlternatives(body, contentType);
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    ...gmailBase64Lines(plain),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    ...gmailBase64Lines(html),
    "",
    `--${boundary}--`,
  ];
}

function gmailRawMessage(
  input: Readonly<Record<string, unknown>>,
  maximumAttachmentBytes: number,
  replyHeaders: GmailReplyHeaders = {},
): string {
  const contentType = optionalInputString(input, "contentType") ?? "text";
  if (contentType !== "text" && contentType !== "html") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const attachments = gmailAttachments(input, maximumAttachmentBytes);
  const body = requiredInputString(input, "body");
  const lines = [`To: ${gmailHeader(requiredInputString(input, "to"))}`];
  const cc = optionalInputString(input, "cc");
  const bcc = optionalInputString(input, "bcc");
  if (cc) lines.push(`Cc: ${gmailHeader(cc)}`);
  if (bcc) lines.push(`Bcc: ${gmailHeader(bcc)}`);
  lines.push(
    `Subject: ${gmailSubject(optionalInputString(input, "subject") ?? "")}`,
  );
  if (replyHeaders.inReplyTo) {
    const inReplyTo = gmailHeader(replyHeaders.inReplyTo);
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(
      `References: ${replyHeaders.references ? `${gmailHeader(replyHeaders.references)} ${inReplyTo}` : inReplyTo}`,
    );
  }
  lines.push("MIME-Version: 1.0");
  if (attachments.length) {
    const mixedBoundary = `oppulence_mixed_${crypto.randomUUID().replace(/-/gu, "")}`;
    const alternativeBoundary = `oppulence_alt_${crypto.randomUUID().replace(/-/gu, "")}`;
    lines.push(
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
    );
    lines.push(
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...gmailAlternativeParts(body, contentType, alternativeBoundary),
      "",
    );
    for (const attachment of attachments) {
      lines.push(
        `--${mixedBoundary}`,
        `Content-Type: ${gmailHeader(attachment.mimeType)}`,
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        ...gmailBase64Lines(attachment.content),
        "",
      );
    }
    lines.push(`--${mixedBoundary}--`);
  } else {
    const alternativeBoundary = `oppulence_alt_${crypto.randomUUID().replace(/-/gu, "")}`;
    lines.push(
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...gmailAlternativeParts(body, contentType, alternativeBoundary),
    );
  }
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function gmailLabelIds(
  input: Readonly<Record<string, unknown>>,
  field: "addLabelIds" | "removeLabelIds" | "labelIds",
): string[] | undefined {
  const value = optionalInputString(input, field);
  if (!value) return undefined;
  const labelIds = value
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (!labelIds.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return labelIds;
}

const GMAIL_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => GmailSdkRequest>
> = {
  "gmail:search-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "list"], {
      userId: "me",
      q: requiredInputString(input, "query"),
      maxResults: optionalInputNumber(input, "maxResults"),
    }),
  "gmail:move-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: definedFields({
        addLabelIds: gmailLabelIds(input, "addLabelIds"),
        removeLabelIds: gmailLabelIds(input, "removeLabelIds"),
      }),
    }),
  "gmail:mark-as-read": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { removeLabelIds: ["UNREAD"] },
    }),
  "gmail:mark-as-unread": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { addLabelIds: ["UNREAD"] },
    }),
  "gmail:archive-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { removeLabelIds: ["INBOX"] },
    }),
  "gmail:unarchive-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { addLabelIds: ["INBOX"] },
    }),
  "gmail:delete-email": (input) =>
    gmailRequest(["gmail", "users", "messages", "trash"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
    }),
  "gmail:add-label": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { addLabelIds: gmailLabelIds(input, "labelIds") },
    }),
  "gmail:remove-label": (input) =>
    gmailRequest(["gmail", "users", "messages", "modify"], {
      userId: "me",
      id: requiredInputString(input, "messageId"),
      requestBody: { removeLabelIds: gmailLabelIds(input, "labelIds") },
    }),
};

function assertGmailOperationCoverage(): void {
  const specialOperations = new Set([
    "gmail:send-email",
    "gmail:read-email",
    "gmail:draft-email",
    "gmail:edit-draft",
  ]);
  const expected = new Set(GMAIL_OPERATION_IDS);
  const implemented = Object.keys(GMAIL_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length + specialOperations.size ||
    implemented.some((operationId) => !expected.has(operationId)) ||
    [...specialOperations].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Gmail provider SDK operation coverage is incomplete.");
  }
}

function gmailResponseRecord(value: unknown): Record<string, unknown> {
  const response = sdkResponseData(value);
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {};
  }
  return response as Record<string, unknown>;
}

function gmailHeaderValue(headers: unknown, name: string): string | undefined {
  if (!Array.isArray(headers)) return undefined;
  for (const rawHeader of headers) {
    if (!rawHeader || typeof rawHeader !== "object") continue;
    const header = rawHeader as Record<string, unknown>;
    if (
      typeof header.name === "string" &&
      header.name.toLowerCase() === name.toLowerCase() &&
      typeof header.value === "string"
    ) {
      return header.value;
    }
  }
  return undefined;
}

function gmailPartBody(
  rawPart: unknown,
  preferredMimeType?: "text/plain" | "text/html",
): string | undefined {
  if (!rawPart || typeof rawPart !== "object") return undefined;
  const part = rawPart as Record<string, unknown>;
  if (
    (!preferredMimeType || part.mimeType === preferredMimeType) &&
    part.body &&
    typeof part.body === "object" &&
    typeof (part.body as Record<string, unknown>).data === "string"
  ) {
    const data = (part.body as Record<string, unknown>).data as string;
    if (/^[A-Za-z0-9_-]*={0,2}$/u.test(data)) {
      return Buffer.from(data, "base64url").toString("utf8");
    }
  }
  if (!Array.isArray(part.parts)) return undefined;
  for (const nestedPart of part.parts) {
    const body = gmailPartBody(nestedPart, preferredMimeType);
    if (body !== undefined) return body;
  }
  return undefined;
}

interface GmailReadAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function gmailReadAttachmentsFromPart(rawPart: unknown): GmailReadAttachment[] {
  if (!rawPart || typeof rawPart !== "object") return [];
  const part = rawPart as Record<string, unknown>;
  const body =
    part.body && typeof part.body === "object"
      ? (part.body as Record<string, unknown>)
      : {};
  const attachments: GmailReadAttachment[] = [];
  if (
    typeof body.attachmentId === "string" &&
    typeof part.filename === "string" &&
    part.filename
  ) {
    attachments.push({
      attachmentId: body.attachmentId,
      filename: part.filename,
      mimeType:
        typeof part.mimeType === "string"
          ? part.mimeType
          : "application/octet-stream",
      size: typeof body.size === "number" ? body.size : 0,
    });
  }
  if (Array.isArray(part.parts)) {
    attachments.push(
      ...part.parts.flatMap((nestedPart) =>
        gmailReadAttachmentsFromPart(nestedPart),
      ),
    );
  }
  return attachments;
}

async function gmailDownloadReadAttachments(
  client: GmailSdkClient,
  messageId: string,
  attachments: readonly GmailReadAttachment[],
  maximumBytes: number,
): Promise<
  Array<{ name: string; data: string; mimeType: string; size: number }>
> {
  const downloaded: Array<{
    name: string;
    data: string;
    mimeType: string;
    size: number;
  }> = [];
  let totalBytes = 0;
  for (const attachment of attachments) {
    if (attachment.size > maximumBytes - totalBytes) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    try {
      const response = await invokeSdkMethod(
        client,
        gmailRequest(["gmail", "users", "messages", "attachments", "get"], {
          userId: "me",
          messageId,
          id: attachment.attachmentId,
        }),
      );
      const data = gmailResponseRecord(response);
      if (
        typeof data.data !== "string" ||
        !/^[A-Za-z0-9_-]*={0,2}$/u.test(data.data)
      ) {
        continue;
      }
      const bytes = Buffer.from(data.data, "base64url");
      totalBytes += bytes.byteLength;
      if (totalBytes > maximumBytes) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      downloaded.push({
        name: attachment.filename,
        data: bytes.toString("base64"),
        mimeType: attachment.mimeType,
        size: bytes.byteLength,
      });
    } catch (error) {
      if (error instanceof IntegrationProviderSdkError) throw error;
      // Preserve the source behavior: one unreadable attachment does not make
      // the whole message unavailable.
    }
  }
  return downloaded;
}

async function gmailFormatReadMessage(
  client: GmailSdkClient,
  value: unknown,
  includeAttachments: boolean,
  maximumAttachmentBytes: number,
): Promise<Record<string, unknown>> {
  const message = gmailResponseRecord(value);
  const payload = gmailResponseRecord(message.payload);
  const attachmentInfo = gmailReadAttachmentsFromPart(payload);
  const messageId = typeof message.id === "string" ? message.id : "";
  const attachments =
    includeAttachments && messageId
      ? await gmailDownloadReadAttachments(
          client,
          messageId,
          attachmentInfo,
          maximumAttachmentBytes,
        )
      : [];
  return {
    id: messageId || undefined,
    threadId:
      typeof message.threadId === "string" ? message.threadId : undefined,
    labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
    from: gmailHeaderValue(payload.headers, "from"),
    to: gmailHeaderValue(payload.headers, "to"),
    subject: gmailHeaderValue(payload.headers, "subject"),
    date: gmailHeaderValue(payload.headers, "date"),
    body:
      gmailPartBody(payload, "text/plain") ??
      gmailPartBody(payload, "text/html") ??
      "",
    hasAttachments: attachmentInfo.length > 0,
    attachmentCount: attachmentInfo.length,
    attachments,
  };
}

function gmailReadMaxResults(input: Readonly<Record<string, unknown>>): number {
  const requested = optionalInputNumber(input, "maxResults") ?? 1;
  if (!Number.isFinite(requested) || requested < 1) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return Math.min(Math.trunc(requested), 10);
}

function gmailReadQuery(input: Readonly<Record<string, unknown>>): string {
  const folder = optionalInputString(input, "folder");
  const unreadOnly = optionalInputBoolean(input, "unreadOnly");
  const terms = [
    unreadOnly ? "is:unread" : undefined,
    folder
      ? ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM"].includes(folder)
        ? `in:${folder.toLowerCase()}`
        : `label:${folder}`
      : "in:inbox",
  ].filter((term): term is string => Boolean(term));
  return terms.join(" ");
}

async function gmailReplyHeaders(
  client: GmailSdkClient,
  messageId: string,
): Promise<GmailReplyHeaders & { threadId?: string }> {
  try {
    const response = await invokeSdkMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "get"], {
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "References", "Subject"],
      }),
    );
    const message = gmailResponseRecord(response);
    const payload = gmailResponseRecord(message.payload);
    return {
      inReplyTo: gmailHeaderValue(payload.headers, "message-id"),
      references: gmailHeaderValue(payload.headers, "references"),
      threadId:
        typeof message.threadId === "string" ? message.threadId : undefined,
    };
  } catch {
    // A reply still sends when Gmail refuses metadata access for an otherwise
    // sendable message, matching the pinned source's best-effort threading.
    return {};
  }
}

async function executeGmailSpecialOperation(
  client: GmailSdkClient,
  operationId: string,
  input: Readonly<Record<string, unknown>>,
  maximumAttachmentBytes: number,
): Promise<unknown> {
  if (operationId === "gmail:read-email") {
    const messageId = optionalInputString(input, "messageId");
    if (messageId) {
      const result = await invokeSdkMethod(
        client,
        gmailRequest(["gmail", "users", "messages", "get"], {
          userId: "me",
          id: messageId,
          format: "full",
        }),
      );
      return gmailFormatReadMessage(
        client,
        result,
        optionalInputBoolean(input, "includeAttachments") ?? false,
        maximumAttachmentBytes,
      );
    }
    const maxResults = gmailReadMaxResults(input);
    const listed = await invokeSdkMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "list"], {
        userId: "me",
        q: gmailReadQuery(input),
        maxResults,
      }),
    );
    const list = gmailResponseRecord(listed);
    const messages = Array.isArray(list.messages)
      ? list.messages
          .filter(
            (message): message is Record<string, unknown> =>
              Boolean(message) && typeof message === "object",
          )
          .slice(0, maxResults)
      : [];
    if (!messages.length) return { results: [], attachments: [] };
    const detailed = await Promise.all(
      messages.map(async (message) => {
        if (typeof message.id !== "string" || !message.id) return undefined;
        const result = await invokeSdkMethod(
          client,
          gmailRequest(["gmail", "users", "messages", "get"], {
            userId: "me",
            id: message.id,
            format: "full",
          }),
        );
        return gmailFormatReadMessage(
          client,
          result,
          optionalInputBoolean(input, "includeAttachments") ?? false,
          maximumAttachmentBytes,
        );
      }),
    );
    const results = detailed.filter(
      (message): message is Record<string, unknown> => message !== undefined,
    );
    if (maxResults === 1) {
      return results.at(0) ?? { results: [], attachments: [] };
    }
    return {
      results: results.map((message) => ({
        id: message.id,
        threadId: message.threadId,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
      })),
      attachments: results.flatMap((message) =>
        Array.isArray(message.attachments) ? message.attachments : [],
      ),
    };
  }
  const replyToMessageId = optionalInputString(input, "replyToMessageId");
  const replyHeaders = replyToMessageId
    ? await gmailReplyHeaders(client, replyToMessageId)
    : {};
  const raw = gmailRawMessage(input, maximumAttachmentBytes, replyHeaders);
  const threadId =
    optionalInputString(input, "threadId") ?? replyHeaders.threadId;
  const message = definedFields({ raw, threadId });
  if (operationId === "gmail:send-email") {
    return invokeSdkMethod(
      client,
      gmailRequest(["gmail", "users", "messages", "send"], {
        userId: "me",
        requestBody: message,
      }),
    );
  }
  const requestBody = { message };
  return invokeSdkMethod(
    client,
    gmailRequest(
      operationId === "gmail:draft-email"
        ? ["gmail", "users", "drafts", "create"]
        : ["gmail", "users", "drafts", "update"],
      definedFields({
        userId: "me",
        id:
          operationId === "gmail:edit-draft"
            ? requiredInputString(input, "draftId")
            : undefined,
        requestBody,
      }),
    ),
  );
}

/** All pinned Gmail actions use Google's official Node.js SDK. */
export function createGmailProviderSdk(
  config: GmailProviderSdkConfig,
): IntegrationProviderSdk {
  assertGmailOperationCoverage();
  const clientFactory = config.clientFactory ?? createGmailClient;
  const maximumAttachmentBytes = config.maxAttachmentBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumAttachmentBytes) ||
    maximumAttachmentBytes < 1 ||
    maximumAttachmentBytes > 40 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  return {
    integrationId: "gmail",
    operationIds: GMAIL_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "gmail" ||
        invocation.reference.integrationId !== "gmail"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = GMAIL_OPERATION_REQUESTS[invocation.operationId];
      if (
        !requestFactory &&
        ![
          "gmail:send-email",
          "gmail:read-email",
          "gmail:draft-email",
          "gmail:edit-draft",
        ].includes(invocation.operationId)
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const client = clientFactory(credential.accessToken);
          const result = requestFactory
            ? await invokeSdkMethod(client, requestFactory(invocation.input))
            : await executeGmailSpecialOperation(
                client,
                invocation.operationId,
                invocation.input,
                maximumAttachmentBytes,
              );
          return {
            operationId: invocation.operationId,
            output: sdkResponseData(result),
          };
        },
      );
    },
  };
}

export function getGmailProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGmailOperationCoverage();
  return {
    operations: GMAIL_OPERATION_IDS.length,
    operationIds: GMAIL_OPERATION_IDS,
  };
}
