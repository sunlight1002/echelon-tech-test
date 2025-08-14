import React, { createContext, useCallback, useContext, useState } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async (signal, options = {}) => {
    const { page = 1, limit = 10, q = '' } = options;
    
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(q && { q })
      });
      
      const response = await fetch(
        `http://localhost:5000/api/items?${params}`,
        { signal }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle both old and new API response formats
      if (data.items && data.pagination) {
        setItems(data.items);
        setPagination(data.pagination);
      } else {
        // Fallback for old format
        setItems(Array.isArray(data) ? data : []);
        setPagination({
          page: 1,
          pageSize: Array.isArray(data) ? data.length : 0,
          totalItems: Array.isArray(data) ? data.length : 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        });
      }
      
      setSearchQuery(q);
      setLoading(false);
      
    } catch (error) {
      setLoading(false);
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch items:', error);
        throw error;
      }
    }
  }, []);

  const searchItems = useCallback(async (query, signal) => {
    return fetchItems(signal, { page: 1, limit: pagination.pageSize, q: query });
  }, [fetchItems, pagination.pageSize]);

  const loadPage = useCallback(async (page, signal) => {
    return fetchItems(signal, { page, limit: pagination.pageSize, q: searchQuery });
  }, [fetchItems, pagination.pageSize, searchQuery]);

  const value = {
    items,
    pagination,
    searchQuery,
    loading,
    fetchItems,
    searchItems,
    loadPage,
    setSearchQuery
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};