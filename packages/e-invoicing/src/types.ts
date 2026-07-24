import { z } from "zod";

/**
 * E-Invoice status enum matching database values
 */
export const eInvoiceStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "failed",
  "rejected",
]);
export type EInvoiceStatus = z.infer<typeof eInvoiceStatusSchema>;

/**
 * Peppol Participant ID format
 * Format: scheme:identifier (e.g., "0007:5567890123" for Swedish org number)
 */
export const peppolParticipantIdSchema = z
  .string()
  .regex(
    /^\d{4}:[A-Za-z0-9\-._~]+$/,
    "Invalid Peppol ID format. Expected format: scheme:identifier (e.g., 0007:5567890123)",
  );
export type PeppolParticipantId = z.infer<typeof peppolParticipantIdSchema>;

/**
 * Address structure for e-invoicing
 */
export const addressSchema = z.object({
  streetName: z.string().optional(),
  additionalStreetName: z.string().optional(),
  cityName: z.string().optional(),
  postalZone: z.string().optional(),
  countrySubentity: z.string().optional(),
  countryCode: z.string().length(2),
});
export type Address = z.infer<typeof addressSchema>;

/**
 * Party information for sender/receiver
 */
export const partySchema = z.object({
  name: z.string(),
  peppolId: peppolParticipantIdSchema,
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: addressSchema.optional(),
});
export type Party = z.infer<typeof partySchema>;

/**
 * Line item for invoice
 */
export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().positive(),
  unitCode: z.string().default("EA"),
  unitPrice: z.number(),
  lineExtensionAmount: z.number(),
  taxPercent: z.number().optional(),
  taxAmount: z.number().optional(),
  itemClassificationCode: z.string().optional(),
});
export type LineItem = z.infer<typeof lineItemSchema>;

/**
 * Payment means information
 */
export const paymentMeansSchema = z.object({
  code: z.string().default("30"), // 30 = Credit transfer
  payeeFinancialAccount: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      financialInstitutionBranch: z
        .object({
          id: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  paymentDueDate: z.string().optional(),
});
export type PaymentMeans = z.infer<typeof paymentMeansSchema>;

/**
 * Tax total structure
 */
export const taxTotalSchema = z.object({
  taxAmount: z.number(),
  taxSubtotals: z.array(
    z.object({
      taxableAmount: z.number(),
      taxAmount: z.number(),
      taxCategory: z.object({
        id: z.string(),
        percent: z.number(),
        taxScheme: z.object({
          id: z.string().default("VAT"),
        }),
      }),
    }),
  ),
});
export type TaxTotal = z.infer<typeof taxTotalSchema>;

/**
 * E-Invoice document structure
 */
export const eInvoiceDocumentSchema = z.object({
  // Document identification
  id: z.string(),
  issueDate: z.string(),
  dueDate: z.string().optional(),
  invoiceTypeCode: z.string().default("380"), // 380 = Commercial Invoice, 381 = Credit Note
  documentCurrencyCode: z.string().length(3),
  buyerReference: z.string().optional(),
  note: z.string().optional(),

  // Parties
  accountingSupplierParty: partySchema,
  accountingCustomerParty: partySchema,

  // Payment
  paymentMeans: paymentMeansSchema.optional(),
  paymentTermsNote: z.string().optional(),

  // Line items
  invoiceLines: z.array(lineItemSchema),

  // Totals
  taxTotal: taxTotalSchema.optional(),
  legalMonetaryTotal: z.object({
    lineExtensionAmount: z.number(),
    taxExclusiveAmount: z.number(),
    taxInclusiveAmount: z.number(),
    payableAmount: z.number(),
    allowanceTotalAmount: z.number().optional(),
    chargeTotalAmount: z.number().optional(),
    prepaidAmount: z.number().optional(),
  }),
});
export type EInvoiceDocument = z.infer<typeof eInvoiceDocumentSchema>;

/**
 * E-Invoice provider interface
 */
export type EInvoiceProvider = {
  /**
   * Send an e-invoice document
   */
  sendInvoice(document: EInvoiceDocument): Promise<EInvoiceSendResult>;

  /**
   * Get the status of a sent document
   */
  getDocumentStatus(documentId: string): Promise<EInvoiceStatus>;

  /**
   * Validate a Peppol participant ID
   */
  validateParticipant(peppolId: PeppolParticipantId): Promise<boolean>;
};

/**
 * Result from sending an e-invoice
 */
export const eInvoiceSendResultSchema = z.object({
  success: z.boolean(),
  documentId: z.string().optional(),
  guid: z.string().optional(),
  error: z.string().optional(),
  sentAt: z.string().datetime().optional(),
});
export type EInvoiceSendResult = z.infer<typeof eInvoiceSendResultSchema>;

/**
 * E-invoicing settings for a team
 */
export const eInvoicingSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(["storecove"]).default("storecove"),
  legalEntityId: z.string().optional(),
  peppolId: peppolParticipantIdSchema.optional(),
  autoSend: z.boolean().default(false),
});
export type EInvoicingSettings = z.infer<typeof eInvoicingSettingsSchema>;

/**
 * Webhook event from Storecove
 */
export const storecoveWebhookEventSchema = z.object({
  event: z.enum([
    "document.submitted",
    "document.sent",
    "document.delivered",
    "document.rejected",
    "document.error",
  ]),
  guid: z.string(),
  legal_entity_id: z.number(),
  timestamp: z.string(),
  document_id: z.string().optional(),
  error: z.string().optional(),
  rejection_reason: z.string().optional(),
});
export type StorecoveWebhookEvent = z.infer<typeof storecoveWebhookEventSchema>;
