import { expect, test } from "bun:test";

import {
  registerProviderPack,
  scaffoldFor,
} from "../scripts/provider-scaffold";

test("provider scaffolds canonicalize catalogue aliases", () => {
  const scaffold = scaffoldFor("bamboo-hr");

  expect(scaffold).toContain('integrationId: "bamboohr"');
  expect(scaffold).not.toContain('integrationId: "bamboo-hr"');
  expect(scaffold).toContain("createBamboohrPack");
});

test("provider scaffolds register the generated factory in the registry", () => {
  const registry = `import type { IntegrationProviderPack } from "../core/provider-pack";

/**
 * Every provider pack
 */
export const BUILT_IN_PROVIDER_PACKS: readonly IntegrationProviderPack[] = [
];
`;
  const registered = registerProviderPack(registry, "bamboohr");

  expect(registered).toContain(
    'import { createBamboohrPack } from "./bamboohr";',
  );
  expect(registered).toContain("  createBamboohrPack(),");
  expect(registerProviderPack(registered, "bamboohr")).toBe(registered);
});
