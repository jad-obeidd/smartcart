import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import App from './App.jsx';
import { AuthProvider } from './api/AuthContext.jsx';
import { DEMO, getToken, setToken } from './api/client.js';

// GitHub Pages has no server-side routing, so the static demo uses hash URLs and
// starts signed in as a guest with two sample lists.
const Router = DEMO ? HashRouter : BrowserRouter;
if (DEMO && !getToken()) setToken('demo.demo-user');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);
