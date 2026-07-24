/**
 * UBL (Universal Business Language) 2.1 Invoice Generation
 *
 * Generates Peppol BIS 3.0 compliant UBL invoices for e-invoicing.
 * Reference: https://docs.peppol.eu/poacc/billing/3.0/
 */

import type { EInvoiceDocument, LineItem, Party, TaxTotal } from "../types";

// =============================================================================
// Constants
// =============================================================================

/**
 * XML namespace declarations for UBL 2.1
 */
const UBL_NAMESPACES = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  creditNote: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
} as const;

/**
 * Peppol BIS 3.0 customization and profile identifiers
 */
const PEPPOL_BIS_3 = {
  customizationId:
    "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0",
  profileId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
} as const;

/**
 * Invoice type codes per UBL 2.1
 */
const INVOICE_TYPE_CODE = {
  /** Standard commercial invoice */
  invoice: "380",
  /** Credit note */
  creditNote: "381",
} as const;

/**
 * Tax scheme and category identifiers
 */
const TAX = {
  schemeId: "VAT",
  /** Standard rate category */
  standardCategory: "S",
} as const;

/**
 * Default values for document generation
 */
const DEFAULTS = {
  currency: "USD",
  /** "Each" - standard unit code for single items */
  unitCode: "EA",
  quantity: 1,
} as const;

/**
 * Number of decimal places for monetary amounts
 */
const AMOUNT_DECIMAL_PLACES = 2;

/**
 * Percentage multiplier for tax calculations
 */
const PERCENTAGE_MULTIPLIER = 100;

/**
 * Escapes special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a number for XML output (2 decimal places)
 */
function formatAmount(amount: number): string {
  return amount.toFixed(AMOUNT_DECIMAL_PLACES);
}

/**
 * Generates the party XML block for supplier or customer
 *
 * @throws Error if peppolId is malformed (doesn't contain scheme:identifier format)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UBL XML generation requires nested conditionals for optional party fields
function generatePartyXml(
  party: Party,
  role: "AccountingSupplierParty" | "AccountingCustomerParty",
): string {
  const [scheme, identifier] = party.peppolId.split(":");

  // Validate that peppolId has the correct format
  if (!(scheme && identifier)) {
    throw new Error(
      `Invalid Peppol ID format for ${role}: "${party.peppolId}". ` +
        "Expected format: scheme:identifier (e.g., 0007:5567890123)",
    );
  }

  let addressXml = "";
  if (party.address) {
    addressXml = `
      <cac:PostalAddress>
        ${party.address.streetName ? `<cbc:StreetName>${escapeXml(party.address.streetName)}</cbc:StreetName>` : ""}
        ${party.address.additionalStreetName ? `<cbc:AdditionalStreetName>${escapeXml(party.address.additionalStreetName)}</cbc:AdditionalStreetName>` : ""}
        ${party.address.cityName ? `<cbc:CityName>${escapeXml(party.address.cityName)}</cbc:CityName>` : ""}
        ${party.address.postalZone ? `<cbc:PostalZone>${escapeXml(party.address.postalZone)}</cbc:PostalZone>` : ""}
        ${party.address.countrySubentity ? `<cbc:CountrySubentity>${escapeXml(party.address.countrySubentity)}</cbc:CountrySubentity>` : ""}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(party.address.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>`;
  }

  // SECURITY: `scheme` comes from `peppolId.split(":")[0]`, which is
  // caller-controlled upstream. It MUST be XML-escaped before being placed
  // inside an attribute value — without this, a crafted peppolId like
  // `abc":injected="bar` would close the attribute and inject new XML.
  const schemeAttr = escapeXml(scheme);
  return `
    <cac:${role}>
      <cac:Party>
        <cbc:EndpointID schemeID="${schemeAttr}">${escapeXml(identifier)}</cbc:EndpointID>
        <cac:PartyIdentification>
          <cbc:ID schemeID="${schemeAttr}">${escapeXml(identifier)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${escapeXml(party.name)}</cbc:Name>
        </cac:PartyName>
        ${addressXml}
        ${
          party.vatNumber
            ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(party.vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>${TAX.schemeId}</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>`
            : ""
        }
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>
          ${party.registrationNumber ? `<cbc:CompanyID>${escapeXml(party.registrationNumber)}</cbc:CompanyID>` : ""}
        </cac:PartyLegalEntity>
        ${
          party.email
            ? `
        <cac:Contact>
          <cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail>
          ${party.phone ? `<cbc:Telephone>${escapeXml(party.phone)}</cbc:Telephone>` : ""}
        </cac:Contact>`
            : ""
        }
      </cac:Party>
    </cac:${role}>`;
}

/**
 * Generates the invoice line XML
 */
function generateLineItemXml(
  item: LineItem,
  index: number,
  currencyCode: string,
): string {
  return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(item.unitCode)}">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currencyCode}">${formatAmount(item.lineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.description)}</cbc:Description>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        ${
          item.itemClassificationCode
            ? `
        <cac:CommodityClassification>
          <cbc:ItemClassificationCode listID="TST">${escapeXml(item.itemClassificationCode)}</cbc:ItemClassificationCode>
        </cac:CommodityClassification>`
            : ""
        }
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${TAX.standardCategory}</cbc:ID>
          <cbc:Percent>${item.taxPercent ?? 0}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>${TAX.schemeId}</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currencyCode}">${formatAmount(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
}

