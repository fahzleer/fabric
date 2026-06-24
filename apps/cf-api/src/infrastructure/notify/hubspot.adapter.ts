import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

const HUBSPOT_BASE = "https://api.hubapi.com";

export class HubSpotAdapter implements NotificationPort {
  constructor(private readonly accessToken: string) {}

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    if (!payload.userEmail) return;

    const { orderId, totalCents, currency, itemCount, userEmail, recipientName } = payload;

    const contactId = await this.upsertContact(userEmail, recipientName);
    if (!contactId) return;

    await this.createDeal(contactId, orderId, totalCents, currency, itemCount);
  }

  private async upsertContact(email: string, name?: string): Promise<string | undefined> {
    try {
      const [firstName, ...rest] = (name ?? "").split(" ");
      const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            email,
            firstname: firstName ?? "",
            lastname: rest.join(" "),
          },
        }),
      });

      // 409 = contact already exists — fetch it
      if (res.status === 409) {
        const search = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
          }),
        });
        if (!search.ok) return undefined;
        const data = (await search.json()) as { results?: { id: string }[] };
        return data.results?.[0]?.id;
      }

      if (!res.ok) {
        log.warn("HubSpot: upsertContact failed", { status: res.status, email });
        return undefined;
      }

      const data = (await res.json()) as { id: string };
      return data.id;
    } catch (err) {
      log.warn("HubSpot: upsertContact error", { error: String(err) });
      return undefined;
    }
  }

  private async createDeal(
    contactId: string,
    orderId: string,
    totalCents: number,
    currency: string,
    itemCount: number
  ): Promise<void> {
    try {
      const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            dealname: `Order #${orderId.slice(0, 8)}`,
            amount: (totalCents / 100).toFixed(2),
            dealstage: "closedwon",
            pipeline: "default",
            closedate: new Date().toISOString().split("T")[0],
            description: `${itemCount} item(s) — ${currency}`,
          },
          associations: [
            {
              to: { id: contactId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
            },
          ],
        }),
      });

      if (!res.ok) {
        log.warn("HubSpot: createDeal failed", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("HubSpot: createDeal error", { orderId, error: String(err) });
    }
  }
}
