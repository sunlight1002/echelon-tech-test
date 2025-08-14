const express = require('express');
const fs = require('fs').promises;
const fsWatch = require('fs');
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

// Cache for stats
let statsCache = {
  data: null,
  lastModified: null,
  isCalculating: false
};

// File watcher to invalidate cache
let watcher = null;

function initializeWatcher() {
  if (watcher) {
    watcher.close();
  }
  
  watcher = fsWatch.watchFile(DATA_PATH, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('Data file changed, invalidating stats cache');
      statsCache.data = null;
      statsCache.lastModified = null;
    }
  });
}

// Initialize watcher when module loads
initializeWatcher();

// Calculate stats from items data
function calculateStats(items) {
  if (!items || items.length === 0) {
    return {
      total: 0,
      averagePrice: 0,
      categories: {},
      priceRange: { min: 0, max: 0 }
    };
  }

  const total = items.length;
  const totalPrice = items.reduce((acc, cur) => acc + (cur.price || 0), 0);
  const averagePrice = totalPrice / total;
  
  // Calculate category distribution
  const categories = items.reduce((acc, item) => {
    const category = item.category || 'Unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate price range
  const prices = items.map(item => item.price || 0);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };

  return {
    total,
    averagePrice: Math.round(averagePrice * 100) / 100, // Round to 2 decimal places
    categories,
    priceRange
  };
}

// Get file modification time
async function getFileModTime() {
  try {
    const stats = await fs.stat(DATA_PATH);
    return stats.mtime.getTime();
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
}

// Read and calculate stats with caching
async function getStats() {
  try {
    const currentModTime = await getFileModTime();
    
    // Return cached data if it's still valid
    if (statsCache.data && statsCache.lastModified === currentModTime) {
      return statsCache.data;
    }
    
    // Prevent concurrent calculations
    if (statsCache.isCalculating) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100));
      return getStats();
    }
    
    statsCache.isCalculating = true;
    
    try {
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const items = JSON.parse(raw);
      const stats = calculateStats(items);
      
      // Update cache
      statsCache.data = stats;
      statsCache.lastModified = currentModTime;
      statsCache.isCalculating = false;
      
      return stats;
    } catch (error) {
      statsCache.isCalculating = false;
      throw error;
    }
  } catch (error) {
    statsCache.isCalculating = false;
    throw new Error(`Failed to calculate stats: ${error.message}`);
  }
}

// GET /api/stats
router.get('/', async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Cleanup on module unload
process.on('exit', () => {
  if (watcher) {
    watcher.close();
  }
});

module.exports = router;