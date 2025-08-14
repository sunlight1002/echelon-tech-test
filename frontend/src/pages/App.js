import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Items from './Items';
import ItemDetail from './ItemDetail';
import { DataProvider } from '../state/DataContext';
import './App.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p>We're sorry, but something unexpected happened.</p>
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
              <summary>Error Details</summary>
              {this.state.error && this.state.error.toString()}
            </details>
            <button 
              onClick={() => window.location.reload()}
              className="error-boundary-button"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Navigation Component
function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="nav-brand-link">
            <span className="nav-brand-icon">📦</span>
            <span className="nav-brand-text">ItemStore</span>
          </Link>
        </div>
        
        <div className="nav-links">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Browse Items
          </Link>
          
          <div className="nav-stats">
            <span className="nav-stats-label">Dashboard</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <div className="app">
        <DataProvider>
          <Navigation />
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Items />} />
              <Route path="/items/:id" element={<ItemDetail />} />
              <Route 
                path="*" 
                element={
                  <div className="not-found">
                    <h2>Page Not Found</h2>
                    <p>The page you're looking for doesn't exist.</p>
                    <Link to="/" className="back-home-link">
                      ← Back to Items
                    </Link>
                  </div>
                } 
              />
            </Routes>
          </main>
          
          <footer className="footer">
            <div className="footer-content">
              <p>&copy; 2024 ItemStore. Demo application for technical assessment.</p>
              <div className="footer-links">
                <span>Performance optimized</span>
                <span>•</span>
                <span>Accessible design</span>
                <span>•</span>
                <span>Responsive layout</span>
              </div>
            </div>
          </footer>
        </DataProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;