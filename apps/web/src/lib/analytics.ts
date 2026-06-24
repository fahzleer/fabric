export type AnalyticsEvent =
  | "product_viewed"
  | "cart_item_added"
  | "cart_item_removed"
  | "checkout_started"
  | "order_placed"
  | "first_deposit"
  | "organic_session_start"
  | "page_viewed";

type FbqFn = (action: string, event: string, params?: Record<string, unknown>) => void;
type GtagFn = (command: string, action: string, params?: Record<string, unknown>) => void;
type TtqFn = { track: (event: string, params?: Record<string, unknown>) => void };
type LtFn = (
  action: string,
  type: string,
  params?: Record<string, unknown>,
  tagIds?: string[]
) => void;

const META_EVENT: Partial<Record<AnalyticsEvent, string>> = {
  product_viewed: "ViewContent",
  cart_item_added: "AddToCart",
  checkout_started: "InitiateCheckout",
  order_placed: "Purchase",
  first_deposit: "Purchase",
};
const GA4_EVENT: Partial<Record<AnalyticsEvent, string>> = {
  product_viewed: "view_item",
  cart_item_added: "add_to_cart",
  cart_item_removed: "remove_from_cart",
  checkout_started: "begin_checkout",
  order_placed: "purchase",
  first_deposit: "first_purchase",
  organic_session_start: "organic_session_start",
};
const LINE_TAG_EVENT: Partial<Record<AnalyticsEvent, string>> = {
  product_viewed: "ViewItem",
  cart_item_added: "AddToCart",
  checkout_started: "BeginCheckout",
  order_placed: "Purchase",
  first_deposit: "Purchase",
};

const TIKTOK_EVENT: Partial<Record<AnalyticsEvent, string>> = {
  product_viewed: "ViewContent",
  cart_item_added: "AddToCart",
  checkout_started: "InitiateCheckout",
  order_placed: "PlaceAnOrder",
  first_deposit: "PlaceAnOrder",
};

const ORGANIC_REFERRERS = [
  "google",
  "bing",
  "yahoo",
  "duckduckgo",
  "yandex",
  "baidu",
  "naver",
  "ask",
  "ecosia",
];

function isOrganicSession(): boolean {
  if (typeof window === "undefined") return false;
  const ref = document.referrer;
  if (!ref) return false;
  try {
    const host = new URL(ref).hostname.toLowerCase();
    return ORGANIC_REFERRERS.some((engine) => host.includes(engine));
  } catch {
    return false;
  }
}

function hasUtmSource(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("utm_source");
}

const FD_KEY = "fabric_fd_done";

function getCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

export function initOrganicTracking(): void {
  if (typeof window === "undefined") return;
  if (isOrganicSession() && !hasUtmSource()) {
    sessionStorage.setItem("fabric_channel", "organic");
    trackEvent("organic_session_start", {
      referrer: document.referrer,
      landing_page: window.location.pathname,
    });
  }
}

export function trackFirstDeposit(data: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(FD_KEY)) return;
  sessionStorage.setItem(FD_KEY, "1");
  const channel = sessionStorage.getItem("fabric_channel") ?? "direct";
  const geo = getCookieValue("fabric_geo") ?? "th";
  const titleVariant = getCookieValue("exp_title_tag_products") ?? "control";
  const anchorVariant = getCookieValue("exp_anchor_text_products") ?? "control";
  trackEvent("first_deposit", {
    ...data,
    channel,
    geo,
    exp_title_tag: titleVariant,
    exp_anchor_text: anchorVariant,
  });
}

function trackMetaPixel(eventType: AnalyticsEvent, data: Record<string, unknown>): void {
  const w = globalThis as unknown as { fbq?: FbqFn };
  const event = META_EVENT[eventType];
  if (!(w.fbq && event && process.env.NEXT_PUBLIC_META_PIXEL_ID)) return;
  w.fbq("track", event, { ...data, content_type: "product" });
}

function trackGa4(eventType: AnalyticsEvent, data: Record<string, unknown>): void {
  const w = globalThis as unknown as { gtag?: GtagFn };
  const event = GA4_EVENT[eventType];
  if (!(w.gtag && event && process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID)) return;
  w.gtag("event", event, data);
}

function trackGtm(eventType: AnalyticsEvent, data: Record<string, unknown>): void {
  const w = globalThis as unknown as { dataLayer?: unknown[] };
  const event = GA4_EVENT[eventType];
  if (!(w.dataLayer && event && process.env.NEXT_PUBLIC_GTM_ID)) return;
  w.dataLayer.push({ event, ...data, analytics_event: eventType });
}

function trackLineTag(eventType: AnalyticsEvent, data: Record<string, unknown>): void {
  const w = globalThis as unknown as { _lt?: LtFn };
  const event = LINE_TAG_EVENT[eventType];
  const tagId = process.env.NEXT_PUBLIC_LINE_TAG_ID;
  if (!(w._lt && event && tagId)) return;
  w._lt("send", "cv", { type: event, ...data }, [tagId]);
}

function trackTikTok(eventType: AnalyticsEvent, data: Record<string, unknown>): void {
  const w = globalThis as unknown as { ttq?: TtqFn };
  const event = TIKTOK_EVENT[eventType];
  if (!(w.ttq && event && process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID)) return;
  w.ttq.track(event, data);
}

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

  if (typeof window !== "undefined") {
    const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
    if (mixpanelToken) {
      import("mixpanel-browser")
        .then(({ default: mixpanel }) => {
          mixpanel.init(mixpanelToken, { debug: false });
          mixpanel.track(eventType, { ...data, distinct_id: userId });
        })
        .catch(() => undefined);
    }

    trackMetaPixel(eventType, data);
    trackGa4(eventType, data);
    trackGtm(eventType, data);
    trackTikTok(eventType, data);
    trackLineTag(eventType, data);
  }
}
