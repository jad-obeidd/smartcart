import { EventEmitter } from 'node:events';
import Product from '../models/Product.js';

// Simulates a live price feed. A real deployment would replace `nextPrice` with
// calls to store APIs or scrapers; everything downstream (history, SSE stream,
// price-drop badges in the UI) stays the same.

export const priceEvents = new EventEmitter();
priceEvents.setMaxListeners(0);

const MAX_STEP = 0.08; // max +/-8% per tick
const BAND = 0.3; // stay within +/-30% of the original price

export function nextPrice(current, base, rand = Math.random) {
  const change = (rand() * 2 - 1) * MAX_STEP;
  const raw = current * (1 + change);
  const clamped = Math.min(base * (1 + BAND), Math.max(base * (1 - BAND), raw));
  return Math.max(0.01, Math.round(clamped * 100) / 100);
}

export async function tick({ sampleSize = 5, rand = Math.random } = {}) {
  const count = await Product.countDocuments();
  if (!count) return [];
  const products = await Product.aggregate([{ $sample: { size: Math.min(sampleSize, count) } }]);
  const updates = [];
  for (const raw of products) {
    const product = await Product.findById(raw._id);
    if (!product) continue;
    const base = product.priceHistory[0]?.price ?? product.price;
    const oldPrice = product.price;
    product.setPrice(nextPrice(oldPrice, base, rand));
    if (product.price === oldPrice) continue;
    await product.save();
    updates.push({ id: String(product._id), name: product.name, oldPrice, price: product.price, at: new Date() });
  }
  if (updates.length) priceEvents.emit('update', updates);
  return updates;
}

let timer = null;

export function startPriceTracker(intervalMs = Number(process.env.PRICE_TICK_MS) || 15000) {
  stopPriceTracker();
  timer = setInterval(() => {
    tick().catch((err) => console.error('Price tracker tick failed:', err.message));
  }, intervalMs);
  timer.unref?.();
}

export function stopPriceTracker() {
  if (timer) clearInterval(timer);
  timer = null;
}
