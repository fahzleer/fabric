export interface CartLine {
  readonly seriesId: string;
  readonly seriesName: string;
  readonly unitPriceSatang: number;
  readonly qty: number;
}

export interface SetItem {
  readonly seriesId: string;
  readonly seriesName: string;
  readonly unitPriceSatang: number;
}

export interface SetResult {
  readonly items: ReadonlyArray<SetItem>;
  readonly count: number;
  readonly discountPct: number;
  readonly originalSatang: number;
  readonly discountSatang: number;
  readonly finalSatang: number;
}

export interface OrderResult {
  readonly sets: ReadonlyArray<SetResult>;
  readonly remainderLines: ReadonlyArray<CartLine>;
  readonly subtotalSatang: number;
  readonly discountSatang: number;
  readonly totalSatang: number;
}

export const discountRate = (count: number): number => {
  switch (count) {
    case 2:
      return 5;
    case 3:
      return 10;
    case 4:
      return 20;
    default:
      return count >= 5 ? 25 : 0;
  }
};

const mergeLines = (lines: ReadonlyArray<CartLine>): CartLine[] => {
  const map = new Map<string, CartLine>();
  for (const line of lines) {
    const existing = map.get(line.seriesId);
    map.set(line.seriesId, existing ? { ...existing, qty: existing.qty + line.qty } : { ...line });
  }
  return Array.from(map.values());
};

const greedyLoop = (
  lines: CartLine[],
  acc: SetResult[]
): { sets: SetResult[]; remainder: CartLine[] } => {
  const available = lines.filter((l) => l.qty > 0);
  const count = available.length;
  if (count < 2) return { sets: acc, remainder: available };

  const setItems: SetItem[] = available.map((l) => ({
    seriesId: l.seriesId,
    seriesName: l.seriesName,
    unitPriceSatang: l.unitPriceSatang,
  }));

  const pct = discountRate(count);
  const originalSatang = setItems.reduce((s, item) => s + item.unitPriceSatang, 0);
  const discountSatang = Math.floor((originalSatang * pct) / 100);

  const setResult: SetResult = {
    items: setItems,
    count,
    discountPct: pct,
    originalSatang,
    discountSatang,
    finalSatang: originalSatang - discountSatang,
  };

  const updated = lines.map((l) => (l.qty > 0 ? { ...l, qty: l.qty - 1 } : l));
  return greedyLoop(updated, [...acc, setResult]);
};

export const calculateOrder = (lines: ReadonlyArray<CartLine>): OrderResult => {
  const merged = mergeLines(lines);
  const { sets, remainder } = greedyLoop(merged, []);

  const subtotalSatang = merged.reduce((s, l) => s + l.unitPriceSatang * l.qty, 0);
  const discountSatang = sets.reduce((s, set) => s + set.discountSatang, 0);
  const totalSatang = subtotalSatang - discountSatang;

  return { sets, remainderLines: remainder, subtotalSatang, discountSatang, totalSatang };
};
