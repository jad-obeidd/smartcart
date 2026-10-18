// In-browser backend for the static live demo (built with VITE_DEMO=true).
// It answers the same /api routes as the Express server, using the server's own
// rule-based search, list generation and recommendation code, and keeps data in
// localStorage so the demo needs no server, database or API key.
import { catalog } from '../../../server/src/catalog.js';
import { bestMatch, scoreProduct } from '../../../server/src/services/matcher.js';
import { parseSearchFallback, generateListFallback, recommendFallback } from '../../../server/src/services/fallbacks.js';
import { nextPrice } from '../../../server/src/services/pricing.js';

const KEY = 'smartcart.demo.v1';
const DEMO_USER = { id: 'demo-user', name: 'Guest', email: 'guest@smartcart.demo' };
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const round = (n) => Math.round(n * 100) / 100;

function freshDb() {
  const start = Date.now() - 6 * 86400000;
  const products = catalog.map((c) => {
    // a few days of simulated history so charts and price changes look alive
    let price = c.price;
    const priceHistory = [];
    for (let d = 0; d < 6; d++) {
      priceHistory.push({ price, at: new Date(start + d * 86400000).toISOString() });
      price = nextPrice(price, c.price);
    }
    priceHistory.push({ price, at: new Date().toISOString() });
    return { _id: id(), ...c, basePrice: c.price, price, priceHistory };
  });
  const db = { products, users: [{ ...DEMO_USER, password: 'demo' }], lists: [] };
  for (const prompt of ['taco night for 4', 'healthy breakfast for a week']) {
    const generated = generateListFallback(prompt, products);
    db.lists.push(makeList(db, DEMO_USER.id, generated.title, generated.items, prompt));
  }
  return db;
}

let db;
function load() {
  if (db) return db;
  try {
    db = JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    db = null;
  }
  if (!db?.products?.length) {
    db = freshDb();
    save();
  }
  return db;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {}
}

