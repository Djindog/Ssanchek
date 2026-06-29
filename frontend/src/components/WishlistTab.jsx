import { useState } from 'react';

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif";

const SELLER_TYPE_LABEL = {
  new: '새책', aladinUsed: '알라딘 중고', userUsed: '판매자 중고', spaceUsed: '광활한우주점',
};
const SELLER_TYPE_COLOR = {
  new: '#0066cc', aladinUsed: '#e6003e', userUsed: '#555', spaceUsed: '#7b3fa0',
};
const CONDITION_COLOR = { '최상': '#e6007e', '상': '#00a650', '중': '#888', '하': '#bbb' };

const SORT_OPTIONS = [
  { value: 'default', label: '기본순' },
  { value: 'price_asc', label: '저가격순' },
  { value: 'price_desc', label: '고가격순' },
  { value: 'discount_desc', label: '할인율 높은순' },
  { value: 'condition_asc', label: '상태 좋은순' },
  { value: 'shipping_asc', label: '배송비 낮은순' },
];

const CONDITIONS = ['최상', '상', '중', '하'];
const CONDITION_RANK = { '최상': 0, '상': 1, '중': 2, '하': 3 };

function applySort(options, sortKey) {
  if (sortKey === 'default') return options;
  const arr = [...options];
  if (sortKey === 'price_asc')     arr.sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9));
  if (sortKey === 'price_desc')    arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  if (sortKey === 'discount_desc') arr.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
  if (sortKey === 'condition_asc') arr.sort((a, b) => (CONDITION_RANK[a.condition] ?? 99) - (CONDITION_RANK[b.condition] ?? 99));
  if (sortKey === 'shipping_asc')  arr.sort((a, b) => (a.shipping ?? 9e9) - (b.shipping ?? 9e9));
  return arr;
}

