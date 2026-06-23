import 'dotenv/config';
import express from 'express';

import searchHandler from './api/search.js';
import lookupHandler from './api/lookup.js';
import crawlHandler from './api/crawl.js';
import wishlistHandler from './api/wishlist.js';
import crawlResultHandler from './api/crawl-result.js';
import optimizeHandler from './api/optimize.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/search', (req, res) => searchHandler(req, res));
app.get('/api/lookup', (req, res) => lookupHandler(req, res));
app.post('/api/crawl', (req, res) => crawlHandler(req, res));
app.get('/api/wishlist', (req, res) => wishlistHandler(req, res));
app.post('/api/wishlist', (req, res) => wishlistHandler(req, res));
app.delete('/api/wishlist', (req, res) => wishlistHandler(req, res));
app.patch('/api/wishlist', (req, res) => wishlistHandler(req, res));
app.get('/api/crawl-result', (req, res) => crawlResultHandler(req, res));
app.post('/api/crawl-result', (req, res) => crawlResultHandler(req, res));
app.post('/api/optimize', (req, res) => optimizeHandler(req, res));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
