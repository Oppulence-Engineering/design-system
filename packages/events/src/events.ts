/**
 * @module @oppulence/events/events
 * @file Event definitions for the Canvas analytics system. This module provides
 *   a comprehensive registry of all trackable events with strong typing.
 */

import {
  createEventDefinition,
  EventChannel,
  type EventDefinition,
  EventSeverity,
} from "./types";

/**
 * Base event definition factory with common properties
 *
 * @param {string} name - Event name
 * @param {EventChannel} channel - Event channel
 * @param {Partial<EventDefinition>} [overrides] - Additional properties
 * @returns {EventDefinition} Complete event definition
 */
const createEvent = (
  name: string,
  channel: EventChannel,
  overrides?: Partial<EventDefinition>,
): EventDefinition =>
  createEventDefinition({
    name,
    channel,
    severity: EventSeverity.INFO,
    productionOnly: false,
    tags: [],
    version: "1.0.0",
    ...overrides,
  });

/**
 * Authentication and user session events
 *
 * @namespace
 */
export const AuthenticationEvents = {
  /**
   * User sign-in event
   *
   * @constant
   */
  SignIn: createEvent("User Signed In", EventChannel.LOGIN, {
    description: "Tracks when a user successfully signs in to the application",
    severity: EventSeverity.INFO,
    tags: ["authentication", "user-action"],
  }),

  /**
   * User sign-out event
   *
   * @constant
   */
  SignOut: createEvent("User Signed Out", EventChannel.LOGIN, {
    description: "Tracks when a user signs out of the application",
    severity: EventSeverity.INFO,
    tags: ["authentication", "user-action"],
  }),

  /**
   * User registration event
   *
   * @constant
   */
  Registered: createEvent("User Registered", EventChannel.REGISTERED, {
    description: "Tracks when a new user completes registration",
    severity: EventSeverity.INFO,
    tags: ["authentication", "onboarding", "conversion"],
  }),

  /**
   * MFA verification event
   *
   * @constant
   */
  MfaVerify: createEvent("MFA Verify", EventChannel.SECURITY, {
    description: "Tracks multi-factor authentication verification attempts",
    severity: EventSeverity.WARNING,
    tags: ["security", "authentication", "mfa"],
  }),
} as const;

/**
 * Team management events
 *
 * @namespace
 */
export const TeamEvents = {
  /**
   * Team switch event
   *
   * @constant
   */
  ChangeTeam: createEvent("Change Team", EventChannel.TEAM, {
    description: "Tracks when a user switches between teams",
    severity: EventSeverity.INFO,
    tags: ["team", "navigation"],
  }),
} as const;

/**
 * Banking and financial connection events
 *
 * @namespace
 */
export const BankingEvents = {
  /**
   * Bank connection completed event
   *
   * @constant
   */
  ConnectBankCompleted: createEvent(
    "Connect Bank Completed",
    EventChannel.BANK,
    {
      description: "Tracks successful bank account connections",
      severity: EventSeverity.INFO,
      tags: ["banking", "integration", "onboarding"],
    },
  ),

  /**
   * Bank provider selection event
   *
   * @constant
   */
  ConnectBankProvider: createEvent("Connect Bank Provider", EventChannel.BANK, {
    description: "Tracks bank provider selection during connection flow",
    severity: EventSeverity.INFO,
    tags: ["banking", "integration"],
  }),

  /**
   * Bank connection cancellation event
   *
   * @constant
   */
  ConnectBankCanceled: createEvent("Connect Bank Canceled", EventChannel.BANK, {
    description: "Tracks when user cancels bank connection process",
    severity: EventSeverity.WARNING,
    tags: ["banking", "integration", "cancellation"],
  }),

  /**
   * Bank authorization event
   *
   * @constant
   */
  ConnectBankAuthorized: createEvent(
    "Connect Bank Authorized",
    EventChannel.BANK,
    {
      description: "Tracks successful bank authorization",
      severity: EventSeverity.INFO,
      tags: ["banking", "integration", "authorization"],
    },
  ),

  /**
   * Bank connection failure event
   *
   * @constant
   */
  ConnectBankFailed: createEvent("Connect Bank Failed", EventChannel.BANK, {
    description: "Tracks failed bank connection attempts",
    severity: EventSeverity.ERROR,
    tags: ["banking", "integration", "error"],
  }),

  /**
   * Bank account creation event
   *
   * @constant
   */
  BankAccountCreate: createEvent("Create Bank Account", EventChannel.BANK, {
    description: "Tracks manual bank account creation",
    severity: EventSeverity.INFO,
    tags: ["banking", "account-management"],
  }),

  /**
   * Bank deletion event
   *
   * @constant
   */
  DeleteBank: createEvent("Delete Bank", EventChannel.BANK, {
    description: "Tracks bank account deletion",
    severity: EventSeverity.WARNING,
    tags: ["banking", "account-management", "deletion"],
  }),

  /**
   * Bank update event
   *
   * @constant
   */
  UpdateBank: createEvent("Update Bank", EventChannel.BANK, {
    description: "Tracks bank account information updates",
    severity: EventSeverity.INFO,
    tags: ["banking", "account-management"],
  }),

  /**
   * Connection reconnection event
   *
   * @constant
   */
  ReconnectConnection: createEvent("Reconnect Connection", EventChannel.BANK, {
    description: "Tracks bank connection reconnection attempts",
    severity: EventSeverity.INFO,
    tags: ["banking", "integration", "maintenance"],
  }),

  /**
   * Connection deletion event
   *
   * @constant
   */
  DeleteConnection: createEvent("Delete Connection", EventChannel.BANK, {
    description: "Tracks bank connection deletion",
    severity: EventSeverity.WARNING,
    tags: ["banking", "integration", "deletion"],
  }),
} as const;

/**
 * GoCardLess integration events
 *
 * @namespace
 */
export const GoCardLessEvents = {
  /**
   * GoCardLess link failure event
   *
   * @constant
   */
  GoCardLessLinkFailed: createEvent(
    "GoCardLess Link Failed",
    EventChannel.GOCARDLESS,
    {
      description: "Tracks GoCardLess link creation failures",
      severity: EventSeverity.ERROR,
      tags: ["gocardless", "integration", "error"],
    },
  ),

  /**
   * GoCardLess link creation event
   *
   * @constant
   */
  GoCardLessLinkCreated: createEvent(
    "GoCardLess Link Created",
    EventChannel.GOCARDLESS,
    {
      description: "Tracks successful GoCardLess link creation",
      severity: EventSeverity.INFO,
      tags: ["gocardless", "integration"],
    },
  ),
} as const;

/**
 * Enable Banking integration events
 *
 * @namespace
 */
export const EnableBankingEvents = {
  /**
   * Enable Banking reconnection event
   *
   * @constant
   */
  EnableBankingLinkReconnected: createEvent(
    "Enable Banking Link Reconnected",
    EventChannel.ENABLEBANKING,
    {
      description: "Tracks Enable Banking link reconnection",
      severity: EventSeverity.INFO,
      tags: ["enablebanking", "integration", "reconnection"],
    },
  ),

  /**
   * Enable Banking link creation event
   *
   * @constant
   */
  EnableBankingLinkCreated: createEvent(
    "Enable Banking Link Created",
    EventChannel.ENABLEBANKING,
    {
      description: "Tracks Enable Banking link creation",
      severity: EventSeverity.INFO,
      tags: ["enablebanking", "integration"],
    },
  ),

  /**
   * Enable Banking link failure event
   *
   * @constant
   */
  EnableBankingLinkFailed: createEvent(
    "Enable Banking Link Failed",
    EventChannel.ENABLEBANKING,
    {
      description: "Tracks Enable Banking link failures",
      severity: EventSeverity.ERROR,
      tags: ["enablebanking", "integration", "error"],
    },
  ),
} as const;

