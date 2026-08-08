import { INTEGRATION_CATALOGUE, SIMSTUDIO_BASELINE } from "./catalog";
import {
  CONNECTION_STATES,
  INTEGRATION_AUTH_METHODS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_CATEGORIES,
  IntegrationConnectionProjectionSchema,
  IntegrationConnectionIssueSchema,
  IntegrationDefinitionSchema,
  SafeIntegrationSummarySchema,
  IntegrationIdSchema,
  IntegrationSummarySchema,
  ProductIntegrationSchema,
} from "./contracts";
import {
  buildIntegrationDirectory,
  createIntegrationDirectoryResolver,
  filterIntegrationDirectory,
  getConnectionAttentionCount,
} from "./connection";
import { getSimStudioParityReport } from "./parity";
import {
  assertSimStudioProviderProtocolParity,
  getSimStudioProviderProtocolReport,
} from "./provider-protocols";
import {
  getProviderExecutionStrategies,
  getProviderExecutionStrategyReport,
} from "./execution-strategy";
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
  assertIntegrationOutcomeReadiness,
  getIntegrationOutcomeReadiness,
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
  IntegrationConnectionIssueSchema,
  IntegrationDefinitionSchema,
  IntegrationActionContractSchema,
  IntegrationActionRequestSchema,
  IntegrationEntitlementPolicySchema,
  IntegrationIdSchema,
  IntegrationOutcomeTemplateSchema,
  assertIntegrationOutcomeReadiness,
  getIntegrationOutcomeReadiness,
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
  filterIntegrationDirectory,
  getFunctionalSupportContract,
  getConnectionAttentionCount,
  getIntegration,
  getIntegrationCatalogue,
  getIntegrationDetail,
  getFunctionallySupportedIntegrationIds,
  getProductIntegrations,
  getOperationTriggerCoverageReport,
  getSimStudioParityReport,
  getSimStudioProviderProtocolReport,
  getProviderExecutionStrategies,
  getProviderExecutionStrategyReport,
  resolveIntegrationId,
  searchIntegrations,
  INTEGRATION_GOLDEN_JOURNEY_STEPS,
  runIntegrationGoldenJourney,
  assertSimStudioProviderProtocolParity,
  validateFunctionalSupportContracts,
  validateOutcomeTemplates,
};

export type {
  IntegrationAuthMethod,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationConnectionProjection,
  IntegrationConnectionIssue,
  IntegrationDefinition,
  IntegrationId,
  IntegrationSummary,
  Product,
  ProductIntegration,
} from "./contracts";
export {
  IntegrationFailureCodeSchema,
  IntegrationFailurePhaseSchema,
  IntegrationFailureSchema,
  createConnectionIssue,
  createIntegrationFailure,
  classifyIntegrationFailure,
  isRetryableIntegrationFailure,
  planConnectionRecovery,
  reportIntegrationFailure,
} from "./reliability";
export type {
  ConnectionRecoveryPlan,
  IntegrationFailure,
  IntegrationFailureObservation,
  IntegrationFailureObserver,
} from "./reliability";
export type {
  IntegrationConnectionResolver,
  IntegrationDirectory,
  IntegrationDirectoryEntry,
  IntegrationDirectoryFacets,
  IntegrationDirectoryFilter,
  IntegrationDirectoryLoader,
} from "./connection";
export {
  EXECUTABLE_INTEGRATION_IDS,
  EXECUTABLE_INTEGRATION_ID_SET,
} from "./executable";
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
export type {
  IntegrationOutcomeReadiness,
  IntegrationOutcomeTemplate,
} from "./templates";
export {
  INTEGRATION_CREDENTIAL_TYPES,
  INTEGRATION_EVIDENCE_BASIS,
  INTEGRATION_EVIDENCE_TYPES,
  INTEGRATION_SURFACE_TYPES,
  INTEGRATION_VERIFICATION_STATUS,
  IntegrationAuthAlternativeSchema,
  IntegrationCredentialDefinitionSchema,
  IntegrationCredentialFieldSchema,
  IntegrationCredentialUseSchema,
  IntegrationEvidenceSchema,
  IntegrationSurfaceAuthSchema,
  IntegrationSurfaceSchema,
} from "./surfaces";
export type {
  IntegrationAuthAlternative,
  IntegrationCredentialDefinition,
  IntegrationCredentialField,
  IntegrationCredentialUse,
  IntegrationEvidence,
  IntegrationSurface,
  IntegrationSurfaceAuth,
} from "./surfaces";
export type {
  SimStudioProviderProtocol,
  SimStudioProviderProtocolGap,
  SimStudioProviderProtocolReport,
} from "./provider-protocols";
export type {
  ProviderExecutionStrategy,
  ProviderExecutionStrategyKind,
  ProviderExecutionStrategyReport,
} from "./execution-strategy";
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