function makeList(store, owner, title, items, prompt = '') {
  const now = new Date().toISOString();
  return {
    _id: id(),
    owner,
    title,
    prompt,
    items: items.map((i) => ({
      _id: id(),
      name: i.name,
      quantity: i.quantity || 1,
      checked: false,
      product: bestMatch(i.name, store.products)?._id ?? null,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function summary(p) {
  const h = p.priceHistory || [];
  const previous = h.length > 1 ? h[h.length - 2].price : p.price;
  return { id: p._id, name: p.name, category: p.category, unit: p.unit, price: p.price, previousPrice: previous, change: round(p.price - previous), tags: p.tags };
}

function withTotals(list) {
  let total = 0;
  const items = list.items.map((item) => {
    const p = db.products.find((x) => x._id === item.product);
    if (!p) return { ...item, product: null };
    total += p.price * item.quantity;
    const s = summary(p);
    return { ...item, product: { id: s.id, name: s.name, category: s.category, price: s.price, unit: s.unit, change: s.change } };
  });
  return { ...list, items, estimatedTotal: round(total) };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function currentUser(token) {
  const user = db.users.find((u) => `demo.${u.id}` === token);
  if (!user) throw new HttpError(401, 'Please log in');
  return user;
}

const ok = (data) => JSON.parse(JSON.stringify(data));

export async function demoApi(path, { method = 'GET', body } = {}, token) {
  load();
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const parts = route.split('/').filter(Boolean);

  // ---- auth ----
  if (parts[0] === 'auth') {
    if (parts[1] === 'register' && method === 'POST') {
      const { name, email, password } = body || {};
      if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8)
        throw new HttpError(400, 'Name, a valid email and a password of at least 8 characters are required');
      if (db.users.some((u) => u.email === email.toLowerCase())) throw new HttpError(409, 'An account with this email already exists');
      const user = { id: id(), name: name.trim(), email: email.toLowerCase(), password };
      db.users.push(user);
      save();
      return ok({ token: `demo.${user.id}`, user: { id: user.id, name: user.name, email: user.email } });
    }
    if (parts[1] === 'login' && method === 'POST') {
      const user = db.users.find((u) => u.email === String(body?.email || '').toLowerCase() && u.password === body?.password);
      if (!user) throw new HttpError(401, 'Invalid email or password');
      return ok({ token: `demo.${user.id}`, user: { id: user.id, name: user.name, email: user.email } });
    }
    if (parts[1] === 'me') {
      const u = currentUser(token);
      return ok({ user: { id: u.id, name: u.name, email: u.email } });
    }
  }

  // ---- products ----
  if (parts[0] === 'products') {
    if (parts[1] === 'categories') return ok({ categories: [...new Set(db.products.map((p) => p.category))].sort() });
    if (parts[1] === 'recommendations') {
      const user = currentUser(token);
      const names = [...new Set(db.lists.filter((l) => l.owner === user.id).flatMap((l) => l.items.map((i) => i.name)))];
      const recs = recommendFallback(names, db.products);
      return ok({ recommendations: recs.map((r) => ({ product: summary(r.product), reason: r.reason })) });
    }
    if (parts[1]) {
      const p = db.products.find((x) => x._id === parts[1]);
      if (!p) throw new HttpError(404, 'Product not found');
      return ok({ product: { ...summary(p), priceHistory: p.priceHistory } });
    }
    const q = (params.get('q') || '').trim();
    if (!q) return ok({ filters: null, products: db.products.map(summary).sort((a, b) => a.name.localeCompare(b.name)) });
    const filters = parseSearchFallback(q, [...new Set(db.products.map((p) => p.category))]);
    const results = db.products
      .filter((p) => !filters.category || p.category === filters.category)
      .filter((p) => filters.maxPrice == null || p.price <= filters.maxPrice)
      .filter((p) => filters.minPrice == null || p.price >= filters.minPrice)
      .map((p) => ({ p, s: filters.keywords.length ? scoreProduct(p, filters.keywords) : 1 }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
      .map((r) => summary(r.p));
    return ok({ filters, products: results });
  }

  // ---- lists ----
  if (parts[0] === 'lists') {
    const user = currentUser(token);
    const mine = () => db.lists.filter((l) => l.owner === user.id);
    const touch = (list) => {
      list.updatedAt = new Date().toISOString();
      save();
      return ok({ list: withTotals(list) });
    };
    if (!parts[1]) {
      if (method === 'GET') return ok({ lists: mine().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(withTotals) });
      const title = String(body?.title || '').trim();
      if (!title) throw new HttpError(400, 'Title is required');
      const list = makeList(db, user.id, title, (body.items || []).filter((i) => i?.name));
      db.lists.push(list);
      return touch(list);
    }
    if (parts[1] === 'generate') {
      const prompt = String(body?.prompt || '').trim();
      if (prompt.length < 3) throw new HttpError(400, 'Describe what you need (at least 3 characters)');
      const generated = generateListFallback(prompt, db.products);
      const list = makeList(db, user.id, generated.title, generated.items, prompt);
      db.lists.push(list);
      return touch(list);
    }
    const list = mine().find((l) => l._id === parts[1]);
    if (!list) throw new HttpError(404, 'List not found');
    if (parts[2] === 'items') {
      if (!parts[3]) {
        const name = String(body?.name || '').trim();
        if (!name) throw new HttpError(400, 'Item name is required');
        list.items.push(makeList(db, user.id, '', [{ name, quantity: Number(body.quantity) || 1 }]).items[0]);
        return touch(list);
      }
      const item = list.items.find((i) => i._id === parts[3]);
      if (!item) throw new HttpError(404, 'Item not found');
      if (method === 'DELETE') list.items = list.items.filter((i) => i !== item);
      else {
        if (typeof body?.checked === 'boolean') item.checked = body.checked;
        if (Number(body?.quantity) >= 1) item.quantity = Math.round(Number(body.quantity));
      }
      return touch(list);
    }
    if (method === 'DELETE') {
      db.lists = db.lists.filter((l) => l !== list);
      save();
      return null;
    }
    if (method === 'PATCH' && typeof body?.title === 'string' && body.title.trim()) list.title = body.title.trim();
    return touch(list);
  }

  throw new HttpError(404, 'Not found');
}

// ---- simulated live price feed (replaces the Server-Sent Events stream) ----
const listeners = new Set();
let timer = null;
function tick() {
  load();
  const picks = [...db.products].sort(() => Math.random() - 0.5).slice(0, 5);
  const updates = [];
  for (const p of picks) {
    const old = p.price;
    p.price = nextPrice(p.price, p.basePrice);
    if (p.price === old) continue;
    p.priceHistory = [...p.priceHistory, { price: p.price, at: new Date().toISOString() }].slice(-30);
    updates.push({ id: p._id, name: p.name, oldPrice: old, price: p.price, at: new Date().toISOString() });
  }
  if (!updates.length) return;
  save();
  listeners.forEach((fn) => fn(updates));
}

export function subscribePrices(fn) {
  listeners.add(fn);
  if (!timer) timer = setInterval(tick, 4000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export const DEMO_TOKEN = `demo.${DEMO_USER.id}`;