/**
 * Transaction management events
 *
 * @namespace
 */
export const TransactionEvents = {
  /**
   * Transaction export event
   *
   * @constant
   */
  ExportTransactions: createEvent(
    "Export Transactions",
    EventChannel.TRANSACTION,
    {
      description: "Tracks transaction export operations",
      severity: EventSeverity.INFO,
      tags: ["transactions", "export", "data-management"],
    },
  ),

  /**
   * Manual transaction sync event
   *
   * @constant
   */
  TransactionsManualSync: createEvent("Manual Sync", EventChannel.TRANSACTION, {
    description: "Tracks manual transaction synchronization",
    severity: EventSeverity.INFO,
    tags: ["transactions", "sync", "manual-action"],
  }),

  /**
   * Base currency update event
   *
   * @constant
   */
  UpdateBaseCurrency: createEvent(
    "Update Base Currency",
    EventChannel.TRANSACTION,
    {
      description: "Tracks base currency changes",
      severity: EventSeverity.INFO,
      tags: ["transactions", "currency", "settings"],
    },
  ),

  /**
   * Currency update event
   *
   * @constant
   */
  UpdateCurrency: createEvent("Update Currency", EventChannel.TRANSACTION, {
    description: "Tracks currency updates for transactions",
    severity: EventSeverity.INFO,
    tags: ["transactions", "currency"],
  }),

  /**
   * Transaction import event
   *
   * @constant
   */
  ImportTransactions: createEvent("Import Transactions", EventChannel.IMPORT, {
    description: "Tracks transaction import operations",
    severity: EventSeverity.INFO,
    tags: ["transactions", "import", "data-management"],
  }),
} as const;

/**
 * File vault and storage events
 *
 * @namespace
 */
export const VaultEvents = {
  /**
   * Folder creation event
   *
   * @constant
   */
  CreateFolder: createEvent("Create Folder", EventChannel.VAULT, {
    description: "Tracks folder creation in vault",
    severity: EventSeverity.INFO,
    tags: ["vault", "folder-management"],
  }),

  /**
   * Folder deletion event
   *
   * @constant
   */
  DeleteFolder: createEvent("Delete Folder", EventChannel.VAULT, {
    description: "Tracks folder deletion from vault",
    severity: EventSeverity.WARNING,
    tags: ["vault", "folder-management", "deletion"],
  }),

  /**
   * File deletion event
   *
   * @constant
   */
  DeleteFile: createEvent("Delete File", EventChannel.VAULT, {
    description: "Tracks file deletion from vault",
    severity: EventSeverity.WARNING,
    tags: ["vault", "file-management", "deletion"],
  }),

  /**
   * File sharing event
   *
   * @constant
   */
  ShareFile: createEvent("Share File", EventChannel.VAULT, {
    description: "Tracks file sharing operations",
    severity: EventSeverity.INFO,
    tags: ["vault", "file-management", "sharing"],
  }),
} as const;

/**
 * Inbox and document processing events
 *
 * @namespace
 */
export const InboxEvents = {
  /**
   * Inbox inbound message event
   *
   * @constant
   */
  InboxInbound: createEvent("Inbox Inbound", EventChannel.INBOX, {
    description: "Tracks inbound messages to inbox",
    severity: EventSeverity.INFO,
    tags: ["inbox", "messaging", "inbound"],
  }),

  /**
   * Inbox file upload event
   *
   * @constant
   */
  InboxUpload: createEvent("Inbox Upload", EventChannel.INBOX, {
    description: "Tracks file uploads to inbox",
    severity: EventSeverity.INFO,
    tags: ["inbox", "upload", "file-management"],
  }),

  /**
   * Message template preview event
   *
   * @constant
   */
  MessageTemplatePreviewed: createEvent(
    "Message Template Previewed",
    EventChannel.INBOX,
    {
      description: "Tracks live previews for outbound message templates",
      severity: EventSeverity.INFO,
      tags: ["inbox", "templates", "preview"],
    },
  ),

  /**
   * Message template applied event
   *
   * @constant
   */
  MessageTemplateApplied: createEvent(
    "Message Template Applied",
    EventChannel.INBOX,
    {
      description: "Tracks applying a saved template into the composer",
      severity: EventSeverity.INFO,
      tags: ["inbox", "templates", "composer"],
    },
  ),

  /**
   * Message template saved event
   *
   * @constant
   */
  MessageTemplateSaved: createEvent(
    "Message Template Saved",
    EventChannel.INBOX,
    {
      description: "Tracks template create and update activity",
      severity: EventSeverity.INFO,
      tags: ["inbox", "templates", "settings"],
    },
  ),

  /**
   * Outbound reply sent on a thread. Fires once per outbound message-like
   * event (skips status changes, internal notes, and inbound webhooks).
   */
  InboxReplySent: createEvent("Inbox Reply Sent", EventChannel.INBOX, {
    description: "User sent an outbound message/reply on a thread",
    tags: ["inbox", "messaging", "outbound"],
  }),

  /**
   * Thread status transitioned (open / closed / snoozed / archived).
   */
  InboxThreadStatusChanged: createEvent(
    "Inbox Thread Status Changed",
    EventChannel.INBOX,
    {
      description: "Thread status transitioned (open/closed/snoozed/archived)",
      tags: ["inbox", "thread", "status"],
    },
  ),

  /**
   * Thread assignee changed (assigned, reassigned, or unassigned).
   */
  InboxThreadAssigned: createEvent(
    "Inbox Thread Assigned",
    EventChannel.INBOX,
    {
      description: "Thread assignee changed (assigned/reassigned/unassigned)",
      tags: ["inbox", "thread", "assignment"],
    },
  ),
} as const;

/**
 * Send-path compliance decisions and email delivery lifecycle events
 * (execution-arc1-communications.md §3.6/§11.3). Fired server-side from
 * the send chokepoint (blocks/defers) and the Resend delivery webhook
 * (lifecycle), so compliance and deliverability are measurable per
 * pause reason, message class, and channel.
 *
 * @namespace
 */
