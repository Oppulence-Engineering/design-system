/**
 * @oppulence/e-invoicing
 *
 * E-invoicing package for Peppol/UBL support via Storecove.
 * Enables sending and receiving invoices through the Peppol network.
 */

export type { StorecoveConfig } from "./providers";
// Providers
export { createStorecoveProvider, StorecoveProvider } from "./providers";
// Types
export * from "./types";
export type { InvoiceToEInvoiceParams } from "./ubl";
// UBL generation
export { generateUBLInvoice, invoiceToEInvoiceDocument } from "./ubl";
