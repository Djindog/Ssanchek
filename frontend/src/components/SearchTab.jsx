import { useState, useRef } from 'react';

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif";

function parseISBNsFromXLS(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const items = []; // { value, type: 'ISBN13' | 'ISBN' }

  for (const table of doc.querySelectorAll('table')) {
    const rows = [...table.querySelectorAll('tr')];
    let col13 = -1, col10 = -1, colTitle = -1;

    for (const row of rows) {
      const cells = [...row.querySelectorAll('td, th')];
      if (col13 === -1 && col10 === -1) {
        const i13 = cells.findIndex(c => c.textContent.trim() === 'ISBN13');
        const i10 = cells.findIndex(c => c.textContent.trim() === 'ISBN');
        const iTitle = cells.findIndex(c => c.textContent.trim() === '상품명');
        if (i13 !== -1 || i10 !== -1) { col13 = i13; col10 = i10; colTitle = iTitle; continue; }
        continue;
      }
      const v13 = col13 !== -1 ? (cells[col13]?.textContent?.trim() ?? '') : '';
      const v10 = col10 !== -1 ? (cells[col10]?.textContent?.trim() ?? '') : '';
      const title = colTitle !== -1 ? (cells[colTitle]?.textContent?.trim() ?? '') : '';
      if (/^97[89]\d{10}$/.test(v13)) {
        items.push({ value: v13, type: 'ISBN13', title });
      } else if (/^\d{9}[\dX]$/i.test(v10) || /^U\d+$/.test(v10)) {
        items.push({ value: v10, type: 'ISBN', title });
      }
    }
  }

  const seen = new Set();
  return items.filter(({ value }) => seen.has(value) ? false : seen.add(value));
}

