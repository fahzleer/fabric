export const vatRatePercent = (countryCode: string): number => {
  switch (countryCode) {
    case "TH":
      return 7;
    case "SG":
      return 9;
    case "DE":
      return 19;
    case "FR":
      return 20;
    case "GB":
      return 20;
    case "AU":
      return 10;
    default:
      return 0;
  }
};

export const calculateVat = (amountCents: number, countryCode: string): number => {
  const rate = vatRatePercent(countryCode);
  return Math.floor((amountCents * rate) / 100);
};
