import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif";

const SELLER_TYPE_LABEL = {
  new: '새책', aladinUsed: '알라딘 중고', userUsed: '판매자 중고', spaceUsed: '우주점',
};
const SELLER_TYPE_COLOR = {
  new: 'var(--color-primary)', aladinUsed: '#e6003e', userUsed: '#555', spaceUsed: '#7b3fa0',
};
const CONDITION_COLOR = { '최상': '#e6007e', '상': '#00a650', '중': '#888', '하': '#bbb' };

const ALL_CONDITIONS = ['최상', '상', '중', '하'];
const COND_RANK = { '최상': 3, '상': 2, '중': 1, '하': 0 };
const ALL_SELLER_TYPES = ['new', 'aladinUsed', 'userUsed', 'spaceUsed'];

function deduplicateCombinations(combinations) {
  const seen = new Map();
  for (const combo of combinations) {
    const key = combo.selections.map(s => s.isbn13).sort().join(',');
    if (!seen.has(key) || combo.realDiscount > seen.get(key).realDiscount) seen.set(key, combo);
  }
  return [...seen.values()].sort((a, b) => b.realDiscount - a.realDiscount);
}

function CondDropdown({ value, globalCondition, onChange }) {
  const { open, pos, ref, toggle, close } = usePortalDropdown();
  const label = value ?? '전체와 동일';

  return (
    <div>
      <button ref={ref} style={styles.smallDropBtn} onClick={toggle}>
        {label} <span style={{ fontSize: '10px', color: '#888' }}>▾</span>
      </button>
      {open && createPortal(
        <div
          style={{ ...styles.portalMenu, top: pos.top, left: pos.left, minWidth: '120px' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{ ...styles.smallDropItem, fontWeight: !value ? 'bold' : 'normal', color: !value ? 'var(--color-primary)' : '#222' }}
            onClick={() => { onChange(null); close(); }}
          >
            전체와 동일
          </div>
          {ALL_CONDITIONS.map(c => {
            const disabled = COND_RANK[c] < COND_RANK[globalCondition];
            return (
              <div
                key={c}
                style={{ ...styles.smallDropItem, color: disabled ? '#ccc' : CONDITION_COLOR[c], cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: value === c ? 'bold' : 'normal' }}
                onClick={() => !disabled && (onChange(c), close())}
              >
                {c}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── 세부 조건 테이블 ────────────────────────────────────────────────────────

// 공통 포털 드롭다운 훅
function usePortalDropdown() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  function toggle(e) {
    e.stopPropagation();
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(p => !p);
  }

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return { open, pos, ref, toggle, close: () => setOpen(false) };
}

function SellerDropdown({ allowed, selected, onToggle, disabled }) {
  const { open, pos, ref, toggle } = usePortalDropdown();

  const label = ALL_SELLER_TYPES.every(t => selected.has(t))
    ? '전체'
    : ALL_SELLER_TYPES.filter(t => selected.has(t)).map(t => SELLER_TYPE_LABEL[t]).join(', ') || '없음';

  return (
    <div>
      <button
        ref={ref}
        style={{ ...styles.smallDropBtn, opacity: disabled ? 0.5 : 1 }}
        onClick={e => !disabled && toggle(e)}
      >
        {label} <span style={{ fontSize: '10px', color: '#888' }}>▾</span>
      </button>
      {open && createPortal(
        <div
          style={{ ...styles.portalMenu, top: pos.top, left: pos.left, minWidth: '140px' }}
          onClick={e => e.stopPropagation()}
        >
          {ALL_SELLER_TYPES.map(t => {
            const isAllowed = allowed.has(t);
            return (
              <label
                key={t}
                style={{ ...styles.smallDropItem, opacity: isAllowed ? 1 : 0.35, cursor: isAllowed ? 'pointer' : 'not-allowed' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(t) && isAllowed}
                  disabled={!isAllowed}
                  onChange={() => isAllowed && onToggle(t)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span style={{ color: SELLER_TYPE_COLOR[t], fontWeight: 'bold', fontSize: '12px' }}>
                  {SELLER_TYPE_LABEL[t]}
                </span>
              </label>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function DetailTable({ wishlist, globalCondition, globalSellerTypes, bookConditions, setBookConditions, onToggleMust }) {
  function getEffectiveCond(isbn13) {
    const p = bookConditions[isbn13]?.condition;
    if (!p) return null;
    return COND_RANK[p] >= COND_RANK[globalCondition] ? p : null;
  }

  function getEffectiveSellers(isbn13) {
    const p = bookConditions[isbn13]?.sellerTypes;
    if (!p) return new Set(globalSellerTypes);
    return new Set([...p].filter(t => globalSellerTypes.has(t)));
  }

  function setCondition(isbn13, val) {
    setBookConditions(prev => ({ ...prev, [isbn13]: { ...prev[isbn13], condition: val || null } }));
  }

  function toggleSeller(isbn13, type) {
    const current = getEffectiveSellers(isbn13);
    const next = new Set(current);
    next.has(type) ? next.delete(type) : next.add(type);
    setBookConditions(prev => ({ ...prev, [isbn13]: { ...prev[isbn13], sellerTypes: next } }));
  }

  if (wishlist.length === 0) {
    return <div style={{ padding: '16px', color: '#aaa', fontSize: '13px' }}>위시리스트가 비어있습니다.</div>;
  }

  return (
    <table style={styles.detailTable}>
      <thead>
        <tr style={{ background: '#f8f8f8' }}>
          <th style={styles.dth}>표지</th>
          <th style={{ ...styles.dth, textAlign: 'left' }}>제목</th>
          <th style={styles.dth}>필수포함</th>
          <th style={styles.dth}>최소 등급</th>
          <th style={styles.dth}>판매처</th>
        </tr>
      </thead>
      <tbody>
        {wishlist.map(book => {
          const effectiveCond = getEffectiveCond(book.isbn13);
          const effectiveSellers = getEffectiveSellers(book.isbn13);

          return (
            <tr key={book.isbn13} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={styles.dtd}>
                <img src={book.cover} alt={book.title} style={{ width: '40px', display: 'block' }} />
              </td>
              <td style={{ ...styles.dtd, maxWidth: '220px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {book.title}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>{book.author}</div>
              </td>
              <td style={{ ...styles.dtd, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!book.mustInclude}
                  onChange={() => onToggleMust(book.isbn13, !book.mustInclude)}
                  style={{ accentColor: 'var(--color-primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </td>
              <td style={{ ...styles.dtd, textAlign: 'center' }}>
                <CondDropdown
                  value={effectiveCond}
                  globalCondition={globalCondition}
                  onChange={val => setCondition(book.isbn13, val)}
                />
              </td>
              <td style={{ ...styles.dtd, textAlign: 'center' }}>
                <SellerDropdown
                  allowed={globalSellerTypes}
                  selected={effectiveSellers}
                  onToggle={t => toggleSeller(book.isbn13, t)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function CombinationTab({ wishlist, results, combinations, loading, onOptimize, onToggleMust }) {
  // 전체 제약조건
  const [budget, setBudget] = useState({ min: '', max: '' });
  const [globalCondition, setGlobalCondition] = useState('하');
  const [globalDays, setGlobalDays] = useState('7');
  const [globalSellerTypes, setGlobalSellerTypes] = useState(new Set(ALL_SELLER_TYPES));
  const condDrop = usePortalDropdown();
  const daysDrop = usePortalDropdown();
  const sellerDrop = usePortalDropdown();

  // 세부 조건
  const [bookConditions, setBookConditions] = useState({});
  const [detailOpen, setDetailOpen] = useState(true);

  // 결과 표시
  const [expanded, setExpanded] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredShip, setHoveredShip] = useState(null);
  const [dedupe, setDedupe] = useState(true);

  function toggleGlobalSeller(type) {
    setGlobalSellerTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function handleOptimize() {
    if (!results?.books?.length) return;
    const mustMap = Object.fromEntries(wishlist.map(b => [b.isbn13, b.mustInclude]));

    const booksWithConstraints = results.books.map(book => {
      const perCond = bookConditions[book.isbn13]?.condition;
      const effectiveCond = perCond && COND_RANK[perCond] >= COND_RANK[globalCondition] ? perCond : globalCondition;

      const perSellers = bookConditions[book.isbn13]?.sellerTypes;
      const effectiveSellers = perSellers
        ? new Set([...perSellers].filter(t => globalSellerTypes.has(t)))
        : new Set(globalSellerTypes);

      const condRank = COND_RANK[effectiveCond] ?? 0;
      const filteredOptions = (book.options || []).filter(o => {
        if (!effectiveSellers.has(o.sellerType)) return false;
        if (o.sellerType === 'new') return true;
        return (COND_RANK[o.condition] ?? 0) >= condRank;
      });

      return { ...book, mustInclude: mustMap[book.isbn13] ?? false, options: filteredOptions };
    });

    onOptimize(booksWithConstraints, {
      minCondition: globalCondition,
      budget: { min: budget.min ? Number(budget.min) : 0, max: budget.max ? Number(budget.max) : 400000 },
      topK: 20,
    });
  }

  const globalSellerLabel = ALL_SELLER_TYPES.every(t => globalSellerTypes.has(t))
    ? '전체'
    : ALL_SELLER_TYPES.filter(t => globalSellerTypes.has(t)).map(t => SELLER_TYPE_LABEL[t]).join(', ') || '없음';

  const hasBooks = (results?.books?.length ?? 0) > 0;

  return (
    <div style={{ fontFamily: FONT }}>

      {/* ── 전체 제약조건 ── */}
      <div style={styles.constraintBox}>
        <div style={styles.constraintTitle}>전체 조건</div>

        <div style={styles.constraintRow}>
          <span style={styles.constraintLabel}>예산 범위</span>
          <input
            style={styles.budgetInput} type="number" placeholder="최소 (원)"
            value={budget.min} onChange={e => setBudget(p => ({ ...p, min: e.target.value }))}
          />
          <span style={{ color: '#666' }}>~</span>
          <input
            style={styles.budgetInput} type="number" placeholder="최대 (원)"
            value={budget.max} onChange={e => setBudget(p => ({ ...p, max: e.target.value }))}
          />
        </div>

        <div style={styles.constraintRow}>
          <span style={styles.constraintLabel}>최소 등급</span>
          <div>
            <button ref={condDrop.ref} style={styles.dropBtn} onClick={condDrop.toggle}>
              {globalCondition} <span style={styles.chevron}>▾</span>
            </button>
            {condDrop.open && createPortal(
              <div style={{ ...styles.portalMenu, top: condDrop.pos.top, left: condDrop.pos.left, minWidth: '100px' }} onClick={e => e.stopPropagation()}>
                {ALL_CONDITIONS.map(c => (
                  <div
                    key={c}
                    style={{ ...styles.dropItem, fontWeight: globalCondition === c ? 'bold' : 'normal', color: globalCondition === c ? 'var(--color-primary)' : '#222' }}
                    onClick={() => { setGlobalCondition(c); condDrop.close(); }}
                  >
                    {c}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          <span style={{ ...styles.constraintLabel, marginLeft: '20px' }}>최대 배송기한</span>
          <div>
            <button ref={daysDrop.ref} style={styles.dropBtn} onClick={daysDrop.toggle}>
              {globalDays}일 <span style={styles.chevron}>▾</span>
            </button>
            {daysDrop.open && createPortal(
              <div style={{ ...styles.portalMenu, top: daysDrop.pos.top, left: daysDrop.pos.left, minWidth: '100px' }} onClick={e => e.stopPropagation()}>
                {['1', '3', '5', '7'].map(d => (
                  <div
                    key={d}
                    style={{ ...styles.dropItem, fontWeight: globalDays === d ? 'bold' : 'normal', color: globalDays === d ? 'var(--color-primary)' : '#222' }}
                    onClick={() => { setGlobalDays(d); daysDrop.close(); }}
                  >
                    {d}일
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          <span style={{ ...styles.constraintLabel, marginLeft: '20px' }}>판매처</span>
          <div>
            <button ref={sellerDrop.ref} style={styles.dropBtn} onClick={sellerDrop.toggle}>
              {globalSellerLabel} <span style={styles.chevron}>▾</span>
            </button>
            {sellerDrop.open && createPortal(
              <div style={{ ...styles.portalMenu, top: sellerDrop.pos.top, left: sellerDrop.pos.left, minWidth: '160px' }} onClick={e => e.stopPropagation()}>
                {ALL_SELLER_TYPES.map(t => (
                  <label key={t} style={styles.sellerItem}>
                    <input type="checkbox" checked={globalSellerTypes.has(t)} onChange={() => toggleGlobalSeller(t)} style={{ accentColor: 'var(--color-primary)' }} />
                    <span style={{ color: SELLER_TYPE_COLOR[t], fontWeight: 'bold', fontSize: '13px' }}>{SELLER_TYPE_LABEL[t]}</span>
                  </label>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* ── 세부 조건 (토글) ── */}
      <div style={styles.detailHeader} onClick={() => setDetailOpen(p => !p)}>
        <span style={styles.detailTitle}>세부 조건</span>
        <span style={{ fontSize: '12px', color: '#888' }}>
          {detailOpen ? '접기 ▲' : '펼치기 ▼'}
        </span>
      </div>

      {detailOpen && (
        <div style={styles.detailBody}>
          <DetailTable
            wishlist={wishlist}
            globalCondition={globalCondition}
            globalSellerTypes={globalSellerTypes}
            bookConditions={bookConditions}
            setBookConditions={setBookConditions}
            onToggleMust={onToggleMust}
          />
        </div>
      )}

      {/* ── 조합 분석 버튼 ── */}
      <div style={styles.analyzeRow}>
        <span style={{ fontSize: '13px', color: '#666' }}>
          {wishlist.length}권 · 정가 합계 {wishlist.reduce((s, b) => s + (b.priceStandard || 0), 0).toLocaleString()}원
        </span>
        <button
          style={{ ...styles.analyzeBtn, opacity: hasBooks ? 1 : 0.5 }}
          disabled={!hasBooks || loading}
          onClick={handleOptimize}
        >
          {loading ? '분석 중...' : '조합 분석 →'}
        </button>
      </div>

      {/* ── 조합 결과 ── */}
      {loading && (
        <div style={styles.empty}>
          <div style={styles.progressBar}><div style={styles.progressFill} /></div>
          <p style={{ color: '#666', marginTop: '16px' }}>최적 조합 계산 중...</p>
        </div>
      )}

      {!loading && combinations === null && (
        <div style={styles.empty}>
          <p style={{ color: '#aaa', fontSize: '13px' }}>조건을 설정하고 조합 분석을 실행하세요.</p>
        </div>
      )}

      {!loading && combinations !== null && combinations.length === 0 && (
        <div style={styles.empty}>
          <p>조건에 맞는 조합이 없습니다.</p>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>예산 범위를 넓히거나 등급 조건을 완화해보세요.</p>
        </div>
      )}

      {!loading && combinations !== null && combinations.length > 0 && (
        <ResultSection
          combinations={combinations}
          results={results}
          expanded={expanded}
          setExpanded={setExpanded}
          hoveredRow={hoveredRow}
          setHoveredRow={setHoveredRow}
          hoveredShip={hoveredShip}
          setHoveredShip={setHoveredShip}
          dedupe={dedupe}
          setDedupe={setDedupe}
        />
      )}
    </div>
  );
}

// ─── 결과 섹션 (기존 CombinationTab 내용) ─────────────────────────────────────

function calcComboBreakdown(combo, results) {
  let bookTotal = 0;
  const multiSellers = new Map();

  for (const sel of combo.selections) {
    const choice = sel.choice;
    if (!choice) continue;
    const opt = choice.opt;
    if (choice.type === 'multi') {
      bookTotal += choice.cost;
      if (!multiSellers.has(choice._sid)) {
        const st = opt?.sellerType;
        multiSellers.set(choice._sid, {
          total: 0, shipping: opt?.shipping ?? 0,
          freeEligible: st === 'aladinUsed' || st === 'spaceUsed',
        });
      }
      multiSellers.get(choice._sid).total += choice.cost;
    } else if (choice.type === 'single') {
      bookTotal += opt?.price ?? 0;
    } else if (choice.type === 'new') {
      bookTotal += choice.cost;
    }
  }

  let shippingTotal = 0;
  for (const sel of combo.selections) {
    const choice = sel.choice;
    if (choice?.type === 'single') shippingTotal += choice.opt?.shipping ?? 0;
  }
  for (const { total, shipping, freeEligible } of multiSellers.values()) {
    shippingTotal += (freeEligible && total >= 20000) ? 0 : shipping;
  }

  // 새책 총가격
  const newBookIndex = Object.fromEntries(
    (results?.books ?? []).map(b => {
      const newOpt = (b.options ?? []).find(o => o.sellerType === 'new');
      return [b.isbn13, newOpt?.price ?? null];
    })
  );
  let newBookTotal = 0;
  let newBookMissing = false;
  for (const sel of combo.selections) {
    const p = newBookIndex[sel.isbn13];
    if (p == null) { newBookMissing = true; break; }
    newBookTotal += p;
  }

  return { bookTotal, shippingTotal, newBookTotal: newBookMissing ? null : newBookTotal };
}

function ResultSection({ combinations, expanded, setExpanded, hoveredRow, setHoveredRow, hoveredShip, setHoveredShip, dedupe, setDedupe, results }) {
  const displayed = dedupe ? deduplicateCombinations(combinations) : combinations;
  const [hoveredHeader, setHoveredHeader] = useState(null);

  function toggle(idx) {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={styles.controlBar}>
        <label style={styles.dedupeLabel}>
          <input
            type="checkbox" checked={dedupe}
            onChange={e => { setDedupe(e.target.checked); setExpanded({}); }}
            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
          중복 조합 제외 (같은 책 구성 중 최고 할인율만)
        </label>
        <span style={{ fontSize: '13px', color: '#888' }}>
          {displayed.length}개 조합{dedupe && combinations.length !== displayed.length ? ` (전체 ${combinations.length}개 중)` : ''}
        </span>
      </div>

      {displayed.map((combo, idx) => {
        const isOpen = expanded[idx] ?? false;
        const titles = combo.selections.map(s => s.title).join(' · ');

        const breakdown = calcComboBreakdown(combo, results);

        return (
          <div key={idx} style={styles.card}>
            <button style={styles.cardHeader} onClick={() => toggle(idx)}>
              <div style={styles.headerLeft}>
                <span style={styles.rank}>#{idx + 1}</span>
                <span style={styles.titles}>{titles}</span>
              </div>
              <div style={styles.headerRight}>
                <div
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}
                  onMouseEnter={() => setHoveredHeader(idx)}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  <span style={styles.totalCost}>{combo.totalCost.toLocaleString()}원</span>
                  <span style={styles.discountBadge}>{combo.realDiscount}% 할인</span>
                  {hoveredHeader === idx && (
                    <div style={styles.breakdownTooltip} onClick={e => e.stopPropagation()}>
                      <div style={styles.breakdownTitle}>견적서</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={styles.breakdownLabel}>책 가격 합계</td>
                            <td style={styles.breakdownValue}>{breakdown.bookTotal.toLocaleString()}원</td>
                          </tr>
                          <tr>
                            <td style={styles.breakdownLabel}>배송비</td>
                            <td style={{ ...styles.breakdownValue, color: breakdown.shippingTotal === 0 ? 'var(--color-primary)' : '#444' }}>
                              {breakdown.shippingTotal === 0 ? '무료' : `${breakdown.shippingTotal.toLocaleString()}원`}
                            </td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ ...styles.breakdownLabel, paddingTop: '8px', fontWeight: 'bold', color: '#222' }}>이 조합 합계</td>
                            <td style={{ ...styles.breakdownValue, paddingTop: '8px', fontWeight: 'bold', color: '#e6003e' }}>
                              {combo.totalCost.toLocaleString()}원
                            </td>
                          </tr>
                          {breakdown.newBookTotal != null && (
                            <>
                              <tr style={{ borderTop: '1px solid #eee' }}>
                                <td style={{ ...styles.breakdownLabel, paddingTop: '8px', color: '#888' }}>새책으로 모두 구매 시</td>
                                <td style={{ ...styles.breakdownValue, paddingTop: '8px', color: '#888' }}>
                                  {breakdown.newBookTotal.toLocaleString()}원
                                </td>
                              </tr>
                              <tr>
                                <td style={{ ...styles.breakdownLabel, color: '#00a650', fontWeight: 'bold' }}>절약</td>
                                <td style={{ ...styles.breakdownValue, color: '#00a650', fontWeight: 'bold' }}>
                                  {(breakdown.newBookTotal - combo.totalCost).toLocaleString()}원
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: '#999' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

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
                    // multi 타입만 추적: single(_sid='single')은 조합 내 1번만 나오므로 중복 없음
                    const sellerSpend = new Map();
                    for (const s of combo.selections) {
                      if (s.choice?.type !== 'multi') continue;
                      const sid = s.choice._sid;
                      const isSpaceAladin = s.choice.opt?.sellerType === 'spaceUsed' || s.choice.opt?.sellerType === 'aladinUsed';
                      if (sid && isSpaceAladin) sellerSpend.set(sid, (sellerSpend.get(sid) || 0) + (s.choice.cost || 0));
                    }

                    const seenSellers = new Map();
                    return combo.selections.map((sel, si) => {
                      const opt = sel.choice?.opt;
                      const type = sel.choice?.type;
                      const rowKey = `${idx}-${si}`;
                      const typeColor = SELLER_TYPE_COLOR[opt?.sellerType] || '#555';
                      const condColor = CONDITION_COLOR[opt?.condition] || '#888';
                      const isSpaceOrAladin = opt?.sellerType === 'spaceUsed' || opt?.sellerType === 'aladinUsed';
                      const sellerName = opt?.sellerName || (type === 'new' ? '알라딘' : '—');
                      const sellerId = sel.choice?._sid;
                      const hasShipping = type !== 'new' && opt?.shipping > 0;
                      // single 타입은 정의상 해당 판매자가 1권만 팔므로 중복 배송비 불가
                      const isDupeShipping = type === 'multi' && hasShipping && sellerId && seenSellers.has(sellerId);
                      const isFreeByAmount = type === 'multi' && isSpaceOrAladin && hasShipping && (sellerSpend.get(sellerId) || 0) >= 20000;
                      const firstBookTitle = isDupeShipping ? seenSellers.get(sellerId) : null;
                      if (type === 'multi' && hasShipping && sellerId && !seenSellers.has(sellerId)) seenSellers.set(sellerId, sel.title);

                      let shippingNode;
                      if (type === 'new' || opt?.shipping === 0) {
                        shippingNode = <span style={styles.freeShip}>무료</span>;
                      } else if (isDupeShipping) {
                        const tooltipText = `"${opt?.sellerName || '같은 판매처'}"에서 "《${firstBookTitle}》" 구매 시 이미 배송비가 청구되어 중복 청구되지 않습니다.`;
                        shippingNode = (
                          <span style={styles.strikeWrap} onMouseEnter={() => setHoveredShip(rowKey)} onMouseLeave={() => setHoveredShip(null)}>
                            <span style={styles.strikeText}>{opt.shipping.toLocaleString()}원</span>
                            {hoveredShip === rowKey && <span style={styles.tooltip}>{tooltipText}</span>}
                          </span>
                        );
                      } else if (isSpaceOrAladin) {
                        shippingNode = (
                          <span style={{ fontSize: '12px' }}>
                            {isFreeByAmount
                              ? <span style={styles.strikeText}>{opt.shipping.toLocaleString()}원</span>
                              : <span style={{ color: '#555' }}>{opt.shipping.toLocaleString()}원</span>}
                            <span style={styles.spaceShip}> (2만원↑무료)</span>
                          </span>
                        );
                      } else {
                        shippingNode = <span style={{ color: '#555', fontSize: '12px' }}>{opt?.shipping?.toLocaleString()}원</span>;
                      }

                      const productLink = opt?.productLink || (sel.isbn13 ? `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}` : null);

                      return (
                        <tr
                          key={si}
                          style={{ ...styles.tr, background: hoveredRow === rowKey ? '#f9f9f9' : '#fff' }}
                          onMouseEnter={() => setHoveredRow(rowKey)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td style={styles.tdThumb}>
                            {sel.cover && (
                              <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}`} target="_blank" rel="noreferrer">
                                <img src={sel.cover} alt={sel.title} style={styles.cover} />
                              </a>
                            )}
                          </td>
                          <td style={styles.tdTitle}>
                            <a href={`https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${sel.isbn13}`} target="_blank" rel="noreferrer" style={styles.titleLink}>
                              {sel.title}
                            </a>
                          </td>
                          <td style={styles.tdCell}>
                            <div>{opt ? <span style={{ ...styles.typePill, color: typeColor, borderColor: typeColor }}>{SELLER_TYPE_LABEL[opt.sellerType] || opt.sellerType}</span> : '—'}</div>
                            <div style={styles.sellerLine}>
                              {opt?.sellerLink
                                ? <a href={opt.sellerLink} target="_blank" rel="noreferrer" style={styles.sellerLinkStyle}>{sellerName}</a>
                                : <span>{sellerName}</span>}
                            </div>
                          </td>
                          <td style={styles.tdCondition}>
                            {opt?.condition ? <span style={{ fontWeight: 'bold', color: condColor, fontSize: '13px' }}>{opt.condition}</span> : '—'}
                          </td>
                          <td style={styles.tdCell}>
                            <div><span style={styles.price}>{(type === 'single' ? opt?.price : sel.choice?.cost)?.toLocaleString()}원</span>{opt?.discount > 0 && <span style={styles.discountSub}> ({opt.discount}%↓)</span>}</div>
                            <div style={{ marginTop: '3px' }}>{shippingNode}</div>
                          </td>
                          <td style={styles.tdBuy}>
                            {productLink && <a href={productLink} target="_blank" rel="noreferrer" style={styles.buyBtn}>구매</a>}
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
  // 전체 제약조건
  constraintBox: { background: '#fff', border: '1px solid #ddd', padding: '16px 20px', marginBottom: '0', display: 'flex', flexDirection: 'column', gap: '10px' },
  constraintTitle: { fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '13px' },
  constraintRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', flexWrap: 'wrap' },
  constraintLabel: { fontWeight: 'bold', color: '#444', fontSize: '13px', whiteSpace: 'nowrap' },
  budgetInput: { border: '1px solid #ddd', padding: '6px 10px', width: '130px', fontSize: '14px' },
  dropBtn: { border: '1px solid #ccc', background: '#fff', padding: '5px 12px', fontSize: '13px', color: '#222', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' },
  chevron: { fontSize: '11px', color: '#888' },
  dropItem: { padding: '8px 14px', fontSize: '13px', cursor: 'pointer' },
  portalMenu: { position: 'fixed', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999, padding: '4px 0' },
  sellerItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', cursor: 'pointer' },

  // 세부 조건
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f0f5ff', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' },
  detailTitle: { fontWeight: 'bold', fontSize: '13px', color: 'var(--color-primary)' },
  detailBody: { background: '#fff', border: '1px solid #ddd', borderTop: 'none', marginBottom: '0', overflowX: 'auto' },
  detailTable: { width: '100%', borderCollapse: 'collapse' },
  dth: { padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#555', borderBottom: '2px solid #eee', background: '#f8f8f8', textAlign: 'center' },
  dtd: { padding: '10px 12px', verticalAlign: 'middle' },
  smallDropBtn: { border: '1px solid #ddd', background: '#fff', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' },
  smallDropItem: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', cursor: 'pointer' },

  // 조합 분석 버튼
  analyzeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid #eee', marginTop: '0' },
  analyzeBtn: { background: 'var(--color-primary)', color: '#fff', padding: '11px 32px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', border: 'none' },

  // 결과 섹션
  empty: { textAlign: 'center', paddingTop: '40px', color: '#444', fontFamily: FONT },
  progressBar: { height: '3px', background: '#e8e8e8', overflow: 'hidden', maxWidth: '400px', margin: '0 auto' },
  progressFill: { height: '100%', width: '40%', background: 'var(--color-primary)', animation: 'slide 1.2s infinite ease-in-out' },
  controlBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' },
  dedupeLabel: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#444', cursor: 'pointer', userSelect: 'none' },
  card: { background: '#fff', border: '1px solid #e8e8e8', borderLeft: '4px solid var(--color-primary)', marginBottom: '10px' },
  cardHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '12px' },
  headerLeft: { display: 'flex', alignItems: 'baseline', gap: '10px', flex: 1, minWidth: 0 },
  rank: { fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary)', flexShrink: 0 },
  titles: { fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  totalCost: { fontSize: '15px', fontWeight: 'bold', color: '#e6003e' },
  discountBadge: { fontSize: '13px', fontWeight: 'bold', color: '#00a650', background: '#f0fff5', padding: '2px 8px', borderRadius: '20px', border: '1px solid #b2eac7' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '7px 6px', textAlign: 'center', borderBottom: '2px solid #eee', borderTop: '1px solid #f0f0f0', fontWeight: 'bold', color: '#555', fontSize: '12px', background: '#fafafa' },
  tr: { borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' },
  tdThumb: { padding: '8px 10px', width: '52px', textAlign: 'center', verticalAlign: 'middle' },
  cover: { width: '40px', display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' },
  tdTitle: { padding: '8px 6px', fontSize: '13px', color: '#222', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  titleLink: { color: '#222', textDecoration: 'none' },
  tdCell: { padding: '8px 6px', fontSize: '13px', color: '#222', textAlign: 'center', verticalAlign: 'middle' },
  tdCondition: { padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', width: '48px' },
  tdBuy: { padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', width: '60px' },
  typePill: { border: '1px solid', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold', borderRadius: '20px', background: 'transparent', whiteSpace: 'nowrap', display: 'inline-block' },
  sellerLine: { marginTop: '4px', fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' },
  sellerLinkStyle: { color: '#555', textDecoration: 'none' },
  price: { color: '#e6003e', fontWeight: 'bold', fontSize: '14px' },
  discountSub: { fontSize: '11px', color: '#e6003e', opacity: 0.8 },
  freeShip: { color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '12px' },
  spaceShip: { color: '#7b3fa0', fontSize: '11px', fontWeight: 'bold' },
  strikeWrap: { position: 'relative', display: 'inline-block', cursor: 'help' },
  strikeText: { color: '#bbb', fontSize: '12px', textDecoration: 'line-through' },
  tooltip: { position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', fontSize: '12px', lineHeight: '1.5', padding: '7px 11px', borderRadius: '5px', whiteSpace: 'normal', width: '220px', textAlign: 'center', zIndex: 200, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' },
  buyBtn: { background: 'var(--color-primary)', color: '#fff', padding: '4px 10px', fontSize: '12px', display: 'inline-block', textDecoration: 'none', borderRadius: '3px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  breakdownTooltip: {
    position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
    background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '12px 16px',
    whiteSpace: 'nowrap', zIndex: 200, minWidth: '200px', textAlign: 'left',
  },
  breakdownTitle: { fontWeight: 'bold', fontSize: '12px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  breakdownLabel: { fontSize: '13px', color: '#666', paddingBottom: '5px', paddingRight: '20px' },
  breakdownValue: { fontSize: '13px', color: '#444', textAlign: 'right', paddingBottom: '5px', fontVariantNumeric: 'tabular-nums' },
};
