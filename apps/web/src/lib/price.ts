interface Price {
  amount: number;
  currency: string;
}

export function formatPrice(price: Price): string {
  return new Intl.NumberFormat(getLocaleForCurrency(price.currency), {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
  }).format(price.amount);
}

function getLocaleForCurrency(currency: string): string {
  const currencyToLocale: Record<string, string> = {
    THB: "th-TH",
    USD: "en-US",
    EUR: "de-DE",
    JPY: "ja-JP",
    GBP: "en-GB",
    CNY: "zh-CN",
    KRW: "ko-KR",
  };
  return currencyToLocale[currency] ?? "en-US";
}
