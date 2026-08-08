import {
  IntegrationCredentialDefinitionSchema,
  IntegrationEvidenceSchema,
  IntegrationSurfaceSchema,
  StableMetadataIdSchema,
  type IntegrationCredentialDefinition,
  type IntegrationEvidence,
  type IntegrationSurface,
} from "./surfaces";

export interface IntegrationMetadata {
  readonly surfaces: readonly IntegrationSurface[];
  readonly credentials: Readonly<
    Record<string, IntegrationCredentialDefinition>
  >;
  readonly evidence: readonly IntegrationEvidence[];
}

function metadata(input: {
  surfaces: readonly unknown[];
  credentials: Readonly<Record<string, unknown>>;
  evidence: readonly unknown[];
}): IntegrationMetadata {
  const credentials = Object.fromEntries(
    Object.entries(input.credentials).map(([id, credential]) => [
      StableMetadataIdSchema.parse(id),
      IntegrationCredentialDefinitionSchema.parse(credential),
    ]),
  );
  return {
    surfaces: input.surfaces.map((surface) =>
      IntegrationSurfaceSchema.parse(surface),
    ),
    credentials,
    evidence: input.evidence.map((entry) =>
      IntegrationEvidenceSchema.parse(entry),
    ),
  };
}

const stripeEvidence = {
  id: "stripe-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://docs.stripe.com/api",
  verificationStatus: "unknown",
} as const;

const slackEvidence = {
  id: "slack-web-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://api.slack.com/web",
  verificationStatus: "unknown",
} as const;

const githubEvidence = {
  id: "github-rest-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://docs.github.com/en/rest",
  verificationStatus: "unknown",
} as const;

const gmailEvidence = {
  id: "gmail-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://developers.google.com/gmail/api",
  verificationStatus: "unknown",
} as const;

const postgresEvidence = {
  id: "postgresql-connection-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://www.postgresql.org/docs/current/libpq-connect.html",
  verificationStatus: "unknown",
} as const;

const quickbooksEvidence = {
  id: "quickbooks-accounting-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl:
    "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
  verificationStatus: "unknown",
} as const;

const xeroEvidence = {
  id: "xero-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://developer.xero.com/documentation/api/accounting/overview",
  verificationStatus: "unknown",
} as const;

const hubspotEvidence = {
  id: "hubspot-api-docs",
  type: "official-docs",
  basis: "discovered",
  sourceUrl: "https://developers.hubspot.com/docs/api/overview",
  verificationStatus: "unknown",
} as const;

/**
 * Initial internal metadata for providers that already have package-owned
 * runtime adapters. This intentionally starts small: metadata is promoted
 * provider-by-provider after its source and auth requirements are reviewed.
 */
export const INTEGRATION_METADATA: Readonly<
  Record<string, IntegrationMetadata>
