type Price = { currency: string } & ({ displayAmount: number } | { amount: number });

export function formatPrice(price: Price): string {
  const value = "displayAmount" in price ? price.displayAmount : price.amount;
  return new Intl.NumberFormat(getLocaleForCurrency(price.currency), {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
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
