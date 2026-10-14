import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ShoppingList from '../models/ShoppingList.js';
import { requireAuth } from '../middleware/auth.js';
import { parseSearchQuery, recommend } from '../services/ai.js';
import { scoreProduct } from '../services/matcher.js';
import { priceEvents } from '../services/priceTracker.js';

const router = Router();

function summary(p) {
  const history = p.priceHistory || [];
  const previous = history.length > 1 ? history[history.length - 2].price : p.price;
  return {
    id: p._id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: p.price,
    previousPrice: previous,
    change: Math.round((p.price - previous) * 100) / 100,
    tags: p.tags,
  };
}

router.get('/categories', async (req, res, next) => {
  try {
    res.json({ categories: (await Product.distinct('category')).sort() });
  } catch (err) {
    next(err);
  }
});

// GET /api/products?q=healthy snacks under $5
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const products = await Product.find().lean();
    if (!q) {
      return res.json({ filters: null, products: products.map(summary).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    const categories = [...new Set(products.map((p) => p.category))];
    const filters = await parseSearchQuery(q, categories);
    const results = products
      .filter((p) => !filters.category || p.category === filters.category)
      .filter((p) => filters.maxPrice == null || p.price <= filters.maxPrice)
      .filter((p) => filters.minPrice == null || p.price >= filters.minPrice)
      .map((p) => ({ p, s: filters.keywords.length ? scoreProduct(p, filters.keywords) : 1 }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
      .map((r) => summary(r.p));
    res.json({ filters, products: results });
  } catch (err) {
    next(err);
  }
});

// Server-Sent Events stream of live price changes.
router.get('/prices/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  const send = (updates) => res.write(`event: prices\ndata: ${JSON.stringify(updates)}\n\n`);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  priceEvents.on('update', send);
  req.on('close', () => {
    clearInterval(keepAlive);
    priceEvents.off('update', send);
  });
});

router.get('/recommendations', requireAuth, async (req, res, next) => {
  try {
    const lists = await ShoppingList.find({ owner: req.user._id }).lean();
    const names = [...new Set(lists.flatMap((l) => l.items.map((i) => i.name)))];
    const products = await Product.find().lean();
    const recs = await recommend(names, products);
    res.json({ recommendations: recs.map((r) => ({ product: summary(r.product), reason: r.reason })) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: { ...summary(product), priceHistory: product.priceHistory } });
  } catch (err) {
    next(err);
  }
});

export default router;
