import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../catalog";
import type { IntegrationOAuthRuntime } from "../runtime";
import { IntegrationProviderSdkError } from "../provider-sdk";
import type { IntegrationProviderSdk } from "../provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "./shared";

type GoogleGroupsSdkClient = Record<string, unknown>;

type GoogleGroupsClientFactory = (accessToken: string) => GoogleGroupsSdkClient;

export interface GoogleGroupsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleGroupsClientFactory;
}

function createGoogleGroupsClient(accessToken: string): GoogleGroupsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    admin: google.admin({ version: "directory_v1", auth }),
    groupssettings: google.groupssettings({ version: "v1", auth }),
  };
}

const GOOGLE_GROUPS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-groups",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleGroupsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleGroupsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleGroupsSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleGroupsKey(input: Readonly<Record<string, unknown>>): string {
  return requiredInputString(input, "groupKey");
}

function googleGroupsMemberKey(
  input: Readonly<Record<string, unknown>>,
): string {
  return requiredInputString(input, "memberKey");
}

function googleGroupsRole(
  input: Readonly<Record<string, unknown>>,
  defaultRole?: "MEMBER",
): "MEMBER" | "MANAGER" | "OWNER" {
  const role = optionalInputString(input, "role") ?? defaultRole;
  if (role !== "MEMBER" && role !== "MANAGER" && role !== "OWNER") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return role;
}

const GOOGLE_GROUPS_SETTINGS_FIELDS = [
  "name",
  "description",
  "whoCanJoin",
  "whoCanViewMembership",
  "whoCanViewGroup",
  "whoCanPostMessage",
  "allowExternalMembers",
  "allowWebPosting",
  "primaryLanguage",
  "isArchived",
  "archiveOnly",
  "messageModerationLevel",
  "spamModerationLevel",
  "replyTo",
  "customReplyTo",
  "includeCustomFooter",
  "customFooterText",
  "sendMessageDenyNotification",
  "defaultMessageDenyNotificationText",
  "membersCanPostAsTheGroup",
  "includeInGlobalAddressList",
  "whoCanLeaveGroup",
  "whoCanContactOwner",
  "favoriteRepliesOnTop",
  "whoCanApproveMembers",
  "whoCanBanUsers",
  "whoCanModerateMembers",
  "whoCanModerateContent",
  "whoCanAssistContent",
  "enableCollaborativeInbox",
  "whoCanDiscoverGroup",
  "defaultSender",
] as const;

function googleGroupsSettingsBody(
  input: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const entries = GOOGLE_GROUPS_SETTINGS_FIELDS.flatMap((field) => {
    const value = input[field];
    return typeof value === "string" && value.length > 0
      ? ([[field, value]] as const)
      : [];
  });
  return Object.fromEntries(entries);
}

const GOOGLE_GROUPS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleGroupsSdkRequest
  >
> = {
  "google-groups:list-groups": (input) => {
    const domain = optionalInputString(input, "domain");
    return googleGroupsRequest(["admin", "groups", "list"], {
      customer: domain
        ? undefined
        : (optionalInputString(input, "customer") ?? "my_customer"),
      domain,
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      query: optionalInputString(input, "query"),
    });
  },
  "google-groups:get-group": (input) =>
    googleGroupsRequest(["admin", "groups", "get"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:create-group": (input) =>
    googleGroupsRequest(["admin", "groups", "insert"], {
      requestBody: definedFields({
        email: requiredInputString(input, "email"),
        name: requiredInputString(input, "name"),
        description: optionalInputString(input, "description"),
      }),
    }),
  "google-groups:update-group": (input) => {
    const requestBody = definedFields({
      name: optionalInputString(input, "name"),
      description: optionalInputString(input, "description"),
      email: optionalInputString(input, "email"),
    });
    if (!Object.keys(requestBody).length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleGroupsRequest(["admin", "groups", "patch"], {
      groupKey: googleGroupsKey(input),
      requestBody,
    });
  },
  "google-groups:delete-group": (input) =>
    googleGroupsRequest(["admin", "groups", "delete"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:list-members": (input) =>
    googleGroupsRequest(["admin", "members", "list"], {
      groupKey: googleGroupsKey(input),
      maxResults: optionalInputNumber(input, "maxResults"),
      pageToken: optionalInputString(input, "pageToken"),
      roles: optionalInputString(input, "roles"),
    }),
  "google-groups:get-member": (input) =>
    googleGroupsRequest(["admin", "members", "get"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:add-member": (input) =>
    googleGroupsRequest(["admin", "members", "insert"], {
      groupKey: googleGroupsKey(input),
      requestBody: {
        email: requiredInputString(input, "email"),
        role: googleGroupsRole(input, "MEMBER"),
      },
    }),
  "google-groups:update-member-role": (input) =>
    googleGroupsRequest(["admin", "members", "update"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
      requestBody: { role: googleGroupsRole(input) },
    }),
  "google-groups:remove-member": (input) =>
    googleGroupsRequest(["admin", "members", "delete"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:check-membership": (input) =>
    googleGroupsRequest(["admin", "members", "hasMember"], {
      groupKey: googleGroupsKey(input),
      memberKey: googleGroupsMemberKey(input),
    }),
  "google-groups:list-aliases": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "list"], {
      groupKey: googleGroupsKey(input),
    }),
  "google-groups:add-alias": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "insert"], {
      groupKey: googleGroupsKey(input),
      requestBody: { alias: requiredInputString(input, "alias") },
    }),
  "google-groups:remove-alias": (input) =>
    googleGroupsRequest(["admin", "groups", "aliases", "delete"], {
      groupKey: googleGroupsKey(input),
      alias: requiredInputString(input, "alias"),
    }),
  "google-groups:get-settings": (input) =>
    googleGroupsRequest(["groupssettings", "groups", "get"], {
      groupUniqueId: requiredInputString(input, "groupEmail"),
    }),
  "google-groups:update-settings": (input) =>
    googleGroupsRequest(["groupssettings", "groups", "update"], {
      groupUniqueId: requiredInputString(input, "groupEmail"),
      requestBody: googleGroupsSettingsBody(input),
    }),
};

function assertGoogleGroupsOperationCoverage(): void {
  const expected = new Set(GOOGLE_GROUPS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_GROUPS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Groups provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Groups actions use Google's official Node.js SDK. */
export function createGoogleGroupsProviderSdk(
  config: GoogleGroupsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleGroupsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleGroupsClient;
  return {
    integrationId: "google-groups",
    operationIds: GOOGLE_GROUPS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-groups" ||
        invocation.reference.integrationId !== "google-groups"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_GROUPS_OPERATION_REQUESTS[invocation.operationId];
      if (!requestFactory) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.oauthRuntime.withCredential(
        invocation.reference,
        async (credential) => ({
          operationId: invocation.operationId,
          output: sdkResponseData(
            await invokeSdkMethod(
              clientFactory(credential.accessToken),
              requestFactory(invocation.input),
            ),
          ),
        }),
      );
    },
  };
}

export function getGoogleGroupsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleGroupsOperationCoverage();
  return {
    operations: GOOGLE_GROUPS_OPERATION_IDS.length,
    operationIds: GOOGLE_GROUPS_OPERATION_IDS,
  };
}
