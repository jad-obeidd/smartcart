import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../api/client.js';

const EXAMPLES = ['Taco night for 4', 'Healthy vegan breakfast for the week', 'Pasta dinner on a budget', 'BBQ party'];

export default function ListsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [recs, setRecs] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [listData, recData] = await Promise.all([api('/lists'), api('/products/recommendations')]);
    setLists(listData.lists);
    setRecs(recData.recommendations);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { list } = await api('/lists/generate', { method: 'POST', body: { prompt } });
      navigate(`/lists/${list._id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function createEmpty(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const { list } = await api('/lists', { method: 'POST', body: { title } });
    navigate(`/lists/${list._id}`);
  }

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="card p-4 mb-4">
          <h1 className="h4">✨ Generate a smart list</h1>
          <p className="text-muted small">Describe what you need and SmartCart builds the list and prices it.</p>
          <form onSubmit={generate} className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="e.g. Taco night for 4"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={3}
              required
            />
            <button className="btn btn-primary text-nowrap" disabled={busy}>
              {busy ? 'Generating…' : 'Generate'}
            </button>
          </form>
          <div className="mt-2 d-flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="btn btn-sm btn-light" onClick={() => setPrompt(ex)}>
                {ex}
              </button>
            ))}
          </div>
          {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">My lists</h2>
          <form onSubmit={createEmpty} className="d-flex gap-2">
            <input className="form-control form-control-sm" placeholder="New empty list" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn btn-sm btn-outline-primary">Add</button>
          </form>
        </div>
        {lists.length === 0 ? (
          <p className="text-muted">No lists yet - generate one above.</p>
        ) : (
          <div className="row g-3">
            {lists.map((list) => (
              <div className="col-md-6" key={list._id}>
                <Link to={`/lists/${list._id}`} className="card p-3 h-100 text-decoration-none text-body">
                  <div className="fw-semibold">{list.title}</div>
                  <div className="small text-muted">
                    {list.items.filter((i) => i.checked).length}/{list.items.length} items · est. {formatPrice(list.estimatedTotal)}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col-lg-4">
        <div className="card p-3">
          <h2 className="h6">Recommended for you</h2>
          {recs.length === 0 ? (
            <p className="text-muted small mb-0">Create a list to get personalized picks.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {recs.map(({ product, reason }) => (
                <li key={product.id} className="py-2 border-bottom">
                  <Link to={`/products/${product.id}`} className="fw-semibold text-decoration-none">{product.name}</Link>
                  <span className="float-end">{formatPrice(product.price)}</span>
                  <div className="small text-muted">{reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
