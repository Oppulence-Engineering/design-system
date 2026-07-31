import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "./catalog";
import {
  CONNECTION_STATES,
  INTEGRATION_AUTH_METHODS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_CATEGORIES,
  IntegrationConnectionProjectionSchema,
  IntegrationDefinitionSchema,
  IntegrationIdSchema,
  IntegrationSummarySchema,
  ProductIntegrationSchema,
} from "./contracts";
import {
  buildIntegrationDirectory,
  createIntegrationDirectoryResolver,
  getConnectionAttentionCount,
} from "./connection";
import { getSimStudioParityReport } from "./parity";
import {
  getIntegration,
  getIntegrationCatalogue,
  getIntegrationDetail,
  getProductIntegrations,
  resolveIntegrationId,
  searchIntegrations,
} from "./registry";
import {
  ActionResultSchema,
  assertOperationTriggerCoverage,
  ConnectRequestSchema,
  ConnectResultSchema,
  ConnectionHealthSchema,
  ConnectionHealthRequestSchema,
  getFunctionalSupportContract,
  getFunctionallySupportedIntegrationIds,
  getOperationTriggerCoverageReport,
  IntegrationActionContractSchema,
  IntegrationActionRequestSchema,
  IntegrationEntitlementPolicySchema,
  IntegrationSupportContractSchema,
  validateFunctionalSupportContracts,
} from "./support";
import {
  IntegrationOutcomeTemplateSchema,
  validateOutcomeTemplates,
} from "./templates";
import {
  createIntegrationConnectionResolver,
  createProductIntegrationKit,
} from "./kit";
import {
  INTEGRATION_GOLDEN_JOURNEY_STEPS,
  runIntegrationGoldenJourney,
} from "./golden-journey";

// Keep runtime imports explicit. Bun 1.3.11 can otherwise tree-shake bare
// `export { value } from` re-exports when the root is bundled as an entrypoint.
export {
  CONNECTION_STATES,
  INTEGRATION_AUTH_METHODS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_CATALOGUE,
  INTEGRATION_CATEGORIES,
  IntegrationConnectionProjectionSchema,
  IntegrationDefinitionSchema,
  IntegrationActionContractSchema,
  IntegrationActionRequestSchema,
  IntegrationEntitlementPolicySchema,
  IntegrationIdSchema,
  IntegrationOutcomeTemplateSchema,
  IntegrationSummarySchema,
  IntegrationSupportContractSchema,
  ProductIntegrationSchema,
  SIMSTUDIO_BASELINE,
  ActionResultSchema,
  assertOperationTriggerCoverage,
  buildIntegrationDirectory,
  ConnectRequestSchema,
  ConnectResultSchema,
  ConnectionHealthSchema,
  ConnectionHealthRequestSchema,
  createIntegrationConnectionResolver,
  createIntegrationDirectoryResolver,
  createProductIntegrationKit,
  getFunctionalSupportContract,
  getConnectionAttentionCount,
  getIntegration,
  getIntegrationCatalogue,
  getIntegrationDetail,
  getFunctionallySupportedIntegrationIds,
  getProductIntegrations,
  getOperationTriggerCoverageReport,
  getSimStudioParityReport,
  resolveIntegrationId,
  searchIntegrations,
  INTEGRATION_GOLDEN_JOURNEY_STEPS,
  runIntegrationGoldenJourney,
  validateFunctionalSupportContracts,
  validateOutcomeTemplates,
};

export type {
  IntegrationAuthMethod,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationConnectionProjection,
  IntegrationDefinition,
  IntegrationId,
  IntegrationSummary,
  Product,
  ProductIntegration,
} from "./contracts";
export type {
  IntegrationConnectionResolver,
  IntegrationDirectory,
  IntegrationDirectoryEntry,
  IntegrationDirectoryLoader,
} from "./connection";
export type {
  ActionResult,
  ConnectRequest,
  ConnectResult,
  ConnectionHealth,
  ConnectionHealthRequest,
  IntegrationActionContract,
  IntegrationActionRequest,
  IntegrationDataContract,
  IntegrationEntitlement,
  IntegrationEntitlementPolicy,
  IntegrationServiceLevel,
  IntegrationSupportContract,
  OperationTriggerCoverageReport,
  ProductIntegrationConnector,
} from "./support";
export type { IntegrationOutcomeTemplate } from "./templates";
export type {
  IntegrationCommand,
  IntegrationConnectionRecordAdapter,
  IntegrationEntitlementInput,
  IntegrationEntitlementRequest,
  ProductIntegrationEntitlements,
  ProductIntegrationKit,
  ProductIntegrationKitConfig,
} from "./kit";
export {
  IntegrationAccessDeniedError,
  IntegrationConnectionAccessError,
  IntegrationUnavailableError,
} from "./kit";
export type {
  IntegrationGoldenJourney,
  IntegrationGoldenJourneyStep,
} from "./golden-journey";
export { IntegrationGoldenJourneyError } from "./golden-journey";
