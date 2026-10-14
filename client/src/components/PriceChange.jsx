import { formatPrice } from '../api/client.js';

export default function PriceChange({ change }) {
  if (!change) return null;
  const up = change > 0;
  return (
    <small className={up ? 'price-up' : 'price-down'} title="Change since previous price">
      {up ? '▲' : '▼'} {formatPrice(Math.abs(change))}
    </small>
  );
}
