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

type GoogleFormsSdkClient = Record<string, unknown>;

type GoogleFormsClientFactory = (accessToken: string) => GoogleFormsSdkClient;

export interface GoogleFormsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleFormsClientFactory;
}

function createGoogleFormsClient(accessToken: string): GoogleFormsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { forms: google.forms({ version: "v1", auth }) };
}

const GOOGLE_FORMS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-forms",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleFormsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleFormsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleFormsSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleFormsRequests(
  input: Readonly<Record<string, unknown>>,
): readonly unknown[] {
  const requests = input.requests;
  if (
    !Array.isArray(requests) ||
    !requests.length ||
    requests.length > 100 ||
    requests.some(
      (request) =>
        !request || typeof request !== "object" || Array.isArray(request),
    )
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return requests;
}

function googleFormsEventType(
  input: Readonly<Record<string, unknown>>,
): "SCHEMA" | "RESPONSES" {
  const eventType = requiredInputString(input, "eventType");
  if (eventType !== "SCHEMA" && eventType !== "RESPONSES") {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return eventType;
}

function googleFormsWatchId(
  input: Readonly<Record<string, unknown>>,
): string | undefined {
  const watchId = optionalInputString(input, "watchId");
  if (
    watchId !== undefined &&
    (!/^[a-z0-9-]{4,63}$/u.test(watchId) || watchId.startsWith("-"))
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return watchId;
}

const GOOGLE_FORMS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleFormsSdkRequest
  >
> = {
  "google-forms:get-responses": (input) => {
    const formId = requiredInputString(input, "formId");
    const responseId = optionalInputString(input, "responseId");
    return responseId
      ? googleFormsRequest(["forms", "forms", "responses", "get"], {
          formId,
          responseId,
        })
      : googleFormsRequest(["forms", "forms", "responses", "list"], {
          formId,
          pageSize: optionalInputNumber(input, "pageSize"),
          pageToken: optionalInputString(input, "pageToken"),
          filter: optionalInputString(input, "filter"),
        });
  },
  "google-forms:get-form": (input) =>
    googleFormsRequest(["forms", "forms", "get"], {
      formId: requiredInputString(input, "formId"),
    }),
  "google-forms:create-form": (input) =>
    googleFormsRequest(["forms", "forms", "create"], {
      unpublished: optionalInputBoolean(input, "unpublished"),
      requestBody: {
        info: definedFields({
          title: requiredInputString(input, "title"),
          documentTitle: optionalInputString(input, "documentTitle"),
        }),
      },
    }),
  "google-forms:batch-update": (input) =>
    googleFormsRequest(["forms", "forms", "batchUpdate"], {
      formId: requiredInputString(input, "formId"),
      requestBody: {
        requests: googleFormsRequests(input),
        includeFormInResponse:
          optionalInputBoolean(input, "includeFormInResponse") ?? false,
      },
    }),
  "google-forms:set-publish-settings": (input) => {
    const isPublished = optionalInputBoolean(input, "isPublished");
    if (isPublished === undefined) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleFormsRequest(["forms", "forms", "setPublishSettings"], {
      formId: requiredInputString(input, "formId"),
      requestBody: {
        publishSettings: {
          publishState: definedFields({
            isPublished,
            isAcceptingResponses: optionalInputBoolean(
              input,
              "isAcceptingResponses",
            ),
          }),
        },
        updateMask: "publishState",
      },
    });
  },
  "google-forms:create-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "create"], {
      formId: requiredInputString(input, "formId"),
      requestBody: definedFields({
        watchId: googleFormsWatchId(input),
        watch: {
          target: {
            topic: { topicName: requiredInputString(input, "topicName") },
          },
          eventType: googleFormsEventType(input),
        },
      }),
    }),
  "google-forms:list-watches": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "list"], {
      formId: requiredInputString(input, "formId"),
    }),
  "google-forms:delete-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "delete"], {
      formId: requiredInputString(input, "formId"),
      watchId: requiredInputString(input, "watchId"),
    }),
  "google-forms:renew-watch": (input) =>
    googleFormsRequest(["forms", "forms", "watches", "renew"], {
      formId: requiredInputString(input, "formId"),
      watchId: requiredInputString(input, "watchId"),
      requestBody: {},
    }),
};

function assertGoogleFormsOperationCoverage(): void {
  const expected = new Set(GOOGLE_FORMS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_FORMS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Forms provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Forms actions use Google's official Node.js SDK. */
export function createGoogleFormsProviderSdk(
  config: GoogleFormsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleFormsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleFormsClient;
  return {
    integrationId: "google-forms",
    operationIds: GOOGLE_FORMS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-forms" ||
        invocation.reference.integrationId !== "google-forms"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_FORMS_OPERATION_REQUESTS[invocation.operationId];
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

export function getGoogleFormsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleFormsOperationCoverage();
  return {
    operations: GOOGLE_FORMS_OPERATION_IDS.length,
    operationIds: GOOGLE_FORMS_OPERATION_IDS,
  };
}
