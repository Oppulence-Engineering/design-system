import {
  createIntegrationCredentialReference,
  createIntegrationCredentialKeyring,
  decryptIntegrationCredential,
  encryptIntegrationCredential,
  EncryptedIntegrationCredentialSchema,
  IntegrationCredentialError,
  IntegrationCredentialReferenceSchema,
  IntegrationOAuthCredentialSchema,
} from "./credentials";
import {
  createOAuth2ProviderSdk,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
  OAuth2ProviderError,
} from "./oauth2";
import {
  createInMemoryIntegrationCredentialRefreshLock,
  createInMemoryIntegrationOAuthStateStore,
  createIntegrationOAuthRuntime,
  IntegrationRuntimeError,
  PendingIntegrationOAuthAuthorizationSchema,
} from "./runtime";
import {
  composeIntegrationRoutes,
  createIntegrationOAuthRoutes,
  createIntegrationProductRoutes,
  createOAuthRouteConnector,
} from "./routes";

if (typeof window !== "undefined") {
  throw new Error(
    "@oppulence/integrations/server is server-only and must not run in a browser.",
  );
}

// Keep runtime imports explicit. Bun can otherwise tree-shake bare re-exports
// when this server entrypoint is bundled for publication.
export {
  createIntegrationCredentialReference,
  createIntegrationCredentialKeyring,
  decryptIntegrationCredential,
  encryptIntegrationCredential,
  EncryptedIntegrationCredentialSchema,
  IntegrationCredentialError,
  IntegrationCredentialReferenceSchema,
  IntegrationOAuthCredentialSchema,
  createOAuth2ProviderSdk,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
  OAuth2ProviderError,
  createIntegrationOAuthRuntime,
  createInMemoryIntegrationCredentialRefreshLock,
  createInMemoryIntegrationOAuthStateStore,
  IntegrationRuntimeError,
  PendingIntegrationOAuthAuthorizationSchema,
  createIntegrationOAuthRoutes,
  createIntegrationProductRoutes,
  composeIntegrationRoutes,
  createOAuthRouteConnector,
};
export type {
  EncryptedIntegrationCredential,
  IntegrationCredentialKeyring,
  IntegrationCredentialKeyDefinition,
  IntegrationCredentialReference,
  IntegrationCredentialVault,
  IntegrationOAuthCredential,
} from "./credentials";
export type {
  OAuth2ApiRequest,
  OAuth2AuthorizationInput,
  OAuth2ProviderConfiguration,
  OAuth2ProviderSdk,
} from "./oauth2";
export type {
  BeginIntegrationOAuthInput,
  BeginIntegrationOAuthResult,
  CompleteIntegrationOAuthInput,
  CompleteIntegrationOAuthResult,
  IntegrationOAuthRuntime,
  IntegrationOAuthRuntimeConfig,
  IntegrationOAuthCompletionAuthorizer,
  IntegrationCredentialRefreshLock,
  IntegrationOAuthStateStore,
  IntegrationOAuthSubject,
  IntegrationProviderRequest,
  PendingIntegrationOAuthAuthorization,
} from "./runtime";
export type {
  IntegrationOAuthRoutesConfig,
  IntegrationProductRoutesConfig,
  IntegrationRouteHandler,
  OAuthRouteConnectorActions,
} from "./routes";
