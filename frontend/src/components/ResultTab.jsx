import { useState } from 'react';

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif";

const SELLER_TYPE_LABEL = {
  new: '새책',
  aladinUsed: '알라딘 중고',
  userUsed: '판매자 중고',
  spaceUsed: '광활한우주점',
};

const SELLER_TYPE_COLOR = {
  new: '#0066cc',
  aladinUsed: '#e6003e',
  userUsed: '#555',
  spaceUsed: '#7b3fa0',
};

const CONDITION_COLOR = {
  최상: '#e6007e',
  상: '#00a650',
  중: '#888',
  하: '#bbb',
};

export default function ResultTab({ results }) {
  const [expanded, setExpanded] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState(null);

  if (!results) {
    return (
      <div style={styles.empty}>
        <p>분석 결과가 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          위시리스트 탭에서 조합 분석을 실행해주세요.
        </p>
      </div>
    );
  }

  const { books = [], crawling = false } = results;

  if (books.length === 0) {
    return <div style={styles.empty}><p>크롤링 중...</p></div>;
  }

  function toggleExpand(isbn13) {
    setExpanded(prev => ({ ...prev, [isbn13]: !prev[isbn13] }));
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {/* 슬림 progress bar */}
      {crawling && (
        <div style={styles.progressBar}>
          <div style={styles.progressFill} />
        </div>
      )}

      {books.map(book => {
        const newOption = book.options.find(o => o.sellerType === 'new');
        const usedOptions = book.options.filter(o => o.sellerType !== 'new');
        const isExpanded = expanded[book.isbn13] ?? true;

        return (
          <div key={book.isbn13} style={styles.bookSection}>
            {/* 책 헤더 */}
            <div style={styles.bookHeader}>
              <a
                href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src={book.cover} alt={book.title} style={styles.cover} />
              </a>
              <div style={styles.bookInfo}>
                <a
                  href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${book.isbn13}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...styles.bookTitle,
                    ...(hoveredTitle === book.isbn13 ? styles.bookTitleHover : {}),
                  }}
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
              <button style={styles.toggleBtn} onClick={() => toggleExpand(book.isbn13)}>
                {isExpanded ? '접기 ▲' : `중고 ${usedOptions.length}개 ▼`}
              </button>
            </div>

            {/* 중고 옵션 테이블 */}
            {isExpanded && usedOptions.length > 0 && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>판매처</th>
                    <th style={styles.th}>판매자</th>
                    <th style={styles.th}>등급</th>
                    <th style={styles.th}>판매가</th>
                    <th style={styles.th}>배송비</th>
                    <th style={styles.th}>할인율</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {usedOptions.map((opt, i) => {
                    const rowKey = `${book.isbn13}-${i}`;
                    const color = SELLER_TYPE_COLOR[opt.sellerType] || '#555';
                    const condColor = CONDITION_COLOR[opt.condition] || '#888';
                    return (
                      <tr
                        key={i}
                        style={{
                          ...styles.tr,
                          background: hoveredRow === rowKey ? '#f9f9f9' : '#fff',
                        }}
                        onMouseEnter={() => setHoveredRow(rowKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td style={styles.td}>
                          <span style={{
                            ...styles.typePill,
                            color,
                            borderColor: color,
                          }}>
                            {SELLER_TYPE_LABEL[opt.sellerType] || opt.sellerType}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {opt.sellerLink
                            ? <a href={opt.sellerLink} target="_blank" rel="noreferrer" style={styles.sellerLink}>{opt.sellerName}</a>
                            : opt.sellerName}
                        </td>
                        <td style={styles.tdCenter}>
                          <span style={{ fontWeight: 'bold', color: condColor, fontSize: '13px' }}>
                            {opt.condition}
                          </span>
                        </td>
                        <td style={styles.tdRight}>
                          <span style={styles.price}>{opt.price?.toLocaleString()}원</span>
                        </td>
                        <td style={styles.tdRight}>
                          {opt.shipping === 0
                            ? <span style={styles.freeShip}>무료</span>
                            : <span style={{ color: '#555' }}>{opt.shipping?.toLocaleString()}원</span>}
                        </td>
                        <td style={styles.tdRight}>
                          <span style={styles.discount}>{opt.discount}%</span>
                        </td>
                        <td style={styles.tdCenter}>
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

            {isExpanded && usedOptions.length === 0 && (
              <div style={styles.noUsed}>{crawling ? '수집 중...' : '중고 판매처 없음'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  empty: { textAlign: 'center', paddingTop: '60px', color: '#444', fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" },
  progressBar: {
    height: '3px',
    background: '#e8e8e8',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '40%',
    background: '#0066cc',
    animation: 'slide 1.2s infinite ease-in-out',
  },
  bookSection: {
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderLeft: '4px solid #0066cc',
    marginBottom: '14px',
  },
  bookHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '16px',
    borderBottom: '1px solid #f0f0f0',
  },
  cover: {
    width: '56px',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  bookInfo: { flex: 1 },
  bookTitle: {
    display: 'block',
    fontWeight: 'bold',
    fontSize: '15px',
    color: '#222',
    textDecoration: 'none',
    marginBottom: '4px',
    transition: 'color 0.1s',
  },
  bookTitleHover: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  bookMeta: { fontSize: '12px', color: '#888', marginBottom: '8px' },
  newRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  newBadge: {
    background: '#0066cc',
    color: '#fff',
    padding: '2px 9px',
    fontSize: '12px',
    fontWeight: 'bold',
    borderRadius: '20px',
  },
  newPrice: { fontWeight: 'bold', color: '#e6003e', fontSize: '15px' },
  newShip: { fontSize: '12px', color: '#0066cc' },
  newDiscount: { fontSize: '12px', color: '#888' },
  toggleBtn: {
    background: 'none',
    color: '#0066cc',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    alignSelf: 'center',
    textDecoration: 'underline',
    flexShrink: 0,
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '8px 12px',
    textAlign: 'center',
    borderBottom: '2px solid #eee',
    fontWeight: 'bold',
    color: '#555',
    fontSize: '13px',
    background: '#fff',
  },
  tr: { borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' },
  td: { padding: '10px 12px', fontSize: '14px', color: '#222', textAlign: 'center' },
  tdCenter: { padding: '10px 12px', textAlign: 'center' },
  tdRight: { padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' },
  typePill: {
    border: '1px solid',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    borderRadius: '20px',
    background: 'transparent',
    whiteSpace: 'nowrap',
  },
  sellerLink: { color: '#333', textDecoration: 'none' },
  price: { color: '#e6003e', fontWeight: 'bold', fontSize: '15px' },
  freeShip: { color: '#0066cc', fontWeight: 'bold' },
  discount: { color: '#e6003e', fontWeight: 'bold' },
  buyBtn: {
    background: '#0066cc',
    color: '#fff',
    padding: '5px 12px',
    fontSize: '12px',
    display: 'inline-block',
    textDecoration: 'none',
    borderRadius: '3px',
    fontWeight: 'bold',
  },
  noUsed: { padding: '12px 16px', color: '#aaa', fontSize: '13px' },
};