/**
 * Generates the credit note line XML (for credit notes)
 */
function generateCreditNoteLineXml(
  item: LineItem,
  index: number,
  currencyCode: string,
): string {
  return `
    <cac:CreditNoteLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:CreditedQuantity unitCode="${escapeXml(item.unitCode)}">${item.quantity}</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="${currencyCode}">${formatAmount(item.lineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.description)}</cbc:Description>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${TAX.standardCategory}</cbc:ID>
          <cbc:Percent>${item.taxPercent ?? 0}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>${TAX.schemeId}</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currencyCode}">${formatAmount(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:CreditNoteLine>`;
}

/**
 * Generates the tax total XML block
 */
function generateTaxTotalXml(taxTotal: TaxTotal, currencyCode: string): string {
  const subtotals = taxTotal.taxSubtotals
    .map(
      (subtotal) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currencyCode}">${formatAmount(subtotal.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currencyCode}">${formatAmount(subtotal.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(subtotal.taxCategory.id)}</cbc:ID>
        <cbc:Percent>${subtotal.taxCategory.percent}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>${escapeXml(subtotal.taxCategory.taxScheme.id)}</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
    )
    .join("");

  return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currencyCode}">${formatAmount(taxTotal.taxAmount)}</cbc:TaxAmount>
      ${subtotals}
    </cac:TaxTotal>`;
}

/**
 * Generates a Peppol BIS 3.0 compliant UBL Invoice XML
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Full UBL document assembly with many optional sections
export function generateUBLInvoice(document: EInvoiceDocument): string {
  const isCreditNote =
    document.invoiceTypeCode === INVOICE_TYPE_CODE.creditNote;
  const rootElement = isCreditNote ? "CreditNote" : "Invoice";
  const namespace = isCreditNote
    ? UBL_NAMESPACES.creditNote
    : UBL_NAMESPACES.invoice;
  const lineGenerator = isCreditNote
    ? generateCreditNoteLineXml
    : generateLineItemXml;

  const lines = document.invoiceLines
    .map((line, index) =>
      lineGenerator(line, index, document.documentCurrencyCode),
    )
    .join("");

  const taxTotalXml = document.taxTotal
    ? generateTaxTotalXml(document.taxTotal, document.documentCurrencyCode)
    : "";

  const paymentMeansXml = document.paymentMeans
    ? `
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>${escapeXml(document.paymentMeans.code)}</cbc:PaymentMeansCode>
      ${document.paymentMeans.paymentDueDate ? `<cbc:PaymentDueDate>${document.paymentMeans.paymentDueDate}</cbc:PaymentDueDate>` : ""}
      ${
        document.paymentMeans.payeeFinancialAccount
          ? `
      <cac:PayeeFinancialAccount>
        <cbc:ID>${escapeXml(document.paymentMeans.payeeFinancialAccount.id)}</cbc:ID>
        ${document.paymentMeans.payeeFinancialAccount.name ? `<cbc:Name>${escapeXml(document.paymentMeans.payeeFinancialAccount.name)}</cbc:Name>` : ""}
        ${
          document.paymentMeans.payeeFinancialAccount.financialInstitutionBranch
            ?.id
            ? `
        <cac:FinancialInstitutionBranch>
          <cbc:ID>${escapeXml(document.paymentMeans.payeeFinancialAccount.financialInstitutionBranch.id)}</cbc:ID>
        </cac:FinancialInstitutionBranch>`
            : ""
        }
      </cac:PayeeFinancialAccount>`
          : ""
      }
    </cac:PaymentMeans>`
    : "";

  const paymentTermsXml = document.paymentTermsNote
    ? `
    <cac:PaymentTerms>
      <cbc:Note>${escapeXml(document.paymentTermsNote)}</cbc:Note>
    </cac:PaymentTerms>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement}
  xmlns="${namespace}"
  xmlns:cac="${UBL_NAMESPACES.cac}"
  xmlns:cbc="${UBL_NAMESPACES.cbc}">
  <cbc:CustomizationID>${PEPPOL_BIS_3.customizationId}</cbc:CustomizationID>
  <cbc:ProfileID>${PEPPOL_BIS_3.profileId}</cbc:ProfileID>
  <cbc:ID>${escapeXml(document.id)}</cbc:ID>
  <cbc:IssueDate>${document.issueDate}</cbc:IssueDate>
  ${document.dueDate ? `<cbc:DueDate>${document.dueDate}</cbc:DueDate>` : ""}
  <cbc:${isCreditNote ? "CreditNoteTypeCode" : "InvoiceTypeCode"}>${document.invoiceTypeCode}</${isCreditNote ? "cbc:CreditNoteTypeCode" : "cbc:InvoiceTypeCode"}>
  ${document.note ? `<cbc:Note>${escapeXml(document.note)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${document.documentCurrencyCode}</cbc:DocumentCurrencyCode>
  ${document.buyerReference ? `<cbc:BuyerReference>${escapeXml(document.buyerReference)}</cbc:BuyerReference>` : ""}
  ${generatePartyXml(document.accountingSupplierParty, "AccountingSupplierParty")}
  ${generatePartyXml(document.accountingCustomerParty, "AccountingCustomerParty")}
  ${paymentMeansXml}
  ${paymentTermsXml}
  ${taxTotalXml}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.lineExtensionAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    ${document.legalMonetaryTotal.allowanceTotalAmount === undefined ? "" : `<cbc:AllowanceTotalAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.allowanceTotalAmount)}</cbc:AllowanceTotalAmount>`}
    ${document.legalMonetaryTotal.chargeTotalAmount === undefined ? "" : `<cbc:ChargeTotalAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.chargeTotalAmount)}</cbc:ChargeTotalAmount>`}
    ${document.legalMonetaryTotal.prepaidAmount === undefined ? "" : `<cbc:PrepaidAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.prepaidAmount)}</cbc:PrepaidAmount>`}
    <cbc:PayableAmount currencyID="${document.documentCurrencyCode}">${formatAmount(document.legalMonetaryTotal.payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines}
</${rootElement}>`;
}

