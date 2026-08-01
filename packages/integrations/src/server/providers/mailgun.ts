import Mailgun from "mailgun.js";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "./shared";

type MailgunSdkClient = Record<string, unknown>;

type MailgunClientFactory = (
  apiKey: string,
  apiUrl: string,
) => MailgunSdkClient;

export interface MailgunProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  /** Either Mailgun's US or EU API origin; action input cannot override it. */
  apiUrl?: "https://api.mailgun.net" | "https://api.eu.mailgun.net";
  clientFactory?: MailgunClientFactory;
}

function createMailgunClient(apiKey: string, apiUrl: string): MailgunSdkClient {
  return new Mailgun(FormData).client({
    username: "api",
    key: apiKey,
    url: apiUrl,
  }) as unknown as MailgunSdkClient;
}

const MAILGUN_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "mailgun",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface MailgunSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function mailgunRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): MailgunSdkRequest {
  return { path, arguments: arguments_ };
}

function mailgunRecipients(
  input: Readonly<Record<string, unknown>>,
  field: string,
): string[] | undefined {
  const value = optionalInputString(input, field);
  return value
    ?.split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function mailgunMessage(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const text = optionalInputString(input, "text");
  const html = optionalInputString(input, "html");
  if (!text && !html) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return definedFields({
    from: requiredInputString(input, "from"),
    to: mailgunRecipients(input, "to") ?? requiredInputString(input, "to"),
    subject: requiredInputString(input, "subject"),
    text,
    html,
    cc: mailgunRecipients(input, "cc"),
    bcc: mailgunRecipients(input, "bcc"),
    "o:tag": mailgunRecipients(input, "tags"),
  });
}

const MAILGUN_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => MailgunSdkRequest
  >
> = {
  "mailgun:send-message": (input) =>
    mailgunRequest(
      ["messages", "create"],
      requiredInputString(input, "domain"),
      mailgunMessage(input),
    ),
  "mailgun:get-message": (input) =>
    mailgunRequest(
      ["messages", "retrieveStoredEmail"],
      requiredInputString(input, "domain"),
      requiredInputString(input, "messageKey"),
    ),
  "mailgun:list-messages": (input) =>
    mailgunRequest(
      ["events", "get"],
      requiredInputString(input, "domain"),
      definedFields({
        event: mailgunRecipients(input, "event"),
        limit: optionalInputNumber(input, "limit"),
      }),
    ),
  "mailgun:create-mailing-list": (input) =>
    mailgunRequest(
      ["lists", "create"],
      definedFields({
        address: requiredInputString(input, "address"),
        name: optionalInputString(input, "name"),
        description: optionalInputString(input, "description"),
        access_level: optionalInputString(input, "accessLevel"),
      }),
    ),
  "mailgun:get-mailing-list": (input) =>
    mailgunRequest(["lists", "get"], requiredInputString(input, "address")),
  "mailgun:add-list-member": (input) =>
    mailgunRequest(
      ["lists", "members", "createMember"],
      requiredInputString(input, "listAddress"),
      definedFields({
        address: requiredInputString(input, "address"),
        name: optionalInputString(input, "name"),
        vars: optionalInputJson(input, "vars"),
        subscribed: optionalInputBoolean(input, "subscribed"),
      }),
    ),
  "mailgun:list-domains": () => mailgunRequest(["domains", "list"]),
  "mailgun:get-domain": (input) =>
    mailgunRequest(["domains", "get"], requiredInputString(input, "domain")),
};

function assertMailgunOperationCoverage(): void {
  const expected = new Set(MAILGUN_OPERATION_IDS);
  const implemented = Object.keys(MAILGUN_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Mailgun provider SDK operation coverage is incomplete.");
  }
}

/** All pinned Mailgun actions use Mailgun's official Node SDK. */
export function createMailgunProviderSdk(
  config: MailgunProviderSdkConfig,
): IntegrationProviderSdk {
  assertMailgunOperationCoverage();
  const apiUrl = config.apiUrl ?? "https://api.mailgun.net";
  if (
    apiUrl !== "https://api.mailgun.net" &&
    apiUrl !== "https://api.eu.mailgun.net"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createMailgunClient;
  return {
    integrationId: "mailgun",
    operationIds: MAILGUN_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "mailgun" ||
        invocation.reference.integrationId !== "mailgun"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory = MAILGUN_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: await invokeSdkMethod(
            clientFactory(credential.apiKey, apiUrl),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getMailgunProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertMailgunOperationCoverage();
  return {
    operations: MAILGUN_OPERATION_IDS.length,
    operationIds: MAILGUN_OPERATION_IDS,
  };
}
