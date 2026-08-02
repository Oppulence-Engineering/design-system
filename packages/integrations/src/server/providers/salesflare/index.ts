import { z } from "zod";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  createRestPack,
  restQuery,
  restSegment,
  type RestAction,
} from "../shared/rest";

/**
 * Generated from salesflare's published OpenAPI document:
 * https://api.salesflare.com/openapi.json
 *
 * This provider is outside the pinned source, so its action table is its own
 * coverage. The table is the shallowest CRUD operations the document declares,
 * capped at 22 — a vendor's top-level resources, not everything it serves.
 */
const SPEC_NOTE =
  "salesflare publishes no maintained Node SDK; its OpenAPI document at https://api.salesflare.com/openapi.json is the supported description of the HTTP API.";

/** Vendor grammars whose shape is the provider's business, not this lane's. */
const SpecObject = z.record(z.string(), z.unknown());
const SpecArray = z.array(z.unknown()).max(500);

const ACTIONS: readonly RestAction<any>[] = [
  {
    action: "list-accounts",
    name: "List Accounts",
    description: "List accounts",
    method: "GET",
    url: (i) =>
      `/accounts${restQuery({ id: i.id, details: i.details, search: i.search, name: i.name, creation_after: i.creationAfter, creation_before: i.creationBefore, min_size: i.minSize, max_size: i.maxSize, domain: i.domain, tag: i.tag, "tag.name": i.tagName, "address.country": i.addressCountry, "address.city": i.addressCity, "address.state_region": i.addressStateRegion, hotness: i.hotness, offset: i.offset, custom: i.custom, order_by: i.orderBy, q: i.q, limit: i.limit, export: i.export })}`,
    input: z
      .object({
        id: SpecArray.optional(),
        details: z.boolean().optional(),
        search: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        creationAfter: z.string().max(4_000).optional(),
        creationBefore: z.string().max(4_000).optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        domain: SpecArray.optional(),
        tag: SpecArray.optional(),
        tagName: SpecArray.optional(),
        addressCountry: SpecArray.optional(),
        addressCity: SpecArray.optional(),
        addressStateRegion: SpecArray.optional(),
        hotness: z.number().optional(),
        offset: z.number().optional(),
        custom: z.string().max(4_000).optional(),
        orderBy: SpecArray.optional(),
        q: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        export: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-account",
    name: "Create Account",
    description: "Create an account",
    method: "POST",
    url: (i) => `/accounts${restQuery({ update_if_exists: i.updateIfExists })}`,
    input: z
      .object({
        updateIfExists: z.boolean().optional(),
        owner: z.number().optional(),
        name: z.string().max(4_000).optional(),
        domain: z.string().max(4_000).optional(),
        picture: z.string().max(4_000).optional(),
        size: z.number().optional(),
        website: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        address: SpecObject.optional(),
        addresses: SpecArray.optional(),
        email: z.string().max(4_000).optional(),
        emailAddresses: SpecArray.optional(),
        phoneNumber: z.string().max(4_000).optional(),
        phoneNumbers: SpecArray.optional(),
        socialProfiles: SpecArray.optional(),
        tags: SpecArray.optional(),
        links: z.string().max(4_000).optional(),
        customers: SpecArray.optional(),
        dirty: z.boolean().optional(),
        parentAccount: z.number().optional(),
        custom: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.owner !== undefined ? { owner: i.owner } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.domain !== undefined ? { domain: i.domain } : {}),
      ...(i.picture !== undefined ? { picture: i.picture } : {}),
      ...(i.size !== undefined ? { size: i.size } : {}),
      ...(i.website !== undefined ? { website: i.website } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.address !== undefined ? { address: i.address } : {}),
      ...(i.addresses !== undefined ? { addresses: i.addresses } : {}),
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.emailAddresses !== undefined
        ? { email_addresses: i.emailAddresses }
        : {}),
      ...(i.phoneNumber !== undefined ? { phone_number: i.phoneNumber } : {}),
      ...(i.phoneNumbers !== undefined
        ? { phone_numbers: i.phoneNumbers }
        : {}),
      ...(i.socialProfiles !== undefined
        ? { social_profiles: i.socialProfiles }
        : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.links !== undefined ? { links: i.links } : {}),
      ...(i.customers !== undefined ? { customers: i.customers } : {}),
      ...(i.dirty !== undefined ? { _dirty: i.dirty } : {}),
      ...(i.parentAccount !== undefined
        ? { parent_account: i.parentAccount }
        : {}),
      ...(i.custom !== undefined ? { custom: i.custom } : {}),
    }),
  },
  {
    action: "get-account",
    name: "Get Account",
    description: "Get account details",
    method: "GET",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.number(),
      })
      .strict(),
  },
  {
    action: "update-account",
    name: "Update Account",
    description: "Update an account",
    method: "PUT",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.number(),
        name: z.string().max(4_000).optional(),
        domain: z.string().max(4_000).optional(),
        picture: z.string().max(4_000).optional(),
        size: z.number().optional(),
        website: z.string().max(4_000).optional(),
        description: z.string().max(4_000).optional(),
        address: SpecObject.optional(),
        addresses: SpecArray.optional(),
        email: z.string().max(4_000).optional(),
        emailAddresses: SpecArray.optional(),
        phoneNumber: z.string().max(4_000).optional(),
        phoneNumbers: SpecArray.optional(),
        socialProfiles: SpecArray.optional(),
        tags: SpecArray.optional(),
        links: z.string().max(4_000).optional(),
        dirty: z.boolean().optional(),
        parentAccount: z.number().optional(),
        custom: SpecObject.optional(),
        q: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.domain !== undefined ? { domain: i.domain } : {}),
      ...(i.picture !== undefined ? { picture: i.picture } : {}),
      ...(i.size !== undefined ? { size: i.size } : {}),
      ...(i.website !== undefined ? { website: i.website } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.address !== undefined ? { address: i.address } : {}),
      ...(i.addresses !== undefined ? { addresses: i.addresses } : {}),
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.emailAddresses !== undefined
        ? { email_addresses: i.emailAddresses }
        : {}),
      ...(i.phoneNumber !== undefined ? { phone_number: i.phoneNumber } : {}),
      ...(i.phoneNumbers !== undefined
        ? { phone_numbers: i.phoneNumbers }
        : {}),
      ...(i.socialProfiles !== undefined
        ? { social_profiles: i.socialProfiles }
        : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.links !== undefined ? { links: i.links } : {}),
      ...(i.dirty !== undefined ? { _dirty: i.dirty } : {}),
      ...(i.parentAccount !== undefined
        ? { parent_account: i.parentAccount }
        : {}),
      ...(i.custom !== undefined ? { custom: i.custom } : {}),
      ...(i.q !== undefined ? { q: i.q } : {}),
    }),
  },
  {
    action: "delete-account",
    name: "Delete Account",
    description: "Delete an account",
    method: "DELETE",
    url: (i) => `/accounts/${restSegment(i.accountId)}`,
    input: z
      .object({
        accountId: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-contacts",
    name: "List Contacts",
    description: "List contacts",
    method: "GET",
    url: (i) =>
      `/contacts${restQuery({ id: i.id, name: i.name, email: i.email, phone_number: i.phoneNumber, domain: i.domain, modification_after: i.modificationAfter, modification_before: i.modificationBefore, creation_after: i.creationAfter, creation_before: i.creationBefore, account: i.account, tag: i.tag, "tag.name": i.tagName, "position.role": i.positionRole, "address.country": i.addressCountry, "address.state_region": i.addressStateRegion, "address.city": i.addressCity, includeArchived: i.includeArchived, search: i.search, type: i.type, limit: i.limit, offset: i.offset, custom: i.custom, order_by: i.orderBy, export: i.export, q: i.q })}`,
    input: z
      .object({
        id: SpecArray.optional(),
        name: z.string().max(4_000).optional(),
        email: z.string().max(4_000).optional(),
        phoneNumber: z.string().max(4_000).optional(),
        domain: z.string().max(4_000).optional(),
        modificationAfter: z.string().max(4_000).optional(),
        modificationBefore: z.string().max(4_000).optional(),
        creationAfter: z.string().max(4_000).optional(),
        creationBefore: z.string().max(4_000).optional(),
        account: SpecArray.optional(),
        tag: SpecArray.optional(),
        tagName: SpecArray.optional(),
        positionRole: SpecArray.optional(),
        addressCountry: SpecArray.optional(),
        addressStateRegion: SpecArray.optional(),
        addressCity: SpecArray.optional(),
        includeArchived: z.boolean().optional(),
        search: z.string().max(4_000).optional(),
        type: z.enum(["customer", "mycontacts"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        custom: z.string().max(4_000).optional(),
        orderBy: SpecArray.optional(),
        export: z.string().max(4_000).optional(),
        q: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-contact",
    name: "Create Contact",
    description: "Create a contact",
    method: "POST",
    url: (i) => `/contacts${restQuery({ force: i.force })}`,
    input: z
      .object({
        force: z.boolean().optional(),
      })
      .strict(),
  },
  {
    action: "get-contact",
    name: "Get Contact",
    description: "Get contact details",
    method: "GET",
    url: (i) => `/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.number(),
      })
      .strict(),
  },
  {
    action: "update-contact",
    name: "Update Contact",
    description: "Update a contact",
    method: "PUT",
    url: (i) =>
      `/contacts/${restSegment(i.contactId)}${restQuery({ force: i.force })}`,
    input: z
      .object({
        contactId: z.number(),
        force: z.boolean().optional(),
        prefix: z.string().max(4_000).optional(),
        firstname: z.string().max(4_000).optional(),
        middle: z.string().max(4_000).optional(),
        lastname: z.string().max(4_000).optional(),
        suffix: z.string().max(4_000).optional(),
        email: z.string().max(4_000).optional(),
        role: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        owner: z.number().optional(),
        picture: z.string().max(4_000).optional(),
        account: z.number().optional(),
        birthDate: z.string().max(4_000).optional(),
        optOut: z.boolean().optional(),
        optOutDate: z.string().max(4_000).optional(),
        optOutCampaign: z.string().max(4_000).optional(),
        bounced: z.boolean().optional(),
        bouncedDate: z.string().max(4_000).optional(),
        files: SpecArray.optional(),
        tags: SpecArray.optional(),
        address: SpecObject.optional(),
        addresses: SpecArray.optional(),
        phoneNumber: z.string().max(4_000).optional(),
        mobilePhoneNumber: z.string().max(4_000).optional(),
        homePhoneNumber: z.string().max(4_000).optional(),
        faxNumber: z.string().max(4_000).optional(),
        phoneNumbers: SpecArray.optional(),
        position: SpecObject.optional(),
        positions: SpecArray.optional(),
        socialProfiles: SpecArray.optional(),
        custom: SpecObject.optional(),
        dirty: z.boolean().optional(),
        archived: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.prefix !== undefined ? { prefix: i.prefix } : {}),
      ...(i.firstname !== undefined ? { firstname: i.firstname } : {}),
      ...(i.middle !== undefined ? { middle: i.middle } : {}),
      ...(i.lastname !== undefined ? { lastname: i.lastname } : {}),
      ...(i.suffix !== undefined ? { suffix: i.suffix } : {}),
      ...(i.email !== undefined ? { email: i.email } : {}),
      ...(i.role !== undefined ? { role: i.role } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.owner !== undefined ? { owner: i.owner } : {}),
      ...(i.picture !== undefined ? { picture: i.picture } : {}),
      ...(i.account !== undefined ? { account: i.account } : {}),
      ...(i.birthDate !== undefined ? { birth_date: i.birthDate } : {}),
      ...(i.optOut !== undefined ? { "opt-out": i.optOut } : {}),
      ...(i.optOutDate !== undefined ? { "opt-out_date": i.optOutDate } : {}),
      ...(i.optOutCampaign !== undefined
        ? { "opt-out_campaign": i.optOutCampaign }
        : {}),
      ...(i.bounced !== undefined ? { bounced: i.bounced } : {}),
      ...(i.bouncedDate !== undefined ? { bounced_date: i.bouncedDate } : {}),
      ...(i.files !== undefined ? { files: i.files } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.address !== undefined ? { address: i.address } : {}),
      ...(i.addresses !== undefined ? { addresses: i.addresses } : {}),
      ...(i.phoneNumber !== undefined ? { phone_number: i.phoneNumber } : {}),
      ...(i.mobilePhoneNumber !== undefined
        ? { mobile_phone_number: i.mobilePhoneNumber }
        : {}),
      ...(i.homePhoneNumber !== undefined
        ? { home_phone_number: i.homePhoneNumber }
        : {}),
      ...(i.faxNumber !== undefined ? { fax_number: i.faxNumber } : {}),
      ...(i.phoneNumbers !== undefined
        ? { phone_numbers: i.phoneNumbers }
        : {}),
      ...(i.position !== undefined ? { position: i.position } : {}),
      ...(i.positions !== undefined ? { positions: i.positions } : {}),
      ...(i.socialProfiles !== undefined
        ? { social_profiles: i.socialProfiles }
        : {}),
      ...(i.custom !== undefined ? { custom: i.custom } : {}),
      ...(i.dirty !== undefined ? { _dirty: i.dirty } : {}),
      ...(i.archived !== undefined ? { archived: i.archived } : {}),
    }),
  },
  {
    action: "delete-contact",
    name: "Delete Contact",
    description: "Delete a contact",
    method: "DELETE",
    url: (i) => `/contacts/${restSegment(i.contactId)}`,
    input: z
      .object({
        contactId: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-opportunities",
    name: "List Opportunities",
    description: "List opportunities",
    method: "GET",
    url: (i) =>
      `/opportunities${restQuery({ search: i.search, id: i.id, name: i.name, status: i.status, stage: i.stage, "stage.name": i.stageName, owner: i.owner, team_member: i.teamMember, owner_group: i.ownerGroup, assignee_group: i.assigneeGroup, team_member_group: i.teamMemberGroup, account: i.account, assignee: i.assignee, min_value: i.minValue, max_value: i.maxValue, close_after: i.closeAfter, close_before: i.closeBefore, creation_after: i.creationAfter, creation_before: i.creationBefore, closed: i.closed, done: i.done, tag: i.tag, "tag.name": i.tagName, hotness: i.hotness, limit: i.limit, offset: i.offset, order_by: i.orderBy, pipeline: i.pipeline, custom: i.custom, details: i.details, export: i.export, q: i.q })}`,
    input: z
      .object({
        search: z.string().max(4_000).optional(),
        id: z.number().optional(),
        name: z.string().max(4_000).optional(),
        status: z.string().max(4_000).optional(),
        stage: z.number().optional(),
        stageName: z.string().max(4_000).optional(),
        owner: z.number().optional(),
        teamMember: z.number().optional(),
        ownerGroup: z.number().optional(),
        assigneeGroup: z.number().optional(),
        teamMemberGroup: z.number().optional(),
        account: z.number().optional(),
        assignee: z.number().optional(),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        closeAfter: z.string().max(4_000).optional(),
        closeBefore: z.string().max(4_000).optional(),
        creationAfter: z.string().max(4_000).optional(),
        creationBefore: z.string().max(4_000).optional(),
        closed: z.boolean().optional(),
        done: z.boolean().optional(),
        tag: SpecArray.optional(),
        tagName: z.string().max(4_000).optional(),
        hotness: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        orderBy: SpecArray.optional(),
        pipeline: z.number().optional(),
        custom: z.string().max(4_000).optional(),
        details: z.boolean().optional(),
        export: z.string().max(4_000).optional(),
        q: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-opportunity",
    name: "Create Opportunity",
    description: "Create an opportunity",
    method: "POST",
    url: "/opportunities",
    input: z
      .object({
        owner: z.number().optional(),
        account: z.number(),
        stage: z.number().optional(),
        lostReason: z.number().optional(),
        files: SpecArray.optional(),
        leadSource: z.number().optional(),
        startDate: z.string().max(4_000).optional(),
        probability: z.number().optional(),
        assignee: z.number().optional(),
        creator: z.number().optional(),
        status: z.string().max(4_000).optional(),
        name: z.string().max(4_000).optional(),
        value: z.number().optional(),
        currency: z.number().optional(),
        statusDate: z.string().max(4_000).optional(),
        closeDate: z.string().max(4_000).optional(),
        closed: z.boolean().optional(),
        tags: SpecArray.optional(),
        recurringPricePerUnit: z.number().optional(),
        frequency: z
          .enum(["annually", "weekly", "monthly", "daily"])
          .optional(),
        units: z.number().optional(),
        contractStartDate: z.string().max(4_000).optional(),
        contractEndDate: z.string().max(4_000).optional(),
        mainContact: z.number().optional(),
        custom: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.owner !== undefined ? { owner: i.owner } : {}),
      account: i.account,
      ...(i.stage !== undefined ? { stage: i.stage } : {}),
      ...(i.lostReason !== undefined ? { lost_reason: i.lostReason } : {}),
      ...(i.files !== undefined ? { files: i.files } : {}),
      ...(i.leadSource !== undefined ? { lead_source: i.leadSource } : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
      ...(i.probability !== undefined ? { probability: i.probability } : {}),
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.creator !== undefined ? { creator: i.creator } : {}),
      ...(i.status !== undefined ? { status: i.status } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.currency !== undefined ? { currency: i.currency } : {}),
      ...(i.statusDate !== undefined ? { status_date: i.statusDate } : {}),
      ...(i.closeDate !== undefined ? { close_date: i.closeDate } : {}),
      ...(i.closed !== undefined ? { closed: i.closed } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.recurringPricePerUnit !== undefined
        ? { recurring_price_per_unit: i.recurringPricePerUnit }
        : {}),
      ...(i.frequency !== undefined ? { frequency: i.frequency } : {}),
      ...(i.units !== undefined ? { units: i.units } : {}),
      ...(i.contractStartDate !== undefined
        ? { contract_start_date: i.contractStartDate }
        : {}),
      ...(i.contractEndDate !== undefined
        ? { contract_end_date: i.contractEndDate }
        : {}),
      ...(i.mainContact !== undefined ? { main_contact: i.mainContact } : {}),
      ...(i.custom !== undefined ? { custom: i.custom } : {}),
    }),
  },
  {
    action: "get-opportunity",
    name: "Get Opportunity",
    description: "Get opportunity details",
    method: "GET",
    url: (i) => `/opportunities/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
  },
  {
    action: "update-opportunity",
    name: "Update Opportunity",
    description: "Update an opportunity",
    method: "PUT",
    url: (i) => `/opportunities/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
        owner: z.number().optional(),
        account: z.number().optional(),
        stage: z.number().optional(),
        lostReason: z.number().optional(),
        files: SpecArray.optional(),
        leadSource: z.number().optional(),
        startDate: z.string().max(4_000).optional(),
        probability: z.number().optional(),
        assignee: z.number().optional(),
        creator: z.number().optional(),
        name: z.string().max(4_000).optional(),
        value: z.number().optional(),
        closeDate: z.string().max(4_000).optional(),
        closed: z.boolean().optional(),
        done: z.boolean().optional(),
        tags: SpecArray.optional(),
        recurringPricePerUnit: z.number().optional(),
        frequency: z
          .enum(["annually", "weekly", "monthly", "daily"])
          .optional(),
        units: z.number().optional(),
        contractStartDate: z.string().max(4_000).optional(),
        contractEndDate: z.string().max(4_000).optional(),
        mainContact: z.number().optional(),
        custom: SpecObject.optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.owner !== undefined ? { owner: i.owner } : {}),
      ...(i.account !== undefined ? { account: i.account } : {}),
      ...(i.stage !== undefined ? { stage: i.stage } : {}),
      ...(i.lostReason !== undefined ? { lost_reason: i.lostReason } : {}),
      ...(i.files !== undefined ? { files: i.files } : {}),
      ...(i.leadSource !== undefined ? { lead_source: i.leadSource } : {}),
      ...(i.startDate !== undefined ? { start_date: i.startDate } : {}),
      ...(i.probability !== undefined ? { probability: i.probability } : {}),
      ...(i.assignee !== undefined ? { assignee: i.assignee } : {}),
      ...(i.creator !== undefined ? { creator: i.creator } : {}),
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.value !== undefined ? { value: i.value } : {}),
      ...(i.closeDate !== undefined ? { close_date: i.closeDate } : {}),
      ...(i.closed !== undefined ? { closed: i.closed } : {}),
      ...(i.done !== undefined ? { done: i.done } : {}),
      ...(i.tags !== undefined ? { tags: i.tags } : {}),
      ...(i.recurringPricePerUnit !== undefined
        ? { recurring_price_per_unit: i.recurringPricePerUnit }
        : {}),
      ...(i.frequency !== undefined ? { frequency: i.frequency } : {}),
      ...(i.units !== undefined ? { units: i.units } : {}),
      ...(i.contractStartDate !== undefined
        ? { contract_start_date: i.contractStartDate }
        : {}),
      ...(i.contractEndDate !== undefined
        ? { contract_end_date: i.contractEndDate }
        : {}),
      ...(i.mainContact !== undefined ? { main_contact: i.mainContact } : {}),
      ...(i.custom !== undefined ? { custom: i.custom } : {}),
    }),
  },
  {
    action: "delete-opportunity",
    name: "Delete Opportunity",
    description: "Delete an opportunity",
    method: "DELETE",
    url: (i) => `/opportunities/${restSegment(i.id)}`,
    input: z
      .object({
        id: z.number(),
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-tasks",
    name: "List Tasks",
    description: "List tasks",
    method: "GET",
    url: (i) =>
      `/tasks${restQuery({ id: i.id, search: i.search, assignees: i.assignees, type: i.type, account: i.account, order_by: i.orderBy, limit: i.limit, offset: i.offset, export: i.export, q: i.q })}`,
    input: z
      .object({
        id: SpecArray.optional(),
        search: z.string().max(4_000).optional(),
        assignees: SpecArray.optional(),
        type: SpecArray.optional(),
        account: SpecArray.optional(),
        orderBy: SpecArray.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        export: z.string().max(4_000).optional(),
        q: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-task",
    name: "Create Task",
    description: "Create a task",
    method: "POST",
    url: "/tasks",
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
  },
  {
    action: "update-task",
    name: "Update Task",
    description: "Update a task",
    method: "PUT",
    url: (i) => `/tasks/${restSegment(i.id)}`,
    input: z
      .object({
        account: z.number().optional(),
        description: z.string().max(4_000).optional(),
        reminderDate: z.string().max(4_000).optional(),
        assignees: SpecArray.optional(),
        completed: z.boolean().optional(),
      })
      .strict(),
    body: (i) => ({
      ...(i.account !== undefined ? { account: i.account } : {}),
      ...(i.description !== undefined ? { description: i.description } : {}),
      ...(i.reminderDate !== undefined
        ? { reminder_date: i.reminderDate }
        : {}),
      ...(i.assignees !== undefined ? { assignees: i.assignees } : {}),
      ...(i.completed !== undefined ? { completed: i.completed } : {}),
    }),
  },
  {
    action: "delete-task",
    name: "Delete Task",
    description: "Delete a task",
    method: "DELETE",
    url: (i) => `/tasks/${restSegment(i.id)}`,
    input: z
      .object({
        /* no declared parameters */
      })
      .strict(),
    emptyResponse: "optional",
  },
  {
    action: "list-tags",
    name: "List Tags",
    description: "List tags",
    method: "GET",
    url: (i) =>
      `/tags${restQuery({ id: i.id, name: i.name, limit: i.limit, offset: i.offset, order_by: i.orderBy, q: i.q })}`,
    input: z
      .object({
        id: SpecArray.optional(),
        name: z.string().max(4_000).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        orderBy: SpecArray.optional(),
        q: z.string().max(4_000).optional(),
      })
      .strict(),
  },
  {
    action: "create-tag",
    name: "Create Tag",
    description: "Create a tag",
    method: "POST",
    url: "/tags",
    input: z
      .object({
        name: z.string().max(4_000),
      })
      .strict(),
    body: (i) => ({
      name: i.name,
    }),
  },
  {
    action: "get-tag",
    name: "Get Tag",
    description: "Get tag details",
    method: "GET",
    url: (i) => `/tags/${restSegment(i.tagId)}`,
    input: z
      .object({
        tagId: z.number(),
      })
      .strict(),
  },
];

export function createSalesflarePack(): IntegrationProviderPack {
  return createRestPack({
    integrationId: "salesflare",
    sdkReview: SPEC_NOTE,
    transportKind: "api_key",
    beyondBaseline: true,
    actions: ACTIONS,
  });
}
