const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

// Utility to read data asynchronously
async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to read data file: ${error.message}`);
  }
}

// Utility to write data asynchronously
async function writeData(data) {
  try {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to write data file: ${error.message}`);
  }
}

// GET /api/items
router.get('/', async (req, res, next) => {
  try {
    const data = await readData();
    const { limit, q, page = 1 } = req.query;
    let results = data;

    // Implement server-side search
    if (q) {
      const searchTerm = q.toLowerCase();
      results = results.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
      );
    }

    // Implement pagination
    const pageSize = parseInt(limit) || 10;
    const pageNumber = parseInt(page);
    const totalItems = results.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const paginatedResults = results.slice(startIndex, endIndex);

    res.json({
      items: paginatedResults,
      pagination: {
        page: pageNumber,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id
router.get('/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const item = data.find(i => i.id === parseInt(req.params.id));
    if (!item) {
      const err = new Error('Item not found');
      err.status = 404;
      throw err;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/items
router.post('/', async (req, res, next) => {
  try {
    // Validate payload
    const { name, category, price } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const err = new Error('Name is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }
    
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      const err = new Error('Category is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }
    
    if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
      const err = new Error('Price is required and must be a non-negative number');
      err.status = 400;
      throw err;
    }

    const item = {
      id: Date.now(), // Simple ID generation - in production, use UUID
      name: name.trim(),
      category: category.trim(),
      price: Number(price)
    };
    
    const data = await readData();
    data.push(item);
    await writeData(data);
    
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

module.exports = router;