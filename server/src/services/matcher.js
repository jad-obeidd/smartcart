// Helpers for matching free-text item names (from users or the AI) to catalog products.

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'for', 'with', 'some', 'to', 'in', 'on', 'my', 'me', 'i',
  'need', 'want', 'buy', 'get', 'find', 'show', 'cheap', 'under', 'below', 'over', 'above',
  'less', 'more', 'than', 'about', 'around', 'please', 'any', 'items', 'item', 'stuff',
]);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(singular);
}

function singular(word) {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es') && /(ch|sh|x|o)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function productTokens(product) {
  return new Set([
    ...tokenize(product.name),
    ...tokenize(product.category),
    ...(product.tags || []).flatMap(tokenize),
  ]);
}

// Score how well a product matches a list of query tokens. Name hits count double.
export function scoreProduct(product, tokens) {
  if (!tokens.length) return 0;
  const nameTokens = new Set(tokenize(product.name));
  const allTokens = productTokens(product);
  let score = 0;
  for (const t of tokens) {
    if (nameTokens.has(t)) score += 2;
    else if (allTokens.has(t)) score += 1;
  }
  return score / tokens.length;
}

export function bestMatch(name, products) {
  const tokens = tokenize(name);
  let best = null;
  let bestScore = 0;
  for (const p of products) {
    const s = scoreProduct(p, tokens);
    if (s > bestScore || (s === bestScore && best && s > 0 && p.price < best.price)) {
      best = p;
      bestScore = s;
    }
  }
  return bestScore >= 1 ? best : null;
}
