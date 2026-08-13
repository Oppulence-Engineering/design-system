import { z } from "zod";
import { requireOptionalSdk } from "../shared/optional-sdk";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import { createIntegrationTypedRestProvider } from "../../core/provider-rest";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
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

// -------------------------------------------------------------- Twilio Voice

const TWILIO_VOICE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "twilio-voice:make-call": {
    path: ["calls", "create"],
    params: (i) => [
      definedFields({
        to: requiredInputString(i, "to"),
        from: requiredInputString(i, "from"),
        // Twilio needs instructions for the call: a TwiML document or a URL
        // that returns one.
        twiml: optionalInputString(i, "twiml"),
        url: optionalInputString(i, "url"),
        statusCallback: optionalInputString(i, "statusCallback"),
        record: i.record === true ? true : undefined,
      }),
    ],
  },
  "twilio-voice:list-calls": {
    path: ["calls", "list"],
    params: (i) => [
      definedFields({
        to: optionalInputString(i, "to"),
        from: optionalInputString(i, "from"),
        status: optionalInputString(i, "status"),
        limit: optionalInputNumber(i, "limit") ?? 50,
      }),
    ],
  },
  "twilio-voice:get-recording": {
    path: ["recordings"],
    invoke: ({ client, input }) => {
      const recordings = (
        client as unknown as {
          recordings: (sid: string) => { fetch(): Promise<unknown> };
        }
      ).recordings;
      const sid = requiredInputString(input, "recordingSid", "sid");
      if (!/^RE[a-f0-9]{32}$/iu.test(sid)) throw invocationError();
      return recordings(sid).fetch();
    },
  },
};

/** Twilio authenticates with an account SID and an auth token. */
export const createTwilioClient: VendorClientFactory = (credential) => {
  const twilio = requireOptionalSdk("twilio") as (
    accountSid: string,
    authToken: string,
  ) => SdkMethodTarget;
  return twilio(
    requiredVendorField(credential, "accountSid"),
    vendorToken(credential),
  );
};

export function createTwilioVoicePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "twilio-voice",
    driver: "twilio@6.0.2",
    transportKind: "api_key",
    operations: TWILIO_VOICE_OPERATIONS,
    clientFactory: options.clientFactory ?? createTwilioClient,
  });
}
