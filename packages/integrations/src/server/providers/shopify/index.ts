import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
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

const shopifyRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/**
 * Shopify removed its REST Admin resources in favour of GraphQL, so each
 * source action is a query document plus variables rather than a method call.
 * Variables are always bound — no value is interpolated into a document.
 */
interface ShopifyGraphqlClient extends SdkMethodTarget {
  request(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<unknown>;
}

/**
 * Shopify addresses everything by global ID (`gid://shopify/Product/123`).
 * A caller may pass either form; a bare numeric ID is promoted.
 */
function globalId(
  input: VendorInput,
  type: string,
  ...names: string[]
): string {
  const value = requiredInputString(input, ...names);
  if (/^\d{1,20}$/u.test(value)) return `gid://shopify/${type}/${value}`;
  if (!new RegExp(`^gid://shopify/${type}/\\d{1,20}$`, "u").test(value)) {
    throw invocationError();
  }
  return value;
}

function pageSize(input: VendorInput): number {
  const value = optionalInputNumber(input, "limit", "first") ?? 50;
  // Shopify caps a GraphQL connection page at 250.
  if (!Number.isSafeInteger(value) || value < 1 || value > 250) {
    throw invocationError();
  }
  return value;
}

/** Every write mutation returns its own userErrors list. */
const USER_ERRORS = "userErrors { field message }";

const PRODUCT_FIELDS =
  "id title handle status vendor productType createdAt updatedAt";
const ORDER_FIELDS =
  "id name email createdAt displayFulfillmentStatus displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } }";
const CUSTOMER_FIELDS =
  "id firstName lastName email phone createdAt numberOfOrders";

function graphql(
  query: string,
  variables: (input: VendorInput) => Record<string, unknown>,
): VendorOperation {
  return {
    path: ["request"],
    invoke: ({ client, input }) =>
      (client as unknown as ShopifyGraphqlClient).request(query, {
        variables: variables(input),
      }),
  };
}

const SHOPIFY_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "shopify:create-product": graphql(
    `mutation CreateProduct($input: ProductInput!) {
      productCreate(input: $input) { product { ${PRODUCT_FIELDS} } ${USER_ERRORS} }
    }`,
    (i) => ({ input: requiredInputRecord(i, "product", "input", "fields") }),
  ),
  "shopify:get-product": graphql(
    `query GetProduct($id: ID!) {
      product(id: $id) {
        ${PRODUCT_FIELDS}
        variants(first: 100) { nodes { id title sku price inventoryQuantity } }
      }
    }`,
    (i) => ({ id: globalId(i, "Product", "productId", "id") }),
  ),
  "shopify:list-products": graphql(
    `query ListProducts($first: Int!, $query: String, $after: String) {
      products(first: $first, query: $query, after: $after) {
        nodes { ${PRODUCT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    (i) =>
      definedFields({
        first: pageSize(i),
        query: optionalInputString(i, "query", "search"),
        after: optionalInputString(i, "cursor", "after"),
      }),
  ),
  "shopify:update-product": graphql(
    `mutation UpdateProduct($input: ProductInput!) {
      productUpdate(input: $input) { product { ${PRODUCT_FIELDS} } ${USER_ERRORS} }
    }`,
    (i) => ({
      input: {
        id: globalId(i, "Product", "productId", "id"),
        ...requiredInputRecord(i, "product", "input", "fields"),
      },
    }),
  ),
  "shopify:delete-product": graphql(
    `mutation DeleteProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) { deletedProductId ${USER_ERRORS} }
    }`,
    (i) => ({ input: { id: globalId(i, "Product", "productId", "id") } }),
  ),
  "shopify:get-order": graphql(
    `query GetOrder($id: ID!) {
      order(id: $id) {
        ${ORDER_FIELDS}
        customer { id email }
        lineItems(first: 100) { nodes { id title quantity sku } }
        fulfillmentOrders(first: 10) { nodes { id status } }
      }
    }`,
    (i) => ({ id: globalId(i, "Order", "orderId", "id") }),
  ),
  "shopify:list-orders": graphql(
    `query ListOrders($first: Int!, $query: String, $after: String) {
      orders(first: $first, query: $query, after: $after) {
        nodes { ${ORDER_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    (i) =>
      definedFields({
        first: pageSize(i),
        query: optionalInputString(i, "query", "search"),
        after: optionalInputString(i, "cursor", "after"),
      }),
  ),
  "shopify:update-order": graphql(
    `mutation UpdateOrder($input: OrderInput!) {
      orderUpdate(input: $input) { order { ${ORDER_FIELDS} note tags } ${USER_ERRORS} }
    }`,
    (i) => ({
      input: definedFields({
        id: globalId(i, "Order", "orderId", "id"),
        note: optionalInputString(i, "note"),
        email: optionalInputString(i, "email"),
        tags: i.tags,
      }),
    }),
  ),
  "shopify:cancel-order": graphql(
    `
      mutation CancelOrder(
        $orderId: ID!
        $reason: OrderCancelReason!
        $refund: Boolean!
        $restock: Boolean!
        $notifyCustomer: Boolean
      ) {
        orderCancel(
          orderId: $orderId
          reason: $reason
          refund: $refund
          restock: $restock
          notifyCustomer: $notifyCustomer
        ) {
          job {
            id
            done
          }
          orderCancelUserErrors {
            field
            message
          }
        }
      }
    `,
    (i) => ({
      orderId: globalId(i, "Order", "orderId", "id"),
      reason: (optionalInputString(i, "reason") ?? "OTHER").toUpperCase(),
      // Both default to true so a cancellation does not silently strand money
      // or inventory.
      refund: i.refund !== false,
      restock: i.restock !== false,
      notifyCustomer: i.notifyCustomer === true,
    }),
  ),
  "shopify:create-customer": graphql(
    `mutation CreateCustomer($input: CustomerInput!) {
      customerCreate(input: $input) { customer { ${CUSTOMER_FIELDS} } ${USER_ERRORS} }
    }`,
    (i) => ({ input: requiredInputRecord(i, "customer", "input", "fields") }),
  ),
  "shopify:get-customer": graphql(
    `query GetCustomer($id: ID!) {
      customer(id: $id) {
        ${CUSTOMER_FIELDS}
        defaultAddress { address1 city province country zip }
      }
    }`,
    (i) => ({ id: globalId(i, "Customer", "customerId", "id") }),
  ),
  "shopify:list-customers": graphql(
    `query ListCustomers($first: Int!, $query: String, $after: String) {
      customers(first: $first, query: $query, after: $after) {
        nodes { ${CUSTOMER_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    (i) =>
      definedFields({
        first: pageSize(i),
        query: optionalInputString(i, "query", "search"),
        after: optionalInputString(i, "cursor", "after"),
      }),
  ),
  "shopify:update-customer": graphql(
    `mutation UpdateCustomer($input: CustomerInput!) {
      customerUpdate(input: $input) { customer { ${CUSTOMER_FIELDS} } ${USER_ERRORS} }
    }`,
    (i) => ({
      input: {
        id: globalId(i, "Customer", "customerId", "id"),
        ...requiredInputRecord(i, "customer", "input", "fields"),
      },
    }),
  ),
  "shopify:delete-customer": graphql(
    `mutation DeleteCustomer($input: CustomerDeleteInput!) {
      customerDelete(input: $input) { deletedCustomerId ${USER_ERRORS} }
    }`,
    (i) => ({ input: { id: globalId(i, "Customer", "customerId", "id") } }),
  ),
  "shopify:list-inventory-items": graphql(
    `
      query ListInventoryItems($first: Int!, $query: String, $after: String) {
        inventoryItems(first: $first, query: $query, after: $after) {
          nodes {
            id
            sku
            tracked
            unitCost {
              amount
              currencyCode
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (i) =>
      definedFields({
        first: pageSize(i),
        query: optionalInputString(i, "query", "sku"),
        after: optionalInputString(i, "cursor", "after"),
      }),
  ),
  "shopify:get-inventory-level": graphql(
    `
      query GetInventoryLevel($id: ID!) {
        inventoryItem(id: $id) {
          id
          sku
          inventoryLevels(first: 50) {
            nodes {
              id
              location {
                id
                name
              }
              quantities(names: ["available", "on_hand"]) {
                name
                quantity
              }
            }
          }
        }
      }
    `,
    (i) => ({ id: globalId(i, "InventoryItem", "inventoryItemId", "id") }),
  ),
  "shopify:adjust-inventory": graphql(
    `mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        inventoryAdjustmentGroup { createdAt reason }
        ${USER_ERRORS}
      }
    }`,
    (i) => ({
      input: {
        name: optionalInputString(i, "quantityName") ?? "available",
        reason: optionalInputString(i, "reason") ?? "correction",
        changes: [
          {
            inventoryItemId: globalId(i, "InventoryItem", "inventoryItemId"),
            locationId: globalId(i, "Location", "locationId"),
            delta: requiredInputNumber(i, "delta"),
          },
        ],
      },
    }),
  ),
  "shopify:list-locations": graphql(
    `
      query ListLocations($first: Int!) {
        locations(first: $first) {
          nodes {
            id
            name
            isActive
            address {
              city
              province
              country
            }
          }
        }
      }
    `,
    (i) => ({ first: pageSize(i) }),
  ),
  "shopify:create-fulfillment": graphql(
    `mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id status trackingInfo { number url company } }
        ${USER_ERRORS}
      }
    }`,
    (i) =>
      definedFields({
        fulfillment: definedFields({
          lineItemsByFulfillmentOrder: [
            definedFields({
              fulfillmentOrderId: globalId(
                i,
                "FulfillmentOrder",
                "fulfillmentOrderId",
              ),
              fulfillmentOrderLineItems: i.lineItems,
            }),
          ],
          trackingInfo: optionalInputRecord(i, "trackingInfo"),
          notifyCustomer: i.notifyCustomer === true,
        }),
      }),
  ),
  "shopify:list-collections": graphql(
    `
      query ListCollections($first: Int!, $query: String, $after: String) {
        collections(first: $first, query: $query, after: $after) {
          nodes {
            id
            title
            handle
            ruleSet {
              appliedDisjunctively
            }
            productsCount {
              count
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (i) =>
      definedFields({
        first: pageSize(i),
        query: optionalInputString(i, "query", "title"),
        after: optionalInputString(i, "cursor", "after"),
      }),
  ),
  "shopify:get-collection": graphql(
    `query GetCollection($id: ID!, $first: Int!) {
      collection(id: $id) {
        id title handle description
        products(first: $first) { nodes { ${PRODUCT_FIELDS} } pageInfo { hasNextPage endCursor } }
      }
    }`,
    (i) => ({
      id: globalId(i, "Collection", "collectionId", "id"),
      first: pageSize(i),
    }),
  ),
};

/**
 * Shopify is per-store: the shop domain identifies the tenant and the access
 * token authorizes against it. The domain is non-secret connection state and
 * is never taken from operation input.
 */
export const createShopifyClient: VendorClientFactory = (credential) => {
  const { shopifyApi, ApiVersion, LATEST_API_VERSION } = shopifyRequire(
    "@shopify/shopify-api",
  ) as {
    shopifyApi(config: Record<string, unknown>): {
      clients: {
        Graphql: new (options: { session: unknown }) => ShopifyGraphqlClient;
      };
    };
    ApiVersion: Record<string, string>;
    LATEST_API_VERSION: string;
  };
  const shop = requiredVendorField(credential, "shopDomain");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u.test(shop)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const shopify = shopifyApi({
    apiKey: requiredVendorField(credential, "clientId"),
    apiSecretKey: requiredVendorField(credential, "clientSecret"),
    scopes: [],
    hostName: shop,
    apiVersion: LATEST_API_VERSION ?? ApiVersion?.January25,
    isEmbeddedApp: false,
  });
  return new shopify.clients.Graphql({
    session: { shop, accessToken: vendorToken(credential) },
  }) as unknown as SdkMethodTarget;
};

export function createShopifyPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "shopify",
    driver: "@shopify/shopify-api@13.1.0",
    transportKind: "oauth2",
    operations: SHOPIFY_OPERATIONS,
    clientFactory: options.clientFactory ?? createShopifyClient,
  });
}
