import { google } from "googleapis";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  sdkResponseData,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** googleapis wraps every response in a `data` envelope. */
const googleOutput = (value: unknown): unknown => sdkResponseData(value);

function googleClient(
  service: "vault" | "bigquery" | "translate",
  version: string,
): VendorClientFactory {
  return (credential) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: vendorToken(credential) });
    const factory = google[service] as (options: {
      version: string;
      auth: unknown;
    }) => unknown;
    return factory({ version, auth }) as SdkMethodTarget;
  };
}

// ---------------------------------------------------------- Google Translate

const TRANSLATE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "google-translate:translate-text": {
    path: ["translations", "translate"],
    params: (i) => [
      {
        requestBody: definedFields({
          q: requiredInputStringArray(i, "text", "q"),
          target: requiredInputString(i, "target", "targetLanguage"),
          source: optionalInputString(i, "source", "sourceLanguage"),
          format: optionalInputString(i, "format") ?? "text",
        }),
      },
    ],
    output: googleOutput,
  },
  "google-translate:detect-language": {
    path: ["detections", "detect"],
    params: (i) => [
      { requestBody: { q: requiredInputStringArray(i, "text", "q") } },
    ],
    output: googleOutput,
  },
};

/**
 * The Translation API authenticates with an API key rather than a user token,
 * so the key is the credential and there is no per-tenant host.
 */
const createGoogleTranslateClient: VendorClientFactory = (credential) => {
  const factory = google.translate as (options: {
    version: string;
    auth: string;
  }) => unknown;
  return factory({
    version: "v2",
    auth: vendorToken(credential),
  }) as SdkMethodTarget;
};

export function createGoogleTranslatePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "google-translate",
    driver: "googleapis translate v2",
    transportKind: "api_key",
    operations: TRANSLATE_OPERATIONS,
    clientFactory: options.clientFactory ?? createGoogleTranslateClient,
  });
}
