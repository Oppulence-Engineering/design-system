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

type GoogleMeetSdkClient = Record<string, unknown>;

type GoogleMeetClientFactory = (accessToken: string) => GoogleMeetSdkClient;

export interface GoogleMeetProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleMeetClientFactory;
}

function createGoogleMeetClient(accessToken: string): GoogleMeetSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { meet: google.meet({ version: "v2", auth }) };
}

const GOOGLE_MEET_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-meet",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

interface GoogleMeetSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleMeetRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleMeetSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleMeetSpaceName(input: Readonly<Record<string, unknown>>): string {
  const value = requiredInputString(input, "spaceName");
  return value.startsWith("spaces/") ? value : `spaces/${value}`;
}

function googleMeetConferenceName(
  input: Readonly<Record<string, unknown>>,
): string {
  const value = requiredInputString(input, "conferenceName");
  return value.startsWith("conferenceRecords/")
    ? value
    : `conferenceRecords/${value}`;
}

const GOOGLE_MEET_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleMeetSdkRequest
  >
> = {
  "google-meet:create-space": (input) =>
    googleMeetRequest(["meet", "spaces", "create"], {
      requestBody: definedFields({
        config:
          optionalInputString(input, "accessType") ||
          optionalInputString(input, "entryPointAccess")
            ? definedFields({
                accessType: optionalInputString(input, "accessType"),
                entryPointAccess: optionalInputString(
                  input,
                  "entryPointAccess",
                ),
              })
            : undefined,
      }),
    }),
  "google-meet:get-space": (input) =>
    googleMeetRequest(["meet", "spaces", "get"], {
      name: googleMeetSpaceName(input),
    }),
  "google-meet:end-conference": (input) =>
    googleMeetRequest(["meet", "spaces", "endActiveConference"], {
      name: googleMeetSpaceName(input),
      requestBody: {},
    }),
  "google-meet:list-conference-records": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "list"], {
      filter: optionalInputString(input, "filter"),
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
    }),
  "google-meet:get-conference-record": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "get"], {
      name: googleMeetConferenceName(input),
    }),
  "google-meet:list-participants": (input) =>
    googleMeetRequest(["meet", "conferenceRecords", "participants", "list"], {
      parent: googleMeetConferenceName(input),
      filter: optionalInputString(input, "filter"),
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
    }),
};

function assertGoogleMeetOperationCoverage(): void {
  const expected = new Set(GOOGLE_MEET_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_MEET_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Meet provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Meet actions use Google's official Node.js SDK. */
export function createGoogleMeetProviderSdk(
  config: GoogleMeetProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleMeetOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleMeetClient;
  return {
    integrationId: "google-meet",
    operationIds: GOOGLE_MEET_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-meet" ||
        invocation.reference.integrationId !== "google-meet"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_MEET_OPERATION_REQUESTS[invocation.operationId];
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

export function getGoogleMeetProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleMeetOperationCoverage();
  return {
    operations: GOOGLE_MEET_OPERATION_IDS.length,
    operationIds: GOOGLE_MEET_OPERATION_IDS,
  };
}
