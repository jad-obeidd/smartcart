import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar navbar-expand bg-white border-bottom">
      <div className="container">
        <Link className="navbar-brand" to="/">🛒 SmartCart</Link>
        <ul className="navbar-nav me-auto">
          {user && (
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>My lists</NavLink>
            </li>
          )}
          <li className="nav-item">
            <NavLink className="nav-link" to="/products">Products</NavLink>
          </li>
        </ul>
        {user ? (
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small d-none d-sm-inline">Hi, {user.name}</span>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link className="btn btn-primary btn-sm" to="/login">Log in</Link>
        )}
      </div>
    </nav>
  );
}
