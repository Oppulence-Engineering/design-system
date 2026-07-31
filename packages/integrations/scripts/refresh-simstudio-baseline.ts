/**
 * Refreshes the checked-in Sim Studio parity baseline.
 *
 * A write is intentionally opt-in and needs a review note. This keeps a
 * source-catalogue change from silently changing our accepted parity target.
 */
const SOURCE_COMMIT = "2a6267391d24d4e10e043ce474615ce9f5d1c22a";
const SOURCE_BLOB = "deadb0012bc33708e4c1500b08b1aa8c9ae533e1";
const SOURCE_URL = `https://raw.githubusercontent.com/simstudioai/sim/${SOURCE_COMMIT}/apps/sim/lib/integrations/integrations.json`;
const OUTPUT_PATH = new URL(
  "../src/generated/simstudio-baseline.json",
  import.meta.url,
);

interface SimOperation {
  name: string;
  description: string;
}

interface SimTrigger extends SimOperation {
  id: string;
}

interface SimIntegration {
  type: string;
  slug: string;
  name: string;
  description: string;
  docsUrl?: string;
  operations: SimOperation[];
  triggers: SimTrigger[];
  operationCount: number;
  triggerCount: number;
  authType: "api-key" | "none" | "oauth";
  category: string;
  integrationType: string;
  tags: string[];
}

interface SimPayload {
  updatedAt: string;
  integrations: SimIntegration[];
}

function toStableId(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function normalize(payload: SimPayload) {
  const integrations = payload.integrations
    .map((integration) => {
      const id = toStableId(integration.slug);
      return {
        id,
        aliases: unique(
          [integration.slug, integration.type]
            .map(toStableId)
            .filter((alias) => alias !== id),
        ),
        sourceSlug: integration.slug,
        sourceType: integration.type,
        name: integration.name,
        summary: integration.description,
        sourceDocumentationUrl: integration.docsUrl,
        sourceCategory: integration.integrationType,
        sourceAuthType: integration.authType,
        tags: integration.tags,
        operations: integration.operations.map((operation) => ({
          id: `${id}:${toStableId(operation.name)}`,
          label: operation.name,
          description: operation.description,
        })),
        triggers: integration.triggers.map((trigger) => ({
          id: `${id}:${toStableId(trigger.id || trigger.name)}`,
          label: trigger.name,
          description: trigger.description,
        })),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const sourceKeys = new Set<string>();
  const ids = new Set<string>();
  for (const integration of integrations) {
    const sourceKey = `${integration.sourceSlug}:${integration.sourceType}`;
    if (sourceKeys.has(sourceKey) || ids.has(integration.id)) {
      throw new Error(`Sim Studio source has a duplicate record: ${sourceKey}`);
    }
    sourceKeys.add(sourceKey);
    ids.add(integration.id);
  }

  const operationCount = integrations.reduce(
    (total, integration) => total + integration.operations.length,
    0,
  );
  const triggerCount = integrations.reduce(
    (total, integration) => total + integration.triggers.length,
    0,
  );

  if (
    integrations.length !== 232 ||
    operationCount !== 3890 ||
    triggerCount !== 363
  ) {
    throw new Error(
      `Unexpected pinned Sim Studio baseline (${integrations.length} providers, ${operationCount} operations, ${triggerCount} triggers).`,
    );
  }

  return {
    source: "simstudio" as const,
    sourceCommit: SOURCE_COMMIT,
    sourceBlob: SOURCE_BLOB,
    sourceDate: payload.updatedAt,
    sourceUrl: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    integrations,
  };
}

const write = Bun.argv.includes("--write");
const reviewNoteFlag = Bun.argv.find((argument) =>
  argument.startsWith("--review-note="),
);
const reviewNote = reviewNoteFlag?.slice("--review-note=".length).trim();

if (!write) {
  throw new Error("Refusing to modify the baseline without --write.");
}

if (!reviewNote) {
  throw new Error("A reviewed mapping note is required: --review-note='…'.");
}

const response = await fetch(SOURCE_URL, {
  headers: { Accept: "application/json" },
});
if (!response.ok) {
  throw new Error(
    `Unable to fetch Sim Studio baseline: ${response.status} ${response.statusText}`,
  );
}

const baseline = normalize((await response.json()) as SimPayload);
await Bun.write(
  OUTPUT_PATH,
  `${JSON.stringify({ ...baseline, reviewNote }, null, 2)}\n`,
);

console.log(
  `Wrote ${baseline.integrations.length} provider records from ${SOURCE_COMMIT} with review note: ${reviewNote}`,
);