> = {
  stripe: metadata({
    evidence: [stripeEvidence],
    credentials: {
      "stripe-secret-key": {
        type: "api_key",
        label: "Stripe secret key",
        description:
          "A restricted or standard secret key for Stripe API calls.",
        fields: [
          {
            id: "secret-key",
            label: "Secret key",
            description:
              "The Stripe secret key used in the Authorization header.",
            secret: true,
          },
        ],
        setupUrl: "https://dashboard.stripe.com/apikeys",
        setup:
          "Create a restricted key when possible and grant only the permissions required by the enabled operations.",
        scopes: [],
        rotation: {
          supported: true,
          guidance:
            "Create the replacement key, validate it, then revoke the previous key.",
        },
      },
    },
    surfaces: [
      {
        id: "stripe-http",
        type: "http",
        name: "Stripe HTTP API",
        description:
          "Stripe's HTTPS API for payments, customers, and billing resources.",
        endpoint: "https://api.stripe.com",
        docsUrl: "https://docs.stripe.com/api",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [
                {
                  credentialId: "stripe-secret-key",
                  placement: "header",
                  name: "Authorization",
                  scheme: "Bearer",
                },
              ],
            },
          ],
        },
        evidenceIds: [stripeEvidence.id],
      },
    ],
  }),
  slack: metadata({
    evidence: [slackEvidence],
    credentials: {
      "slack-oauth": {
        type: "oauth2",
        label: "Slack OAuth app",
        description:
          "An OAuth installation that grants the selected Slack scopes.",
        fields: [
          {
            id: "client-id",
            label: "Client ID",
            description: "The Slack app client ID configured by the product.",
            secret: false,
          },
          {
            id: "client-secret",
            label: "Client secret",
            description:
              "The Slack app client secret configured by the product.",
            secret: true,
          },
        ],
        acquisition: "oauth",
        setupUrl: "https://api.slack.com/apps",
        setup:
          "Install the product's Slack app and approve only the scopes required by the enabled capabilities.",
        scopes: ["chat:write", "channels:history"],
        rotation: {
          supported: true,
          guidance:
            "Rotate the app secret through the product's server-side secret configuration.",
        },
      },
    },
    surfaces: [
      {
        id: "slack-http",
        type: "http",
        name: "Slack Web API",
        description:
          "Slack's HTTPS Web API for messages, conversations, and workspace resources.",
        endpoint: "https://slack.com/api",
        docsUrl: "https://api.slack.com/web",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [{ credentialId: "slack-oauth", placement: "oauth" }],
            },
          ],
        },
        evidenceIds: [slackEvidence.id],
      },
    ],
  }),
  github: metadata({
    evidence: [githubEvidence],
    credentials: {
      "github-pat": {
        type: "pat",
        label: "GitHub personal access token",
        description:
          "A fine-grained token scoped to the repositories and actions in use.",
        fields: [
          {
            id: "token",
            label: "Token",
            description: "The GitHub token used as a bearer credential.",
            secret: true,
          },
        ],
        setupUrl: "https://github.com/settings/personal-access-tokens",
        setup:
          "Create a fine-grained token with the minimum repository and organization permissions required.",
        scopes: [],
        rotation: {
          supported: true,
          guidance:
            "Create and validate a replacement token before revoking the old token.",
        },
      },
    },
    surfaces: [
      {
        id: "github-http",
        type: "http",
        name: "GitHub REST API",
        description:
          "GitHub's HTTPS API for repositories, issues, pull requests, and organizations.",
        endpoint: "https://api.github.com",
        docsUrl: "https://docs.github.com/en/rest",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [
                {
                  credentialId: "github-pat",
                  placement: "header",
                  name: "Authorization",
                  scheme: "Bearer",
                },
              ],
            },
          ],
        },
        evidenceIds: [githubEvidence.id],
      },
    ],
  }),
  gmail: metadata({
    evidence: [gmailEvidence],
    credentials: {
      "google-workspace-oauth": {
        type: "oauth2",
        label: "Google Workspace OAuth",
        description:
          "An OAuth grant for the selected Google Workspace APIs and scopes.",
        fields: [
          {
            id: "client-id",
            label: "Client ID",
            description:
              "The Google OAuth client ID configured by the product.",
            secret: false,
          },
          {
            id: "client-secret",
            label: "Client secret",
            description:
              "The Google OAuth client secret configured by the product.",
            secret: true,
          },
        ],
        acquisition: "oauth",
        setupUrl: "https://console.cloud.google.com/apis/credentials",
        setup:
          "Configure the OAuth consent screen and request only the Gmail scopes required by the product outcome.",
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        rotation: {
          supported: true,
          guidance:
            "Rotate the OAuth client secret through the product's server-side configuration.",
        },
      },
    },
    surfaces: [
      {
        id: "gmail-http",
        type: "http",
        name: "Gmail API",
        description:
          "Google's Gmail API for messages, threads, labels, and drafts.",
        endpoint: "https://gmail.googleapis.com/gmail/v1",
        docsUrl: "https://developers.google.com/gmail/api",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [
                { credentialId: "google-workspace-oauth", placement: "oauth" },
              ],
            },
          ],
        },
        evidenceIds: [gmailEvidence.id],
      },
    ],
  }),
  postgresql: metadata({
    evidence: [postgresEvidence],
    credentials: {
      "postgresql-connection": {
        type: "compound",
        label: "PostgreSQL connection",
        description:
          "The host, database, user, and password needed for a PostgreSQL connection.",
        fields: [
          { id: "host", label: "Host", description: "Database hostname." },
          {
            id: "port",
            label: "Port",
            description: "Database port.",
            required: false,
          },
          { id: "database", label: "Database", description: "Database name." },
          { id: "user", label: "User", description: "Database user." },
          {
            id: "password",
            label: "Password",
            description: "Database password.",
            secret: true,
          },
        ],
        setup:
          "Provide the database connection details through a server-side secret or connection form.",
        scopes: [],
        rotation: {
          supported: true,
          guidance:
            "Rotate the password or connection secret, validate connectivity, then retire the old value.",
        },
      },
    },
    surfaces: [
      {
        id: "postgresql-driver",
        type: "special",
        name: "PostgreSQL driver",
        description:
          "A package-owned PostgreSQL protocol adapter for governed data operations.",
        packageName: "pg",
        docsUrl: "https://www.postgresql.org/docs/current/libpq-connect.html",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [
                {
                  credentialId: "postgresql-connection",
                  placement: "connection",
                },
              ],
            },
          ],
        },
        evidenceIds: [postgresEvidence.id],
        notes:
          "The connection target is credential-owned and never accepted from an operation input.",
      },
    ],
  }),
  quickbooks: metadata({
    evidence: [quickbooksEvidence],
    credentials: {
      "quickbooks-oauth": {
        type: "oauth2",
        label: "QuickBooks Online OAuth",
        description:
          "An OAuth grant for the QuickBooks Online accounting company.",
        fields: [
          {
            id: "client-id",
            label: "Client ID",
            description: "The Intuit OAuth client ID.",
          },
          {
            id: "client-secret",
            label: "Client secret",
            description: "The Intuit OAuth client secret.",
            secret: true,
          },
          {
            id: "realm-id",
            label: "Realm ID",
            description: "The connected QuickBooks company identifier.",
          },
        ],
        acquisition: "oauth",
        setupUrl: "https://developer.intuit.com/app/developer/myapps",
        setup:
          "Connect the QuickBooks company and retain the realm identifier with the encrypted credential record.",
        scopes: ["com.intuit.quickbooks.accounting"],
        rotation: {
          supported: true,
          guidance:
            "Reauthorize the company when the refresh grant is revoked or the app secret changes.",
        },
      },
    },
    surfaces: [
      {
        id: "quickbooks-accounting-http",
        type: "http",
        name: "QuickBooks Accounting API",
        description:
          "QuickBooks Online accounting resources for companies, invoices, payments, and accounts.",
        endpoint: "https://quickbooks.api.intuit.com",
        docsUrl:
          "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [{ credentialId: "quickbooks-oauth", placement: "oauth" }],
            },
          ],
        },
        evidenceIds: [quickbooksEvidence.id],
      },
    ],
  }),
  xero: metadata({
    evidence: [xeroEvidence],
    credentials: {
      "xero-oauth": {
        type: "oauth2",
        label: "Xero OAuth",
        description: "An OAuth grant for one or more Xero organizations.",
        fields: [
          {
            id: "client-id",
            label: "Client ID",
            description: "The Xero OAuth client ID.",
          },
          {
            id: "client-secret",
            label: "Client secret",
            description: "The Xero OAuth client secret.",
            secret: true,
          },
        ],
        acquisition: "oauth",
        setupUrl: "https://developer.xero.com/app/manage",
        setup:
          "Connect the Xero organization and retain the tenant identifier returned during authorization.",
        scopes: ["openid", "profile", "email", "accounting.transactions"],
        rotation: {
          supported: true,
          guidance:
            "Reauthorize the organization when the refresh grant is revoked or the app secret changes.",
        },
      },
    },
    surfaces: [
      {
        id: "xero-accounting-http",
        type: "http",
        name: "Xero Accounting API",
        description:
          "Xero accounting resources for organizations, accounts, contacts, invoices, and bank transactions.",
        endpoint: "https://api.xero.com/api.xro/2.0",
        docsUrl:
          "https://developer.xero.com/documentation/api/accounting/overview",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [{ credentialId: "xero-oauth", placement: "oauth" }],
            },
          ],
        },
        evidenceIds: [xeroEvidence.id],
      },
    ],
  }),
  hubspot: metadata({
    evidence: [hubspotEvidence],
    credentials: {
      "hubspot-oauth": {
        type: "oauth2",
        label: "HubSpot OAuth",
        description:
          "An OAuth grant for the HubSpot CRM objects and actions in use.",
        fields: [
          {
            id: "client-id",
            label: "Client ID",
            description: "The HubSpot app client ID.",
          },
          {
            id: "client-secret",
            label: "Client secret",
            description: "The HubSpot app client secret.",
            secret: true,
          },
        ],
        acquisition: "oauth",
        setupUrl:
          "https://developers.hubspot.com/docs/apps/legacy-apps/authentication/oauth-quickstart",
        setup:
          "Install the HubSpot app and request only the CRM scopes required by the product outcome.",
        scopes: ["crm.objects.contacts.read", "crm.objects.companies.read"],
        rotation: {
          supported: true,
          guidance:
            "Rotate the app secret through the product's server-side configuration.",
        },
      },
    },
    surfaces: [
      {
        id: "hubspot-http",
        type: "http",
        name: "HubSpot API",
        description:
          "HubSpot's HTTPS API for CRM objects, associations, and activity context.",
        endpoint: "https://api.hubapi.com",
        docsUrl: "https://developers.hubspot.com/docs/api/overview",
        transport: "https",
        auth: {
          status: "required",
          alternatives: [
            {
              uses: [{ credentialId: "hubspot-oauth", placement: "oauth" }],
            },
          ],
        },
        evidenceIds: [hubspotEvidence.id],
      },
    ],
  }),
};

export function metadataForIntegration(
  integrationId: string,
): IntegrationMetadata | undefined {
  return INTEGRATION_METADATA[integrationId];
}