export default function WishlistTab({ results, onRemove }) {
  const [expanded, setExpanded] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState(null);
  const [sortKey, setSortKey] = useState('default');
  const [condFilter, setCondFilter] = useState(new Set(CONDITIONS));
  const [condOpen, setCondOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  function toggleCond(c) {
    setCondFilter(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  }

  const { books = [], crawling = false } = results || {};

  if (books.length === 0) {
    return (
      <div style={styles.empty}>
        <p>위시리스트가 비어있습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          검색 탭에서 책을 추가하면 바로 매물이 수집됩니다.
        </p>
      </div>
    );
  }

  function toggleExpand(isbn13) {
    setExpanded(prev => ({ ...prev, [isbn13]: !prev[isbn13] }));
  }

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? '기본순';
  const condAllChecked = condFilter.size === CONDITIONS.length;
  const condLabel = condAllChecked ? '모든 등급' : (CONDITIONS.filter(c => condFilter.has(c)).join(', ') || '없음');

  return (
    <div style={{ fontFamily: FONT }} onClick={() => { setSortOpen(false); setCondOpen(false); }}>
      {/* 컨트롤 바 */}
      <div style={styles.controlBar} onClick={e => e.stopPropagation()}>
        <span style={styles.controlLabel}>정렬</span>
        <div style={styles.dropWrap}>
          <button style={styles.dropBtn} onClick={() => { setSortOpen(p => !p); setCondOpen(false); }}>
            {sortLabel} <span style={styles.chevron}>▾</span>
          </button>
          {sortOpen && (
            <div style={styles.dropMenu}>
              {SORT_OPTIONS.map(o => (
                <div
                  key={o.value}
                  style={{ ...styles.dropItem, fontWeight: sortKey === o.value ? 'bold' : 'normal', color: sortKey === o.value ? '#0066cc' : '#222' }}
                  onClick={() => { setSortKey(o.value); setSortOpen(false); }}
                >
                  {o.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <span style={{ ...styles.controlLabel, marginLeft: '16px' }}>상태별 보기</span>
        <div style={styles.dropWrap}>
          <button style={styles.dropBtn} onClick={() => { setCondOpen(p => !p); setSortOpen(false); }}>
            {condLabel} <span style={styles.chevron}>▾</span>
          </button>
          {condOpen && (
            <div style={styles.dropMenu}>
              <div
                style={{ ...styles.dropItem, borderBottom: '1px solid #eee' }}
                onClick={() => setCondFilter(condAllChecked ? new Set() : new Set(CONDITIONS))}
              >
                <input type="checkbox" checked={condAllChecked} readOnly style={styles.check} />
                <span>전체</span>
              </div>
              {CONDITIONS.map(c => (
                <div key={c} style={styles.dropItem} onClick={() => toggleCond(c)}>
                  <input type="checkbox" checked={condFilter.has(c)} readOnly style={styles.check} />
                  <span style={{ color: CONDITION_COLOR[c], fontWeight: 'bold' }}>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {crawling && (
        <div style={styles.progressBar}><div style={styles.progressFill} /></div>
      )}

      {books.map(book => {
        const newOption = book.options?.find(o => o.sellerType === 'new');
        const usedOptions = applySort(
          (book.options || []).filter(o => o.sellerType !== 'new' && condFilter.has(o.condition)),
          sortKey
        );
        const isExpanded = expanded[book.isbn13] ?? false;
        const isCrawling = crawling && (!book.options || book.options.length === 0);

        return (
          <div key={book.isbn13} style={styles.bookSection}>
            <div style={styles.bookHeader}>
              <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`} target="_blank" rel="noreferrer">
                <img src={book.cover} alt={book.title} style={styles.cover} />
              </a>
              <div style={styles.bookInfo}>
                <a
                  href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`}
                  target="_blank" rel="noreferrer"
                  style={{ ...styles.bookTitle, ...(hoveredTitle === book.isbn13 ? styles.bookTitleHover : {}) }}
                  onMouseEnter={() => setHoveredTitle(book.isbn13)}
                  onMouseLeave={() => setHoveredTitle(null)}
                >
                  {book.title}
                </a>
                <div style={styles.bookMeta}>{book.author} | {book.publisher}</div>
                {newOption && (
                  <div style={styles.newRow}>
                    <span style={styles.newBadge}>새책</span>
                    <span style={styles.newPrice}>{newOption.price?.toLocaleString()}원</span>
                    <span style={styles.newShip}>무료배송</span>
                    <span style={styles.newDiscount}>({newOption.discount}% 할인)</span>
                    <a href={newOption.productLink} target="_blank" rel="noreferrer" style={styles.buyBtn}>구매</a>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                {!isCrawling && (
                  <button style={styles.toggleBtn} onClick={() => toggleExpand(book.isbn13)}>
                    {isExpanded ? '접기 ▲' : `중고 ${usedOptions.length}개 ▼`}
                  </button>
                )}
                <button style={styles.removeBtn} onClick={() => onRemove(book.isbn13)}>삭제</button>
              </div>
            </div>

            {isCrawling && <div style={styles.noUsed}>매물 수집 중...</div>}

            {!isCrawling && isExpanded && usedOptions.length > 0 && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>판매처</th>
                    <th style={styles.th}>판매자</th>
                    <th style={styles.th}>등급</th>
                    <th style={styles.th}>판매가</th>
                    <th style={styles.th}>배송비</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {usedOptions.map((opt, i) => {
                    const rowKey = `${book.isbn13}-${i}`;
                    const color = SELLER_TYPE_COLOR[opt.sellerType] || '#555';
                    const condColor = CONDITION_COLOR[opt.condition] || '#888';
                    const isSpace = opt.sellerType === 'spaceUsed';
                    return (
                      <tr
                        key={i}
                        style={{ ...styles.tr, background: hoveredRow === rowKey ? '#f9f9f9' : '#fff' }}
                        onMouseEnter={() => setHoveredRow(rowKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td style={styles.tdCell}>
                          <span style={{ ...styles.typePill, color, borderColor: color }}>
                            {SELLER_TYPE_LABEL[opt.sellerType] || opt.sellerType}
                          </span>
                        </td>
                        <td style={styles.tdSeller}>
                          <div style={styles.sellerInner}>
                            {opt.sellerLink
                              ? <a href={opt.sellerLink} target="_blank" rel="noreferrer" style={styles.sellerLink}>{opt.sellerName || '—'}</a>
                              : <span>{opt.sellerName || '—'}</span>}
                          </div>
                        </td>
                        <td style={styles.tdCell}>
                          <span style={{ fontWeight: 'bold', color: condColor, fontSize: '13px' }}>{opt.condition}</span>
                        </td>
                        <td style={styles.tdCell}>
                          <span style={styles.price}>{opt.price?.toLocaleString()}원</span>
                          {opt.discount > 0 && <span style={styles.discountSub}> ({opt.discount}% 할인)</span>}
                        </td>
                        <td style={styles.tdCell}>
                          {opt.shipping === 0
                            ? <span style={styles.freeShip}>무료</span>
                            : <span style={{ color: '#555', fontSize: '13px' }}>{opt.shipping?.toLocaleString()}원</span>}
                          {isSpace && <span style={styles.spaceShip}> (2만원↑무료)</span>}
                        </td>
                        <td style={styles.tdCell}>
                          {opt.productLink && (
                            <a href={opt.productLink} target="_blank" rel="noreferrer" style={styles.buyBtn}>구매</a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!isCrawling && isExpanded && usedOptions.length === 0 && (
              <div style={styles.noUsed}>중고 판매처 없음</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  empty: { textAlign: 'center', paddingTop: '60px', color: '#444', fontFamily: FONT },
  progressBar: { height: '3px', background: '#e8e8e8', marginBottom: '16px', overflow: 'hidden' },
  progressFill: { height: '100%', width: '40%', background: '#0066cc', animation: 'slide 1.2s infinite ease-in-out' },
  controlBar: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  controlLabel: { fontSize: '13px', color: '#555', fontWeight: 'bold' },
  dropWrap: { position: 'relative' },
  dropBtn: {
    border: '1px solid #ccc', background: '#fff', padding: '5px 12px',
    fontSize: '13px', color: '#222', cursor: 'pointer', borderRadius: '4px',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  chevron: { fontSize: '11px', color: '#888' },
  dropMenu: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0,
    background: '#fff', border: '1px solid #ddd', borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, minWidth: '140px',
  },
  dropItem: { padding: '8px 14px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  check: { cursor: 'pointer', accentColor: '#0066cc' },
  bookSection: { background: '#fff', border: '1px solid #e8e8e8', borderLeft: '4px solid #0066cc', marginBottom: '14px' },
  bookHeader: { display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px', borderBottom: '1px solid #f0f0f0' },
  cover: { width: '56px', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' },
  bookInfo: { flex: 1 },
  bookTitle: { display: 'block', fontWeight: 'bold', fontSize: '15px', color: '#222', textDecoration: 'none', marginBottom: '4px', transition: 'color 0.1s' },
  bookTitleHover: { color: '#0066cc', textDecoration: 'underline' },
  bookMeta: { fontSize: '12px', color: '#888', marginBottom: '8px' },
  newRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  newBadge: { background: '#0066cc', color: '#fff', padding: '2px 9px', fontSize: '12px', fontWeight: 'bold', borderRadius: '20px' },
  newPrice: { fontWeight: 'bold', color: '#e6003e', fontSize: '15px' },
  newShip: { fontSize: '12px', color: '#0066cc' },
  newDiscount: { fontSize: '12px', color: '#888' },
  toggleBtn: { background: 'none', color: '#0066cc', fontSize: '13px', whiteSpace: 'nowrap', textDecoration: 'underline', flexShrink: 0, cursor: 'pointer' },
  removeBtn: { background: 'none', color: '#e6003e', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 4px', textAlign: 'center', borderBottom: '2px solid #eee', fontWeight: 'bold', color: '#555', fontSize: '13px', background: '#fff' },
  tr: { borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' },
  tdCell: { padding: '8px 4px', fontSize: '13px', color: '#222', textAlign: 'center', whiteSpace: 'nowrap' },
  tdSeller: { padding: '8px 4px', maxWidth: '220px', width: '220px' },
  sellerInner: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#222', textAlign: 'center' },
  typePill: { border: '1px solid', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold', borderRadius: '20px', background: 'transparent', whiteSpace: 'nowrap', display: 'inline-block' },
  sellerLink: { color: '#333', textDecoration: 'none' },
  price: { color: '#e6003e', fontWeight: 'bold', fontSize: '14px' },
  discountSub: { fontSize: '12px', color: '#e6003e', opacity: 0.75 },
  freeShip: { color: '#0066cc', fontWeight: 'bold', fontSize: '13px' },
  spaceShip: { color: '#7b3fa0', fontSize: '12px', fontWeight: 'bold' },
  buyBtn: { background: '#0066cc', color: '#fff', padding: '4px 10px', fontSize: '12px', display: 'inline-block', textDecoration: 'none', borderRadius: '3px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  noUsed: { padding: '12px 16px', color: '#aaa', fontSize: '13px' },
};
