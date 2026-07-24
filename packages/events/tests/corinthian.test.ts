import { describe, expect, it } from "bun:test";
import {
  prepareCorinthianAnalyticsEvent,
  resolveCorinthianAnalyticsEvent,
  sanitizeCorinthianAnalyticsProperties,
} from "../src/corinthian";
import { LogEvents } from "../src/events";

describe("Corinthian analytics contract", () => {
  it("normalizes legacy portal events to canonical OpenPanel events", () => {
    const event = prepareCorinthianAnalyticsEvent({
      eventName: "portal.initiate_payment.succeeded",
      properties: {
        amountCents: 12_500,
        body: "Raw email body should never be sent",
        clientEmail: "ap@example.com",
        invoiceId: "inv_123",
      },
      surface: "corinthian-web",
    });

    expect(event.event).toBe(LogEvents.PortalPaymentInitiated.name);
    expect(event.channel).toBe(LogEvents.PortalPaymentInitiated.channel);
    expect(event.properties).toMatchObject({
      amountCents: 12_500,
      invoiceId: "inv_123",
      legacyEventName: "portal.initiate_payment.succeeded",
      surface: "corinthian-web",
    });
    expect(event.properties.body).toBeUndefined();
    expect(event.properties.clientEmail).toBeUndefined();
  });

  it("normalizes dynamic recurring lifecycle events", () => {
    expect(
      resolveCorinthianAnalyticsEvent("recurring.pause.succeeded").definition
        .name,
    ).toBe(LogEvents.RecurringInvoicePaused.name);

    expect(
      resolveCorinthianAnalyticsEvent("recurring.delete.failed").definition
        .name,
    ).toBe(LogEvents.RecurringInvoiceDeleteFailed.name);
  });

  it("normalizes reminder cancellation aliases", () => {
    expect(
      resolveCorinthianAnalyticsEvent("reminders.create.cancelled").definition
        .name,
    ).toBe(LogEvents.ReminderActionCancelled.name);
  });

  it("preserves unknown event names while applying the Corinthian privacy policy", () => {
    const event = prepareCorinthianAnalyticsEvent({
      eventName: "custom.experiment.clicked",
      properties: {
        customerPhone: "555-123-4567",
        route: "/dashboard",
        secretToken: "tok_123",
      },
      surface: "corinthian-web",
    });

    expect(event.event).toBe("custom.experiment.clicked");
    expect(event.channel).toBe(LogEvents.FeatureUsed.channel);
    expect(event.properties).toEqual({
      route: "/dashboard",
      surface: "corinthian-web",
    });
  });

  it("recursively strips unsafe assistant and invoice payload fields", () => {
    const properties = sanitizeCorinthianAnalyticsProperties({
      artifact: {
        invoiceId: "inv_123",
        prompt: "Write a message to the customer",
      },
      notes: "Private invoice notes",
      paymentMethod: {
        brand: "visa",
        cardNumber: "4242424242424242",
      },
      status: "accepted",
    });

    expect(properties).toEqual({
      artifact: {
        invoiceId: "inv_123",
      },
      paymentMethod: {
        brand: "visa",
      },
      status: "accepted",
    });
  });
});
