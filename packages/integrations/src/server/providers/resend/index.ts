import { Resend } from "resend";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
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
} from "../shared/sdk";

type ResendSdkClient = Record<string, unknown>;

type ResendClientFactory = (apiKey: string) => ResendSdkClient;

export interface ResendProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: ResendClientFactory;
}

function createResendClient(apiKey: string): ResendSdkClient {
  return { resend: new Resend(apiKey) };
}

const RESEND_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "resend",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface ResendSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function resendRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): ResendSdkRequest {
  return { path, arguments: arguments_ };
}

function resendStringList(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const value = optionalInputString(input, field);
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return entries;
}

function resendTags(
  input: Readonly<Record<string, unknown>>,
): Array<{ name: string; value: string }> | undefined {
  const tags = optionalInputString(input, "tags");
  if (!tags) return undefined;
  const parsed = tags.split(",").map((entry) => {
    const [name, ...value] = entry.trim().split(":");
    if (!name || !value.length || !value.join(":").trim()) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return { name, value: value.join(":").trim() };
  });
  return parsed.length ? parsed : undefined;
}

function resendContactSelector(
  input: Readonly<Record<string, unknown>>,
): { id: string } | { email: string } {
  const contactId = requiredInputString(input, "contactId");
  return contactId.includes("@") ? { email: contactId } : { id: contactId };
}

function resendEmailPayload(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const contentType = optionalInputString(input, "contentType") ?? "text";
  if (contentType !== "text" && contentType !== "html") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const body = requiredInputString(input, "body");
  return definedFields({
    from: requiredInputString(input, "fromAddress"),
    to: resendStringList(input, "to") ?? requiredInputString(input, "to"),
    subject: requiredInputString(input, "subject"),
    text: contentType === "text" ? body : undefined,
    html: contentType === "html" ? body : undefined,
    cc: resendStringList(input, "cc"),
    bcc: resendStringList(input, "bcc"),
    replyTo: resendStringList(input, "replyTo"),
    scheduledAt: optionalInputString(input, "scheduledAt"),
    tags: resendTags(input),
  });
}

const RESEND_OPERATION_REQUESTS: Readonly<
  Record<string, (input: Readonly<Record<string, unknown>>) => ResendSdkRequest>
> = {
  "resend:send-email": (input) =>
    resendRequest(["resend", "emails", "send"], resendEmailPayload(input)),
  "resend:get-email": (input) =>
    resendRequest(
      ["resend", "emails", "get"],
      requiredInputString(input, "emailId"),
    ),
  "resend:cancel-email": (input) =>
    resendRequest(
      ["resend", "emails", "cancel"],
      requiredInputString(input, "cancelEmailId"),
    ),
  "resend:create-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "create"],
      definedFields({
        email: requiredInputString(input, "email"),
        firstName: optionalInputString(input, "firstName"),
        lastName: optionalInputString(input, "lastName"),
        unsubscribed: optionalInputBoolean(input, "unsubscribed"),
      }),
    ),
  "resend:list-contacts": (input) =>
    resendRequest(
      ["resend", "contacts", "list"],
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        after: optionalInputString(input, "after"),
        before: optionalInputString(input, "before"),
      }),
    ),
  "resend:get-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "get"],
      requiredInputString(input, "contactId"),
    ),
  "resend:update-contact": (input) => {
    const update = definedFields({
      ...resendContactSelector(input),
      firstName: optionalInputString(input, "firstName"),
      lastName: optionalInputString(input, "lastName"),
      unsubscribed: optionalInputBoolean(input, "unsubscribed"),
    });
    if (Object.keys(update).length === 1) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return resendRequest(["resend", "contacts", "update"], update);
  },
  "resend:delete-contact": (input) =>
    resendRequest(
      ["resend", "contacts", "remove"],
      resendContactSelector(input),
    ),
  "resend:create-audience": (input) =>
    resendRequest(["resend", "audiences", "create"], {
      name: requiredInputString(input, "audienceName"),
    }),
  "resend:get-audience": (input) =>
    resendRequest(
      ["resend", "audiences", "get"],
      requiredInputString(input, "audienceId"),
    ),
  "resend:list-audiences": (input) =>
    resendRequest(
      ["resend", "audiences", "list"],
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        after: optionalInputString(input, "after"),
        before: optionalInputString(input, "before"),
      }),
    ),
  "resend:delete-audience": (input) =>
    resendRequest(
      ["resend", "audiences", "remove"],
      requiredInputString(input, "audienceId"),
    ),
  "resend:create-broadcast": (input) => {
    const html = optionalInputString(input, "broadcastHtml");
    const text = optionalInputString(input, "broadcastText");
    if (!html && !text) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return resendRequest(
      ["resend", "broadcasts", "create"],
      definedFields({
        audienceId: requiredInputString(input, "audienceId"),
        from: requiredInputString(input, "broadcastFrom"),
        subject: requiredInputString(input, "broadcastSubject"),
        html,
        text,
        replyTo: resendStringList(input, "broadcastReplyTo"),
        name: optionalInputString(input, "broadcastName"),
        previewText: optionalInputString(input, "broadcastPreviewText"),
      }),
    );
  },
  "resend:send-broadcast": (input) =>
    resendRequest(
      ["resend", "broadcasts", "send"],
      requiredInputString(input, "broadcastId"),
      definedFields({
        scheduledAt: optionalInputString(input, "broadcastScheduledAt"),
      }),
    ),
  "resend:get-broadcast": (input) =>
    resendRequest(
      ["resend", "broadcasts", "get"],
      requiredInputString(input, "broadcastId"),
    ),
  "resend:list-domains": (input) =>
    resendRequest(
      ["resend", "domains", "list"],
      definedFields({
        limit: optionalInputNumber(input, "limit"),
        after: optionalInputString(input, "after"),
        before: optionalInputString(input, "before"),
      }),
    ),
};

function resendResponseData(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const response = value as Record<string, unknown>;
  return response.error ? response : (response.data ?? response);
}

function assertResendOperationCoverage(): void {
  const expected = new Set(RESEND_OPERATION_IDS);
  const implemented = Object.keys(RESEND_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Resend provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Resend actions use the vendor's official Node.js SDK. */
export function createResendProviderSdk(
  config: ResendProviderSdkConfig,
): IntegrationProviderSdk {
  assertResendOperationCoverage();
  const clientFactory = config.clientFactory ?? createResendClient;
  return {
    integrationId: "resend",
    operationIds: RESEND_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "resend" ||
        invocation.reference.integrationId !== "resend"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = RESEND_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: resendResponseData(
            await invokeSdkMethod(
              clientFactory(credential.apiKey),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getResendProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertResendOperationCoverage();
  return {
    operations: RESEND_OPERATION_IDS.length,
    operationIds: RESEND_OPERATION_IDS,
  };
}
