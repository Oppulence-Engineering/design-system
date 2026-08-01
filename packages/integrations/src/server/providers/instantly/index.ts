import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from Instantly's published OpenAPI document:
 * https://developer.instantly.ai/api-reference/openapi.json
 *
 * Paths, methods, parameter names, required-ness, and enums are the vendor's
 * own. Actions the document does not describe are deferred with that reason
 * rather than bound to a plausible neighbour.
 */
const SPEC_NOTE =
  "Instantly publishes no maintained Node SDK; its OpenAPI document at https://developer.instantly.ai/api-reference/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-leads",
    name: "List Leads",
    description:
      "Retrieves Instantly V2 leads with search, campaign, list, and pagination filters.",
    method: "GET",
    url: (i) =>
      `/api/v2/lead-lists${restQuery({ limit: i.limit, starting_after: i.startingAfter, has_enrichment_task: i.hasEnrichmentTask, search: i.search })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        startingAfter: z.string().max(4_000).optional(),
        hasEnrichmentTask: z.boolean().optional(),
        search: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "get-lead",
    name: "Get Lead",
    description: "Retrieves an Instantly V2 lead by ID.",
    method: "GET",
    url: (i) => `/api/v2/leads/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-lead",
    name: "Create Lead",
    description: "Creates an Instantly V2 lead in a campaign or lead list.",
    method: "POST",
    url: "/api/v2/leads",
    input: z
      .object({
        campaign: z.string().max(4_000).optional(),
        email: z.string().max(4_000).optional(),
        personalization: z.string().max(4_000).optional(),
        website: z.string().max(4_000).optional(),
        lastName: z.string().max(4_000).optional(),
        firstName: z.string().max(4_000).optional(),
        companyName: z.string().max(4_000).optional(),
        phone: z.string().max(4_000).optional(),
        ltInterestStatus: z.number().optional(),
        plValueLead: z.string().max(4_000).optional(),
        listId: z.string().max(4_000).optional(),
        assignedTo: z.string().max(4_000).optional(),
        skipIfInWorkspace: z.boolean().optional(),
        skipIfInCampaign: z.boolean().optional(),
        skipIfInList: z.boolean().optional(),
        blocklistId: z.string().max(4_000).optional(),
        verifyLeadsForLeadFinder: z.boolean().optional(),
        verifyLeadsOnImport: z.boolean().optional(),
        customVariables: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.campaign !== undefined ? { campaign: i.campaign } : {}),
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.personalization !== undefined
        ? { personalization: i.personalization }
        : {}),
      ...(i.website !== undefined ? { website: i.website } : {}),
      ...(i.lastName !== undefined ? { last_name: i.lastName } : {}),
      ...(i.firstName !== undefined ? { first_name: i.firstName } : {}),
      ...(i.companyName !== undefined ? { company_name: i.companyName } : {}),
      ...(i.phone !== undefined ? { phone: i.phone } : {}),
      ...(i.ltInterestStatus !== undefined
        ? { lt_interest_status: i.ltInterestStatus }
        : {}),
      ...(i.plValueLead !== undefined ? { pl_value_lead: i.plValueLead } : {}),
      ...(i.listId !== undefined ? { list_id: i.listId } : {}),
      ...(i.assignedTo !== undefined ? { assigned_to: i.assignedTo } : {}),
      ...(i.skipIfInWorkspace !== undefined
        ? { skip_if_in_workspace: i.skipIfInWorkspace }
        : {}),
      ...(i.skipIfInCampaign !== undefined
        ? { skip_if_in_campaign: i.skipIfInCampaign }
        : {}),
      ...(i.skipIfInList !== undefined
        ? { skip_if_in_list: i.skipIfInList }
        : {}),
      ...(i.blocklistId !== undefined ? { blocklist_id: i.blocklistId } : {}),
      ...(i.verifyLeadsForLeadFinder !== undefined
        ? { verify_leads_for_lead_finder: i.verifyLeadsForLeadFinder }
        : {}),
      ...(i.verifyLeadsOnImport !== undefined
        ? { verify_leads_on_import: i.verifyLeadsOnImport }
        : {}),
      ...(i.customVariables !== undefined
        ? { custom_variables: i.customVariables }
        : {}),
    }),
  },
  {
    action: "patch-lead",
    name: "Patch Lead",
    description: "Updates fields on an existing Instantly V2 lead.",
    method: "PATCH",
    url: (i) => `/api/v2/leads/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
        personalization: z.string().max(4_000).optional(),
        website: z.string().max(4_000).optional(),
        lastName: z.string().max(4_000).optional(),
        firstName: z.string().max(4_000).optional(),
        companyName: z.string().max(4_000).optional(),
        phone: z.string().max(4_000).optional(),
        ltInterestStatus: z.number().optional(),
        plValueLead: z.string().max(4_000).optional(),
        assignedTo: z.string().max(4_000).optional(),
        customVariables: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.personalization !== undefined
        ? { personalization: i.personalization }
        : {}),
      ...(i.website !== undefined ? { website: i.website } : {}),
      ...(i.lastName !== undefined ? { last_name: i.lastName } : {}),
      ...(i.firstName !== undefined ? { first_name: i.firstName } : {}),
      ...(i.companyName !== undefined ? { company_name: i.companyName } : {}),
      ...(i.phone !== undefined ? { phone: i.phone } : {}),
      ...(i.ltInterestStatus !== undefined
        ? { lt_interest_status: i.ltInterestStatus }
        : {}),
      ...(i.plValueLead !== undefined ? { pl_value_lead: i.plValueLead } : {}),
      ...(i.assignedTo !== undefined ? { assigned_to: i.assignedTo } : {}),
      ...(i.customVariables !== undefined
        ? { custom_variables: i.customVariables }
        : {}),
    }),
  },
  {
    action: "delete-leads",
    name: "Delete Leads",
    description:
      "Deletes Instantly V2 leads in bulk from a campaign or lead list.",
    method: "DELETE",
    url: "/api/v2/leads",
    input: z
      .object({
        campaignId: z.string().max(4_000).optional(),
        listId: z.string().max(4_000).optional(),
        status: z.number().optional(),
        ids: SpecArray.optional(),
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.campaignId !== undefined ? { campaign_id: i.campaignId } : {}),
      ...(i.listId !== undefined ? { list_id: i.listId } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.ids !== undefined ? { ids: i.ids } : {}),
      ...(i.limit !== undefined ? { limit: i.limit } : {}),
    }),
    emptyResponse: "optional",
  },
  {
    action: "update-lead-interest-status",
    name: "Update Lead Interest Status",
    description:
      "Submits an Instantly V2 background job to update a lead interest status.",
    method: "POST",
    url: "/api/v2/leads/update-interest-status",
    input: z
      .object({
        leadEmail: z.string().max(4_000),
        interestValue: z.string().max(4_000),
        campaignId: z.string().max(4_000).optional(),
        aiInterestValue: z.number().optional(),
        disableAutoInterest: z.boolean().optional(),
        listId: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      lead_email: i.leadEmail,
      interest_value: i.interestValue,
      ...(i.campaignId !== undefined ? { campaign_id: i.campaignId } : {}),
      ...(i.aiInterestValue !== undefined
        ? { ai_interest_value: i.aiInterestValue }
        : {}),
      ...(i.disableAutoInterest !== undefined
        ? { disable_auto_interest: i.disableAutoInterest }
        : {}),
      ...(i.listId !== undefined ? { list_id: i.listId } : {}),
    }),
  },
  {
    action: "list-campaigns",
    name: "List Campaigns",
    description:
      "Retrieves Instantly V2 campaigns with search, status, tag, and pagination filters.",
    method: "GET",
    url: (i) =>
      `/api/v2/campaigns${restQuery({ limit: i.limit, starting_after: i.startingAfter, search: i.search, tag_ids: i.tagIds, ai_sdr_id: i.aiSdrId, status: i.status })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        startingAfter: z.string().max(4_000).optional(),
        search: z.string().max(4_000).optional(),
        tagIds: z.string().max(4_000).optional(),
        aiSdrId: z.string().max(4_000).optional(),
        status: z.number().optional(),
      })
      .strict(),
  },
  {
    action: "create-campaign",
    name: "Create Campaign",
    description:
      "Creates an Instantly V2 campaign using the documented campaign schedule schema.",
    method: "POST",
    url: "/api/v2/campaigns",
    input: z
      .object({
        name: z.string().max(4_000),
        plValue: z.string().max(4_000).optional(),
        isEvergreen: z.string().max(4_000).optional(),
        campaignSchedule: SpecObject,
        sequences: SpecArray.optional(),
        emailGap: z.string().max(4_000).optional(),
        randomWaitMax: z.string().max(4_000).optional(),
        textOnly: z.string().max(4_000).optional(),
        firstEmailTextOnly: z.string().max(4_000).optional(),
        emailList: SpecArray.optional(),
        dailyLimit: z.string().max(4_000).optional(),
        stopOnReply: z.string().max(4_000).optional(),
        emailTagList: SpecArray.optional(),
        linkTracking: z.string().max(4_000).optional(),
        openTracking: z.string().max(4_000).optional(),
        stopOnAutoReply: z.string().max(4_000).optional(),
        dailyMaxLeads: z.string().max(4_000).optional(),
        prioritizeNewLeads: z.string().max(4_000).optional(),
        autoVariantSelect: z.string().max(4_000).optional(),
        matchLeadEsp: z.string().max(4_000).optional(),
        stopForCompany: z.string().max(4_000).optional(),
        insertUnsubscribeHeader: z.string().max(4_000).optional(),
        allowRiskyContacts: z.string().max(4_000).optional(),
        disableBounceProtect: z.string().max(4_000).optional(),
        limitEmailsPerCompanyOverride: z.string().max(4_000).optional(),
        ccList: SpecArray.optional(),
        bccList: SpecArray.optional(),
        ownedBy: z.string().max(4_000).optional(),
        aiSdrId: z.string().max(4_000).optional(),
        providerRoutingRules: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
      ...(i.plValue !== undefined ? { pl_value: i.plValue } : {}),
      ...(i.isEvergreen !== undefined ? { is_evergreen: i.isEvergreen } : {}),
      campaign_schedule: i.campaignSchedule,
      ...(i.sequences !== undefined ? { sequences: i.sequences } : {}),
      ...(i.emailGap !== undefined ? { email_gap: i.emailGap } : {}),
      ...(i.randomWaitMax !== undefined
        ? { random_wait_max: i.randomWaitMax }
        : {}),
      ...(i.textOnly !== undefined ? { text_only: i.textOnly } : {}),
      ...(i.firstEmailTextOnly !== undefined
        ? { first_email_text_only: i.firstEmailTextOnly }
        : {}),
      ...(i.emailList !== undefined ? { email_list: i.emailList } : {}),
      ...(i.dailyLimit !== undefined ? { daily_limit: i.dailyLimit } : {}),
      ...(i.stopOnReply !== undefined ? { stop_on_reply: i.stopOnReply } : {}),
      ...(i.emailTagList !== undefined
        ? { email_tag_list: i.emailTagList }
        : {}),
      ...(i.linkTracking !== undefined
        ? { link_tracking: i.linkTracking }
        : {}),
      ...(i.openTracking !== undefined
        ? { open_tracking: i.openTracking }
        : {}),
      ...(i.stopOnAutoReply !== undefined
        ? { stop_on_auto_reply: i.stopOnAutoReply }
        : {}),
      ...(i.dailyMaxLeads !== undefined
        ? { daily_max_leads: i.dailyMaxLeads }
        : {}),
      ...(i.prioritizeNewLeads !== undefined
        ? { prioritize_new_leads: i.prioritizeNewLeads }
        : {}),
      ...(i.autoVariantSelect !== undefined
        ? { auto_variant_select: i.autoVariantSelect }
        : {}),
      ...(i.matchLeadEsp !== undefined
        ? { match_lead_esp: i.matchLeadEsp }
        : {}),
      ...(i.stopForCompany !== undefined
        ? { stop_for_company: i.stopForCompany }
        : {}),
      ...(i.insertUnsubscribeHeader !== undefined
        ? { insert_unsubscribe_header: i.insertUnsubscribeHeader }
        : {}),
      ...(i.allowRiskyContacts !== undefined
        ? { allow_risky_contacts: i.allowRiskyContacts }
        : {}),
      ...(i.disableBounceProtect !== undefined
        ? { disable_bounce_protect: i.disableBounceProtect }
        : {}),
      ...(i.limitEmailsPerCompanyOverride !== undefined
        ? { limit_emails_per_company_override: i.limitEmailsPerCompanyOverride }
        : {}),
      ...(i.ccList !== undefined ? { cc_list: i.ccList } : {}),
      ...(i.bccList !== undefined ? { bcc_list: i.bccList } : {}),
      ...(i.ownedBy !== undefined ? { owned_by: i.ownedBy } : {}),
      ...(i.aiSdrId !== undefined ? { ai_sdr_id: i.aiSdrId } : {}),
      ...(i.providerRoutingRules !== undefined
        ? { provider_routing_rules: i.providerRoutingRules }
        : {}),
    }),
  },
  {
    action: "patch-campaign",
    name: "Patch Campaign",
    description: "Updates documented Instantly V2 campaign fields.",
    method: "PATCH",
    url: (i) => `/api/v2/campaigns/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
        name: z.string().max(4_000).optional(),
        plValue: z.string().max(4_000).optional(),
        isEvergreen: z.string().max(4_000).optional(),
        campaignSchedule: SpecObject.optional(),
        sequences: SpecArray.optional(),
        emailGap: z.string().max(4_000).optional(),
        randomWaitMax: z.string().max(4_000).optional(),
        textOnly: z.string().max(4_000).optional(),
        firstEmailTextOnly: z.string().max(4_000).optional(),
        emailList: SpecArray.optional(),
        dailyLimit: z.string().max(4_000).optional(),
        stopOnReply: z.string().max(4_000).optional(),
        emailTagList: SpecArray.optional(),
        linkTracking: z.string().max(4_000).optional(),
        openTracking: z.string().max(4_000).optional(),
        stopOnAutoReply: z.string().max(4_000).optional(),
        dailyMaxLeads: z.string().max(4_000).optional(),
        prioritizeNewLeads: z.string().max(4_000).optional(),
        autoVariantSelect: z.string().max(4_000).optional(),
        matchLeadEsp: z.string().max(4_000).optional(),
        stopForCompany: z.string().max(4_000).optional(),
        insertUnsubscribeHeader: z.string().max(4_000).optional(),
        allowRiskyContacts: z.string().max(4_000).optional(),
        disableBounceProtect: z.string().max(4_000).optional(),
        limitEmailsPerCompanyOverride: z.string().max(4_000).optional(),
        ccList: SpecArray.optional(),
        bccList: SpecArray.optional(),
        ownedBy: z.string().max(4_000).optional(),
        providerRoutingRules: SpecArray.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.plValue !== undefined ? { pl_value: i.plValue } : {}),
      ...(i.isEvergreen !== undefined ? { is_evergreen: i.isEvergreen } : {}),
      ...(i.campaignSchedule !== undefined
        ? { campaign_schedule: i.campaignSchedule }
        : {}),
      ...(i.sequences !== undefined ? { sequences: i.sequences } : {}),
      ...(i.emailGap !== undefined ? { email_gap: i.emailGap } : {}),
      ...(i.randomWaitMax !== undefined
        ? { random_wait_max: i.randomWaitMax }
        : {}),
      ...(i.textOnly !== undefined ? { text_only: i.textOnly } : {}),
      ...(i.firstEmailTextOnly !== undefined
        ? { first_email_text_only: i.firstEmailTextOnly }
        : {}),
      ...(i.emailList !== undefined ? { email_list: i.emailList } : {}),
      ...(i.dailyLimit !== undefined ? { daily_limit: i.dailyLimit } : {}),
      ...(i.stopOnReply !== undefined ? { stop_on_reply: i.stopOnReply } : {}),
      ...(i.emailTagList !== undefined
        ? { email_tag_list: i.emailTagList }
        : {}),
      ...(i.linkTracking !== undefined
        ? { link_tracking: i.linkTracking }
        : {}),
      ...(i.openTracking !== undefined
        ? { open_tracking: i.openTracking }
        : {}),
      ...(i.stopOnAutoReply !== undefined
        ? { stop_on_auto_reply: i.stopOnAutoReply }
        : {}),
      ...(i.dailyMaxLeads !== undefined
        ? { daily_max_leads: i.dailyMaxLeads }
        : {}),
      ...(i.prioritizeNewLeads !== undefined
        ? { prioritize_new_leads: i.prioritizeNewLeads }
        : {}),
      ...(i.autoVariantSelect !== undefined
        ? { auto_variant_select: i.autoVariantSelect }
        : {}),
      ...(i.matchLeadEsp !== undefined
        ? { match_lead_esp: i.matchLeadEsp }
        : {}),
      ...(i.stopForCompany !== undefined
        ? { stop_for_company: i.stopForCompany }
        : {}),
      ...(i.insertUnsubscribeHeader !== undefined
        ? { insert_unsubscribe_header: i.insertUnsubscribeHeader }
        : {}),
      ...(i.allowRiskyContacts !== undefined
        ? { allow_risky_contacts: i.allowRiskyContacts }
        : {}),
      ...(i.disableBounceProtect !== undefined
        ? { disable_bounce_protect: i.disableBounceProtect }
        : {}),
      ...(i.limitEmailsPerCompanyOverride !== undefined
        ? { limit_emails_per_company_override: i.limitEmailsPerCompanyOverride }
        : {}),
      ...(i.ccList !== undefined ? { cc_list: i.ccList } : {}),
      ...(i.bccList !== undefined ? { bcc_list: i.bccList } : {}),
      ...(i.ownedBy !== undefined ? { owned_by: i.ownedBy } : {}),
      ...(i.providerRoutingRules !== undefined
        ? { provider_routing_rules: i.providerRoutingRules }
        : {}),
    }),
  },
  {
    action: "activate-campaign",
    name: "Activate Campaign",
    description: "Activates, starts, or resumes an Instantly V2 campaign.",
    method: "POST",
    url: (i) => `/api/v2/campaigns/${restSegment(i.id)}/activate`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "pause-campaign",
    name: "Pause Campaign",
    description:
      "Pauses a running Instantly V2 campaign, stopping further email sends.",
    method: "POST",
    url: (i) => `/api/v2/campaigns/${restSegment(i.id)}/pause`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "delete-campaign",
    name: "Delete Campaign",
    description: "Permanently deletes an Instantly V2 campaign.",
    method: "DELETE",
    url: (i) => `/api/v2/campaigns/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-emails",
    name: "List Emails",
    description:
      "Retrieves Instantly V2 Unibox emails with search and pagination filters.",
    method: "GET",
    url: (i) =>
      `/api/v2/emails${restQuery({ limit: i.limit, starting_after: i.startingAfter, search: i.search, campaign_id: i.campaignId, list_id: i.listId, i_status: i.iStatus, eaccount: i.eaccount, is_unread: i.isUnread, has_reminder: i.hasReminder, mode: i.mode, preview_only: i.previewOnly, sort_order: i.sortOrder, scheduled_only: i.scheduledOnly, assigned_to: i.assignedTo, lead: i.lead, company_domain: i.companyDomain, marked_as_done: i.markedAsDone, email_type: i.emailType, min_timestamp_created: i.minTimestampCreated, max_timestamp_created: i.maxTimestampCreated })}`,
    input: z
      .object({
        limit: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000)
          .optional(),
        startingAfter: z.string().max(4_000).optional(),
        search: z.string().max(4_000).optional(),
        campaignId: z.string().max(4_000).optional(),
        listId: z.string().max(4_000).optional(),
        iStatus: z.number().optional(),
        eaccount: z.string().max(4_000).optional(),
        isUnread: z.boolean().optional(),
        hasReminder: z.boolean().optional(),
        mode: z.enum(["emode_focused", "emode_others", "emode_all"]).optional(),
        previewOnly: z.boolean().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        scheduledOnly: z.boolean().optional(),
        assignedTo: z.string().max(4_000).optional(),
        lead: z.string().max(4_000).optional(),
        companyDomain: z.string().max(4_000).optional(),
        markedAsDone: z.boolean().optional(),
        emailType: z.enum(["received", "sent", "manual"]).optional(),
        minTimestampCreated: z.string().max(4_000).optional(),
        maxTimestampCreated: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "reply-to-email",
    name: "Reply To Email",
    description: "Sends an Instantly V2 reply to an existing Unibox email.",
    method: "POST",
    url: "/api/v2/emails/reply",
    input: z
      .object({
        eaccount: z.string().max(4_000),
        replyToUuid: z.string().max(4_000),
        subject: z.string().max(4_000),
        body: SpecObject,
        ccAddressEmailList: z.string().max(4_000).optional(),
        bccAddressEmailList: z.string().max(4_000).optional(),
        reminderTs: z.string().max(4_000).optional(),
        assignedTo: z.string().max(4_000).optional(),
      })
      .strict(),
    body: (i) => ({
      eaccount: i.eaccount,
      reply_to_uuid: i.replyToUuid,
      subject: i.subject,
      body: i.body,
      ...(i.ccAddressEmailList !== undefined
        ? { cc_address_email_list: i.ccAddressEmailList }
        : {}),
      ...(i.bccAddressEmailList !== undefined
        ? { bcc_address_email_list: i.bccAddressEmailList }
        : {}),
      ...(i.reminderTs !== undefined ? { reminder_ts: i.reminderTs } : {}),
      ...(i.assignedTo !== undefined ? { assigned_to: i.assignedTo } : {}),
    }),
  },
  {
    action: "list-lead-lists",
    name: "List Lead Lists",
    description:
      "Retrieves Instantly V2 lead lists with search and pagination filters.",
    method: "GET",
    url: (i) => `/api/v2/lead-lists/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.string().max(4_000),
      })
      .strict(),
  },
  {
    action: "create-lead-list",
    name: "Create Lead List",
    description: "Creates an Instantly V2 lead list.",
    method: "POST",
    url: "/api/v2/lead-lists",
    input: z
      .object({
        hasEnrichmentTask: z.string().max(4_000).optional(),
        ownedBy: z.string().max(4_000).optional(),
        name: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      ...(i.hasEnrichmentTask !== undefined
        ? { has_enrichment_task: i.hasEnrichmentTask }
        : {}),
      ...(i.ownedBy !== undefined ? { owned_by: i.ownedBy } : {}),
      name: i.name,
    }),
  },
];

export function createInstantlyPack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "instantly",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    actions: ACTIONS,
  });
}
