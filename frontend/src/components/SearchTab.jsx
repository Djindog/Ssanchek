import { useState } from 'react';

export default function SearchTab({ wishlist, onAdd }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.item || []);
    } catch {
      setError('검색 중 오류가 발생했습니다.');
    }
    setLoading(false);
  }

  return (
    <div>
      {/* 검색창 */}
      <form onSubmit={handleSearch} style={styles.searchRow}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="책 제목 또는 ISBN으로 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button style={styles.searchBtn} type="submit" disabled={loading}>
          {loading ? '검색중...' : '검색'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>표지</th>
              <th style={styles.th}>책 정보</th>
              <th style={styles.th}>정가</th>
              <th style={styles.th}>판매가</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {results.map(book => {
              const inWishlist = wishlist.find(b => b.isbn13 === book.isbn13);
              return (
                <tr key={book.isbn13} style={styles.tr}>
                  <td style={styles.tdCover}>
                    <img src={book.cover} alt={book.title} style={styles.cover} />
                  </td>
                  <td style={styles.tdInfo}>
                    <div style={styles.title}>{book.title}</div>
                    <div style={styles.meta}>{book.author} | {book.publisher} | {book.pubDate}</div>
                  </td>
                  <td style={styles.tdPrice}>
                    {book.priceStandard?.toLocaleString()}원
                  </td>
                  <td style={styles.tdPrice}>
                    <span style={styles.salePrice}>{book.priceSales?.toLocaleString()}원</span>
                  </td>
                  <td style={styles.tdAction}>
                    <button
                      style={inWishlist ? styles.btnAdded : styles.btnAdd}
                      onClick={() => onAdd(book)}
                      disabled={!!inWishlist}
                    >
                      {inWishlist ? '추가됨' : '+ 위시리스트'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {results.length === 0 && !loading && query && (
        <p style={styles.empty}>검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

const styles = {
  searchRow: { display: 'flex', gap: '8px', marginBottom: '20px' },
  searchInput: {
    flex: 1,
    border: '1px solid #ddd',
    padding: '10px 14px',
    fontSize: '15px',
    outline: 'none',
  },
  searchBtn: {
    background: '#0066cc',
    color: '#fff',
    padding: '10px 24px',
    fontWeight: 'bold',
    fontSize: '15px',
  },
  error: { color: '#e6003e', marginBottom: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  thead: { background: '#f0f5ff' },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '2px solid #0066cc',
    fontWeight: 'bold',
    color: '#333',
  },
  tr: { borderBottom: '1px solid #eee' },
  tdCover: { padding: '12px', width: '80px' },
  cover: { width: '60px', display: 'block' },
  tdInfo: { padding: '12px', verticalAlign: 'top' },
  title: { fontWeight: 'bold', marginBottom: '4px', color: '#222' },
  meta: { fontSize: '12px', color: '#888' },
  tdPrice: { padding: '12px', textAlign: 'right', color: '#444', whiteSpace: 'nowrap' },
  salePrice: { color: '#e6003e', fontWeight: 'bold' },
  tdAction: { padding: '12px', textAlign: 'center' },
  btnAdd: {
    background: '#0066cc',
    color: '#fff',
    padding: '6px 14px',
    fontSize: '13px',
  },
  btnAdded: {
    background: '#ccc',
    color: '#fff',
    padding: '6px 14px',
    fontSize: '13px',
  },
  empty: { color: '#888', textAlign: 'center', marginTop: '40px' },
};
