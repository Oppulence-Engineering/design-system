import { z } from "zod";

export const StableMetadataIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/u,
    "Metadata IDs must be stable lowercase kebab-case identifiers.",
  );

const SecureUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Integration metadata URLs must use HTTPS and cannot contain credentials.");

export const INTEGRATION_SURFACE_TYPES = [
  "http",
  "graphql",
  "mcp",
  "cli",
  "sdk",
  "special",
] as const;

export const INTEGRATION_CREDENTIAL_TYPES = [
  "api_key",
  "oauth2",
  "oauth2_client_credentials",
  "pat",
  "basic",
  "bearer",
  "service_account",
  "jwt",
  "app",
  "aws_sigv4",
  "compound",
  "custom",
  "none",
] as const;

export const INTEGRATION_EVIDENCE_TYPES = [
  "official-docs",
  "openapi",
  "graphql",
  "mcp",
  "cli",
  "vendor-sdk",
  "manual",
] as const;

export const INTEGRATION_EVIDENCE_BASIS = [
  "detected",
  "declared",
  "discovered",
  "manual",
] as const;

export const INTEGRATION_VERIFICATION_STATUS = [
  "verified",
  "stale",
  "failed",
  "unknown",
] as const;

export const IntegrationCredentialFieldSchema = z
  .object({
    id: StableMetadataIdSchema,
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(500),
    required: z.boolean().default(true),
    secret: z.boolean().default(false),
  })
  .strict();

export const IntegrationCredentialDefinitionSchema = z
  .object({
    type: z.enum(INTEGRATION_CREDENTIAL_TYPES),
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(1_000),
    fields: z.array(IntegrationCredentialFieldSchema).readonly().default([]),
    acquisition: z.enum(["manual", "oauth", "ambient"]).default("manual"),
    setupUrl: SecureUrlSchema.optional(),
    setup: z.string().min(1).max(2_000),
    scopes: z.array(z.string().min(1).max(300)).readonly().default([]),
    rotation: z
      .object({
        supported: z.boolean(),
        guidance: z.string().min(1).max(1_000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((credential, context) => {
    const fieldIds = new Set<string>();
    for (const field of credential.fields) {
      if (fieldIds.has(field.id)) {
        context.addIssue({
          code: "custom",
          path: ["fields"],
          message: `Duplicate credential field: ${field.id}`,
        });
      }
      fieldIds.add(field.id);
    }
    if (credential.type === "none" && credential.fields.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "A no-auth credential cannot declare secret fields.",
      });
    }
  });

export const IntegrationCredentialUseSchema = z
  .object({
    credentialId: StableMetadataIdSchema,
    placement: z.enum([
      "header",
      "query",
      "body",
      "path",
      "environment",
      "oauth",
      "connection",
    ]),
    name: z.string().min(1).max(160).optional(),
    scheme: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(500).optional(),
  })
  .strict();

export const IntegrationAuthAlternativeSchema = z
  .object({
    uses: z.array(IntegrationCredentialUseSchema).min(1).readonly(),
    description: z.string().min(1).max(500).optional(),
  })
  .strict();

export const IntegrationSurfaceAuthSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("none") }).strict(),
  z
    .object({
      status: z.literal("required"),
      alternatives: z.array(IntegrationAuthAlternativeSchema).min(1).readonly(),
    })
    .strict(),
  z.object({ status: z.literal("unknown") }).strict(),
]);

export const IntegrationSurfaceSchema = z
  .object({
    id: StableMetadataIdSchema,
    type: z.enum(INTEGRATION_SURFACE_TYPES),
    name: z.string().min(1).max(160),
    description: z.string().min(1).max(1_000),
    endpoint: SecureUrlSchema.optional(),
    specUrl: SecureUrlSchema.optional(),
    docsUrl: SecureUrlSchema.optional(),
    packageName: z.string().min(1).max(200).optional(),
    command: z.string().min(1).max(500).optional(),
    transport: z
      .enum(["https", "graphql-http", "streamable-http", "sse", "stdio"])
      .optional(),
    origin: z
      .enum(["vendor", "community", "internal", "unknown"])
      .default("vendor"),
    auth: IntegrationSurfaceAuthSchema,
    evidenceIds: z.array(StableMetadataIdSchema).readonly().default([]),
    verificationStatus: z
      .enum(INTEGRATION_VERIFICATION_STATUS)
      .default("unknown"),
    verifiedAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().min(1).max(1_000).optional(),
  })
  .strict()
  .superRefine((surface, context) => {
    if (
      !surface.endpoint &&
      !surface.specUrl &&
      !surface.packageName &&
      !surface.command
    ) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message: "A surface needs an endpoint, spec, package, or command.",
      });
    }
    if (surface.verificationStatus === "verified" && !surface.verifiedAt) {
      context.addIssue({
        code: "custom",
        path: ["verifiedAt"],
        message: "Verified surfaces require a verification timestamp.",
      });
    }
    if (surface.type === "mcp" && !surface.endpoint && !surface.packageName) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message: "MCP surfaces require a remote endpoint or package.",
      });
    }
    if (surface.type === "cli" && !surface.command && !surface.packageName) {
      context.addIssue({
        code: "custom",
        path: ["command"],
        message: "CLI surfaces require a command or package.",
      });
    }
  });

export const IntegrationEvidenceSchema = z
  .object({
    id: StableMetadataIdSchema,
    type: z.enum(INTEGRATION_EVIDENCE_TYPES),
    basis: z.enum(INTEGRATION_EVIDENCE_BASIS),
    sourceUrl: SecureUrlSchema,
    retrievedAt: z.string().datetime({ offset: true }).optional(),
    verifiedAt: z.string().datetime({ offset: true }).optional(),
    verificationStatus: z
      .enum(INTEGRATION_VERIFICATION_STATUS)
      .default("unknown"),
    note: z.string().min(1).max(1_000).optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.verificationStatus === "verified" && !evidence.verifiedAt) {
      context.addIssue({
        code: "custom",
        path: ["verifiedAt"],
        message: "Verified evidence requires a verification timestamp.",
      });
    }
  });

export type IntegrationCredentialField = z.infer<
  typeof IntegrationCredentialFieldSchema
>;
export type IntegrationCredentialDefinition = z.infer<
  typeof IntegrationCredentialDefinitionSchema
>;
export type IntegrationCredentialUse = z.infer<
  typeof IntegrationCredentialUseSchema
>;
export type IntegrationAuthAlternative = z.infer<
  typeof IntegrationAuthAlternativeSchema
>;
export type IntegrationSurfaceAuth = z.infer<
  typeof IntegrationSurfaceAuthSchema
>;
export type IntegrationSurface = z.infer<typeof IntegrationSurfaceSchema>;
export type IntegrationEvidence = z.infer<typeof IntegrationEvidenceSchema>;

export function surfaceCredentialIds(
  surface: IntegrationSurface,
): readonly string[] {
  if (surface.auth.status !== "required") return [];
  return [
    ...new Set(
      surface.auth.alternatives.flatMap((alternative) =>
        alternative.uses.map((use) => use.credentialId),
      ),
    ),
  ];
}
