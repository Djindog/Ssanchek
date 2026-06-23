import { supabase } from './supabase';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  return userId ? { 'x-user-id': userId, 'Content-Type': 'application/json' } : {};
}

export async function fetchWishlist() {
  const headers = await authHeaders();
  const res = await fetch('/api/wishlist', { headers });
  return res.json();
}

export async function addToWishlistDB(book) {
  const headers = await authHeaders();
  const res = await fetch('/api/wishlist', {
    method: 'POST',
    headers,
    body: JSON.stringify(book),
  });
  return res.json();
}

export async function removeFromWishlistDB(isbn13) {
  const headers = await authHeaders();
  await fetch(`/api/wishlist?isbn13=${isbn13}`, { method: 'DELETE', headers });
}

export async function updateMustInclude(isbn13, mustInclude) {
  const headers = await authHeaders();
  await fetch('/api/wishlist', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isbn13, mustInclude }),
  });
}

export async function fetchCrawlResult() {
  const headers = await authHeaders();
  const res = await fetch('/api/crawl-result', { headers });
  return res.json();
}

export async function saveCrawlResult(data) {
  const headers = await authHeaders();
  await fetch('/api/crawl-result', {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
}
