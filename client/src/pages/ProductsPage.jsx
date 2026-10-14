import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatPrice } from '../api/client.js';
import { useLivePrices } from '../api/useLivePrices.js';
import PriceChange from '../components/PriceChange.jsx';

function describeFilters(filters) {
  if (!filters) return null;
  const parts = [];
  if (filters.keywords?.length) parts.push(`matching “${filters.keywords.join(' ')}”`);
  if (filters.category) parts.push(`in ${filters.category}`);
  if (filters.minPrice != null) parts.push(`over ${formatPrice(filters.minPrice)}`);
  if (filters.maxPrice != null) parts.push(`under ${formatPrice(filters.maxPrice)}`);
  return parts.length ? `Showing products ${parts.join(', ')}` : null;
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);
  const [result, setResult] = useState({ products: [], filters: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { prices, feed, connected } = useLivePrices();

  useEffect(() => {
    setLoading(true);
    api(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q]);

  function search(e) {
    e.preventDefault();
    setParams(query.trim() ? { q: query.trim() } : {});
  }

  const summary = describeFilters(result.filters);

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <form onSubmit={search} className="d-flex gap-2 mb-2">
          <input
            className="form-control"
            placeholder='Try "healthy snacks under $5" or "vegan protein"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary">Search</button>
        </form>
        {summary && <p className="small text-muted">{summary}</p>}
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : result.products.length === 0 ? (
          <p className="text-muted">No products found.</p>
        ) : (
          <div className="card">
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-end">Price</th>
                </tr>
              </thead>
              <tbody>
                {result.products.map((p) => {
                  const live = prices[p.id];
                  return (
                    <tr key={p.id} className={live ? 'flash' : ''}>
                      <td>
                        <Link to={`/products/${p.id}`} className="text-decoration-none">{p.name}</Link>
                        <span className="text-muted small"> / {p.unit}</span>
                      </td>
                      <td className="small">{p.category}</td>
                      <td className="text-end">
                        {formatPrice(live?.price ?? p.price)}{' '}
                        <PriceChange change={live ? live.price - live.oldPrice : p.change} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="col-lg-4">
        <div className="card p-3">
          <h2 className="h6">
            <span className={`live-dot ${connected ? 'on' : ''}`} />
            Live price feed
          </h2>
          {feed.length === 0 ? (
            <p className="small text-muted mb-0">Waiting for price changes…</p>
          ) : (
            <ul className="list-unstyled small mb-0">
              {feed.map((u, i) => (
                <li key={`${u.id}-${u.at}-${i}`} className="py-1 border-bottom">
                  {u.name}: {formatPrice(u.oldPrice)} → <strong>{formatPrice(u.price)}</strong>{' '}
                  <PriceChange change={u.price - u.oldPrice} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
