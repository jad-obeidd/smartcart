import { formatPrice } from '../api/client.js';

// Small dependency-free SVG line chart of a product's price history.
export default function PriceChart({ history, width = 560, height = 180 }) {
  if (!history || history.length < 2) {
    return <p className="text-muted small mb-0">Not enough price history yet - updates arrive every few seconds.</p>;
  }
  const pad = 28;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const x = (i) => pad + (i / (history.length - 1)) * (width - pad * 2);
  const y = (p) => height - pad - ((p - min) / range) * (height - pad * 2);
  const points = history.map((h, i) => `${x(i)},${y(h.price)}`).join(' ');
  const last = history[history.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-100" role="img" aria-label="Price history chart">
      <line x1={pad} x2={width - pad} y1={y(max)} y2={y(max)} stroke="#e4e7ec" />
      <line x1={pad} x2={width - pad} y1={y(min)} y2={y(min)} stroke="#e4e7ec" />
      <text x={pad} y={y(max) - 6} fontSize="11" fill="#667085">{formatPrice(max)}</text>
      <text x={pad} y={y(min) + 14} fontSize="11" fill="#667085">{formatPrice(min)}</text>
      <polyline points={points} fill="none" stroke="#0d6efd" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(history.length - 1)} cy={y(last.price)} r="4" fill="#0d6efd" />
    </svg>
  );
}