export const CommsComplianceEvents = {
  /**
   * The compliance engine blocked an outbound message. `properties`
   * carry `reasonCode` (dispute_pause/opt_out/suppressed/…),
   * `messageClass`, and `channel` — never recipient addresses or bodies.
   */
  CommsOutboundBlocked: createEvent(
    "Comms Outbound Blocked",
    EventChannel.INBOX,
    {
      description: "Compliance engine blocked an outbound message",
      tags: ["inbox", "compliance", "outbound"],
    },
  ),

  /** The compliance engine deferred a send (quiet hours). */
  CommsOutboundDeferred: createEvent(
    "Comms Outbound Deferred",
    EventChannel.INBOX,
    {
      description: "Compliance engine deferred an outbound message",
      tags: ["inbox", "compliance", "outbound"],
    },
  ),

  /**
   * A dunning send was suppressed because the invoice belongs to the
   * measurement holdout cohort (§3.13) — recorded as a would-be send.
   */
  CommsHoldoutSuppressed: createEvent(
    "Comms Holdout Suppressed",
    EventChannel.INBOX,
    {
      description: "Send suppressed for a holdout-cohort invoice",
      tags: ["inbox", "compliance", "holdout"],
    },
  ),

  /** Provider webhook confirmed delivery of an outbound email. */
  EmailDelivered: createEvent("Email Delivered", EventChannel.INBOX, {
    description: "Provider webhook confirmed delivery for an outbound email",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Provider webhook reported an open for an outbound email. */
  EmailOpened: createEvent("Email Opened", EventChannel.INBOX, {
    description: "Provider webhook reported an email open",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Provider webhook reported a link click in an outbound email. */
  EmailClicked: createEvent("Email Clicked", EventChannel.INBOX, {
    description: "Provider webhook reported an email click",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Provider webhook reported a bounce (soft or hard). */
  EmailBounced: createEvent("Email Bounced", EventChannel.INBOX, {
    description: "Provider webhook reported an email bounce",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Provider webhook reported a spam complaint. */
  EmailComplained: createEvent("Email Complained", EventChannel.INBOX, {
    description: "Provider webhook reported a spam complaint",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Recipient unsubscribed via the one-click/unsubscribe flow. */
  EmailUnsubscribed: createEvent("Email Unsubscribed", EventChannel.INBOX, {
    description: "Recipient unsubscribed from email communication",
    tags: ["inbox", "email", "delivery"],
  }),

  /** Weekly communication digest dispatched to org admins. */
  WeeklyCommunicationDigestSent: createEvent(
    "Weekly Communication Digest Sent",
    EventChannel.INBOX,
    {
      description: "Weekly communication digest emailed to org admins",
      tags: ["inbox", "digest", "reporting"],
    },
  ),
} as const;

/**
 * Support and feedback events
 *
 * @namespace
 */
export const SupportEvents = {
  /**
   * Support ticket creation event
   *
   * @constant
   */
  SupportTicket: createEvent("Support Ticket", EventChannel.SUPPORT, {
    description: "Tracks support ticket creation",
    severity: EventSeverity.INFO,
    tags: ["support", "customer-service", "ticket"],
  }),

  /**
   * Feedback submission event
   *
   * @constant
   */
  SendFeedback: createEvent("Send Feedback", EventChannel.FEEDBACK, {
    description: "Tracks user feedback submissions",
    severity: EventSeverity.INFO,
    tags: ["feedback", "user-input", "product-improvement"],
  }),

  /**
   * Support Thread Created
   */
  SupportThreadCreated: createEvent(
    "Support Thread Created",
    EventChannel.GENERAL,
    {
      description: "Support Thread Created",
      tags: ["support", "general"],
    },
  ),

  /**
   * Support Reply Sent
   */
  SupportReplySent: createEvent("Support Reply Sent", EventChannel.GENERAL, {
    description: "Support Reply Sent",
    tags: ["support", "general"],
  }),

  /**
   * Support Attachment Uploaded
   */
  SupportAttachmentUploaded: createEvent(
    "Support Attachment Uploaded",
    EventChannel.GENERAL,
    {
      description: "Support Attachment Uploaded",
      tags: ["support", "general"],
    },
  ),

  /**
   * Support Thread Resolved Seen
   */
  SupportThreadResolvedSeen: createEvent(
    "Support Thread Resolved Seen",
    EventChannel.GENERAL,
    {
      description: "Support Thread Resolved Seen",
      tags: ["support", "general"],
    },
  ),
} as const;

/**
 * Onboarding flow events
 *
 * @namespace
 */
export const OnboardingEvents = {
  OnboardingStarted: createEvent(
    "Onboarding Started",
    EventChannel.ONBOARDING,
    {
      description: "User entered the onboarding flow",
      tags: ["onboarding", "activation"],
    },
  ),
  OnboardingStepViewed: createEvent(
    "Onboarding Step Viewed",
    EventChannel.ONBOARDING,
    {
      description: "User viewed an onboarding step",
      tags: ["onboarding"],
    },
  ),
  OnboardingStepCompleted: createEvent(
    "Onboarding Step Completed",
    EventChannel.ONBOARDING,
    {
      description: "User completed an onboarding step",
      tags: ["onboarding"],
    },
  ),
  OnboardingStepSkipped: createEvent(
    "Onboarding Step Skipped",
    EventChannel.ONBOARDING,
    {
      description: "User skipped an onboarding step",
      tags: ["onboarding"],
    },
  ),
  OnboardingCompleted: createEvent(
    "Onboarding Completed",
    EventChannel.ONBOARDING,
    {
      description: "User finished the onboarding flow",
      tags: ["onboarding", "activation", "conversion"],
    },
  ),
  OnboardingAbandoned: createEvent(
    "Onboarding Abandoned",
    EventChannel.ONBOARDING,
    {
      description: "User exited the onboarding flow before completion",
      severity: EventSeverity.WARNING,
      tags: ["onboarding", "drop-off"],
    },
  ),
  OnboardingResumed: createEvent(
    "Onboarding Resumed",
    EventChannel.ONBOARDING,
    {
      description: "User returned to the onboarding flow after abandoning",
      tags: ["onboarding"],
    },
  ),
  OnboardingStageViewed: createEvent(
    "Onboarding Stage Viewed",
    EventChannel.ONBOARDING,
    {
      description: "User viewed a stage in the unified onboarding journey",
      tags: ["onboarding", "funnel", "stage"],
    },
  ),
  OnboardingStageCompleted: createEvent(
    "Onboarding Stage Completed",
    EventChannel.ONBOARDING,
    {
      description: "User completed a stage in the unified onboarding journey",
      tags: ["onboarding", "funnel", "stage", "conversion"],
    },
  ),
  OnboardingNextActionShown: createEvent(
    "Onboarding Next Action Shown",
    EventChannel.ONBOARDING,
    {
      description: "The canonical next best action was shown to a user",
      tags: ["onboarding", "next-action", "impression"],
    },
  ),
  OnboardingNextActionClicked: createEvent(
    "Onboarding Next Action Clicked",
    EventChannel.ONBOARDING,
    {
      description: "A user selected the canonical next best action",
      tags: ["onboarding", "next-action", "conversion"],
    },
  ),
  OnboardingGuideOpened: createEvent(
    "Onboarding Guide Opened",
    EventChannel.ONBOARDING,
    {
      description: "A user opened the setup guide or activation hub",
      tags: ["onboarding", "guide", "discovery"],
    },
  ),
  OnboardingGuideActionClicked: createEvent(
    "Onboarding Guide Action Clicked",
    EventChannel.ONBOARDING,
    {
      description: "A user selected an action from the setup guide",
      tags: ["onboarding", "guide", "conversion"],
    },
  ),
  OnboardingActivationMilestone: createEvent(
    "Onboarding Activation Milestone",
    EventChannel.ACTIVATION,
    {
      description: "A live business predicate completed an activation step",
      tags: ["onboarding", "activation", "milestone"],
    },
  ),
  OnboardingProviderError: createEvent(
    "Onboarding Provider Error",
    EventChannel.ONBOARDING,
    {
      description: "A provider failed during guided connection setup",
      severity: EventSeverity.WARNING,
      tags: ["onboarding", "provider", "error"],
    },
  ),
  OnboardingRecoveryAction: createEvent(
    "Onboarding Recovery Action",
    EventChannel.ONBOARDING,
    {
      description: "A user selected a recovery path after setup friction",
      tags: ["onboarding", "provider", "recovery"],
    },
  ),
  OnboardingFirstValueReached: createEvent(
    "Onboarding First Value Reached",
    EventChannel.ACTIVATION,
    {
      description: "A workspace reached the first value for its chosen outcome",
      tags: ["onboarding", "activation", "first-value", "conversion"],
    },
  ),
  OnboardingTourStarted: createEvent(
    "Onboarding Tour Started",
    EventChannel.ONBOARDING,
    {
      description: "A user started or resumed a contextual product tour",
      tags: ["onboarding", "tour", "activation"],
    },
  ),
  OnboardingTourAdvanced: createEvent(
    "Onboarding Tour Advanced",
    EventChannel.ONBOARDING,
    {
      description: "A user advanced to another contextual tour step",
      tags: ["onboarding", "tour"],
    },
  ),
  OnboardingTourSkipped: createEvent(
    "Onboarding Tour Skipped",
    EventChannel.ONBOARDING,
    {
      description: "A user dismissed a contextual product tour",
      tags: ["onboarding", "tour", "drop-off"],
    },
  ),
  OnboardingTourCompleted: createEvent(
    "Onboarding Tour Completed",
    EventChannel.ONBOARDING,
    {
      description: "A user completed a contextual product tour",
      tags: ["onboarding", "tour", "conversion"],
    },
  ),
  OnboardingCommunityJoinClicked: createEvent(
    "Onboarding Community Join Clicked",
    EventChannel.ONBOARDING,
    {
      description:
        "User clicked through to the Discord invite from the onboarding flow's community step",
      tags: ["onboarding", "community", "activation"],
    },
  ),
} as const;

/**
 * Billing and subscription events
 *
 * @namespace
 */
export const BillingEvents = {
  CheckoutStarted: createEvent("Checkout Started", EventChannel.BILLING, {
    description: "User started a checkout session",
    tags: ["billing", "checkout"],
  }),
  CheckoutCompleted: createEvent("Checkout Completed", EventChannel.BILLING, {
    description: "Checkout session completed successfully",
    tags: ["billing", "checkout", "conversion"],
  }),
  SubscriptionUpgraded: createEvent(
    "Subscription Upgraded",
    EventChannel.BILLING,
    {
      description: "Subscription plan upgraded",
      tags: ["billing", "subscription", "expansion"],
    },
  ),
  SubscriptionDowngraded: createEvent(
    "Subscription Downgraded",
    EventChannel.BILLING,
    {
      description: "Subscription plan downgraded",
      severity: EventSeverity.WARNING,
      tags: ["billing", "subscription", "contraction"],
    },
  ),
  SubscriptionCanceled: createEvent(
    "Subscription Canceled",
    EventChannel.BILLING,
    {
      description: "Subscription canceled",
      severity: EventSeverity.WARNING,
      tags: ["billing", "subscription", "churn"],
    },
  ),
} as const;

/**
 * Invoice lifecycle events
 *
 * @namespace
 */
export const InvoiceEvents = {
  InvoiceCreated: createEvent("Invoice Created", EventChannel.INVOICE, {
    description: "Invoice draft created",
    tags: ["invoice"],
  }),
  InvoiceSent: createEvent("Invoice Sent", EventChannel.INVOICE, {
    description: "Invoice sent to customer",
    tags: ["invoice", "communication"],
  }),
  InvoiceViewed: createEvent("Invoice Viewed", EventChannel.INVOICE, {
    description: "Invoice viewed by customer",
    tags: ["invoice", "customer-action"],
  }),
  InvoicePaid: createEvent("Invoice Paid", EventChannel.INVOICE, {
    description: "Invoice marked as paid",
    tags: ["invoice", "revenue"],
  }),
  InvoiceOverdue: createEvent("Invoice Overdue", EventChannel.INVOICE, {
    description: "Invoice passed due date without payment",
    severity: EventSeverity.WARNING,
    tags: ["invoice", "dunning"],
  }),
  InvoiceCanceled: createEvent("Invoice Canceled", EventChannel.INVOICE, {
    description: "Invoice canceled / voided",
    severity: EventSeverity.WARNING,
    tags: ["invoice"],
  }),
  InvoiceReminderSent: createEvent(
    "Invoice Reminder Sent",
    EventChannel.INVOICE,
    {
      description: "Dunning reminder dispatched for an overdue invoice",
      tags: ["invoice", "dunning", "communication"],
    },
  ),
  InvoiceDownloaded: createEvent("Invoice Downloaded", EventChannel.INVOICE, {
    description:
      "User downloaded an invoice document or PDF from an invoice surface",
    tags: ["invoice", "download", "engagement"],
  }),
  InvoicePreviewViewed: createEvent(
    "Invoice Preview Viewed",
    EventChannel.INVOICE,
    {
      description:
        "User viewed an invoice preview before sending, downloading, or sharing",
      tags: ["invoice", "preview", "engagement"],
    },
  ),
  InvoiceStatusChanged: createEvent(
    "Invoice Status Changed",
    EventChannel.INVOICE,
    {
      description: "Invoice lifecycle status changed through user action",
      tags: ["invoice", "status", "workflow"],
    },
  ),
} as const;

/**
 * Time tracker events
 *
 * @namespace
 */
export const TrackerEvents = {
  TrackerStarted: createEvent("Tracker Started", EventChannel.TRACKER, {
    description: "Time tracker started",
    tags: ["tracker"],
  }),
  TrackerStopped: createEvent("Tracker Stopped", EventChannel.TRACKER, {
    description: "Time tracker stopped",
    tags: ["tracker"],
  }),
  TrackerEntryCreated: createEvent(
    "Tracker Entry Created",
    EventChannel.TRACKER,
    {
      description: "Tracker entry added manually",
      tags: ["tracker"],
    },
  ),
  TrackerEntryUpdated: createEvent(
    "Tracker Entry Updated",
    EventChannel.TRACKER,
    {
      description: "Tracker entry edited",
      tags: ["tracker"],
    },
  ),
  TrackerEntryDeleted: createEvent(
    "Tracker Entry Deleted",
    EventChannel.TRACKER,
    {
      description: "Tracker entry removed",
      severity: EventSeverity.WARNING,
      tags: ["tracker"],
    },
  ),
  TrackerProjectCreated: createEvent(
    "Tracker Project Created",
    EventChannel.TRACKER,
    {
      description: "Tracker project created",
      tags: ["tracker", "project"],
    },
  ),
} as const;

/**
 * Customer CRUD events
 *
 * @namespace
 */
export const CustomerEvents = {
  CustomerCreated: createEvent("Customer Created", EventChannel.CUSTOMER, {
    description: "Customer record created",
    tags: ["customer"],
  }),
  CustomerUpdated: createEvent("Customer Updated", EventChannel.CUSTOMER, {
    description: "Customer record updated",
    tags: ["customer"],
  }),
  CustomerDeleted: createEvent("Customer Deleted", EventChannel.CUSTOMER, {
    description: "Customer record deleted",
    severity: EventSeverity.WARNING,
    tags: ["customer", "deletion"],
  }),
  CustomerImported: createEvent("Customer Imported", EventChannel.CUSTOMER, {
    description: "Customer import completed from CSV or external source",
    tags: ["customer", "import", "activation"],
  }),
  CustomerProfileViewed: createEvent(
    "Customer Profile Viewed",
    EventChannel.CUSTOMER,
    {
      description:
        "User viewed a customer profile, including billing, risk, or timeline data",
      tags: ["customer", "profile", "engagement"],
    },
  ),
} as const;

/**
 * Client portal events
 *
 * @namespace
 */
export const ClientPortalEvents = {
  ClientPortalViewed: createEvent(
    "Client Portal Viewed",
    EventChannel.CUSTOMER,
    {
      description:
        "Customer-facing portal was viewed successfully by a recipient",
      tags: ["portal", "customer", "engagement"],
    },
  ),
  ClientPortalViewFailed: createEvent(
    "Client Portal View Failed",
    EventChannel.FRICTION,
    {
      description: "Customer-facing portal view failed before rendering",
      severity: EventSeverity.WARNING,
      tags: ["portal", "customer", "friction"],
    },
  ),
  ClientPortalEnabled: createEvent(
    "Client Portal Enabled",
    EventChannel.CUSTOMER,
    {
      description: "Workspace user enabled portal access for a customer",
      tags: ["portal", "customer", "settings"],
    },
  ),
  ClientPortalDisabled: createEvent(
    "Client Portal Disabled",
    EventChannel.CUSTOMER,
    {
      description: "Workspace user disabled portal access for a customer",
      tags: ["portal", "customer", "settings"],
    },
  ),
  ClientPortalTokenRegenerated: createEvent(
    "Client Portal Token Regenerated",
    EventChannel.SECURITY,
    {
      description: "Workspace user regenerated a customer portal access token",
      severity: EventSeverity.WARNING,
      tags: ["portal", "security", "customer"],
    },
  ),
  ClientPortalActivityViewed: createEvent(
    "Client Portal Activity Viewed",
    EventChannel.CUSTOMER,
    {
      description: "Workspace user viewed customer portal activity history",
      tags: ["portal", "customer", "engagement"],
    },
  ),
  ClientPortalActionFailed: createEvent(
    "Client Portal Action Failed",
    EventChannel.FRICTION,
    {
      description: "Workspace user portal-admin action failed",
      severity: EventSeverity.WARNING,
      tags: ["portal", "customer", "friction"],
    },
  ),
  PortalPaymentStarted: createEvent(
    "Portal Payment Started",
    EventChannel.PAYMENT,
    {
      description: "Customer clicked to start payment from the portal",
      tags: ["portal", "payment", "intent"],
    },
  ),
  PortalPaymentInitiated: createEvent(
    "Portal Payment Initiated",
    EventChannel.PAYMENT,
    {
      description: "Portal payment session was created successfully",
      tags: ["portal", "payment", "checkout"],
    },
  ),
  PortalPaymentConfirmed: createEvent(
    "Portal Payment Confirmed",
    EventChannel.PAYMENT,
    {
      description: "Portal payment was confirmed after checkout polling",
      tags: ["portal", "payment", "outcome"],
    },
  ),
  PortalPaymentFailed: createEvent(
    "Portal Payment Failed",
    EventChannel.PAYMENT,
    {
      description: "Portal payment attempt failed before confirmation",
      severity: EventSeverity.WARNING,
      tags: ["portal", "payment", "friction"],
    },
  ),
} as const;

/**
 * Corinthian assistant events
 *
 * @namespace
 */
export const AssistantEvents = {
  AssistantSessionStarted: createEvent(
    "Assistant Session Started",
    EventChannel.ASSISTANT,
    {
      description: "User opened an assistant session",
      tags: ["assistant"],
    },
  ),
  AssistantMessageSent: createEvent(
    "Assistant Message Sent",
    EventChannel.ASSISTANT,
    {
      description: "User sent a message to the assistant",
      tags: ["assistant"],
    },
  ),
  AssistantMessageReceived: createEvent(
    "Assistant Message Received",
    EventChannel.ASSISTANT,
    {
      description: "Assistant returned a response",
      tags: ["assistant"],
    },
  ),
  AssistantToolInvoked: createEvent(
    "Assistant Tool Invoked",
    EventChannel.ASSISTANT,
    {
      description: "Assistant invoked a tool call",
      tags: ["assistant", "tool"],
    },
  ),
  AssistantToolFailed: createEvent(
    "Assistant Tool Failed",
    EventChannel.ASSISTANT,
    {
      description: "Assistant tool call failed",
      severity: EventSeverity.ERROR,
      tags: ["assistant", "tool", "error"],
    },
  ),
  AssistantArtifactCreated: createEvent(
    "Assistant Artifact Created",
    EventChannel.ASSISTANT,
    {
      description: "Assistant produced an artifact (doc, draft, file)",
      tags: ["assistant", "artifact"],
    },
  ),
  AssistantBriefingStarted: createEvent(
    "Assistant Briefing Started",
    EventChannel.ASSISTANT,
    {
      description: "User started a briefing flow",
      tags: ["assistant", "briefing"],
    },
  ),
  AssistantBriefingCompleted: createEvent(
    "Assistant Briefing Completed",
    EventChannel.ASSISTANT,
    {
      description: "Briefing flow completed",
      tags: ["assistant", "briefing"],
    },
  ),
} as const;

/**
 * Settings and team-management events
 *
 * @namespace
 */
export const SettingsEvents = {
  SettingsUpdated: createEvent("Settings Updated", EventChannel.SETTINGS, {
    description: "Workspace or user setting updated",
    tags: ["settings"],
  }),
  TeamMemberInvited: createEvent("Team Member Invited", EventChannel.SETTINGS, {
    description: "Invite sent to a new team member",
    tags: ["settings", "team", "invite"],
  }),
  TeamMemberRemoved: createEvent("Team Member Removed", EventChannel.SETTINGS, {
    description: "Team member removed",
    severity: EventSeverity.WARNING,
    tags: ["settings", "team"],
  }),
  TeamRoleChanged: createEvent("Team Role Changed", EventChannel.SETTINGS, {
    description: "Team member role updated",
    tags: ["settings", "team", "role"],
  }),
} as const;

/**
 * Payment lifecycle events
 *
 * @namespace
 */
export const PaymentEvents = {
  PaymentSucceeded: createEvent("Payment Succeeded", EventChannel.PAYMENT, {
    description: "Payment captured successfully",
    tags: ["payment", "revenue"],
  }),
  PaymentFailed: createEvent("Payment Failed", EventChannel.PAYMENT, {
    description: "Payment attempt failed",
    severity: EventSeverity.WARNING,
    tags: ["payment", "failure"],
  }),
  PaymentRefunded: createEvent("Payment Refunded", EventChannel.PAYMENT, {
    description: "Payment refunded",
    severity: EventSeverity.WARNING,
    tags: ["payment", "refund"],
  }),
  PaymentDisputeOpened: createEvent(
    "Payment Dispute Opened",
    EventChannel.PAYMENT,
    {
      description: "Customer opened a dispute / chargeback",
      severity: EventSeverity.ERROR,
      tags: ["payment", "dispute"],
    },
  ),
  PaymentEventEmailDelivered: createEvent(
    "Payment Event Email Delivered",
    EventChannel.PAYMENT,
    {
      description:
        "Customer-facing email sent in response to a payment lifecycle event",
      tags: ["payment", "communication"],
    },
  ),
} as const;

/**
 * Dunning workflow lifecycle events.
 *
 * @namespace
 */
export const WorkflowEvents = {
  WorkflowTriggered: createEvent("Workflow Triggered", EventChannel.WORKFLOW, {
    description: "A workflow execution was kicked off",
    tags: ["workflow", "dunning"],
  }),
  WorkflowNodeAdvanced: createEvent(
    "Workflow Node Advanced",
    EventChannel.WORKFLOW,
    {
      description: "Workflow execution transitioned to a new node",
      tags: ["workflow", "dunning"],
    },
  ),
  WorkflowEscalated: createEvent("Workflow Escalated", EventChannel.WORKFLOW, {
    description: "Workflow execution moved to an escalation branch",
    severity: EventSeverity.WARNING,
    tags: ["workflow", "dunning", "escalation"],
  }),
  WorkflowCompleted: createEvent("Workflow Completed", EventChannel.WORKFLOW, {
    description: "Workflow execution reached a terminal success state",
    tags: ["workflow", "dunning", "completion"],
  }),
  WorkflowFailed: createEvent("Workflow Failed", EventChannel.WORKFLOW, {
    description: "Workflow execution terminated with a failure",
    severity: EventSeverity.ERROR,
    tags: ["workflow", "dunning", "error"],
  }),
  ReminderListViewed: createEvent(
    "Reminder List Viewed",
    EventChannel.WORKFLOW,
    {
      description: "User viewed the reminders management surface",
      tags: ["reminder", "workflow", "engagement"],
    },
  ),
  ReminderWidgetClicked: createEvent(
    "Reminder Widget Clicked",
    EventChannel.WORKFLOW,
    {
      description: "User clicked into reminders from a dashboard widget",
      tags: ["reminder", "workflow", "engagement"],
    },
  ),
  ReminderCreated: createEvent("Reminder Created", EventChannel.WORKFLOW, {
    description: "User created a manual or scheduled reminder",
    tags: ["reminder", "workflow", "creation"],
  }),
  ReminderUpdated: createEvent("Reminder Updated", EventChannel.WORKFLOW, {
    description: "User updated reminder timing, content, or ownership",
    tags: ["reminder", "workflow", "update"],
  }),
  ReminderSnoozed: createEvent("Reminder Snoozed", EventChannel.WORKFLOW, {
    description: "User snoozed a reminder for later action",
    tags: ["reminder", "workflow", "snooze"],
  }),
  ReminderSent: createEvent("Reminder Sent", EventChannel.WORKFLOW, {
    description: "User sent a reminder immediately",
    tags: ["reminder", "workflow", "communication"],
  }),
  ReminderDeleted: createEvent("Reminder Deleted", EventChannel.WORKFLOW, {
    description: "User deleted a reminder",
    severity: EventSeverity.WARNING,
    tags: ["reminder", "workflow", "deletion"],
  }),
  ReminderBulkSent: createEvent("Reminder Bulk Sent", EventChannel.WORKFLOW, {
    description: "User sent multiple reminders in one bulk action",
    tags: ["reminder", "workflow", "bulk"],
  }),
  ReminderAutomationPaused: createEvent(
    "Reminder Automation Paused",
    EventChannel.WORKFLOW,
    {
      description:
        "Reminder automation paused because manual handling took over",
      tags: ["reminder", "workflow", "automation"],
    },
  ),
  ReminderActionFailed: createEvent(
    "Reminder Action Failed",
    EventChannel.FRICTION,
    {
      description: "Reminder create, update, send, snooze, or delete failed",
      severity: EventSeverity.WARNING,
      tags: ["reminder", "workflow", "friction"],
    },
  ),
  ReminderActionCancelled: createEvent(
    "Reminder Action Cancelled",
    EventChannel.WORKFLOW,
    {
      description: "User cancelled a reminder create or update form",
      tags: ["reminder", "workflow", "cancellation"],
    },
  ),
} as const;

/**
 * OAuth / API integration lifecycle events.
 *
 * @namespace
 */
export const IntegrationEvents = {
  IntegrationConnected: createEvent(
    "Integration Connected",
    EventChannel.INTEGRATION,
    {
      description: "User completed OAuth/API connection for an integration",
      tags: ["integration", "activation"],
    },
  ),
  IntegrationDisconnected: createEvent(
    "Integration Disconnected",
    EventChannel.INTEGRATION,
    {
      description: "User removed an integration",
      severity: EventSeverity.WARNING,
      tags: ["integration", "churn-signal"],
    },
  ),
  IntegrationReconnected: createEvent(
    "Integration Reconnected",
    EventChannel.INTEGRATION,
    {
      description: "User refreshed an expired/broken integration",
      tags: ["integration", "maintenance"],
    },
  ),
} as const;

/**
 * Document/report export and download events.
 *
 * @namespace
 */
export const ExportEvents = {
  InvoiceExported: createEvent("Invoice Exported", EventChannel.EXPORT, {
    description: "User downloaded an invoice PDF",
    tags: ["export", "invoice"],
  }),
  ReportExported: createEvent("Report Exported", EventChannel.EXPORT, {
    description: "User exported / downloaded a generated report",
    tags: ["export", "report"],
  }),
} as const;

/**
 * Activation milestones — fired exactly once per workspace the first time a
 * given action happens. Used for funnel analysis from sign-up → first value.
 *
 * @namespace
 */
export const ActivationEvents = {
  FirstCustomerCreated: createEvent(
    "First Customer Created",
    EventChannel.ACTIVATION,
    {
      description: "Workspace created its first customer",
      tags: ["activation", "first", "customer"],
    },
  ),
  FirstInvoiceCreated: createEvent(
    "First Invoice Created",
    EventChannel.ACTIVATION,
    {
      description: "Workspace created its first invoice (draft or not)",
      tags: ["activation", "first", "invoice"],
    },
  ),
  FirstInvoiceSent: createEvent("First Invoice Sent", EventChannel.ACTIVATION, {
    description: "Workspace sent its first invoice to a customer",
    tags: ["activation", "first", "invoice", "send"],
  }),
  FirstPaymentReceived: createEvent(
    "First Payment Received",
    EventChannel.ACTIVATION,
    {
      description:
        "Workspace received its first invoice payment — the canonical aha moment",
      tags: ["activation", "first", "payment", "revenue"],
    },
  ),
  FirstInboxReplyReceived: createEvent(
    "First Inbox Reply Received",
    EventChannel.ACTIVATION,
    {
      description:
        "Workspace's first inbound customer reply landed on a thread",
      tags: ["activation", "first", "inbox"],
    },
  ),
  FirstAssistantChatStarted: createEvent(
    "First Assistant Chat Started",
    EventChannel.ACTIVATION,
    {
      description: "User opened the assistant for the first time",
      tags: ["activation", "first", "assistant"],
    },
  ),
  FirstAssistantDraftAccepted: createEvent(
    "First Assistant Draft Accepted",
    EventChannel.ACTIVATION,
    {
      description: "User accepted an AI-generated draft for the first time",
      tags: ["activation", "first", "assistant", "ai-trust"],
    },
  ),
  FirstIntegrationConnected: createEvent(
    "First Integration Connected",
    EventChannel.ACTIVATION,
    {
      description: "Workspace connected its first OAuth integration",
      tags: ["activation", "first", "integration"],
    },
  ),
  FirstScheduledBriefingCreated: createEvent(
    "First Scheduled Briefing Created",
    EventChannel.ACTIVATION,
    {
      description: "User created their first recurring briefing schedule",
      tags: ["activation", "first", "briefing"],
    },
  ),
  FirstWorkflowAutomationEnabled: createEvent(
    "First Workflow Automation Enabled",
    EventChannel.ACTIVATION,
    {
      description: "Workspace turned on its first dunning workflow",
      tags: ["activation", "first", "workflow"],
    },
  ),
  // ---- Canvas-specific activation milestones ----
  FirstBankConnected: createEvent(
    "First Bank Connected",
    EventChannel.ACTIVATION,
    {
      description:
        "Workspace successfully linked its first bank account (Canvas aha moment)",
      tags: ["activation", "first", "banking", "canvas"],
    },
  ),
  FirstTransactionsSynced: createEvent(
    "First Transactions Synced",
    EventChannel.ACTIVATION,
    {
      description:
        "First batch of real transactions landed for a workspace via bank sync",
      tags: ["activation", "first", "transaction", "canvas"],
    },
  ),
  FirstTransactionCategorized: createEvent(
    "First Transaction Categorized",
    EventChannel.ACTIVATION,
    {
      description:
        "User updated a transaction's category for the first time — proves trust in the data",
      tags: ["activation", "first", "transaction", "canvas"],
    },
  ),
  FirstDocumentUploaded: createEvent(
    "First Document Uploaded",
    EventChannel.ACTIVATION,
    {
      description:
        "First document uploaded to the workspace vault (canvas/inbox parsing path)",
      tags: ["activation", "first", "vault", "document"],
    },
  ),
  FirstAccountingExport: createEvent(
    "First Accounting Export",
    EventChannel.ACTIVATION,
    {
      description:
        "Workspace pushed data to an accounting provider (QuickBooks, Xero, etc.) for the first time",
      tags: ["activation", "first", "accounting", "export"],
    },
  ),
  FirstTeamMemberInvited: createEvent(
    "First Team Member Invited",
    EventChannel.ACTIVATION,
    {
      description:
        "Workspace owner invited their first teammate — multi-user signal",
      tags: ["activation", "first", "team", "expansion"],
    },
  ),
} as const;

/**
 * Friction / health signals — leading indicators for churn or support load.
 *
 * @namespace
 */
export const FrictionEvents = {
  ErrorEncountered: createEvent("Error Encountered", EventChannel.FRICTION, {
    description: "A mutation, route, or background job surfaced an error",
    severity: EventSeverity.ERROR,
    tags: ["friction", "error"],
  }),
  IntegrationConnectionLost: createEvent(
    "Integration Connection Lost",
    EventChannel.FRICTION,
    {
      description:
        "An OAuth integration's tokens were revoked, expired, or rejected",
      severity: EventSeverity.WARNING,
      tags: ["friction", "integration", "churn-risk"],
    },
  ),
  IngestionFailureSeen: createEvent(
    "Ingestion Failure Seen",
    EventChannel.FRICTION,
    {
      description:
        "A webhook receiver failed to ingest payload (inbox, payments, etc.)",
      severity: EventSeverity.WARNING,
      tags: ["friction", "webhook"],
    },
  ),
  EmptyStateShown: createEvent("Empty State Shown", EventChannel.FRICTION, {
    description: "A user-facing list rendered with zero rows",
    tags: ["friction", "empty-state"],
  }),
  LoadingExceededSLO: createEvent(
    "Loading Exceeded SLO",
    EventChannel.FRICTION,
    {
      description: "A surface loaded slower than the target SLO",
      severity: EventSeverity.WARNING,
      tags: ["friction", "perf"],
    },
  ),
  OnboardingStepAbandonedDetailed: createEvent(
    "Onboarding Step Abandoned (Detailed)",
    EventChannel.FRICTION,
    {
      description:
        "User left an onboarding step after >N seconds without completing it",
      severity: EventSeverity.WARNING,
      tags: ["friction", "onboarding"],
    },
  ),
  AssistantSuggestionRejected: createEvent(
    "Assistant Suggestion Rejected",
    EventChannel.FRICTION,
    {
      description: "User discarded an AI-generated draft",
      tags: ["friction", "assistant", "ai-quality"],
    },
  ),
  UserSignedOutInactive: createEvent(
    "User Signed Out Inactive",
    EventChannel.FRICTION,
    {
      description: "A user's session ended after a prolonged inactivity window",
      severity: EventSeverity.WARNING,
      tags: ["friction", "session"],
    },
  ),
} as const;

/**
 * Computed outcome events — the ROI story.
 *
 * @namespace
 */
export const OutcomeEvents = {
  InvoicePaymentAttributed: createEvent(
    "Invoice Payment Attributed",
    EventChannel.OUTCOME,
    {
      description:
        "Payment received on an invoice, attributed to the last Corinthian touch (assistant draft, dunning step, manual reminder, or organic)",
      tags: ["outcome", "attribution", "revenue"],
    },
  ),
  DSOImprovementWeekly: createEvent(
    "DSO Improvement Weekly",
    EventChannel.OUTCOME,
    {
      description: "Weekly change in days-sales-outstanding for the workspace",
      tags: ["outcome", "dso"],
    },
  ),
  ManualTouchSaved: createEvent("Manual Touch Saved", EventChannel.OUTCOME, {
    description:
      "An AI-generated draft was sent without significant human edit",
    tags: ["outcome", "assistant", "productivity"],
  }),
  DunningRecoveryWin: createEvent(
    "Dunning Recovery Win",
    EventChannel.OUTCOME,
    {
      description:
        "An overdue invoice was paid after a dunning workflow step fired",
      tags: ["outcome", "dunning", "recovery"],
    },
  ),
  DisputeResolved: createEvent("Dispute Resolved", EventChannel.OUTCOME, {
    description: "A payment dispute reached a terminal resolution",
    tags: ["outcome", "dispute"],
  }),
  CashCollectedDaily: createEvent(
    "Cash Collected Daily",
    EventChannel.OUTCOME,
    {
      description:
        "Aggregate dollar amount collected through Corinthian on a given day",
      tags: ["outcome", "cash"],
    },
  ),
  OverdueRateWeekly: createEvent("Overdue Rate Weekly", EventChannel.OUTCOME, {
    description: "Weekly change in the workspace's overdue invoice rate",
    tags: ["outcome", "overdue"],
  }),
  AssistantDraftCycleTime: createEvent(
    "Assistant Draft Cycle Time",
    EventChannel.OUTCOME,
    {
      description:
        "Seconds elapsed from an assistant draft being generated to being sent",
      tags: ["outcome", "assistant", "cycle-time"],
    },
  ),
} as const;

/**
 * Engagement / habit events — middle-of-funnel power-user indicators.
 *
 * @namespace
 */
export const EngagementEvents = {
  DailySessionStarted: createEvent(
    "Daily Session Started",
    EventChannel.GENERAL,
    {
      description:
        "First session of the day for this user on a given surface (DAU signal)",
      tags: ["engagement", "session", "dau"],
    },
  ),
  TemplateUsed: createEvent("Template Used", EventChannel.INBOX, {
    description:
      "User applied a saved message template into the composer (track edits separately)",
    tags: ["engagement", "template"],
  }),
  BulkActionPerformed: createEvent(
    "Bulk Action Performed",
    EventChannel.GENERAL,
    {
      description: "User performed a bulk operation across multiple rows",
      tags: ["engagement", "bulk", "power-user"],
    },
  ),
  SearchPerformed: createEvent("Search Performed", EventChannel.GENERAL, {
    description:
      "User ran a search on a surface (sample at 10% to control cost)",
    tags: ["engagement", "search"],
  }),
  FilterSaved: createEvent("Filter Saved", EventChannel.GENERAL, {
    description: "User saved a custom filter (strong retention indicator)",
    tags: ["engagement", "filter", "power-user"],
  }),
  KeyboardShortcutUsed: createEvent(
    "Keyboard Shortcut Used",
    EventChannel.GENERAL,
    {
      description: "User triggered an action via keyboard shortcut",
      tags: ["engagement", "shortcut", "power-user"],
    },
  ),
  RecurringInvoiceCreated: createEvent(
    "Recurring Invoice Created",
    EventChannel.INVOICE,
    {
      description:
        "User scheduled an invoice to recur — strong retention signal",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoicesListViewed: createEvent(
    "Recurring Invoices List Viewed",
    EventChannel.INVOICE,
    {
      description: "User viewed the recurring invoices management surface",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceViewed: createEvent(
    "Recurring Invoice Viewed",
    EventChannel.INVOICE,
    {
      description: "User viewed a recurring invoice detail surface",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceWidgetClicked: createEvent(
    "Recurring Invoice Widget Clicked",
    EventChannel.INVOICE,
    {
      description: "User clicked into recurring invoices from a widget",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceUpdated: createEvent(
    "Recurring Invoice Updated",
    EventChannel.INVOICE,
    {
      description: "User updated recurring invoice schedule or content",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoicePaused: createEvent(
    "Recurring Invoice Paused",
    EventChannel.INVOICE,
    {
      description: "User paused a recurring invoice schedule",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceResumed: createEvent(
    "Recurring Invoice Resumed",
    EventChannel.INVOICE,
    {
      description: "User resumed a paused recurring invoice schedule",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceCanceled: createEvent(
    "Recurring Invoice Canceled",
    EventChannel.INVOICE,
    {
      description:
        "User canceled a recurring invoice schedule, ending future issuance",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceSkipped: createEvent(
    "Recurring Invoice Skipped",
    EventChannel.INVOICE,
    {
      description: "User skipped an upcoming recurring invoice occurrence",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceSentNow: createEvent(
    "Recurring Invoice Sent Now",
    EventChannel.INVOICE,
    {
      description: "User manually sent a recurring invoice immediately",
      tags: ["engagement", "invoice", "recurring"],
    },
  ),
  RecurringInvoiceDeleted: createEvent(
    "Recurring Invoice Deleted",
    EventChannel.INVOICE,
    {
      description: "User deleted a recurring invoice schedule",
      severity: EventSeverity.WARNING,
      tags: ["engagement", "invoice", "recurring", "deletion"],
    },
  ),
  RecurringInvoiceDeleteFailed: createEvent(
    "Recurring Invoice Delete Failed",
    EventChannel.FRICTION,
    {
      description: "Recurring invoice delete action failed",
      severity: EventSeverity.WARNING,
      tags: ["invoice", "recurring", "friction"],
    },
  ),
  RecurringInvoiceActionFailed: createEvent(
    "Recurring Invoice Action Failed",
    EventChannel.FRICTION,
    {
      description:
        "Recurring invoice create, update, pause, resume, skip, send, or delete failed",
      severity: EventSeverity.WARNING,
      tags: ["invoice", "recurring", "friction"],
    },
  ),
  InvoiceTemplateCreated: createEvent(
    "Invoice Template Created",
    EventChannel.INVOICE,
    {
      description: "User saved an invoice template for reuse",
      tags: ["engagement", "invoice", "template"],
    },
  ),
} as const;

/**
 * Expansion / account-health signals — primarily consumed by GTM / Sales
 * dashboards. Fire when a workspace crosses a meaningful threshold or
 * reveals upgrade intent.
 *
 * @namespace
 */
export const ExpansionEvents = {
  TeamMemberJoined: createEvent("Team Member Joined", EventChannel.SETTINGS, {
    description:
      "An invited team member completed sign-up and joined the workspace",
    tags: ["expansion", "team", "realized"],
  }),
  MonthlyTransactionVolumeBand: createEvent(
    "Monthly Transaction Volume Band",
    EventChannel.GENERAL,
    {
      description:
        "Workspace crossed a transaction-volume band (100, 1k, 10k, 50k, 100k+ per month)",
      tags: ["expansion", "transaction", "plan-fit"],
    },
  ),
  IntegrationCountCrossedThreshold: createEvent(
    "Integration Count Crossed Threshold",
    EventChannel.INTEGRATION,
    {
      description:
        "Workspace crossed an integration-count threshold (1, 3, 5) — multi-integration = sticky",
      tags: ["expansion", "integration", "switching-cost"],
    },
  ),
  BankAccountCountCrossedThreshold: createEvent(
    "Bank Account Count Crossed Threshold",
    EventChannel.BANK,
    {
      description:
        "Workspace crossed a connected-bank-account threshold (1, 3, 5, 10)",
      tags: ["expansion", "banking"],
    },
  ),
  BillingUpgradeViewed: createEvent(
    "Billing Upgrade Viewed",
    EventChannel.BILLING,
    {
      description:
        "User viewed the billing / upgrade page — leading indicator of conversion intent",
      tags: ["expansion", "billing", "intent"],
    },
  ),
  WorkflowAutomationCreated: createEvent(
    "Workflow Automation Created",
    EventChannel.WORKFLOW,
    {
      description: "User created any new workflow automation — embedded use",
      tags: ["expansion", "workflow", "automation"],
    },
  ),
  MultiCurrencyEnabled: createEvent(
    "Multi Currency Enabled",
    EventChannel.SETTINGS,
    {
      description:
        "Workspace enabled multi-currency support — pro/enterprise feature",
      tags: ["expansion", "settings", "multi-currency"],
    },
  ),
} as const;

/**
 * General product events
 *
 * @namespace
 */
export const GeneralEvents = {
  PageViewed: createEvent("Page Viewed", EventChannel.GENERAL, {
    description: "User viewed a page",
    tags: ["page-view"],
  }),
  FeatureUsed: createEvent("Feature Used", EventChannel.GENERAL, {
    description: "User used a tracked feature",
    tags: ["feature"],
  }),
} as const;

/**
 * Complete event registry combining all event namespaces
 *
 * @constant
 */
export const LogEvents = {
  ...AuthenticationEvents,
  ...TeamEvents,
  ...BankingEvents,
  ...GoCardLessEvents,
  ...EnableBankingEvents,
  ...TransactionEvents,
  ...VaultEvents,
  ...InboxEvents,
  ...CommsComplianceEvents,
  ...SupportEvents,
  ...OnboardingEvents,
  ...BillingEvents,
  ...InvoiceEvents,
  ...TrackerEvents,
  ...CustomerEvents,
  ...ClientPortalEvents,
  ...AssistantEvents,
  ...SettingsEvents,
  ...PaymentEvents,
  ...WorkflowEvents,
  ...IntegrationEvents,
  ...ExportEvents,
  ...ActivationEvents,
  ...FrictionEvents,
  ...OutcomeEvents,
  ...EngagementEvents,
  ...ExpansionEvents,
  ...GeneralEvents,
} as const;

/**
 * Type representing all available event keys
 *
 * @typedef
 */
export type EventKey = keyof typeof LogEvents;

/**
 * Type representing all event definitions
 *
 * @typedef
 */
export type LogEventDefinition = (typeof LogEvents)[EventKey];

/**
 * Gets an event definition by key
 *
 * @param {EventKey} key - Event key
 * @returns {EventDefinition} Event definition
 */
export function getEventDefinition(key: EventKey): EventDefinition {
  return LogEvents[key];
}

/**
 * Gets all events for a specific channel
 *
 * @param {EventChannel} channel - Event channel
 * @returns {EventDefinition[]} Array of event definitions
 */
export function getEventsByChannel(channel: EventChannel): EventDefinition[] {
  return Object.values(LogEvents).filter((event) => event.channel === channel);
}

/**
 * Gets all events with a specific severity
 *
 * @param {EventSeverity} severity - Event severity
 * @returns {EventDefinition[]} Array of event definitions
 */
export function getEventsBySeverity(
  severity: EventSeverity,
): EventDefinition[] {
  return Object.values(LogEvents).filter(
    (event) => event.severity === severity,
  );
}

/**
 * Gets all events with a specific tag
 *
 * @param {string} tag - Tag to filter by
 * @returns {EventDefinition[]} Array of event definitions
 */
export function getEventsByTag(tag: string): EventDefinition[] {
  return Object.values(LogEvents).filter((event) => event.tags.includes(tag));
}

/**
 * Checks if an event key exists
 *
 * @param {string} key - Event key to check
 * @returns {boolean} Whether the event exists
 */
export function isValidEventKey(key: string): key is EventKey {
  return key in LogEvents;
}

/**
 * Gets event metadata for monitoring and debugging
 *
 * @param {EventKey} key - Event key
 * @returns {Object} Event metadata
 */
export function getEventMetadata(key: EventKey): {
  name: string;
  channel: string;
  severity: string;
  tags: string[];
  version: string;
} {
  const event = LogEvents[key];
  return {
    name: event.name,
    channel: event.channel,
    severity: event.severity,
    tags: event.tags,
    version: event.version,
  };
}
