import { IntercomClient } from "intercom-client";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationApiKeyRuntime } from "../api-key-runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputCsv,
  optionalInputJson,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "./shared";

type IntercomSdkClient = Record<string, unknown>;

type IntercomClientFactory = (apiKey: string) => IntercomSdkClient;

export interface IntercomProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: IntercomClientFactory;
}

function createIntercomClient(apiKey: string): IntercomSdkClient {
  return new IntercomClient({ token: apiKey }) as unknown as IntercomSdkClient;
}

const INTERCOM_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "intercom",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface IntercomSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function intercomRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): IntercomSdkRequest {
  return { path, arguments: arguments_ };
}

function intercomFields(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> {
  return definedFields(
    Object.fromEntries(fields.map((field) => [field, input[field]])),
  );
}

function intercomJsonObject(
  input: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> | undefined {
  const value = optionalInputJson(input, field);
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value as Record<string, unknown>;
}

function intercomRequiredJsonArrayOrId(
  input: Readonly<Record<string, unknown>>,
  field: string,
): unknown[] {
  const value = requiredInputString(input, field);
  const parsed = optionalInputJson({ [field]: value }, field);
  if (Array.isArray(parsed)) return parsed;
  return [{ id: value }];
}

function intercomSearchRequest(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const query = intercomJsonObject(input, "query");
  if (!query) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const pagination = intercomFields(input, ["per_page", "starting_after"]);
  return definedFields({
    query,
    pagination: Object.keys(pagination).length ? pagination : undefined,
  });
}

function intercomConversationPart(
  input: Readonly<Record<string, unknown>>,
  messageType: string,
): Record<string, unknown> {
  const body = intercomFields(input, [
    "type",
    "admin_id",
    "assignee_id",
    "body",
    "snoozed_until",
    "created_at",
  ]);
  const attachmentUrls = optionalInputCsv(input, "attachment_urls");
  return definedFields({
    message_type: messageType,
    type: body.type ?? "admin",
    ...body,
    attachment_urls: attachmentUrls,
  });
}

const INTERCOM_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => IntercomSdkRequest
  >
> = {
  "intercom:create-contact": (input) =>
    intercomRequest(
      ["contacts", "create"],
      definedFields({
        ...intercomFields(input, [
          "role",
          "email",
          "external_id",
          "phone",
          "name",
          "avatar",
          "signed_up_at",
          "last_seen_at",
          "owner_id",
          "unsubscribed_from_emails",
          "company_id",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:get-contact": (input) =>
    intercomRequest(["contacts", "find"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
    }),
  "intercom:update-contact": (input) =>
    intercomRequest(
      ["contacts", "update"],
      definedFields({
        contact_id: requiredInputString(input, "contactId", "contact_id"),
        ...intercomFields(input, [
          "role",
          "email",
          "external_id",
          "phone",
          "name",
          "avatar",
          "signed_up_at",
          "last_seen_at",
          "owner_id",
          "unsubscribed_from_emails",
          "company_id",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:list-contacts": (input) =>
    intercomRequest(
      ["contacts", "list"],
      intercomFields(input, ["page", "per_page", "starting_after"]),
    ),
  "intercom:search-contacts": (input) =>
    intercomRequest(["contacts", "search"], intercomSearchRequest(input)),
  "intercom:delete-contact": (input) =>
    intercomRequest(["contacts", "delete"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
    }),
  "intercom:create-company": (input) =>
    intercomRequest(
      ["companies", "createOrUpdate"],
      definedFields({
        ...intercomFields(input, [
          "company_id",
          "name",
          "website",
          "plan",
          "size",
          "industry",
          "monthly_spend",
          "remote_created_at",
        ]),
        custom_attributes: intercomJsonObject(input, "custom_attributes"),
      }),
    ),
  "intercom:get-company": (input) =>
    intercomRequest(["companies", "find"], {
      company_id: requiredInputString(input, "companyId", "company_id"),
    }),
  "intercom:list-companies": (input) =>
    intercomRequest(
      ["companies", "list"],
      intercomFields(input, ["page", "per_page", "order"]),
    ),
  "intercom:get-conversation": (input) =>
    intercomRequest(
      ["conversations", "find"],
      definedFields({
        conversation_id: requiredInputString(
          input,
          "conversationId",
          "conversation_id",
        ),
        ...intercomFields(input, ["display_as", "include_translations"]),
      }),
    ),
  "intercom:list-conversations": (input) =>
    intercomRequest(
      ["conversations", "list"],
      intercomFields(input, ["per_page", "starting_after"]),
    ),
  "intercom:reply-to-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(
        input,
        requiredInputString(input, "message_type"),
      ),
    }),
  "intercom:search-conversations": (input) =>
    intercomRequest(["conversations", "search"], intercomSearchRequest(input)),
  "intercom:create-ticket": (input) =>
    intercomRequest(
      ["tickets", "create"],
      definedFields({
        ticket_type_id: requiredInputString(input, "ticket_type_id"),
        contacts: intercomRequiredJsonArrayOrId(input, "contacts"),
        ticket_attributes: intercomJsonObject(input, "ticket_attributes"),
        ...intercomFields(input, [
          "company_id",
          "created_at",
          "conversation_to_link_id",
        ]),
        skip_notifications: optionalInputBoolean(
          input,
          "disable_notifications",
        ),
      }),
    ),
  "intercom:get-ticket": (input) =>
    intercomRequest(["tickets", "get"], {
      ticket_id: requiredInputString(input, "ticketId", "ticket_id"),
    }),
  "intercom:update-ticket": (input) =>
    intercomRequest(
      ["tickets", "update"],
      definedFields({
        ticket_id: requiredInputString(input, "ticketId", "ticket_id"),
        ...intercomFields(input, [
          "open",
          "is_shared",
          "snoozed_until",
          "admin_id",
          "assignee_id",
        ]),
        ticket_attributes: intercomJsonObject(input, "ticket_attributes"),
      }),
    ),
  "intercom:create-message": (input) =>
    intercomRequest(
      ["messages", "create"],
      definedFields({
        message_type: requiredInputString(input, "message_type"),
        template: optionalInputString(input, "template"),
        subject: optionalInputString(input, "subject"),
        body: requiredInputString(input, "body"),
        from: {
          type: requiredInputString(input, "from_type"),
          id: requiredInputString(input, "from_id"),
        },
        to: {
          type: requiredInputString(input, "to_type"),
          id: requiredInputString(input, "to_id"),
        },
        created_at: optionalInputNumber(input, "created_at"),
      }),
    ),
  "intercom:list-admins": () => intercomRequest(["admins", "list"]),
  "intercom:close-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "close"),
    }),
  "intercom:open-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "open"),
    }),
  "intercom:snooze-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "snoozed"),
    }),
  "intercom:assign-conversation": (input) =>
    intercomRequest(["conversations", "reply"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      body: intercomConversationPart(input, "assignment"),
    }),
  "intercom:list-tags": () => intercomRequest(["tags", "list"]),
  "intercom:create-tag": (input) =>
    intercomRequest(
      ["tags", "create"],
      definedFields({
        name: requiredInputString(input, "name"),
        id: optionalInputString(input, "id"),
      }),
    ),
  "intercom:tag-contact": (input) =>
    intercomRequest(["tags", "tagContact"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
      id: requiredInputString(input, "tagId", "tag_id"),
    }),
  "intercom:untag-contact": (input) =>
    intercomRequest(["tags", "untagContact"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
      tag_id: requiredInputString(input, "tagId", "tag_id"),
    }),
  "intercom:tag-conversation": (input) =>
    intercomRequest(["tags", "tagConversation"], {
      conversation_id: requiredInputString(
        input,
        "conversationId",
        "conversation_id",
      ),
      id: requiredInputString(input, "tagId", "tag_id"),
      admin_id: requiredInputString(input, "admin_id"),
    }),
  "intercom:create-note": (input) =>
    intercomRequest(
      ["notes", "create"],
      definedFields({
        contact_id: requiredInputString(input, "contactId", "contact_id"),
        body: requiredInputString(input, "body"),
        admin_id: optionalInputString(input, "admin_id"),
      }),
    ),
  "intercom:create-event": (input) =>
    intercomRequest(
      ["events", "create"],
      definedFields({
        event_name: requiredInputString(input, "event_name"),
        created_at:
          optionalInputNumber(input, "created_at") ??
          Math.floor(Date.now() / 1_000),
        ...intercomFields(input, ["user_id", "email", "id"]),
        metadata: intercomJsonObject(input, "metadata"),
      }),
    ),
  "intercom:attach-contact-to-company": (input) =>
    intercomRequest(["companies", "attachContact"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
      id: requiredInputString(input, "companyId", "company_id"),
    }),
  "intercom:detach-contact-from-company": (input) =>
    intercomRequest(["companies", "detachContact"], {
      contact_id: requiredInputString(input, "contactId", "contact_id"),
      company_id: requiredInputString(input, "companyId", "company_id"),
    }),
};

function assertIntercomOperationCoverage(): void {
  const expected = new Set(INTERCOM_OPERATION_IDS);
  const implemented = Object.keys(INTERCOM_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error("Intercom provider SDK operation coverage is incomplete.");
  }
}

/**
 * All pinned Intercom actions execute through Intercom's official SDK. Product
 * code never sees or transports the API token; the SDK is constructed only
 * inside the package's encrypted API-key runtime.
 */
export function createIntercomProviderSdk(
  config: IntercomProviderSdkConfig,
): IntegrationProviderSdk {
  assertIntercomOperationCoverage();
  const clientFactory = config.clientFactory ?? createIntercomClient;
  return {
    integrationId: "intercom",
    operationIds: INTERCOM_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "intercom" ||
        invocation.reference.integrationId !== "intercom"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        INTERCOM_OPERATION_REQUESTS[invocation.operationId];
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
            clientFactory(credential.apiKey),
            requestFactory(invocation.input),
          ),
        }),
      );
    },
  };
}

export function getIntercomProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertIntercomOperationCoverage();
  return {
    operations: INTERCOM_OPERATION_IDS.length,
    operationIds: INTERCOM_OPERATION_IDS,
  };
}
