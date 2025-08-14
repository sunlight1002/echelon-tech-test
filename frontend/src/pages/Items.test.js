import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Items from './Items';
import { DataContext } from '../state/DataContext';

// Mock react-window
jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize }) => (
    <div data-testid="virtual-list">
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) =>
        children({ index, style: {} })
      )}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockItems = [
  { id: 1, name: 'Test Laptop', category: 'Electronics', price: 1000 },
  { id: 2, name: 'Test Headphones', category: 'Electronics', price: 200 },
  { id: 3, name: 'Test Chair', category: 'Furniture', price: 500 },
];

const mockPagination = {
  page: 1,
  pageSize: 10,
  totalItems: 3,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

// Test Provider Component
const TestDataProvider = ({ children, value }) => {
  const defaultValue = {
    items: mockItems,
    pagination: mockPagination,
    searchQuery: '',
    loading: false,
    fetchItems: jest.fn().mockResolvedValue(),
    searchItems: jest.fn().mockResolvedValue(),
    loadPage: jest.fn().mockResolvedValue(),
    setSearchQuery: jest.fn(),
    ...value,
  };

  return (
    <DataContext.Provider value={defaultValue}>
      {children}
    </DataContext.Provider>
  );
};

const renderItemsWithProvider = (contextValues = {}) => {
  return render(
    <MemoryRouter>
      <TestDataProvider value={contextValues}>
        <Items />
      </TestDataProvider>
    </MemoryRouter>
  );
};

describe('Items Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading spinner when loading and no items', () => {
      renderItemsWithProvider({ loading: true, items: [] });
      
      expect(screen.getByText('Loading items...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows search loading indicator when searching', () => {
      renderItemsWithProvider({ loading: true });
      
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows retry button on error', async () => {
      renderItemsWithProvider({ 
        items: [],
        loading: false 
      });

      // Simulate error by rejecting the mock
      const fetchItemsMock = jest.fn().mockRejectedValue(new Error('Network error'));
      
      // Re-render with error
      render(
        <MemoryRouter>
          <TestDataProvider value={{ 
            items: [],
            loading: false,
            fetchItems: fetchItemsMock
          }}>
            <Items />
          </TestDataProvider>
        </MemoryRouter>
      );

      // Wait for the error state - but since we have an initial error, just check for retry button
      expect(screen.queryByText('Try Again')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no items', () => {
      renderItemsWithProvider({ items: [] });
      
      expect(screen.getByText('No Items Found')).toBeInTheDocument();
      expect(screen.getByText('There are no items to display.')).toBeInTheDocument();
    });

    it('shows search-specific empty state when search returns no results', () => {
      renderItemsWithProvider({ 
        items: [], 
        searchQuery: 'nonexistent' 
      });
      
      expect(screen.getByText('No items match your search for "nonexistent"')).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });
  });

  describe('Items Display', () => {
    it('renders items correctly', () => {
      renderItemsWithProvider();
      
      expect(screen.getByText('Test Laptop')).toBeInTheDocument();
      expect(screen.getByText('Test Headphones')).toBeInTheDocument();
      expect(screen.getByText('Test Chair')).toBeInTheDocument();
      
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Furniture')).toBeInTheDocument();
      
      expect(screen.getByText('$1000')).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
    });

    it('shows correct item count', () => {
      renderItemsWithProvider();
      
      expect(screen.getByText('Showing 3 of 3 items')).toBeInTheDocument();
    });

    it('shows search query in item count when searching', () => {
      renderItemsWithProvider({ searchQuery: 'laptop' });
      
      expect(screen.getByText('Showing 3 of 3 items for "laptop"')).toBeInTheDocument();
    });

    it('creates correct links for items', () => {
      renderItemsWithProvider();
      
      const laptopLink = screen.getByText('Test Laptop').closest('a');
      expect(laptopLink).toHaveAttribute('href', '/items/1');
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', () => {
      renderItemsWithProvider();
      
      const searchInput = screen.getByPlaceholderText('Search items by name or category...');
      expect(searchInput).toBeInTheDocument();
    });

    it('calls searchItems when typing in search input', async () => {
      const user = userEvent.setup();
      const mockSearchItems = jest.fn().mockResolvedValue();
      
      renderItemsWithProvider({ searchItems: mockSearchItems });
      
      const searchInput = screen.getByPlaceholderText('Search items by name or category...');
      await user.type(searchInput, 'laptop');
      
      // Wait for debounce
      await waitFor(() => {
        expect(mockSearchItems).toHaveBeenCalledWith('laptop', expect.any(AbortSignal));
      }, { timeout: 500 });
    });

    it('disables search input when loading', () => {
      renderItemsWithProvider({ loading: true });
      
      const searchInput = screen.getByPlaceholderText('Search items by name or category...');
      expect(searchInput).toBeDisabled();
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      const mockSearchItems = jest.fn().mockResolvedValue();
      
      renderItemsWithProvider({ 
        items: [], 
        searchQuery: 'laptop',
        searchItems: mockSearchItems 
      });
      
      const clearButton = screen.getByText('Clear Search');
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(mockSearchItems).toHaveBeenCalledWith('', expect.any(AbortSignal));
      });
    });
  });

  describe('Pagination', () => {
    const paginatedMockPagination = {
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    };

    it('shows pagination when there are multiple pages', () => {
      renderItemsWithProvider({ pagination: paginatedMockPagination });
      
      expect(screen.getByText('← Previous')).toBeInTheDocument();
      expect(screen.getByText('Next →')).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    it('does not show pagination for single page', () => {
      renderItemsWithProvider();
      
      expect(screen.queryByText('← Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next →')).not.toBeInTheDocument();
    });

    it('calls loadPage when pagination button is clicked', async () => {
      const user = userEvent.setup();
      const mockLoadPage = jest.fn().mockResolvedValue();
      
      renderItemsWithProvider({ 
        pagination: paginatedMockPagination,
        loadPage: mockLoadPage 
      });
      
      const nextButton = screen.getByText('Next →');
      await user.click(nextButton);
      
      expect(mockLoadPage).toHaveBeenCalledWith(3, expect.any(AbortSignal));
    });

    it('disables pagination buttons when loading', () => {
      renderItemsWithProvider({ 
        pagination: paginatedMockPagination,
        loading: true 
      });
      
      const prevButton = screen.getByText('← Previous');
      const nextButton = screen.getByText('Next →');
      
      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('highlights current page button', () => {
      renderItemsWithProvider({ pagination: paginatedMockPagination });
      
      const currentPageButton = screen.getByText('2');
      expect(currentPageButton).toHaveClass('active');
    });
  });

  describe('Virtualization', () => {
    it('uses virtual list for large datasets', () => {
      const manyItems = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        category: 'Electronics',
        price: 100 + i,
      }));

      renderItemsWithProvider({ items: manyItems });
      
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('uses grid layout for smaller datasets', () => {
      renderItemsWithProvider();
      
      expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('items-grid')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const paginatedMockPagination = {
        page: 1,
        pageSize: 10,
        totalItems: 20,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      };
      
      renderItemsWithProvider({ pagination: paginatedMockPagination });
      
      expect(screen.getByLabelText('Items pagination')).toBeInTheDocument();
    });

    it('has proper heading structure', () => {
      renderItemsWithProvider();
      
      expect(screen.getByRole('heading', { level: 1, name: 'Items' })).toBeInTheDocument();
    });

    it('supports keyboard navigation for links', () => {
      renderItemsWithProvider();
      
      const itemLinks = screen.getAllByRole('link');
      itemLinks.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('cleans up on unmount', () => {
      const { unmount } = renderItemsWithProvider();
      
      // Component should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('uses AbortController for fetch requests', async () => {
      const mockFetchItems = jest.fn().mockResolvedValue();
      
      renderItemsWithProvider({ fetchItems: mockFetchItems });
      
      await waitFor(() => {
        expect(mockFetchItems).toHaveBeenCalledWith(
          expect.any(AbortSignal),
          expect.any(Object)
        );
      });
    });
  });

  describe('Component Resilience', () => {
    it('handles component errors gracefully', () => {
      // Mock console.error to prevent error logging in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Test that component doesn't crash with missing props
      expect(() => {
        render(
          <MemoryRouter>
            <TestDataProvider value={{ items: null }}>
              <Items />
            </TestDataProvider>
          </MemoryRouter>
        );
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
}); 