/** Parse prices only; all energy and monetary arithmetic remains in Fullb. */
export function intervalTariff(text: string, intervalCount: number): number[] {
  if (intervalCount < 1 || intervalCount > 100 || !Number.isInteger(intervalCount)) throw new Error("Invalid planning horizon.");
  const trimmed = text.trim();
  if (/^[,;]|[,;]$|[,;]\s*[,;]/u.test(trimmed)) throw new Error("A price is missing between separators.");
  const values = trimmed.split(/[\s,;]+/u);
  if (values.length !== intervalCount || values.some(value => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(value)))
    throw new Error(`Enter exactly ${intervalCount} prices in interval order.`);
  const prices = values.map(Number);
  if (prices.some(value => !Number.isFinite(value))) throw new Error("Prices must be finite EUR/MWh values.");
  return prices;
}
