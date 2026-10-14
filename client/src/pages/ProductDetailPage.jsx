import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatPrice } from '../api/client.js';
import { useLivePrices } from '../api/useLivePrices.js';
import PriceChart from '../components/PriceChart.jsx';
import PriceChange from '../components/PriceChange.jsx';

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const { prices } = useLivePrices();
  const live = prices[id];

  useEffect(() => {
    api(`/products/${id}`)
      .then((data) => setProduct(data.product))
      .catch((err) => setError(err.message));
  }, [id, live?.at]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!product) return <div className="text-muted">Loading…</div>;

  const history = product.priceHistory;
  const low = Math.min(...history.map((h) => h.price));
  const high = Math.max(...history.map((h) => h.price));

  return (
    <div className="card p-4">
      <Link to="/products" className="small text-decoration-none">← All products</Link>
      <div className="d-flex justify-content-between align-items-start mt-1 mb-3">
        <div>
          <h1 className="h4 mb-0">{product.name}</h1>
          <div className="small text-muted">{product.category} · per {product.unit}</div>
          <div className="mt-2 d-flex flex-wrap gap-1">
            {product.tags.map((t) => (
              <span key={t} className="badge text-bg-light">{t}</span>
            ))}
          </div>
        </div>
        <div className="text-end">
          <div className="h3 mb-0">{formatPrice(product.price)}</div>
          <PriceChange change={product.change} />
        </div>
      </div>
      <PriceChart history={history} />
      <div className="row text-center mt-3 small">
        <div className="col">
          <div className="text-muted">Lowest</div>
          <strong>{formatPrice(low)}</strong>
        </div>
        <div className="col">
          <div className="text-muted">Highest</div>
          <strong>{formatPrice(high)}</strong>
        </div>
        <div className="col">
          <div className="text-muted">Data points</div>
          <strong>{history.length}</strong>
        </div>
      </div>
    </div>
  );
}
