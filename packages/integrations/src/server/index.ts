import {
  createIntegrationCredentialReference,
  createIntegrationCredentialKeyring,
  decryptIntegrationApiKeyCredential,
  decryptIntegrationCredential,
  encryptIntegrationApiKeyCredential,
  encryptIntegrationCredential,
  EncryptedIntegrationCredentialSchema,
  IntegrationApiKeyCredentialSchema,
  IntegrationCredentialError,
  IntegrationCredentialReferenceSchema,
  IntegrationOAuthCredentialSchema,
} from "./credentials";
import {
  createIntegrationApiKeyRuntime,
  IntegrationApiKeyRuntimeError,
} from "./api-key-runtime";
import {
  createIntegrationNoAuthRuntime,
  IntegrationNoAuthRuntimeError,
} from "./no-auth-runtime";
import { createApiKeyProviderSdk, ApiKeyProviderError } from "./api-key";
import {
  createOAuth2ProviderSdk,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
  OAuth2ProviderError,
} from "./oauth2";
import {
  createUnauthenticatedProviderSdk,
  UnauthenticatedProviderError,
} from "./unauthenticated";
import {
  createInMemoryIntegrationCredentialRefreshLock,
  createInMemoryIntegrationOAuthStateStore,
  createIntegrationOAuthRuntime,
  IntegrationRuntimeError,
  PendingIntegrationOAuthAuthorizationSchema,
} from "./runtime";
import {
  composeIntegrationRoutes,
  createApiKeyRouteConnector,
  createIntegrationApiKeyRoutes,
  createIntegrationNoAuthRoutes,
  createIntegrationOAuthRoutes,
  createIntegrationProductRoutes,
  createNoAuthRouteConnector,
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
  decryptIntegrationApiKeyCredential,
  decryptIntegrationCredential,
  encryptIntegrationApiKeyCredential,
  encryptIntegrationCredential,
  EncryptedIntegrationCredentialSchema,
  IntegrationApiKeyCredentialSchema,
  IntegrationCredentialError,
  IntegrationCredentialReferenceSchema,
  IntegrationOAuthCredentialSchema,
  createIntegrationApiKeyRuntime,
  IntegrationApiKeyRuntimeError,
  createIntegrationNoAuthRuntime,
  IntegrationNoAuthRuntimeError,
  createOAuth2ProviderSdk,
  createQuickBooksOAuth2Provider,
  createXeroOAuth2Provider,
  OAuth2ProviderError,
  createApiKeyProviderSdk,
  ApiKeyProviderError,
  createUnauthenticatedProviderSdk,
  UnauthenticatedProviderError,
  createIntegrationOAuthRuntime,
  createInMemoryIntegrationCredentialRefreshLock,
  createInMemoryIntegrationOAuthStateStore,
  IntegrationRuntimeError,
  PendingIntegrationOAuthAuthorizationSchema,
  createIntegrationOAuthRoutes,
  createIntegrationApiKeyRoutes,
  createIntegrationNoAuthRoutes,
  createIntegrationProductRoutes,
  composeIntegrationRoutes,
  createApiKeyRouteConnector,
  createNoAuthRouteConnector,
  createOAuthRouteConnector,
};
export type {
  EncryptedIntegrationCredential,
  IntegrationCredentialKeyring,
  IntegrationCredentialKeyDefinition,
  IntegrationCredentialReference,
  IntegrationCredentialVault,
  IntegrationApiKeyCredential,
  IntegrationOAuthCredential,
} from "./credentials";
export type {
  ConnectIntegrationApiKeyInput,
  ConnectIntegrationApiKeyResult,
  IntegrationApiKeyAuthorizer,
  IntegrationApiKeyProviderRequest,
  IntegrationApiKeyRuntime,
  IntegrationApiKeyRuntimeConfig,
  IntegrationApiKeySubject,
} from "./api-key-runtime";
export type {
  ConnectIntegrationNoAuthInput,
  ConnectIntegrationNoAuthResult,
  IntegrationNoAuthAuthorizer,
  IntegrationNoAuthProviderRequest,
  IntegrationNoAuthRuntime,
  IntegrationNoAuthRuntimeConfig,
  IntegrationNoAuthSubject,
} from "./no-auth-runtime";
export type {
  ApiKeyProviderConfiguration,
  ApiKeyProviderRequest,
  ApiKeyProviderSdk,
} from "./api-key";
export type {
  OAuth2ApiRequest,
  OAuth2AuthorizationInput,
  OAuth2ProviderConfiguration,
  OAuth2ProviderSdk,
} from "./oauth2";
export type {
  UnauthenticatedProviderConfiguration,
  UnauthenticatedProviderRequest,
  UnauthenticatedProviderSdk,
} from "./unauthenticated";
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
  IntegrationApiKeyRoutesConfig,
  IntegrationNoAuthRoutesConfig,
  IntegrationOAuthRoutesConfig,
  IntegrationProductRoutesConfig,
  IntegrationRouteHandler,
  OAuthRouteConnectorActions,
} from "./routes";
