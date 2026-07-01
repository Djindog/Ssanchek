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
  const TOAST_KEY = 'ssanchek_toast_v1';
  const [showToast, setShowToast] = useState(() => !localStorage.getItem(TOAST_KEY));

  function dismissToast() {
    localStorage.setItem(TOAST_KEY, '1');
    setShowToast(false);
  }

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
    // ISBN13 타입은 바로 필터, ISBN(10자리) 타입은 lookup 후 중복 확인
    const toFetch = isbns.filter(({ value, type }) => type !== 'ISBN13' || !existingSet.has(value));
    const preSkipped = isbns.length - toFetch.length;

    if (!toFetch.length) return { added: 0, skipped: preSkipped, failed: 0 };

    // 배치 조회 (5개씩 병렬)
    const lookupData = [];
    const failedItems = []; // { value, reason }
    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async ({ value, type }) => {
          const param = type === 'ISBN13' ? `isbn13=${value}` : `isbn=${value}`;
          const res = await fetch(`/api/lookup?${param}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          return data;
        })
      );
      for (let j = 0; j < settled.length; j++) {
        const r = settled[j];
        const { value, title: xlsTitle } = batch[j];
        if (r.status === 'rejected') {
          failedItems.push({ value, title: xlsTitle || null, reason: r.reason?.message || '네트워크 오류' });
          continue;
        }
        const d = r.value;
        if (d.isbn13) {
          lookupData.push(d);
        } else if (d.subInfo?.usedList || d.usedList) {
          // U-접두어 중고 ID 등 isbn13이 비어있을 때: usedList 링크에서 알라딘 ItemId 추출 후 재조회
          const usedList = d.usedList ?? d.subInfo?.usedList;
          const anyLink = usedList?.aladinUsed?.link || usedList?.userUsed?.link || usedList?.spaceUsed?.link;
          const m = anyLink?.match(/[?&]ItemId=(\d+)/i);
          if (m) {
            try {
              const retry = await fetch(`/api/lookup?itemId=${m[1]}`).then(r2 => r2.json());
              if (retry?.isbn13) { lookupData.push(retry); continue; }
            } catch { /* fall through */ }
          }
          failedItems.push({ value, title: xlsTitle || d.title || null, reason: 'ISBN13 식별 불가' });
        } else {
          failedItems.push({ value, title: xlsTitle || d.title || null, reason: d.error || '책을 찾을 수 없음' });
        }
      }
      onProgress?.({ done: Math.min(i + BATCH, toFetch.length), total: toFetch.length });
    }

    // lookup 후 isbn13 기준 중복 재확인 (ISBN 10자리로 조회한 경우)
    const newLookupData = lookupData.filter(d => !existingSet.has(d.isbn13));
    const skipped = preSkipped + (lookupData.length - newLookupData.length);
    Object.assign(lookupData, newLookupData);
    lookupData.length = newLookupData.length;
    if (!lookupData.length) return { added: 0, skipped, failed: failedItems.length, failedItems };

    const books = lookupData.map(d => ({
      isbn13: d.isbn13, title: d.title, author: d.author,
      publisher: d.publisher, cover: d.cover,
      priceStandard: d.priceStandard, priceSales: d.priceSales, link: d.link,
    }));
    const usedLists = Object.fromEntries(lookupData.map(d => [d.isbn13, d.usedList]));

    // 전체 한번에 위시리스트 추가
    setWishlist(prev => [...prev, ...books.map(b => ({ ...b, mustInclude: false }))]);
    books.forEach(b => addToWishlistDB(b));
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

    return { added: books.length, skipped, failed: failedItems.length, failedItems, titles: books.map(b => b.title) };
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
            {tab.id === 'wishlist' && (wishlist.length > 0 || results?.crawling) && (
              <span style={{
                ...styles.badge,
                ...(results?.crawling ? { animation: 'badge-pulse 0.9s ease-in-out infinite' } : {}),
              }}>
                {results?.crawling ? '···' : wishlist.length}
              </span>
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

      {showToast && (
        <div style={styles.toast}>
          <div style={styles.toastHeader}>
            <span style={styles.toastTitle}>업데이트 안내</span>
            <button style={styles.toastClose} onClick={dismissToast}>✕</button>
          </div>
          <ul style={styles.toastList}>
            <li>책 추가 시 탭이 자동으로 이동하지 않습니다. 위시리스트 탭 옆 뱃지의 <strong>···</strong> 가 수집 중 표시예요.</li>
            <li>엑셀 가져오기에서 중고책도 이제 정상적으로 추가됩니다.</li>
          </ul>
          <button style={styles.toastBtn} onClick={dismissToast}>확인</button>
        </div>
      )}

      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <span>도서 정보 제공: <a href="https://www.aladin.co.kr" target="_blank" rel="noreferrer" style={styles.footerLink}>알라딘 오픈API</a></span>
          <span style={styles.footerDivider}>·</span>
          <span>이 서비스는 알라딘의 공식 서비스가 아닙니다</span>
          <span style={styles.footerDivider}>·</span>
          <span>문의: <a href="mailto:1111younik@gmail.com" style={styles.footerLink}>1111younik@gmail.com</a></span>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', background: '#f9f9f9', display: 'flex', flexDirection: 'column' },
  header: { background: 'var(--color-primary)', color: '#fff' },
  headerInner: {
    maxWidth: '1100px', margin: '0 auto', padding: '12px 24px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  logo: { fontSize: '20px', fontWeight: 'bold' },
  headerSub: { fontSize: '13px', opacity: 0.85, flex: 1 },
  logoutBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '5px 12px', fontSize: '13px' },
  tabBar: { background: '#fff', borderBottom: '2px solid var(--color-primary)', display: 'flex', padding: '0 24px' },
  tab: {
    padding: '12px 24px', background: 'none', color: '#666',
    fontWeight: 'bold', fontSize: '14px',
    borderBottom: '2px solid transparent', marginBottom: '-2px',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  tabActive: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' },
  badge: {
    background: '#e6003e', color: '#fff', borderRadius: '10px',
    padding: '1px 6px', fontSize: '11px', fontWeight: 'bold',
  },
  main: { maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '24px 60px', flex: 1 },
  footer: { background: '#f0f0f0', borderTop: '1px solid #ddd', marginTop: '48px' },
  footerInner: {
    maxWidth: '1100px', margin: '0 auto', padding: '16px 24px',
    display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '12px', color: '#888', flexWrap: 'wrap',
  },
  footerLink: { color: '#888', textDecoration: 'underline' },
  footerDivider: { color: '#ccc' },
  toast: {
    position: 'fixed', bottom: '28px', right: '28px', zIndex: 1000,
    background: '#fff', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
    padding: '18px 20px', width: '300px',
    animation: 'toast-in 0.3s ease',
    borderLeft: '4px solid var(--color-primary)',
  },
  toastHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  toastTitle: { fontWeight: 'bold', fontSize: '14px', color: '#222' },
  toastClose: { background: 'none', border: 'none', color: '#aaa', fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 },
  toastList: {
    paddingLeft: '16px', margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '8px',
    fontSize: '13px', color: '#444', lineHeight: '1.6',
  },
  toastBtn: {
    width: '100%', background: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: '6px', padding: '8px', fontSize: '13px',
    fontWeight: 'bold', cursor: 'pointer',
  },
};
