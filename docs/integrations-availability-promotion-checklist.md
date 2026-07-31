# Integration availability promotion checklist

Use this review before moving a product integration from `planned` to `beta`
or `shipped` in `@oppulence/integrations`. A catalogue card, SDK dependency,
OAuth callback stub, or static logo is not promotion evidence.

## Beta

- Name the product owner and customer outcome.
- Record canonical ID, legacy aliases, supported capabilities, setup path, and
  documentation path in the registry.
- Define the authorized product API resolver and confirm it emits only
  `IntegrationConnectionProjection` fields.
- Record a static entitlement policy: eligible plans, required roles,
  connection limits, delegated-admin requirements, data-region policy, and
  safe request-access behavior. The product API still evaluates its
  tenant-specific entitlement projection for every command.
- Specify initial-sync, freshness, recovery, audit, and test plans.

## Shipped

- Complete the beta checks and add a validated `IntegrationSupportContract`.
- Add at least one data or action contract with owner, classification,
  normalization, retention/deletion owner, and source-to-output lineage. An
  Eigenn data contract additionally records model driver, grain, units,
  coverage, refresh field, and forecasting use; a Conduitt contract records
  evidence, policy, idempotency key, and audit event. A governed action
  contract records its command, authorization policy, idempotency key, audit
  event, and source-to-output lineage instead of treating an action label as
  evidence.
- Give every source operation and trigger a `supported`,
  `intentionally-not-applicable`, or `not-yet-supported` disposition.
- Test the product golden journey: authorization, entitlement denial, connect,
  initial sync, normal update, freshness expiry, recovery, audit event, and
  disconnect.
- Confirm the product API re-authorizes every visible command; UI
  `permittedActions` are never authority.
- For Eigenn, verify model-driver period, coverage, currency/units, lineage,
  and stale/deleted-source propagation. For Conduitt, verify idempotency,
  policy evaluation, evidence persistence, and audit correlation.
- If an outcome template is advertised, verify it maps to a supported operation
  and contract and only invokes authorized product commands.