/**
 * Converts a platform invoice to an EInvoiceDocument
 */
export type InvoiceToEInvoiceParams = {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    issueDate: string | null;
    dueDate: string | null;
    amount: number | null;
    subtotal: number | null;
    tax: number | null;
    vat: number | null;
    currency: string | null;
    note: string | null;
    lineItems: unknown;
  };
  supplier: {
    name: string;
    peppolId: string;
    vatNumber?: string;
    email?: string;
    address?: {
      streetName?: string;
      cityName?: string;
      postalZone?: string;
      countryCode: string;
    };
  };
  customer: {
    name: string;
    peppolId: string;
    vatNumber?: string;
    email?: string;
    address?: {
      streetName?: string;
      cityName?: string;
      postalZone?: string;
      countryCode: string;
    };
  };
};

export function invoiceToEInvoiceDocument(
  params: InvoiceToEInvoiceParams,
): EInvoiceDocument {
  const { invoice, supplier, customer } = params;

  const issueDate = invoice.issueDate
    ? new Date(invoice.issueDate).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toISOString().split("T")[0]
    : undefined;

  const currency = invoice.currency ?? DEFAULTS.currency;
  const subtotal = invoice.subtotal ?? invoice.amount ?? 0;
  const taxAmount = invoice.tax ?? invoice.vat ?? 0;
  const total = subtotal + taxAmount;

  // Parse line items or create a single line item
  let lineItems: LineItem[] = [];
  if (invoice.lineItems && Array.isArray(invoice.lineItems)) {
    lineItems = (
      invoice.lineItems as Array<{
        name?: string;
        description?: string;
        quantity?: number;
        unit_code?: string;
        price?: number;
      }>
    ).map((item, index) => ({
      id: `line-${index + 1}`,
      description: item.name ?? item.description ?? "Item",
      quantity: item.quantity ?? DEFAULTS.quantity,
      unitCode: item.unit_code ?? DEFAULTS.unitCode,
      unitPrice: item.price ?? 0,
      lineExtensionAmount:
        (item.quantity ?? DEFAULTS.quantity) * (item.price ?? 0),
    }));
  }

  // If no line items, create one from the invoice total
  if (lineItems.length === 0) {
    lineItems = [
      {
        id: "line-1",
        description: `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
        quantity: DEFAULTS.quantity,
        unitCode: DEFAULTS.unitCode,
        unitPrice: subtotal,
        lineExtensionAmount: subtotal,
      },
    ];
  }

  return {
    id: invoice.invoiceNumber ?? invoice.id,
    issueDate: issueDate ?? new Date().toISOString().split("T")[0] ?? "",
    dueDate,
    invoiceTypeCode: INVOICE_TYPE_CODE.invoice,
    documentCurrencyCode: currency,
    note: invoice.note ?? undefined,
    accountingSupplierParty: {
      name: supplier.name,
      peppolId: supplier.peppolId,
      vatNumber: supplier.vatNumber,
      email: supplier.email,
      address: supplier.address,
    },
    accountingCustomerParty: {
      name: customer.name,
      peppolId: customer.peppolId,
      vatNumber: customer.vatNumber,
      email: customer.email,
      address: customer.address,
    },
    invoiceLines: lineItems,
    taxTotal:
      taxAmount > 0
        ? {
            taxAmount,
            taxSubtotals: [
              {
                taxableAmount: subtotal,
                taxAmount,
                taxCategory: {
                  id: TAX.standardCategory,
                  percent:
                    subtotal > 0
                      ? Math.round(
                          (taxAmount / subtotal) * PERCENTAGE_MULTIPLIER,
                        )
                      : 0,
                  taxScheme: { id: TAX.schemeId },
                },
              },
            ],
          }
        : undefined,
    legalMonetaryTotal: {
      lineExtensionAmount: subtotal,
      taxExclusiveAmount: subtotal,
      taxInclusiveAmount: total,
      payableAmount: total,
    },
  };
}
