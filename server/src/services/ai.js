import OpenAI from 'openai';
import { tokenize } from './matcher.js';
import { parseSearchFallback, generateListFallback, recommendFallback } from './fallbacks.js';

export { parseSearchFallback, generateListFallback, recommendFallback };

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
