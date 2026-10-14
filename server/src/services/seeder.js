import Product from '../models/Product.js';
import { catalog } from '../catalog.js';

export async function seedProducts({ reset = false } = {}) {
  if (reset) await Product.deleteMany({});
  if (await Product.estimatedDocumentCount()) return 0;
  const now = new Date();
  await Product.insertMany(catalog.map((p) => ({ ...p, priceHistory: [{ price: p.price, at: now }] })));
  return catalog.length;
}
