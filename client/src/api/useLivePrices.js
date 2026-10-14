import { useEffect, useState } from 'react';

// Subscribes to the server's Server-Sent Events price feed and keeps a map of
// productId -> latest update, plus a short feed of recent changes.
export function useLivePrices() {
  const [prices, setPrices] = useState({});
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource('/api/products/prices/stream');
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('prices', (event) => {
      const updates = JSON.parse(event.data);
      setPrices((prev) => {
        const next = { ...prev };
        for (const u of updates) next[u.id] = u;
        return next;
      });
      setFeed((prev) => [...updates, ...prev].slice(0, 8));
    });
    return () => source.close();
  }, []);

  return { prices, feed, connected };
}
