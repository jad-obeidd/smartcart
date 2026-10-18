const TOKEN_KEY = 'smartcart.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const DEMO = import.meta.env.VITE_DEMO === 'true';

export async function api(path, { method = 'GET', body } = {}) {
  if (DEMO) {
    // Static live demo: the same routes are answered in the browser (see src/demo/backend.js)
    const { demoApi } = await import('../demo/backend.js');
    return demoApi(path, { method, body }, getToken());
  }
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}
