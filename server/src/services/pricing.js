// Simulated price movement shared by the price tracker and the browser demo.
const MAX_STEP = 0.08; // max +/-8% per tick
const BAND = 0.3; // stay within +/-30% of the original price

export function nextPrice(current, base, rand = Math.random) {
  const change = (rand() * 2 - 1) * MAX_STEP;
  const raw = current * (1 + change);
  const clamped = Math.min(base * (1 + BAND), Math.max(base * (1 - BAND), raw));
  return Math.max(0.01, Math.round(clamped * 100) / 100);
}
