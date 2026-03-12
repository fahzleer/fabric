export type AnalyticsEvent =
  | "product_viewed"
  | "cart_item_added"
  | "cart_item_removed"
  | "checkout_started"
  | "order_placed"
  | "page_viewed";

export async function logUserAction(
  action: string,
  userId: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  return trackEvent("page_viewed", { action, userId, ...data });
}

export async function logError(
  error: Error | string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const message = error instanceof Error ? error.message : error;
  return trackEvent("page_viewed", { error: message, ...context });
}

export async function trackEvent(
  eventType: AnalyticsEvent,
  data: Record<string, unknown> = {},
  userId?: string
): Promise<void> {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, eventData: data, userId }),
  }).catch(() => undefined);

  const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (typeof window !== "undefined" && mixpanelToken) {
    import("mixpanel-browser")
      .then(({ default: mixpanel }) => {
        mixpanel.init(mixpanelToken, { debug: false });
        mixpanel.track(eventType, { ...data, distinct_id: userId });
      })
      .catch(() => undefined);
  }
}
