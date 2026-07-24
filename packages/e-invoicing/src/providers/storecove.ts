/**
 * Storecove E-Invoicing Provider
 *
 * Implements the EInvoiceProvider interface for Storecove API.
 * Reference: https://www.storecove.com/docs/
 */

import type {
  EInvoiceDocument,
  EInvoiceProvider,
  EInvoiceSendResult,
  EInvoiceStatus,
  PeppolParticipantId,
} from "../types";
import { generateUBLInvoice } from "../ubl";

// =============================================================================
// Constants
// =============================================================================

/** Default Storecove API base URL */
const STORECOVE_DEFAULT_BASE_URL = "https://api.storecove.com/api/v2";

/** Storecove API endpoints */
const STORECOVE_ENDPOINTS = {
  documentSubmissions: "/document_submissions",
  discovery: "/discovery/receives",
} as const;

/** Invoice type code for credit notes in UBL */
const INVOICE_TYPE_CREDIT_NOTE = "381";

/** Document types supported by Storecove */
const STORECOVE_DOCUMENT_TYPES = {
  invoice: "invoice",
  creditNote: "creditnote",
} as const;

/** Parse strategy for UBL documents */
const PARSE_STRATEGY_UBL = "ubl";

/** Storecove status strings */
const STORECOVE_STATUS = {
  pending: "pending",
  submitted: "submitted",
  sent: "sent",
  delivered: "delivered",
  rejected: "rejected",
  error: "error",
  failed: "failed",
} as const;

// =============================================================================
// Types
// =============================================================================

export type StorecoveConfig = {
  apiKey: string;
  legalEntityId: string;
  baseUrl?: string;
};

type StorecoveSubmitResponse = {
  guid: string;
};

type StorecoveDocumentStatus = {
  guid: string;
  status: string;
  document_id?: string;
  error?: string;
};

type StorecoveParticipantLookup = {
  code: string;
  email?: string;
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when Storecove API returns an error response
 */
export class StorecoveApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(`Storecove API error: ${statusCode} - ${responseBody}`);
    this.name = "StorecoveApiError";
  }
}

/**
 * Error thrown when environment variables are missing
 */
export class StorecoveConfigError extends Error {
  constructor(missingVariable: string) {
    super(`${missingVariable} environment variable is required`);
    this.name = "StorecoveConfigError";
  }
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * Storecove provider for Peppol e-invoicing
 */
export class StorecoveProvider implements EInvoiceProvider {
  private readonly apiKey: string;
  private readonly legalEntityId: string;
  private readonly baseUrl: string;

  constructor(config: StorecoveConfig) {
    this.apiKey = config.apiKey;
    this.legalEntityId = config.legalEntityId;
    this.baseUrl = config.baseUrl ?? STORECOVE_DEFAULT_BASE_URL;
  }

  /**
   * Send an e-invoice via Storecove
   */
  async sendInvoice(document: EInvoiceDocument): Promise<EInvoiceSendResult> {
    const ublXml = generateUBLInvoice(document);

    // Extract receiver Peppol ID for routing
    const [receiverScheme, receiverIdentifier] =
      document.accountingCustomerParty.peppolId.split(":");

    if (!(receiverScheme && receiverIdentifier)) {
      return {
        success: false,
        error: `Invalid Peppol ID format for customer: "${document.accountingCustomerParty.peppolId}". Expected scheme:identifier (e.g., 0007:5567890123)`,
      };
    }

    const documentType =
      document.invoiceTypeCode === INVOICE_TYPE_CREDIT_NOTE
        ? STORECOVE_DOCUMENT_TYPES.creditNote
        : STORECOVE_DOCUMENT_TYPES.invoice;

    const payload = {
      legalEntityId: Number(this.legalEntityId),
      routing: {
        eIdentifiers: [
          {
            scheme: receiverScheme,
            id: receiverIdentifier,
          },
        ],
      },
      document: {
        documentType,
        rawDocumentData: {
          document: Buffer.from(ublXml).toString("base64"),
          parseStrategy: PARSE_STRATEGY_UBL,
        },
      },
    };

    try {
      const response = await fetch(
        `${this.baseUrl}${STORECOVE_ENDPOINTS.documentSubmissions}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new StorecoveApiError(response.status, errorText);
      }

      const result = (await response.json()) as StorecoveSubmitResponse;

      return {
        success: true,
        documentId: result.guid,
        guid: result.guid,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof StorecoveApiError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error sending e-invoice",
      };
    }
  }

  /**
   * Get the status of a document by GUID
   */
  async getDocumentStatus(documentGuid: string): Promise<EInvoiceStatus> {
    const response = await fetch(
      `${this.baseUrl}${STORECOVE_ENDPOINTS.documentSubmissions}/${documentGuid}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      throw new StorecoveApiError(response.status, await response.text());
    }

    const result = (await response.json()) as StorecoveDocumentStatus;

    // Map Storecove status to our status enum
    return this.mapStorecoveStatus(result.status);
  }

  /**
   * Validate if a Peppol participant ID exists in the network
   */
  async validateParticipant(peppolId: PeppolParticipantId): Promise<boolean> {
    try {
      const [scheme, identifier] = peppolId.split(":");

      if (!(scheme && identifier)) {
        return false;
      }

      const response = await fetch(
        `${this.baseUrl}${STORECOVE_ENDPOINTS.discovery}?` +
          new URLSearchParams({
            scheme,
            identifier,
          }),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as StorecoveParticipantLookup;

      // If we get a valid response with a code, the participant exists
      return Boolean(result.code);
    } catch {
      return false;
    }
  }

  /**
   * Map Storecove status strings to our EInvoiceStatus enum
   */
  private mapStorecoveStatus(status: string): EInvoiceStatus {
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case STORECOVE_STATUS.pending:
      case STORECOVE_STATUS.submitted:
        return "pending";
      case STORECOVE_STATUS.sent:
        return "sent";
      case STORECOVE_STATUS.delivered:
        return "delivered";
      case STORECOVE_STATUS.rejected:
        return "rejected";
      case STORECOVE_STATUS.error:
      case STORECOVE_STATUS.failed:
        return "failed";
      default:
        return "pending";
    }
  }
}

/**
 * Create a Storecove provider from environment variables
 */
export function createStorecoveProvider(): StorecoveProvider {
  const apiKey = process.env.STORECOVE_API_KEY;
  const legalEntityId = process.env.STORECOVE_LEGAL_ENTITY_ID;

  if (!apiKey) {
    throw new StorecoveConfigError("STORECOVE_API_KEY");
  }

  if (!legalEntityId) {
    throw new StorecoveConfigError("STORECOVE_LEGAL_ENTITY_ID");
  }

  return new StorecoveProvider({
    apiKey,
    legalEntityId,
    baseUrl: process.env.STORECOVE_BASE_URL,
  });
}
