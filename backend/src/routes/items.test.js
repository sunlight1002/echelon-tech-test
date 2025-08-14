const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const itemsRouter = require('./items');

// Mock data
const mockItems = [
  { "id": 1, "name": "Test Laptop", "category": "Electronics", "price": 1000 },
  { "id": 2, "name": "Test Headphones", "category": "Electronics", "price": 200 },
  { "id": 3, "name": "Test Chair", "category": "Furniture", "price": 500 }
];

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/items', itemsRouter);
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  }
}));

describe('Items API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation
    fs.readFile.mockResolvedValue(JSON.stringify(mockItems));
    fs.writeFile.mockResolvedValue();
  });

  describe('GET /api/items', () => {
    it('should return all items with pagination info', async () => {
      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(3);
      expect(response.body.pagination.totalItems).toBe(3);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should filter items by search query', async () => {
      const response = await request(app)
        .get('/api/items?q=laptop')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Test Laptop');
    });

    it('should filter items by category', async () => {
      const response = await request(app)
        .get('/api/items?q=Electronics')
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items.every(item => item.category === 'Electronics')).toBe(true);
    });

    it('should implement pagination correctly', async () => {
      const response = await request(app)
        .get('/api/items?limit=2&page=1')
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.pagination.pageSize).toBe(2);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(false);
    });

    it('should handle pagination for second page', async () => {
      const response = await request(app)
        .get('/api/items?limit=2&page=2')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.hasNextPage).toBe(false);
      expect(response.body.pagination.hasPrevPage).toBe(true);
    });

    it('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get('/api/items')
        .expect(500);

      expect(response.body.error).toContain('Failed to read data file');
    });

    it('should handle invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const response = await request(app)
        .get('/api/items')
        .expect(500);

      expect(response.body.error).toContain('Failed to read data file');
    });
  });

  describe('GET /api/items/:id', () => {
    it('should return a specific item by ID', async () => {
      const response = await request(app)
        .get('/api/items/1')
        .expect(200);

      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Test Laptop');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/api/items/999')
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should handle invalid ID format', async () => {
      const response = await request(app)
        .get('/api/items/abc')
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });

    it('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get('/api/items/1')
        .expect(500);

      expect(response.body.error).toContain('Failed to read data file');
    });
  });

  describe('POST /api/items', () => {
    const validItem = {
      name: 'New Product',
      category: 'Electronics',
      price: 299
    };

    it('should create a new item successfully', async () => {
      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Product');
      expect(response.body.category).toBe('Electronics');
      expect(response.body.price).toBe(299);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should trim whitespace from name and category', async () => {
      const itemWithSpaces = {
        name: '  Spaced Product  ',
        category: '  Electronics  ',
        price: 299
      };

      const response = await request(app)
        .post('/api/items')
        .send(itemWithSpaces)
        .expect(201);

      expect(response.body.name).toBe('Spaced Product');
      expect(response.body.category).toBe('Electronics');
    });

    it('should validate required name field', async () => {
      const invalidItem = { category: 'Electronics', price: 299 };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Name is required');
    });

    it('should validate name is not empty string', async () => {
      const invalidItem = { name: '', category: 'Electronics', price: 299 };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Name is required');
    });

    it('should validate name is not just whitespace', async () => {
      const invalidItem = { name: '   ', category: 'Electronics', price: 299 };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Name is required');
    });

    it('should validate required category field', async () => {
      const invalidItem = { name: 'Product', price: 299 };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Category is required');
    });

    it('should validate required price field', async () => {
      const invalidItem = { name: 'Product', category: 'Electronics' };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Price is required');
    });

    it('should validate price is a number', async () => {
      const invalidItem = { name: 'Product', category: 'Electronics', price: 'expensive' };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Price is required and must be a non-negative number');
    });

    it('should validate price is not negative', async () => {
      const invalidItem = { name: 'Product', category: 'Electronics', price: -100 };

      const response = await request(app)
        .post('/api/items')
        .send(invalidItem)
        .expect(400);

      expect(response.body.error).toContain('Price is required and must be a non-negative number');
    });

    it('should allow price of zero', async () => {
      const freeItem = { name: 'Free Product', category: 'Electronics', price: 0 };

      const response = await request(app)
        .post('/api/items')
        .send(freeItem)
        .expect(201);

      expect(response.body.price).toBe(0);
    });

    it('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .expect(500);

      expect(response.body.error).toContain('Failed to read data file');
    });

    it('should handle file write errors', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write permission denied'));

      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .expect(500);

      expect(response.body.error).toContain('Failed to write data file');
    });

    it('should handle malformed JSON in data file', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const response = await request(app)
        .post('/api/items')
        .send(validItem)
        .expect(500);

      expect(response.body.error).toContain('Failed to read data file');
    });
  });
}); 