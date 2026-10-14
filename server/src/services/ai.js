import OpenAI from 'openai';
import { tokenize, scoreProduct } from './matcher.js';

// The OpenAI client is optional: without OPENAI_API_KEY every feature falls back to a
// rule-based implementation, so the app still works for local development and tests.
let client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function setAIClient(newClient) {
  client = newClient;
}

export function aiEnabled() {
  return Boolean(client);
}

async function askJSON(system, user) {
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

// ---------------------------------------------------------------------------
// Natural-language search: "cheap vegan snacks under $5" -> structured filters
// ---------------------------------------------------------------------------

export function parseSearchFallback(query, categories) {
  const text = String(query).toLowerCase();
  const filters = { keywords: [], category: null, minPrice: null, maxPrice: null };

  const max = text.match(/(?:under|below|less than|max|cheaper than|<)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (max) filters.maxPrice = Number(max[1]);
  const min = text.match(/(?:over|above|more than|min|>)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (min) filters.minPrice = Number(min[1]);

  const cleaned = text.replace(/(under|below|less than|max|cheaper than|over|above|more than|min)\s*\$?\s*\d+(\.\d+)?/g, ' ');
  let tokens = tokenize(cleaned).filter((t) => !/^\d+$/.test(t));

  const category = categories.find((c) => tokens.includes(tokenize(c)[0]));
  if (category) {
    filters.category = category;
    const catToken = tokenize(category)[0];
    tokens = tokens.filter((t) => t !== catToken);
  }
  filters.keywords = tokens;
  return filters;
}

export async function parseSearchQuery(query, categories) {
  if (!client) return parseSearchFallback(query, categories);
  try {
    const out = await askJSON(
      'You convert grocery search queries into JSON filters. Reply with JSON: ' +
        '{"keywords": string[], "category": string|null, "minPrice": number|null, "maxPrice": number|null}. ' +
        `category must be one of: ${categories.join(', ')} or null. Keywords are short singular nouns or attributes.`,
      query
    );
    return {
      keywords: Array.isArray(out.keywords) ? out.keywords.flatMap(tokenize) : [],
      category: categories.includes(out.category) ? out.category : null,
      minPrice: typeof out.minPrice === 'number' ? out.minPrice : null,
      maxPrice: typeof out.maxPrice === 'number' ? out.maxPrice : null,
    };
  } catch (err) {
    console.warn('AI search parsing failed, using fallback:', err.message);
    return parseSearchFallback(query, categories);
  }
}

// ---------------------------------------------------------------------------
// Smart list generation: "taco night for 4" -> [{ name, quantity }]
// ---------------------------------------------------------------------------

export function generateListFallback(prompt, products, maxItems = 8) {
  const tokens = tokenize(prompt);
  const ranked = products
    .map((p) => ({ p, s: scoreProduct(p, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
    .slice(0, maxItems);
  return {
    title: prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt,
    items: ranked.map(({ p }) => ({ name: p.name, quantity: 1 })),
  };
}

export async function generateList(prompt, products) {
  if (!client) return generateListFallback(prompt, products);
  try {
    const catalog = products.map((p) => `${p.name} (${p.category}, $${p.price})`).join('\n');
    const out = await askJSON(
      'You are a shopping assistant. Build a practical shopping list for the user request, ' +
        'preferring items from the catalog. Reply with JSON: ' +
        '{"title": string, "items": [{"name": string, "quantity": number}]}. Max 15 items.\n\nCatalog:\n' +
        catalog,
      prompt
    );
    const items = (Array.isArray(out.items) ? out.items : [])
      .filter((i) => i && typeof i.name === 'string' && i.name.trim())
      .slice(0, 15)
      .map((i) => ({ name: i.name.trim(), quantity: Math.max(1, Math.round(Number(i.quantity) || 1)) }));
    if (!items.length) return generateListFallback(prompt, products);
    return { title: String(out.title || prompt).slice(0, 120), items };
  } catch (err) {
    console.warn('AI list generation failed, using fallback:', err.message);
    return generateListFallback(prompt, products);
  }
}

// ---------------------------------------------------------------------------
// Personalized recommendations based on what the user already buys
// ---------------------------------------------------------------------------

export function recommendFallback(listItemNames, products, limit = 6) {
  const owned = new Set(listItemNames.map((n) => n.toLowerCase()));
  const tokens = listItemNames.flatMap(tokenize);
  const categoryCounts = {};
  for (const p of products) {
    if (owned.has(p.name.toLowerCase())) categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  return products
    .filter((p) => !owned.has(p.name.toLowerCase()))
    .map((p) => ({ p, s: (categoryCounts[p.category] || 0) * 2 + scoreProduct(p, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
    .slice(0, limit)
    .map(({ p }) => ({ product: p, reason: `Popular with your ${p.category.toLowerCase()} picks` }));
}

export async function recommend(listItemNames, products, limit = 6) {
  if (!client || !listItemNames.length) return recommendFallback(listItemNames, products, limit);
  try {
    const catalog = products.map((p) => p.name).join(', ');
    const out = await askJSON(
      `Recommend up to ${limit} products from the catalog that complement what the user usually buys. ` +
        'Do not recommend items they already have. Reply with JSON: ' +
        '{"recommendations": [{"name": string, "reason": string}]}.\n\nCatalog: ' +
        catalog,
      `User's items: ${listItemNames.join(', ')}`
    );
    const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]));
    const recs = (out.recommendations || [])
      .map((r) => ({ product: byName.get(String(r.name).toLowerCase()), reason: String(r.reason || '') }))
      .filter((r) => r.product)
      .slice(0, limit);
    return recs.length ? recs : recommendFallback(listItemNames, products, limit);
  } catch (err) {
    console.warn('AI recommendations failed, using fallback:', err.message);
    return recommendFallback(listItemNames, products, limit);
  }
}
