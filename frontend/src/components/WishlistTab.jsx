import { useState } from 'react';
import { updateMustInclude } from '../lib/api';

const CONDITION_LABELS = { 최상: '최상', 상: '상', 중: '중', 하: '하' };

export default function WishlistTab({ wishlist, onRemove, onToggleMust, onAnalyze }) {
  const [budget, setBudget] = useState({ min: '', max: '' });
  const [globalCondition, setGlobalCondition] = useState('중');
  const [globalDays, setGlobalDays] = useState('7');
  const [loading, setLoading] = useState(false);

  async function toggleMust(isbn13, current) {
    const next = !current;
    onToggleMust(isbn13, next);
    await updateMustInclude(isbn13, next);
  }

  async function handleAnalyze() {
    if (wishlist.length === 0) {
      alert('위시리스트에 책을 추가해주세요.');
      return;
    }
    setLoading(true);
    onAnalyze({ books: wishlist.map(b => ({ ...b, options: [] })), crawling: true });

    // 각 책마다 lookup → crawl 순서로 처리
    const bookData = wishlist.map(b => ({ ...b, options: [] }));

    for (let i = 0; i < wishlist.length; i++) {
      const book = wishlist[i];
      try {
        // 1. lookup으로 usedList URL 가져오기
        const lookupRes = await fetch(`/api/lookup?isbn13=${book.isbn13}`);
        const lookupData = await lookupRes.json();
        const usedList = lookupData.usedList;

        // 새책 옵션 추가
        bookData[i].options.push({
          sellerType: 'new',
          sellerName: '알라딘 새책',
          price: lookupData.priceSales,
          priceStandard: lookupData.priceStandard,
          shipping: 0,
          discount: Math.round((1 - lookupData.priceSales / lookupData.priceStandard) * 100),
          condition: '새책',
          productLink: lookupData.link,
        });

        onAnalyze({ books: [...bookData], crawling: true });

        // 2. 크롤링할 URL 목록 구성
        const urlList = [];
        if (usedList?.aladinUsed?.link) urlList.push({ url: usedList.aladinUsed.link, type: 'aladinUsed', isbn: book.isbn13 });
        if (usedList?.userUsed?.link)   urlList.push({ url: usedList.userUsed.link,   type: 'userUsed',   isbn: book.isbn13 });
        if (usedList?.spaceUsed?.link)  urlList.push({ url: usedList.spaceUsed.link,  type: 'spaceUsed',  isbn: book.isbn13 });

        if (urlList.length > 0) {
          const crawlRes = await fetch('/api/crawl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ books: [{ isbn: book.isbn13, ...Object.fromEntries(urlList.map(u => [u.type + 'Link', u.url])) }] }),
          });
          const crawlData = await crawlRes.json();
          const crawled = crawlData.data?.[0]?.options ?? [];
          bookData[i].options.push(...crawled);
        }

        onAnalyze({ books: [...bookData], crawling: i < wishlist.length - 1 });
      } catch (e) {
        console.error('크롤링 오류', book.isbn13, e);
      }
    }

    setLoading(false);
  }

  if (wishlist.length === 0) {
    return (
      <div style={styles.empty}>
        <p>위시리스트가 비어있습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          검색 탭에서 책을 추가해주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 전체 제약조건 */}
      <div style={styles.constraints}>
        <span style={styles.constraintLabel}>전체 기본 조건</span>
        <div style={styles.constraintRow}>
          <label>예산 범위</label>
          <input
            style={styles.budgetInput}
            type="number"
            placeholder="최소 (원)"
            value={budget.min}
            onChange={e => setBudget(p => ({ ...p, min: e.target.value }))}
          />
          <span>~</span>
          <input
            style={styles.budgetInput}
            type="number"
            placeholder="최대 (원)"
            value={budget.max}
            onChange={e => setBudget(p => ({ ...p, max: e.target.value }))}
          />
        </div>
        <div style={styles.constraintRow}>
          <label>최소 등급</label>
          <select
            style={styles.select}
            value={globalCondition}
            onChange={e => setGlobalCondition(e.target.value)}
          >
            {Object.keys(CONDITION_LABELS).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label style={{ marginLeft: '16px' }}>최대 배송기한</label>
          <select
            style={styles.select}
            value={globalDays}
            onChange={e => setGlobalDays(e.target.value)}
          >
            <option value="1">1일</option>
            <option value="3">3일</option>
            <option value="5">5일</option>
            <option value="7">7일</option>
          </select>
        </div>
      </div>

      {/* 위시리스트 테이블 */}
      <table style={styles.table}>
        <thead>
          <tr style={styles.thead}>
            <th style={styles.th}>표지</th>
            <th style={styles.th}>책 정보</th>
            <th style={styles.th}>정가</th>
            <th style={styles.th}>필수포함</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {wishlist.map(book => (
            <tr key={book.isbn13} style={styles.tr}>
              <td style={styles.tdCover}>
                <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`} target="_blank" rel="noreferrer">
                  <img src={book.cover} alt={book.title} style={styles.cover} />
                </a>
              </td>
              <td style={styles.tdInfo}>
                <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`} target="_blank" rel="noreferrer" style={styles.titleLink}>
                  {book.title}
                </a>
                <div style={styles.meta}>{book.author} | {book.publisher}</div>
              </td>
              <td style={styles.tdPrice}>
                <span style={styles.salePrice}>{book.priceSales?.toLocaleString()}원</span>
                <div style={{ fontSize: '12px', color: '#888' }}>정가 {book.priceStandard?.toLocaleString()}원</div>
              </td>
              <td style={styles.tdCenter}>
                <input
                  type="checkbox"
                  checked={!!book.mustInclude}
                  onChange={() => toggleMust(book.isbn13, book.mustInclude)}
                />
              </td>
              <td style={styles.tdCenter}>
                <button style={styles.removeBtn} onClick={() => onRemove(book.isbn13)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 분석 버튼 */}
      <div style={styles.analyzeRow}>
        <span style={styles.summary}>
          총 {wishlist.length}권 | 정가 합계{' '}
          {wishlist.reduce((s, b) => s + (b.priceStandard || 0), 0).toLocaleString()}원
        </span>
        <button style={styles.analyzeBtn} onClick={handleAnalyze} disabled={loading}>
          {loading ? '분석중...' : '최적 조합 분석 →'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  empty: { textAlign: 'center', paddingTop: '60px', color: '#444' },
  constraints: {
    background: '#fff',
    border: '1px solid #ddd',
    padding: '16px 20px',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  constraintLabel: { fontWeight: 'bold', color: '#0066cc', fontSize: '13px' },
  constraintRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' },
  budgetInput: {
    border: '1px solid #ddd',
    padding: '6px 10px',
    width: '140px',
    fontSize: '14px',
  },
  select: { border: '1px solid #ddd', padding: '6px 8px', fontSize: '14px' },
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
  titleLink: { fontWeight: 'bold', marginBottom: '4px', color: '#222', textDecoration: 'none' },
  meta: { fontSize: '12px', color: '#888' },
  tdPrice: { padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' },
  salePrice: { color: '#e6003e', fontWeight: 'bold' },
  tdCenter: { padding: '12px', textAlign: 'center' },
  removeBtn: { background: 'none', color: '#888', fontSize: '13px', textDecoration: 'underline' },
  analyzeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    padding: '12px 0',
  },
  summary: { color: '#444', fontSize: '14px' },
  analyzeBtn: {
    background: '#e6003e',
    color: '#fff',
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
};
