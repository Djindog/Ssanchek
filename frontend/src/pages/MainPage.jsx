import { useState } from 'react';
import { supabase } from '../lib/supabase';
import SearchTab from '../components/SearchTab';
import WishlistTab from '../components/WishlistTab';
import ResultTab from '../components/ResultTab';

const TABS = [
  { id: 'search', label: '책 검색' },
  { id: 'wishlist', label: '위시리스트' },
  { id: 'result', label: '조합 분석' },
];

export default function MainPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [wishlist, setWishlist] = useState([]);
  const [results, setResults] = useState([]);

  function addToWishlist(book) {
    if (wishlist.find(b => b.isbn13 === book.isbn13)) return;
    setWishlist(prev => [...prev, book]);
  }

  function removeFromWishlist(isbn13) {
    setWishlist(prev => prev.filter(b => b.isbn13 !== isbn13));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div style={styles.wrapper}>
      {/* 헤더 */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>싼책</span>
          <span style={styles.headerSub}>알라딘 중고책 최적 구매 조합 분석기</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      {/* 탭 */}
      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'wishlist' && wishlist.length > 0 && (
              <span style={styles.badge}>{wishlist.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <main style={styles.main}>
        {activeTab === 'search' && (
          <SearchTab wishlist={wishlist} onAdd={addToWishlist} />
        )}
        {activeTab === 'wishlist' && (
          <WishlistTab
            wishlist={wishlist}
            onRemove={removeFromWishlist}
            onAnalyze={(res) => { setResults(res); setActiveTab('result'); }}
          />
        )}
        {activeTab === 'result' && (
          <ResultTab results={results} />
        )}
      </main>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#0066cc', color: '#fff' },
  headerInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: { fontSize: '20px', fontWeight: 'bold' },
  headerSub: { fontSize: '13px', opacity: 0.85, flex: 1 },
  logoutBtn: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '5px 12px',
    fontSize: '13px',
  },
  tabBar: {
    background: '#fff',
    borderBottom: '2px solid #0066cc',
    display: 'flex',
    maxWidth: '1100px',
    margin: '0 auto',
    width: '100%',
  },
  tab: {
    padding: '12px 24px',
    background: 'none',
    color: '#666',
    fontWeight: 'bold',
    fontSize: '14px',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tabActive: {
    color: '#0066cc',
    borderBottom: '2px solid #0066cc',
  },
  badge: {
    background: '#e6003e',
    color: '#fff',
    borderRadius: '10px',
    padding: '1px 6px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '20px',
    width: '100%',
  },
};
