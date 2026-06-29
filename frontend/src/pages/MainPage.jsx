import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchWishlist, addToWishlistDB, removeFromWishlistDB, fetchCrawlResult, saveCrawlResult } from '../lib/api';
import SearchTab from '../components/SearchTab';
import WishlistTab from '../components/WishlistTab';
import CombinationTab from '../components/CombinationTab';

const TABS = [
  { id: 'search', label: '책 추가' },
  { id: 'wishlist', label: '위시리스트' },
  { id: 'combination', label: '조합' },
];

export default function MainPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [wishlist, setWishlist] = useState([]);
  const [results, setResults] = useState(null);
  const [combinations, setCombinations] = useState(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchWishlist().then(items => {
      if (Array.isArray(items)) setWishlist(items);
    });
    fetchCrawlResult().then(saved => {
      if (saved) setResults(saved);
    });
  }, []);

  async function addBookAndCrawl(book) {
    if (wishlist.find(b => b.isbn13 === book.isbn13)) return;

    setWishlist(prev => [...prev, { ...book, mustInclude: false }]);
    addToWishlistDB(book);
    setActiveTab('wishlist');

    setResults(prev => ({
      ...(prev || {}),
      books: [...(prev?.books || []), { ...book, options: [] }],
      crawling: true,
    }));

    try {
      const lookupRes = await fetch(`/api/lookup?isbn13=${book.isbn13}`);
      const lookupData = await lookupRes.json();
      const usedList = lookupData.usedList;

      const newOption = {
        sellerType: 'new',
        sellerName: '알라딘 새책',
        price: lookupData.priceSales,
        priceStandard: lookupData.priceStandard,
        shipping: 0,
        discount: Math.round((1 - lookupData.priceSales / lookupData.priceStandard) * 100),
        condition: '새책',
        productLink: lookupData.link,
      };

      const urlList = [];
      if (usedList?.aladinUsed?.link) urlList.push({ url: usedList.aladinUsed.link, type: 'aladinUsed', isbn: book.isbn13 });
      if (usedList?.userUsed?.link)   urlList.push({ url: usedList.userUsed.link,   type: 'userUsed',   isbn: book.isbn13 });
      if (usedList?.spaceUsed?.link)  urlList.push({ url: usedList.spaceUsed.link,  type: 'spaceUsed',  isbn: book.isbn13 });

      let crawledOptions = [newOption];
      if (urlList.length > 0) {
        const crawlRes = await fetch('/api/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            books: [{ isbn: book.isbn13, ...Object.fromEntries(urlList.map(u => [u.type + 'Link', u.url])) }],
          }),
        });
        const crawlData = await crawlRes.json();
        crawledOptions = [newOption, ...(crawlData.data?.[0]?.options ?? [])];
      }

      setResults(prev => {
        const updated = {
          ...prev,
          books: (prev?.books || []).map(b =>
            b.isbn13 === book.isbn13 ? { ...b, options: crawledOptions } : b
          ),
          crawling: false,
        };
        saveCrawlResult(updated);
        return updated;
      });
    } catch (e) {
      console.error('크롤링 오류', book.isbn13, e);
      setResults(prev => ({ ...prev, crawling: false }));
    }
  }

  async function bulkAddBooks(isbns, onProgress) {
    const existingSet = new Set(wishlist.map(b => b.isbn13));
    const newIsbns = isbns.filter(isbn => !existingSet.has(isbn));
    const skipped = isbns.length - newIsbns.length;

    if (!newIsbns.length) return { added: 0, skipped, failed: 0 };

    // 배치 조회 (5개씩 병렬)
    const lookupData = [];
    const BATCH = 5;
    for (let i = 0; i < newIsbns.length; i += BATCH) {
      const batch = newIsbns.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(isbn => fetch(`/api/lookup?isbn13=${isbn}`).then(r => r.json()))
      );
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value?.isbn13) lookupData.push(r.value);
      }
      onProgress?.({ done: Math.min(i + BATCH, newIsbns.length), total: newIsbns.length });
    }

    const failed = newIsbns.length - lookupData.length;
    if (!lookupData.length) return { added: 0, skipped, failed };

    const books = lookupData.map(d => ({
      isbn13: d.isbn13, title: d.title, author: d.author,
      publisher: d.publisher, cover: d.cover,
      priceStandard: d.priceStandard, priceSales: d.priceSales, link: d.link,
    }));
    const usedLists = Object.fromEntries(lookupData.map(d => [d.isbn13, d.usedList]));

    // 전체 한번에 위시리스트 추가
    setWishlist(prev => [...prev, ...books.map(b => ({ ...b, mustInclude: false }))]);
    books.forEach(b => addToWishlistDB(b));
    setActiveTab('wishlist');
    setResults(prev => ({
      ...(prev || {}),
      books: [...(prev?.books || []), ...books.map(b => ({ ...b, options: [] }))],
      crawling: true,
    }));

    // 백그라운드에서 순차 크롤
    (async () => {
      for (const book of books) {
        try {
          const usedList = usedLists[book.isbn13];
          const newOption = {
            sellerType: 'new', sellerName: '알라딘 새책',
            price: book.priceSales, priceStandard: book.priceStandard, shipping: 0,
            discount: Math.round((1 - book.priceSales / book.priceStandard) * 100),
            condition: '새책', productLink: book.link,
          };
          const urlList = [];
          if (usedList?.aladinUsed?.link) urlList.push({ url: usedList.aladinUsed.link, type: 'aladinUsed' });
          if (usedList?.userUsed?.link)   urlList.push({ url: usedList.userUsed.link,   type: 'userUsed'   });
          if (usedList?.spaceUsed?.link)  urlList.push({ url: usedList.spaceUsed.link,  type: 'spaceUsed'  });

          let crawledOptions = [newOption];
          if (urlList.length) {
            const crawlRes = await fetch('/api/crawl', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                books: [{ isbn: book.isbn13, ...Object.fromEntries(urlList.map(u => [u.type + 'Link', u.url])) }],
              }),
            });
            const crawlData = await crawlRes.json();
            crawledOptions = [newOption, ...(crawlData.data?.[0]?.options ?? [])];
          }

          setResults(prev => ({
            ...prev,
            books: (prev?.books || []).map(b =>
              b.isbn13 === book.isbn13 ? { ...b, options: crawledOptions } : b
            ),
          }));
        } catch (e) {
          console.error('bulk crawl error', book.isbn13, e);
        }
      }
      setResults(prev => {
        if (!prev) return prev;
        const updated = { ...prev, crawling: false };
        saveCrawlResult(updated);
        return updated;
      });
    })();

    return { added: books.length, skipped, failed };
  }

  async function removeFromWishlist(isbn13) {
    setWishlist(prev => prev.filter(b => b.isbn13 !== isbn13));
    removeFromWishlistDB(isbn13);
    setResults(prev => {
      if (!prev) return prev;
      const updated = { ...prev, books: (prev.books || []).filter(b => b.isbn13 !== isbn13) };
      saveCrawlResult(updated);
      return updated;
    });
  }

  function toggleMustInclude(isbn13, next) {
    setWishlist(prev => prev.map(b => b.isbn13 === isbn13 ? { ...b, mustInclude: next } : b));
  }

  async function handleOptimize(books, constraints) {
    setComboLoading(true);
    setCombinations(null);
    setActiveTab('combination');
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, constraints }),
      });
      const data = await res.json();
      setCombinations(data.results ?? []);
    } catch (e) {
      console.error('optimize 오류', e);
      setCombinations([]);
    } finally {
      setComboLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>싼책</span>
          <span style={styles.headerSub}>알라딘 중고책 최적 구매 조합 분석기</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'wishlist' && wishlist.length > 0 && (
              <span style={styles.badge}>{wishlist.length}</span>
            )}
          </button>
        ))}
      </div>

      <main style={styles.main}>
        {activeTab === 'search' && (
          <SearchTab
            wishlist={wishlist}
            onAdd={addBookAndCrawl}
            onBulkAdd={bulkAddBooks}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            onResultsChange={setSearchResults}
          />
        )}
        {activeTab === 'wishlist' && (
          <WishlistTab
            results={results}
            onRemove={removeFromWishlist}
          />
        )}
        {activeTab === 'combination' && (
          <CombinationTab
            wishlist={wishlist}
            results={results}
            combinations={combinations}
            loading={comboLoading}
            onOptimize={handleOptimize}
            onToggleMust={toggleMustInclude}
          />
        )}
      </main>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', background: '#f9f9f9' },
  header: { background: '#0066cc', color: '#fff' },
  headerInner: {
    maxWidth: '1100px', margin: '0 auto', padding: '12px 24px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  logo: { fontSize: '20px', fontWeight: 'bold' },
  headerSub: { fontSize: '13px', opacity: 0.85, flex: 1 },
  logoutBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '5px 12px', fontSize: '13px' },
  tabBar: { background: '#fff', borderBottom: '2px solid #0066cc', display: 'flex', padding: '0 24px' },
  tab: {
    padding: '12px 24px', background: 'none', color: '#666',
    fontWeight: 'bold', fontSize: '14px',
    borderBottom: '2px solid transparent', marginBottom: '-2px',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  tabActive: { color: '#0066cc', borderBottom: '2px solid #0066cc' },
  badge: {
    background: '#e6003e', color: '#fff', borderRadius: '10px',
    padding: '1px 6px', fontSize: '11px', fontWeight: 'bold',
  },
  main: { maxWidth: '1100px', margin: '0 auto', padding: '24px 60px' },
};
