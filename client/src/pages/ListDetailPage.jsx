import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice } from '../api/client.js';
import { useLivePrices } from '../api/useLivePrices.js';
import PriceChange from '../components/PriceChange.jsx';

export default function ListDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [newItem, setNewItem] = useState('');
  const { prices } = useLivePrices();

  useEffect(() => {
    api(`/lists/${id}`)
      .then((data) => setList(data.list))
      .catch((err) => setError(err.message));
  }, [id]);

  async function mutate(path, method, body) {
    try {
      const data = await api(`/lists/${id}${path}`, { method, body });
      setList(data.list);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await mutate('/items', 'POST', { name: newItem });
    setNewItem('');
  }

  async function removeList() {
    if (!window.confirm('Delete this list?')) return;
    await api(`/lists/${id}`, { method: 'DELETE' });
    navigate('/');
  }

  if (error && !list) return <div className="alert alert-danger">{error}</div>;
  if (!list) return <div className="text-muted">Loading…</div>;

  // Merge live price updates into the list so totals move in real time.
  const livePrice = (item) => (item.product && prices[item.product.id]?.price) ?? item.product?.price;
  const total = list.items.reduce((sum, i) => sum + (livePrice(i) || 0) * i.quantity, 0);

  return (
    <div className="card p-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <Link to="/" className="small text-decoration-none">← All lists</Link>
          <h1 className="h4 mt-1 mb-0">{list.title}</h1>
          {list.prompt && <div className="small text-muted">Generated from “{list.prompt}”</div>}
        </div>
        <div className="text-end">
          <div className="small text-muted">Estimated total</div>
          <div className="h4 mb-0">{formatPrice(total)}</div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <ul className="list-group mb-3">
        {list.items.map((item) => {
          const live = item.product && prices[item.product.id];
          return (
            <li key={item._id} className={`list-group-item d-flex align-items-center gap-3 ${live ? 'flash' : ''}`}>
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={item.checked}
                onChange={(e) => mutate(`/items/${item._id}`, 'PATCH', { checked: e.target.checked })}
                aria-label={`Mark ${item.name} as bought`}
              />
              <div className={`flex-grow-1 ${item.checked ? 'list-item-checked' : ''}`}>
                {item.product ? (
                  <Link to={`/products/${item.product.id}`} className="text-reset">{item.product.name}</Link>
                ) : (
                  item.name
                )}
                {!item.product && <span className="badge text-bg-light ms-2">not in catalog</span>}
              </div>
              <input
                type="number"
                min="1"
                className="form-control form-control-sm"
                style={{ width: 70 }}
                value={item.quantity}
                onChange={(e) => mutate(`/items/${item._id}`, 'PATCH', { quantity: Number(e.target.value) })}
                aria-label="Quantity"
              />
              <div className="text-end" style={{ width: 90 }}>
                {item.product ? formatPrice(livePrice(item)) : '-'}
                <div>
                  <PriceChange change={live ? live.price - live.oldPrice : item.product?.change} />
                </div>
              </div>
              <button className="btn btn-sm btn-link text-danger" onClick={() => mutate(`/items/${item._id}`, 'DELETE')} aria-label={`Remove ${item.name}`}>
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <form onSubmit={addItem} className="d-flex gap-2 mb-3">
        <input className="form-control" placeholder="Add an item, e.g. oat milk" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
        <button className="btn btn-outline-primary">Add</button>
      </form>

      <button className="btn btn-outline-danger btn-sm align-self-start" onClick={removeList}>Delete list</button>
    </div>
  );
}
