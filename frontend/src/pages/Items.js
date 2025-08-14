import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useData } from '../state/DataContext';
import { Link } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import './Items.css';

function Items() {
  const { 
    items, 
    pagination, 
    searchQuery, 
    loading, 
    fetchItems, 
    searchItems, 
    loadPage 
  } = useData();
  
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadInitialItems = async () => {
      try {
        setError(null);
        await fetchItems(abortController.signal, { page: 1, limit: 20 });
      } catch (err) {
        if (isMounted && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load items');
        }
      }
    };

    loadInitialItems();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [fetchItems]);

  // Debounced search
  const handleSearch = useCallback((query) => {
    setLocalSearchQuery(query);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(async () => {
      const abortController = new AbortController();
      try {
        setError(null);
        await searchItems(query, abortController.signal);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Search failed');
        }
      }
    }, 300);
    
    setSearchTimeout(timeout);
  }, [searchItems, searchTimeout]);

  const handlePageChange = useCallback(async (newPage) => {
    const abortController = new AbortController();
    try {
      setError(null);
      await loadPage(newPage, abortController.signal);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load page');
      }
    }
  }, [loadPage]);

  // Item renderer for virtualization
  const ItemRow = useCallback(({ index, style }) => {
    const item = items[index];
    if (!item) return null;

    return (
      <div style={style} className="virtual-item">
        <div className="item-card">
          <Link to={`/items/${item.id}`} className="item-link">
            <div className="item-content">
              <h3 className="item-name">{item.name}</h3>
              <span className="item-category">{item.category}</span>
              <span className="item-price">${item.price}</span>
            </div>
          </Link>
        </div>
      </div>
    );
  }, [items]);

  // Generate pagination buttons
  const paginationButtons = useMemo(() => {
    const buttons = [];
    const { page, totalPages } = pagination;
    
    // Previous button
    if (pagination.hasPrevPage) {
      buttons.push(
        <button 
          key="prev" 
          onClick={() => handlePageChange(page - 1)}
          className="pagination-btn"
          disabled={loading}
        >
          ← Previous
        </button>
      );
    }
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    if (startPage > 1) {
      buttons.push(
        <button 
          key={1} 
          onClick={() => handlePageChange(1)}
          className="pagination-btn"
          disabled={loading}
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(<span key="ellipsis1" className="pagination-ellipsis">...</span>);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-btn ${i === page ? 'active' : ''}`}
          disabled={loading}
        >
          {i}
        </button>
      );
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(<span key="ellipsis2" className="pagination-ellipsis">...</span>);
      }
      buttons.push(
        <button 
          key={totalPages} 
          onClick={() => handlePageChange(totalPages)}
          className="pagination-btn"
          disabled={loading}
        >
          {totalPages}
        </button>
      );
    }
    
    // Next button
    if (pagination.hasNextPage) {
      buttons.push(
        <button 
          key="next" 
          onClick={() => handlePageChange(page + 1)}
          className="pagination-btn"
          disabled={loading}
        >
          Next →
        </button>
      );
    }
    
    return buttons;
  }, [pagination, handlePageChange, loading]);

  if (error) {
    return (
      <div className="error-container">
        <h3>Error Loading Items</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="items-container">
      <header className="items-header">
        <h1>Items</h1>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search items by name or category..."
            value={localSearchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
            disabled={loading}
          />
          {loading && <div className="search-loading">Searching...</div>}
        </div>
      </header>

      <div className="items-info">
        <p>
          Showing {items.length} of {pagination.totalItems} items
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      </div>

      {loading && items.length === 0 ? (
              <div className="loading-container">
        <div className="loading-spinner" data-testid="loading-spinner"></div>
        <p>Loading items...</p>
      </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>No Items Found</h3>
          <p>
            {searchQuery 
              ? `No items match your search for "${searchQuery}"`
              : 'There are no items to display.'
            }
          </p>
          {searchQuery && (
            <button 
              onClick={() => handleSearch('')}
              className="clear-search-btn"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="items-list-container">
            {/* Use virtualization for large lists */}
            {items.length > 50 ? (
              <List
                height={600}
                itemCount={items.length}
                itemSize={120}
                className="virtual-list"
              >
                {ItemRow}
              </List>
            ) : (
                             <div className="items-grid" data-testid="items-grid">
                 {items.map(item => (
                   <div key={item.id} className="item-card">
                     <Link to={`/items/${item.id}`} className="item-link">
                       <div className="item-content">
                         <h3 className="item-name">{item.name}</h3>
                         <span className="item-category">{item.category}</span>
                         <span className="item-price">${item.price}</span>
                       </div>
                     </Link>
                   </div>
                 ))}
               </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <nav className="pagination-container" aria-label="Items pagination">
              <div className="pagination">
                {paginationButtons}
              </div>
              <div className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default Items;