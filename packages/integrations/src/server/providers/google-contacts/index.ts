import { google } from "googleapis";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationOAuthRuntime } from "../../runtime/oauth";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
  sdkResponseData,
} from "../shared/sdk";

type GoogleContactsSdkClient = Record<string, unknown>;

type GoogleContactsClientFactory = (
  accessToken: string,
) => GoogleContactsSdkClient;

export interface GoogleContactsProviderSdkConfig {
  oauthRuntime: Pick<IntegrationOAuthRuntime, "withCredential">;
  clientFactory?: GoogleContactsClientFactory;
}

function createGoogleContactsClient(
  accessToken: string,
): GoogleContactsSdkClient {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { people: google.people({ version: "v1", auth }) };
}

const GOOGLE_CONTACTS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "google-contacts",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const GOOGLE_CONTACTS_PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,biographies,urls,photos,metadata";

interface GoogleContactsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function googleContactsRequest(
  path: readonly string[],
  request: Record<string, unknown> = {},
): GoogleContactsSdkRequest {
  return { path, arguments: [definedFields(request)] };
}

function googleContactsPerson(
  input: Readonly<Record<string, unknown>>,
  includeConcurrencyControl: boolean,
): { person: Record<string, unknown>; updateFields: string[] } {
  const givenName = optionalInputString(input, "givenName");
  const familyName = optionalInputString(input, "familyName");
  const email = optionalInputString(input, "email");
  const phone = optionalInputString(input, "phone");
  const organization = optionalInputString(input, "organization");
  const jobTitle = optionalInputString(input, "jobTitle");
  const notes = optionalInputString(input, "notes");
  const updateFields = [
    givenName || familyName ? "names" : undefined,
    email ? "emailAddresses" : undefined,
    phone ? "phoneNumbers" : undefined,
    organization || jobTitle ? "organizations" : undefined,
    notes ? "biographies" : undefined,
  ].filter((field): field is string => Boolean(field));
  const etag = includeConcurrencyControl
    ? requiredInputString(input, "etag")
    : undefined;
  return {
    updateFields,
    person: definedFields({
      etag,
      metadata: etag ? { sources: [{ type: "CONTACT", etag }] } : undefined,
      names:
        givenName || familyName
          ? [definedFields({ givenName, familyName })]
          : undefined,
      emailAddresses: email
        ? [
            {
              value: email,
              type: optionalInputString(input, "emailType") ?? "other",
            },
          ]
        : undefined,
      phoneNumbers: phone
        ? [
            {
              value: phone,
              type: optionalInputString(input, "phoneType") ?? "mobile",
            },
          ]
        : undefined,
      organizations:
        organization || jobTitle
          ? [definedFields({ name: organization, title: jobTitle })]
          : undefined,
      biographies: notes
        ? [{ value: notes, contentType: "TEXT_PLAIN" }]
        : undefined,
    }),
  };
}

const GOOGLE_CONTACTS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => GoogleContactsSdkRequest
  >
> = {
  "google-contacts:create-contact": (input) => {
    const { person } = googleContactsPerson(input, false);
    if (!Array.isArray(person.names)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleContactsRequest(["people", "people", "createContact"], {
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      requestBody: person,
    });
  },
  "google-contacts:get-contact": (input) =>
    googleContactsRequest(["people", "people", "get"], {
      resourceName: requiredInputString(input, "resourceName"),
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
    }),
  "google-contacts:list-contacts": (input) =>
    googleContactsRequest(["people", "people", "connections", "list"], {
      resourceName: "people/me",
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      pageSize: optionalInputNumber(input, "pageSize"),
      pageToken: optionalInputString(input, "pageToken"),
      sortOrder: optionalInputString(input, "sortOrder"),
    }),
  "google-contacts:search-contacts": (input) =>
    googleContactsRequest(["people", "people", "searchContacts"], {
      query: requiredInputString(input, "query"),
      readMask: GOOGLE_CONTACTS_PERSON_FIELDS,
      pageSize: optionalInputNumber(input, "pageSize"),
    }),
  "google-contacts:update-contact": (input) => {
    const { person, updateFields } = googleContactsPerson(input, true);
    if (!updateFields.length) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return googleContactsRequest(["people", "people", "updateContact"], {
      resourceName: requiredInputString(input, "resourceName"),
      updatePersonFields: updateFields.join(","),
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      requestBody: person,
    });
  },
  "google-contacts:delete-contact": (input) =>
    googleContactsRequest(["people", "people", "deleteContact"], {
      resourceName: requiredInputString(input, "resourceName"),
    }),
};

function assertGoogleContactsOperationCoverage(): void {
  const expected = new Set(GOOGLE_CONTACTS_OPERATION_IDS);
  const implemented = Object.keys(GOOGLE_CONTACTS_OPERATION_REQUESTS);
  if (
    expected.size !== implemented.length ||
    implemented.some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "Google Contacts provider SDK operation coverage is incomplete.",
    );
  }
}

/** All pinned Google Contacts actions use Google's official Node.js SDK. */
export function createGoogleContactsProviderSdk(
  config: GoogleContactsProviderSdkConfig,
): IntegrationProviderSdk {
  assertGoogleContactsOperationCoverage();
  const clientFactory = config.clientFactory ?? createGoogleContactsClient;
  return {
    integrationId: "google-contacts",
    operationIds: GOOGLE_CONTACTS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "google-contacts" ||
        invocation.reference.integrationId !== "google-contacts"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const requestFactory =
        GOOGLE_CONTACTS_OPERATION_REQUESTS[invocation.operationId];
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

export function getGoogleContactsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertGoogleContactsOperationCoverage();
  return {
    operations: GOOGLE_CONTACTS_OPERATION_IDS.length,
    operationIds: GOOGLE_CONTACTS_OPERATION_IDS,
  };
}