export default function SearchTab({ wishlist, onAdd, onBulkAdd, query, onQueryChange, results, onResultsChange }) {
  const [mode, setMode] = useState('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState(''); // '' | 'parsing' | 'loading' | 'done' | 'error'
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      onResultsChange(data.item || []);
    } catch {
      setError('검색 중 오류가 발생했습니다.');
    }
    setLoading(false);
  }

  async function handleImport() {
    if (!importFile || !onBulkAdd) return;
    setImportStatus('parsing');
    setImportResult(null);
    setError('');

    try {
      const text = await importFile.text();
      const isbns = parseISBNsFromXLS(text);

      if (!isbns.length) {
        setImportStatus('error');
        setError('ISBN을 찾을 수 없습니다. 올바른 파일인지 확인해주세요.');
        return;
      }

      setImportStatus('loading');
      setImportProgress({ done: 0, total: isbns.length });

      const result = await onBulkAdd(isbns, ({ done, total }) => {
        setImportProgress({ done, total });
      });

      setImportResult(result);
      setImportStatus('done');
    } catch {
      setImportStatus('error');
      setError('파일 처리 중 오류가 발생했습니다.');
    }
  }

  function switchMode(m) {
    setMode(m);
    setImportFile(null);
    setImportStatus('');
    setImportResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const isBusy = importStatus === 'parsing' || importStatus === 'loading';

  return (
    <div style={{ fontFamily: FONT }}>
      {/* 모드 탭 */}
      <div style={styles.modeBar}>
        {[
          { id: 'search',   label: '검색' },
          { id: 'basket',   label: '장바구니' },
          { id: 'savelist', label: '보관함' },
        ].map(m => (
          <button
            key={m.id}
            style={{ ...styles.modeBtn, ...(mode === m.id ? styles.modeBtnActive : {}) }}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── 검색 ── */}
      {mode === 'search' && (
        <div>
          <form onSubmit={handleSearch} style={styles.searchRow}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="책 제목 또는 ISBN으로 검색"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
            />
            <button style={styles.searchBtn} type="submit" disabled={loading}>
              {loading ? '검색중...' : '검색'}
            </button>
          </form>

          {error && <p style={styles.error}>{error}</p>}

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
                      <td style={styles.tdPrice}>{book.priceStandard?.toLocaleString()}원</td>
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
      )}

      {/* ── 장바구니 / 보관함 가져오기 ── */}
      {(mode === 'basket' || mode === 'savelist') && (
        <div style={styles.importBox}>
          <div style={styles.guideBox}>
            {mode === 'basket' ? (
              <>
                <div style={styles.guideTitle}>장바구니 엑셀 파일 가져오기</div>
                <div style={styles.guideText}>
                  알라딘 장바구니 페이지 하단의 <strong>'선택한 상품 주문하기'</strong> 버튼 왼쪽에 있는{' '}
                  <strong style={{ color: '#217346' }}>엑셀저장</strong> 버튼을 눌러 다운로드한 파일을 업로드하세요.
                </div>
              </>
            ) : (
              <>
                <div style={styles.guideTitle}>보관함 엑셀 파일 가져오기</div>
                <div style={styles.guideText}>
                  알라딘 보관함 페이지 우측 상단의{' '}
                  <strong style={{ color: '#217346' }}>엑셀 아이콘</strong>을 눌러 다운로드한 파일을 업로드하세요.
                </div>
              </>
            )}
          </div>

          <div style={styles.uploadRow}>
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx,.html,.htm"
              style={{ display: 'none' }}
              onChange={e => {
                setImportFile(e.target.files[0] || null);
                setImportStatus('');
                setImportResult(null);
              }}
            />
            <button style={styles.fileBtn} onClick={() => fileRef.current?.click()} disabled={isBusy}>
              파일 선택
            </button>
            <span style={styles.fileName}>
              {importFile ? importFile.name : '선택된 파일 없음'}
            </span>
            <button
              style={{ ...styles.confirmBtn, opacity: importFile && !isBusy ? 1 : 0.5 }}
              disabled={!importFile || isBusy}
              onClick={handleImport}
            >
              {isBusy ? '가져오는 중...' : '확인'}
            </button>
          </div>

          {importStatus === 'parsing' && (
            <div style={styles.statusText}>파일 파싱 중...</div>
          )}

          {importStatus === 'loading' && importProgress.total > 0 && (
            <div style={styles.progressWrap}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(importProgress.done / importProgress.total) * 100}%`,
                  }}
                />
              </div>
              <span style={styles.statusText}>
                {importProgress.done} / {importProgress.total}권 조회 중...
              </span>
            </div>
          )}

          {importStatus === 'done' && importResult && (
            <div style={styles.doneBox}>
              <div style={styles.doneMsg}>
                ✓ {importResult.added}권 추가됨
                {importResult.skipped > 0 && (
                  <span style={{ color: '#888', fontWeight: 'normal' }}> ({importResult.skipped}권 이미 있음)</span>
                )}
                {importResult.failed > 0 && (
                  <span style={{ color: '#e6003e', fontWeight: 'normal' }}> · {importResult.failed}권 실패</span>
                )}
              </div>
              {importResult.titles?.length > 0 && (
                <ul style={styles.titleList}>
                  {importResult.titles.map((t, i) => (
                    <li key={i} style={styles.titleItem}>· {t}</li>
                  ))}
                </ul>
              )}
              {importResult.failedItems?.length > 0 && (
                <ul style={{ ...styles.titleList, marginTop: '8px' }}>
                  {importResult.failedItems.map((f, i) => (
                    <li key={i} style={{ ...styles.titleItem, color: '#e6003e' }}>
                      · {f.title ? <span>{f.title}</span> : <code style={{ fontSize: '11px', background: '#fff0f0', padding: '1px 4px', borderRadius: '3px' }}>{f.value}</code>}
                      <span style={{ color: '#999', fontWeight: 'normal' }}> — {f.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                위시리스트 탭에서 매물 수집 현황을 확인하세요
              </div>
            </div>
          )}

          {importStatus === 'error' && (
            <div style={{ ...styles.doneMsg, color: '#e6003e' }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  modeBar: {
    display: 'flex', marginBottom: '24px',
    borderBottom: '2px solid #e0e0e0',
  },
  modeBtn: {
    padding: '10px 22px', background: 'none', color: '#888', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '14px', fontFamily: 'inherit',
    borderBottom: '2px solid transparent', marginBottom: '-2px',
  },
  modeBtnActive: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' },

  searchRow: { display: 'flex', gap: '8px', marginBottom: '20px' },
  searchInput: { flex: 1, border: '1px solid #ddd', padding: '10px 14px', fontSize: '15px', outline: 'none' },
  searchBtn: { background: 'var(--color-primary)', color: '#fff', padding: '10px 24px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' },
  error: { color: '#e6003e', marginBottom: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  thead: { background: '#f0f5ff' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--color-primary)', fontWeight: 'bold', color: '#333' },
  tr: { borderBottom: '1px solid #eee' },
  tdCover: { padding: '12px', width: '80px' },
  cover: { width: '60px', display: 'block' },
  tdInfo: { padding: '12px', verticalAlign: 'top' },
  title: { fontWeight: 'bold', marginBottom: '4px', color: '#222' },
  meta: { fontSize: '12px', color: '#888' },
  tdPrice: { padding: '12px', textAlign: 'right', color: '#444', whiteSpace: 'nowrap' },
  salePrice: { color: '#e6003e', fontWeight: 'bold' },
  tdAction: { padding: '12px', textAlign: 'center', width: '120px' },
  btnAdd: { background: 'var(--color-primary)', color: '#fff', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAdded: { background: '#ccc', color: '#fff', padding: '6px 14px', fontSize: '13px', cursor: 'default', whiteSpace: 'nowrap' },
  empty: { color: '#888', textAlign: 'center', marginTop: '40px' },

  importBox: { padding: '4px 0' },
  guideBox: {
    background: '#f5f8ff', border: '1px solid #d0dff5',
    padding: '16px 20px', borderRadius: '6px', marginBottom: '20px',
  },
  guideTitle: { fontWeight: 'bold', fontSize: '15px', color: 'var(--color-primary)', marginBottom: '8px' },
  guideText: { fontSize: '13px', color: '#444', lineHeight: '1.8' },
  uploadRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  fileBtn: {
    border: '1px solid #aaa', background: '#fff', padding: '8px 16px',
    fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: '#333', flexShrink: 0,
  },
  fileName: { fontSize: '13px', color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  confirmBtn: {
    background: 'var(--color-primary)', color: '#fff', padding: '8px 20px',
    fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', flexShrink: 0,
  },
  progressWrap: { marginBottom: '8px' },
  progressBar: { height: '4px', background: '#e8e8e8', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' },
  progressFill: { height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s ease' },
  statusText: { fontSize: '13px', color: '#666' },
  doneBox: { padding: '4px 0' },
  doneMsg: { fontSize: '14px', fontWeight: 'bold', color: '#00a650', marginBottom: '8px' },
  titleList: { listStyle: 'none', margin: '0', padding: '0', display: 'flex', flexDirection: 'column', gap: '3px' },
  titleItem: { fontSize: '13px', color: '#444', paddingLeft: '12px', position: 'relative' },
};
