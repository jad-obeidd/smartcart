import { tokenize, scoreProduct } from './matcher.js';

// Rule-based versions of the AI features. They have no server dependencies, so the
// API uses them when OPENAI_API_KEY is missing and the browser demo runs them directly.

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
