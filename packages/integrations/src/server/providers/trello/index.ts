import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { importOptionalSdk, lazyAsyncClient } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

/** Trello identifiers are 24-character hex object IDs. */
function trelloId(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[a-f0-9]{24}$/iu.test(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

const TRELLO_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "trello:get-lists": {
    path: ["boards", "getBoardLists"],
    params: (input) => [{ id: trelloId(input, "boardId", "id") }],
  },
  "trello:create-list": {
    path: ["lists", "createList"],
    params: (input) => [
      definedFields({
        idBoard: trelloId(input, "boardId"),
        name: requiredInputString(input, "name"),
        pos: optionalInputString(input, "position", "pos"),
      }),
    ],
  },
  "trello:update-list": {
    path: ["lists", "updateList"],
    params: (input) => [
      definedFields({
        id: trelloId(input, "listId", "id"),
        name: optionalInputString(input, "name"),
        pos: optionalInputString(input, "position", "pos"),
        closed: input.closed === true ? true : undefined,
      }),
    ],
  },
  "trello:list-cards": {
    path: ["lists", "getListCards"],
    params: (input) => [{ id: trelloId(input, "listId", "id") }],
  },
  "trello:search": {
    path: ["search", "search"],
    params: (input) => [
      definedFields({
        query: requiredInputString(input, "query", "search"),
        idBoards: optionalInputStringArray(input, "boardIds")?.join(","),
        modelTypes: optionalInputString(input, "modelTypes"),
        cards_limit: optionalInputNumber(input, "limit"),
      }),
    ],
  },
  "trello:create-card": {
    path: ["cards", "createCard"],
    params: (input) => [
      definedFields({
        idList: trelloId(input, "listId"),
        name: requiredInputString(input, "name"),
        desc: optionalInputString(input, "description", "desc"),
        due: optionalInputString(input, "due", "dueDate"),
        pos: optionalInputString(input, "position", "pos"),
        idMembers: optionalInputStringArray(input, "memberIds"),
        idLabels: optionalInputStringArray(input, "labelIds"),
      }),
    ],
  },
  "trello:get-card": {
    path: ["cards", "getCard"],
    params: (input) => [{ id: trelloId(input, "cardId", "id") }],
  },
  "trello:update-card": {
    path: ["cards", "updateCard"],
    params: (input) => [
      definedFields({
        id: trelloId(input, "cardId", "id"),
        name: optionalInputString(input, "name"),
        desc: optionalInputString(input, "description", "desc"),
        due: optionalInputString(input, "due", "dueDate"),
        idList: optionalInputString(input, "listId"),
        pos: optionalInputString(input, "position", "pos"),
        closed: input.closed === true ? true : undefined,
      }),
    ],
  },
  "trello:delete-card": {
    path: ["cards", "deleteCard"],
    params: (input) => [{ id: trelloId(input, "cardId", "id") }],
    output: (_v, input) => ({
      cardId: trelloId(input, "cardId", "id"),
      deleted: true,
    }),
  },
  "trello:get-actions": {
    path: ["cards", "getCardActions"],
    params: (input) => [
      definedFields({
        id: trelloId(input, "cardId", "id"),
        filter: optionalInputString(input, "filter"),
      }),
    ],
  },
  "trello:add-comment": {
    path: ["cards", "createCardComment"],
    params: (input) => [
      {
        id: trelloId(input, "cardId", "id"),
        text: requiredInputString(input, "text", "comment"),
      },
    ],
  },
  "trello:add-checklist": {
    path: ["cards", "createCardChecklist"],
    params: (input) => [
      {
        id: trelloId(input, "cardId", "id"),
        name: requiredInputString(input, "name"),
      },
    ],
  },
  "trello:add-checklist-item": {
    path: ["checklists", "createChecklistItem"],
    params: (input) => [
      definedFields({
        id: trelloId(input, "checklistId"),
        name: requiredInputString(input, "name"),
        checked: input.checked === true ? true : undefined,
        pos: optionalInputString(input, "position", "pos"),
      }),
    ],
  },
  "trello:update-checklist-item": {
    path: ["cards", "updateCardCheckItem"],
    params: (input) => [
      definedFields({
        id: trelloId(input, "cardId"),
        idCheckItem: trelloId(input, "checkItemId", "itemId"),
        name: optionalInputString(input, "name"),
        state: optionalInputString(input, "state"),
        pos: optionalInputString(input, "position", "pos"),
      }),
    ],
  },
  "trello:add-label": {
    path: ["cards", "addCardLabel"],
    params: (input) => [
      {
        id: trelloId(input, "cardId"),
        value: trelloId(input, "labelId"),
      },
    ],
  },
  "trello:remove-label": {
    path: ["cards", "removeCardLabel"],
    params: (input) => [
      {
        id: trelloId(input, "cardId"),
        idLabel: trelloId(input, "labelId"),
      },
    ],
    output: (_v, input) => ({
      cardId: trelloId(input, "cardId"),
      labelId: trelloId(input, "labelId"),
      attached: false,
    }),
  },
  "trello:add-member": {
    path: ["cards", "addCardMember"],
    params: (input) => [
      {
        id: trelloId(input, "cardId"),
        value: trelloId(input, "memberId"),
      },
    ],
  },
  "trello:remove-member": {
    path: ["cards", "removeCardMember"],
    params: (input) => [
      {
        id: trelloId(input, "cardId"),
        idMember: trelloId(input, "memberId"),
      },
    ],
    output: (_v, input) => ({
      cardId: trelloId(input, "cardId"),
      memberId: trelloId(input, "memberId"),
      assigned: false,
    }),
  },
  "trello:list-members": {
    path: ["cards", "getCardMembers"],
    params: (input) => [{ id: trelloId(input, "cardId", "id") }],
  },
  "trello:create-board": {
    path: ["boards", "createBoard"],
    params: (input) => [
      definedFields({
        name: requiredInputString(input, "name"),
        desc: optionalInputString(input, "description", "desc"),
        idOrganization: optionalInputString(input, "organizationId"),
        defaultLists: input.defaultLists !== false,
      }),
    ],
  },
  "trello:get-board": {
    path: ["boards", "getBoard"],
    params: (input) => [{ id: trelloId(input, "boardId", "id") }],
  },
};

/**
 * Trello authorizes with an API key plus a per-user token, both required on
 * every request. The key is deployment configuration and the token is the
 * per-connection credential, so they travel together in the envelope.
 */
export const createTrelloClient: VendorClientFactory = (credential) =>
  // `trello.js` is ESM-only: its `exports` map declares no `require`
  // condition, so a CommonJS require cannot load it from any directory.
  // Imported dynamically behind a lazy facade, which keeps this factory
  // synchronous and still defers the load until an operation runs.
  lazyAsyncClient(async () => {
    const { createTrelloClient: create } = (await importOptionalSdk(
      "trello.js",
    )) as {
      createTrelloClient(config: {
        key: string;
        token: string;
      }): SdkMethodTarget;
    };
    return create({
      key: requiredVendorField(credential, "apiKey"),
      token: vendorToken(credential),
    });
  });

export function createTrelloPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "trello",
    driver: "trello.js@2.1.6",
    transportKind: "oauth2",
    operations: TRELLO_OPERATIONS,
    clientFactory: options.clientFactory ?? createTrelloClient,
  });
}
