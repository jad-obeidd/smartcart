import { Router } from 'express';
import mongoose from 'mongoose';
import ShoppingList from '../models/ShoppingList.js';
import Product from '../models/Product.js';
import { requireAuth } from '../middleware/auth.js';
import { generateList } from '../services/ai.js';
import { bestMatch } from '../services/matcher.js';

const router = Router();
router.use(requireAuth);

const POPULATE = { path: 'items.product', select: 'name category price unit priceHistory' };

function withTotals(list) {
  const json = list.toObject ? list.toObject() : list;
  let total = 0;
  json.items = json.items.map((item) => {
    const p = item.product;
    if (p) {
      const history = p.priceHistory || [];
      const previous = history.length > 1 ? history[history.length - 2].price : p.price;
      item.product = { id: p._id, name: p.name, category: p.category, price: p.price, unit: p.unit, change: Math.round((p.price - previous) * 100) / 100 };
      total += p.price * item.quantity;
    }
    return item;
  });
  json.estimatedTotal = Math.round(total * 100) / 100;
  return json;
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'List not found' });
    return null;
  }
  const list = await ShoppingList.findOne({ _id: req.params.id, owner: req.user._id });
  if (!list) res.status(404).json({ error: 'List not found' });
  return list;
}

async function linkProducts(items) {
  const products = await Product.find().lean();
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity || 1,
    product: bestMatch(item.name, products)?._id ?? null,
  }));
}

router.get('/', async (req, res, next) => {
  try {
    const lists = await ShoppingList.find({ owner: req.user._id }).sort({ updatedAt: -1 }).populate(POPULATE);
    res.json({ lists: lists.map(withTotals) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const items = Array.isArray(req.body.items) ? req.body.items.filter((i) => i?.name) : [];
    const list = await ShoppingList.create({ owner: req.user._id, title, items: await linkProducts(items) });
    await list.populate(POPULATE);
    res.status(201).json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/generate { prompt: "healthy breakfast for a week" }
router.post('/generate', async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (prompt.length < 3) return res.status(400).json({ error: 'Describe what you need (at least 3 characters)' });
    const products = await Product.find().lean();
    const generated = await generateList(prompt, products);
    const list = await ShoppingList.create({
      owner: req.user._id,
      title: generated.title,
      prompt,
      items: generated.items.map((item) => ({ ...item, product: bestMatch(item.name, products)?._id ?? null })),
    });
    await list.populate(POPULATE);
    res.status(201).json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    await list.populate(POPULATE);
    res.json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    if (typeof req.body?.title === 'string' && req.body.title.trim()) list.title = req.body.title.trim();
    await list.save();
    await list.populate(POPULATE);
    res.json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    await list.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/items', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Item name is required' });
    const [item] = await linkProducts([{ name, quantity: Number(req.body.quantity) || 1 }]);
    list.items.push(item);
    await list.save();
    await list.populate(POPULATE);
    res.status(201).json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/items/:itemId', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    const item = list.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (typeof req.body?.checked === 'boolean') item.checked = req.body.checked;
    if (Number(req.body?.quantity) >= 1) item.quantity = Math.round(Number(req.body.quantity));
    await list.save();
    await list.populate(POPULATE);
    res.json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const list = await findOwned(req, res);
    if (!list) return;
    const item = list.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    item.deleteOne();
    await list.save();
    await list.populate(POPULATE);
    res.json({ list: withTotals(list) });
  } catch (err) {
    next(err);
  }
});

export default router;
