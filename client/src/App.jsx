import { Navigate, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import { useAuth } from './api/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ListsPage from './pages/ListsPage.jsx';
import ListDetailPage from './pages/ListDetailPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-5 text-muted">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container py-4">
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/" element={<RequireAuth><ListsPage /></RequireAuth>} />
          <Route path="/lists/:id" element={<RequireAuth><ListDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
