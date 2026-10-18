import { useEffect, useState } from 'react';
import { DEMO } from './client.js';

// Subscribes to the server's Server-Sent Events price feed and keeps a map of
// productId -> latest update, plus a short feed of recent changes.
export function useLivePrices() {
  const [prices, setPrices] = useState({});
  const [feed, setFeed] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const apply = (updates) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const u of updates) next[u.id] = u;
        return next;
      });
      setFeed((prev) => [...updates, ...prev].slice(0, 8));
    };
    if (DEMO) {
      // the demo simulates the price feed in the browser instead of using SSE
      let unsubscribe = () => {};
      let active = true;
      import('../demo/backend.js').then(({ subscribePrices }) => {
        if (!active) return;
        setConnected(true);
        unsubscribe = subscribePrices(apply);
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }
    const source = new EventSource('/api/products/prices/stream');
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('prices', (event) => apply(JSON.parse(event.data)));
    return () => source.close();
  }, []);

  return { prices, feed, connected };
}
