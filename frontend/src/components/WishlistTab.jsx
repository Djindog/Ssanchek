import { useState } from 'react';

const CONDITION_LABELS = { 최상: '최상', 상: '상', 중: '중', 하: '하' };

export default function WishlistTab({ wishlist, onRemove, onAnalyze }) {
  const [budget, setBudget] = useState({ min: '', max: '' });
  const [globalCondition, setGlobalCondition] = useState('중');
  const [globalDays, setGlobalDays] = useState('7');
  const [mustInclude, setMustInclude] = useState({});
  const [loading, setLoading] = useState(false);

  function toggleMust(isbn13) {
    setMustInclude(prev => ({ ...prev, [isbn13]: !prev[isbn13] }));
  }

  async function handleAnalyze() {
    if (!budget.min || !budget.max) {
      alert('예산 범위를 입력해주세요.');
      return;
    }
    if (wishlist.length === 0) {
      alert('위시리스트에 책을 추가해주세요.');
      return;
    }
    setLoading(true);
    // TODO: 크롤링 API 호출 + 알고리즘 실행
    // 임시로 빈 결과
    setTimeout(() => {
      onAnalyze([]);
      setLoading(false);
    }, 1000);
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
                <img src={book.cover} alt={book.title} style={styles.cover} />
              </td>
              <td style={styles.tdInfo}>
                <div style={styles.title}>{book.title}</div>
                <div style={styles.meta}>{book.author} | {book.publisher}</div>
              </td>
              <td style={styles.tdPrice}>
                <span style={styles.salePrice}>{book.priceSales?.toLocaleString()}원</span>
                <div style={{ fontSize: '12px', color: '#888' }}>정가 {book.priceStandard?.toLocaleString()}원</div>
              </td>
              <td style={styles.tdCenter}>
                <input
                  type="checkbox"
                  checked={!!mustInclude[book.isbn13]}
                  onChange={() => toggleMust(book.isbn13)}
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
