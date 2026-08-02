import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
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

const deskRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

// ----------------------------------------------------------------- DocuSign

interface DocuSignClient extends SdkMethodTarget {
  envelopesApi: {
    createEnvelope(accountId: string, options: unknown): Promise<unknown>;
    getEnvelope(accountId: string, envelopeId: string): Promise<unknown>;
    listStatusChanges(accountId: string, options: unknown): Promise<unknown>;
    update(
      accountId: string,
      envelopeId: string,
      options: unknown,
    ): Promise<unknown>;
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string,
    ): Promise<unknown>;
    listRecipients(accountId: string, envelopeId: string): Promise<unknown>;
  };
  templatesApi: {
    listTemplates(accountId: string, options?: unknown): Promise<unknown>;
  };
  accountId: string;
}

/** A DocuSign envelope ID is a GUID. */
function envelopeId(input: VendorInput): string {
  const value = requiredInputString(input, "envelopeId", "id");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw invocationError();
  }
  return value;
}

const DOCUSIGN_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "docusign:send-envelope": {
    path: ["envelopesApi", "createEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.createEnvelope(docusign.accountId, {
        envelopeDefinition: definedFields({
          emailSubject: requiredInputString(input, "emailSubject", "subject"),
          emailBlurb: optionalInputString(input, "emailBody", "message"),
          documents: input.documents,
          recipients: optionalInputRecord(input, "recipients"),
          // "sent" dispatches immediately; "created" leaves it a draft.
          status: optionalInputString(input, "status") ?? "sent",
        }),
      });
    },
  },
  "docusign:send-from-template": {
    path: ["envelopesApi", "createEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.createEnvelope(docusign.accountId, {
        envelopeDefinition: definedFields({
          templateId: requiredInputString(input, "templateId"),
          emailSubject: optionalInputString(input, "emailSubject", "subject"),
          templateRoles: input.templateRoles ?? input.roles,
          status: optionalInputString(input, "status") ?? "sent",
        }),
      });
    },
  },
  "docusign:get-envelope": {
    path: ["envelopesApi", "getEnvelope"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.getEnvelope(
        docusign.accountId,
        envelopeId(input),
      );
    },
  },
  "docusign:list-envelopes": {
    path: ["envelopesApi", "listStatusChanges"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.listStatusChanges(
        docusign.accountId,
        definedFields({
          // DocuSign requires a lower bound on the search window.
          fromDate:
            optionalInputString(input, "fromDate") ??
            new Date(Date.now() - 30 * 86_400_000).toISOString(),
          status: optionalInputString(input, "status"),
          count: optionalInputNumber(input, "limit", "count"),
        }),
      );
    },
  },
  "docusign:void-envelope": {
    path: ["envelopesApi", "update"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.update(
        docusign.accountId,
        envelopeId(input),
        {
          envelope: {
            status: "voided",
            voidedReason: requiredInputString(input, "reason", "voidedReason"),
          },
        },
      );
    },
  },
  "docusign:download-document": {
    path: ["envelopesApi", "getDocument"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      // "combined" is DocuSign's alias for the whole envelope as one PDF.
      const documentId = optionalInputString(input, "documentId") ?? "combined";
      if (!/^[A-Za-z0-9_-]{1,64}$/u.test(documentId)) throw invocationError();
      return docusign.envelopesApi.getDocument(
        docusign.accountId,
        envelopeId(input),
        documentId,
      );
    },
  },
  "docusign:list-recipients": {
    path: ["envelopesApi", "listRecipients"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.envelopesApi.listRecipients(
        docusign.accountId,
        envelopeId(input),
      );
    },
  },
  "docusign:list-templates": {
    path: ["templatesApi", "listTemplates"],
    invoke: ({ client, input }) => {
      const docusign = client as unknown as DocuSignClient;
      return docusign.templatesApi.listTemplates(
        docusign.accountId,
        definedFields({
          count: optionalInputNumber(input, "limit", "count"),
          searchText: optionalInputString(input, "search", "searchText"),
        }),
      );
    },
  },
};

/**
 * DocuSign issues a per-account base URI at consent time, and every call takes
 * the account ID. Both are non-secret connection state, stored beside the
 * token rather than accepted as operation input.
 */
export const createDocuSignClient: VendorClientFactory = (credential) => {
  const docusign = deskRequire("docusign-esign") as {
    ApiClient: new (config?: Record<string, unknown>) => {
      setBasePath(path: string): void;
      addDefaultHeader(name: string, value: string): void;
    };
    EnvelopesApi: new (client: unknown) => DocuSignClient["envelopesApi"];
    TemplatesApi: new (client: unknown) => DocuSignClient["templatesApi"];
  };
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(requiredVendorField(credential, "basePath"));
  apiClient.addDefaultHeader(
    "Authorization",
    `Bearer ${vendorToken(credential)}`,
  );
  return {
    envelopesApi: new docusign.EnvelopesApi(apiClient),
    templatesApi: new docusign.TemplatesApi(apiClient),
    accountId: requiredVendorField(credential, "accountId"),
  } as unknown as SdkMethodTarget;
};

export function createDocuSignPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "docusign",
    driver: "docusign-esign@10.0.0",
    transportKind: "oauth2",
    operations: DOCUSIGN_OPERATIONS,
    clientFactory: options.clientFactory ?? createDocuSignClient,
  });
}
