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

function deduplicateCombinations(combinations) {
  const seen = new Map(); // key: sorted isbn13 목록 → 가장 높은 할인율 조합
  for (const combo of combinations) {
    const key = combo.selections.map(s => s.isbn13).sort().join(',');
    if (!seen.has(key) || combo.realDiscount > seen.get(key).realDiscount) {
      seen.set(key, combo);
    }
  }
  return [...seen.values()].sort((a, b) => b.realDiscount - a.realDiscount);
}

export default function CombinationTab({ combinations, loading, onOptimize }) {
  const [expanded, setExpanded] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredShip, setHoveredShip] = useState(null); // rowKey of strikeout tooltip
  const [dedupe, setDedupe] = useState(false);

  function toggle(idx) {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  if (loading) {
    return (
      <div style={styles.empty}>
        <div style={styles.progressBar}><div style={styles.progressFill} /></div>
        <p style={{ color: '#666', marginTop: '16px' }}>최적 조합 계산 중...</p>
      </div>
    );
  }

  if (!combinations) {
    return (
      <div style={styles.empty}>
        <p>조합 분석 결과가 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          위시리스트 탭에서 조합 분석을 실행해주세요.
        </p>
        {onOptimize && (
          <button style={styles.runBtn} onClick={onOptimize}>조합 분석 실행 →</button>
        )}
      </div>
    );
  }

  if (combinations.length === 0) {
    return (
      <div style={styles.empty}>
        <p>조건에 맞는 조합이 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          예산 범위를 넓히거나 등급 조건을 완화해보세요.
        </p>
      </div>
    );
  }

  const displayed = dedupe ? deduplicateCombinations(combinations) : combinations;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* 상단 컨트롤 */}
      <div style={styles.controlBar}>
        <label style={styles.dedupeLabel}>
          <input
            type="checkbox"
            checked={dedupe}
            onChange={e => {
              setDedupe(e.target.checked);
              setExpanded({});
            }}
            style={{ accentColor: '#0066cc', cursor: 'pointer' }}
          />
          중복 조합 제외 (같은 책 구성 중 최고 할인율만)
        </label>
        <span style={styles.resultMeta}>
          {displayed.length}개 조합{dedupe && combinations.length !== displayed.length ? ` (전체 ${combinations.length}개 중)` : ''}
        </span>
      </div>

      {displayed.map((combo, idx) => {
        const isOpen = expanded[idx] ?? false;
        const titles = combo.selections.map(s => s.title).join(' · ');

        return (
          <div key={idx} style={styles.card}>
            {/* 카드 헤더 */}
            <button style={styles.cardHeader} onClick={() => toggle(idx)}>
              <div style={styles.headerLeft}>
                <span style={styles.rank}>#{idx + 1}</span>
                <span style={styles.titles}>{titles}</span>
              </div>
              <div style={styles.headerRight}>
                <span style={styles.totalCost}>{combo.totalCost.toLocaleString()}원</span>
                <span style={styles.discountBadge}>{combo.realDiscount}% 할인</span>
                <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* 펼쳐진 테이블 */}
            {isOpen && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '52px' }}></th>
                    <th style={styles.th}>책 제목</th>
                    <th style={styles.th}>판매처 / 판매자</th>
                    <th style={{ ...styles.th, width: '48px' }}>등급</th>
                    <th style={styles.th}>가격 / 배송비</th>
                    <th style={{ ...styles.th, width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // sellerId → 첫 등장 판매처 표시명
                    const seenSellers = new Map();
                    return combo.selections.map((sel, si) => {
                    const opt = sel.choice?.opt;
                    const type = sel.choice?.type;
                    const rowKey = `${idx}-${si}`;
                    const typeColor = SELLER_TYPE_COLOR[opt?.sellerType] || '#555';
                    const condColor = CONDITION_COLOR[opt?.condition] || '#888';
                    const isSpaceOrAladin = opt?.sellerType === 'spaceUsed' || opt?.sellerType === 'aladinUsed';

                    const sellerName = opt?.sellerName || (type === 'new' ? '알라딘' : '—');

                    // 배송비 중복 여부: 새책/무료배송이 아닌 판매처가 이미 등장했으면 strikeout
                    const sellerId = sel.choice?._sid || opt?.sellerId;
                    const displaySellerName = opt?.sellerName || (type === 'new' ? '알라딘' : null);
                    const hasShipping = type !== 'new' && opt?.shipping > 0;
                    const isDupeShipping = hasShipping && sellerId && seenSellers.has(sellerId);
                    const firstBookTitle = isDupeShipping ? seenSellers.get(sellerId) : null;
                    if (hasShipping && sellerId && !seenSellers.has(sellerId)) {
                      seenSellers.set(sellerId, sel.title);
                    }

                    let shippingNode;
                    if (type === 'new') {
                      shippingNode = <span style={styles.freeShip}>무료</span>;
                    } else if (opt?.shipping === 0) {
                      shippingNode = <span style={styles.freeShip}>무료</span>;
                    } else if (isDupeShipping) {
                      const tooltipText = `"${displaySellerName || '같은 판매처'}"에서 "《${firstBookTitle}》" 구매 시 이미 배송비가 청구되어 중복 청구되지 않습니다.`;
                      shippingNode = (
                        <span
                          style={styles.strikeWrap}
                          onMouseEnter={() => setHoveredShip(rowKey)}
                          onMouseLeave={() => setHoveredShip(null)}
                        >
                          <span style={styles.strikeText}>{opt.shipping.toLocaleString()}원</span>
                          {hoveredShip === rowKey && (
                            <span style={styles.tooltip}>{tooltipText}</span>
                          )}
                        </span>
                      );
                    } else if (isSpaceOrAladin) {
                      shippingNode = (
                        <span style={{ color: '#555', fontSize: '12px' }}>
                          {opt.shipping.toLocaleString()}원
                          <span style={styles.spaceShip}> (2만원↑무료)</span>
                        </span>
                      );
                    } else {
                      shippingNode = <span style={{ color: '#555', fontSize: '12px' }}>{opt?.shipping?.toLocaleString()}원</span>;
                    }

                    const productLink = opt?.productLink || (
                      sel.isbn13 ? `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}` : null
                    );

                    return (
                      <tr
                        key={si}
                        style={{
                          ...styles.tr,
                          background: hoveredRow === rowKey ? '#f9f9f9' : '#fff',
                        }}
                        onMouseEnter={() => setHoveredRow(rowKey)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        {/* 썸네일 */}
                        <td style={styles.tdThumb}>
                          {sel.cover
                            ? <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}`} target="_blank" rel="noreferrer">
                                <img src={sel.cover} alt={sel.title} style={styles.cover} />
                              </a>
                            : null}
                        </td>

                        {/* 책 제목 */}
                        <td style={styles.tdTitle}>
                          <a
                            href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}`}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.titleLink}
                          >
                            {sel.title}
                          </a>
                        </td>

                        {/* 판매처 / 판매자 (2줄) */}
                        <td style={styles.tdCell}>
                          <div>
                            {opt ? (
                              <span style={{ ...styles.typePill, color: typeColor, borderColor: typeColor }}>
                                {SELLER_TYPE_LABEL[opt.sellerType] || opt.sellerType}
                              </span>
                            ) : '—'}
                          </div>
                          <div style={styles.sellerLine}>
                            {opt?.sellerLink
                              ? <a href={opt.sellerLink} target="_blank" rel="noreferrer" style={styles.sellerLink}>{sellerName}</a>
                              : <span>{sellerName}</span>}
                          </div>
                        </td>

                        {/* 등급 (세로 가운데) */}
                        <td style={styles.tdCondition}>
                          {opt?.condition
                            ? <span style={{ fontWeight: 'bold', color: condColor, fontSize: '13px' }}>{opt.condition}</span>
                            : '—'}
                        </td>

                        {/* 가격 / 배송비 (2줄) */}
                        <td style={styles.tdCell}>
                          <div>
                            <span style={styles.price}>{sel.choice?.cost?.toLocaleString()}원</span>
                            {opt?.discount > 0 && (
                              <span style={styles.discountSub}> ({opt.discount}%↓)</span>
                            )}
                          </div>
                          <div style={{ marginTop: '3px' }}>{shippingNode}</div>
                        </td>

                        {/* 구매 버튼 */}
                        <td style={styles.tdBuy}>
                          {productLink && (
                            <a href={productLink} target="_blank" rel="noreferrer" style={styles.buyBtn}>구매</a>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  empty: { textAlign: 'center', paddingTop: '60px', color: '#444', fontFamily: FONT },
  progressBar: { height: '3px', background: '#e8e8e8', overflow: 'hidden', maxWidth: '400px', margin: '0 auto' },
  progressFill: {
    height: '100%', width: '40%', background: '#0066cc',
    animation: 'slide 1.2s infinite ease-in-out',
  },
  runBtn: {
    marginTop: '20px', background: '#e6003e', color: '#fff',
    padding: '10px 28px', fontSize: '15px', fontWeight: 'bold',
    cursor: 'pointer', border: 'none', borderRadius: '3px',
  },
  controlBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '14px', flexWrap: 'wrap', gap: '8px',
  },
  dedupeLabel: {
    display: 'flex', alignItems: 'center', gap: '7px',
    fontSize: '13px', color: '#444', cursor: 'pointer', userSelect: 'none',
  },
  resultMeta: { fontSize: '13px', color: '#888' },
  card: {
    background: '#fff', border: '1px solid #e8e8e8',
    borderLeft: '4px solid #0066cc', marginBottom: '10px',
  },
  cardHeader: {
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '14px 16px',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '12px',
  },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0 },
  rank: { fontSize: '13px', fontWeight: 'bold', color: '#0066cc', flexShrink: 0 },
  titles: { fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  totalCost: { fontSize: '15px', fontWeight: 'bold', color: '#e6003e' },
  discountBadge: {
    fontSize: '13px', fontWeight: 'bold', color: '#00a650',
    background: '#f0fff5', padding: '2px 8px', borderRadius: '20px', border: '1px solid #b2eac7',
  },
  chevron: { fontSize: '12px', color: '#999' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '7px 6px', textAlign: 'center',
    borderBottom: '2px solid #eee', borderTop: '1px solid #f0f0f0',
    fontWeight: 'bold', color: '#555', fontSize: '12px', background: '#fafafa',
  },
  tr: { borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' },
  tdThumb: { padding: '8px 10px', width: '52px', textAlign: 'center', verticalAlign: 'middle' },
  cover: { width: '40px', display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' },
  tdTitle: {
    padding: '8px 6px', fontSize: '13px', color: '#222',
    maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  titleLink: { color: '#222', textDecoration: 'none' },
  tdCell: { padding: '8px 6px', fontSize: '13px', color: '#222', textAlign: 'center', verticalAlign: 'middle' },
  tdCondition: { padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', width: '48px' },
  tdBuy: { padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', width: '60px' },
  typePill: {
    border: '1px solid', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold',
    borderRadius: '20px', background: 'transparent', whiteSpace: 'nowrap', display: 'inline-block',
  },
  sellerLine: {
    marginTop: '4px', fontSize: '12px', color: '#666',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    textAlign: 'center',
  },
  sellerLink: { color: '#555', textDecoration: 'none' },
  price: { color: '#e6003e', fontWeight: 'bold', fontSize: '14px' },
  discountSub: { fontSize: '11px', color: '#e6003e', opacity: 0.8 },
  freeShip: { color: '#0066cc', fontWeight: 'bold', fontSize: '12px' },
  spaceShip: { color: '#7b3fa0', fontSize: '11px', fontWeight: 'bold' },
  strikeWrap: {
    position: 'relative',
    display: 'inline-block',
    cursor: 'help',
  },
  strikeText: {
    color: '#bbb',
    fontSize: '12px',
    textDecoration: 'line-through',
  },
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#333',
    color: '#fff',
    fontSize: '12px',
    lineHeight: '1.5',
    padding: '7px 11px',
    borderRadius: '5px',
    whiteSpace: 'normal',
    width: '220px',
    textAlign: 'center',
    zIndex: 200,
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  buyBtn: {
    background: '#0066cc', color: '#fff', padding: '4px 10px',
    fontSize: '12px', display: 'inline-block', textDecoration: 'none',
    borderRadius: '3px', fontWeight: 'bold', whiteSpace: 'nowrap',
  },
};
