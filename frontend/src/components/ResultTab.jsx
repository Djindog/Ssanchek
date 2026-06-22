export default function ResultTab({ results }) {
  if (!results || results.length === 0) {
    return (
      <div style={styles.empty}>
        <p>분석 결과가 없습니다.</p>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          위시리스트 탭에서 조합 분석을 실행해주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {results.map((combo, idx) => (
        <div key={idx} style={styles.comboBox}>
          {/* 조합 헤더 - 총 가격 / 할인율 강조 */}
          <div style={styles.comboHeader}>
            <div style={styles.comboRank}>#{idx + 1}</div>
            <div style={styles.comboStat}>
              <span style={styles.totalPrice}>{combo.totalCost?.toLocaleString()}원</span>
              <span style={styles.discount}>평균 {combo.discountRate}% 할인</span>
            </div>
            <div style={styles.comboMeta}>
              {combo.sellerSummary}
            </div>
          </div>

          {/* 책별 테이블 */}
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>표지</th>
                <th style={styles.th}>책 제목</th>
                <th style={styles.th}>등급</th>
                <th style={styles.th}>판매처</th>
                <th style={styles.th}>판매가</th>
                <th style={styles.th}>배송비</th>
                <th style={styles.th}>할인율</th>
                <th style={styles.th}>링크</th>
              </tr>
            </thead>
            <tbody>
              {combo.items?.map((item, i) => (
                <tr key={i} style={styles.tr}>
                  <td style={styles.tdCover}>
                    <img src={item.cover} alt={item.title} style={styles.cover} />
                  </td>
                  <td style={styles.td}>{item.title}</td>
                  <td style={styles.tdCenter}>
                    <span style={styles.conditionBadge}>{item.condition}</span>
                  </td>
                  <td style={styles.td}>{item.sellerName}</td>
                  <td style={styles.tdRight}>
                    <span style={styles.price}>{item.price?.toLocaleString()}원</span>
                  </td>
                  <td style={styles.tdRight}>
                    {item.shipping === 0
                      ? <span style={styles.freeShip}>무료</span>
                      : `${item.shipping?.toLocaleString()}원`}
                  </td>
                  <td style={styles.tdRight}>
                    <span style={styles.discountBadge}>{item.discount}%</span>
                  </td>
                  <td style={styles.tdCenter}>
                    <a href={item.productLink} target="_blank" rel="noreferrer" style={styles.link}>
                      구매
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 배송비 합계 푸터 */}
          <div style={styles.comboFooter}>
            <span>책 가격 합계 {combo.itemPrice?.toLocaleString()}원</span>
            <span>+ 배송비 {combo.totalShipping?.toLocaleString()}원</span>
            <span style={styles.totalFinal}>= 총 {combo.totalCost?.toLocaleString()}원</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  empty: { textAlign: 'center', paddingTop: '60px', color: '#444' },
  comboBox: {
    background: '#fff',
    border: '1px solid #ddd',
    marginBottom: '20px',
  },
  comboHeader: {
    background: '#f0f5ff',
    borderBottom: '2px solid #0066cc',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  comboRank: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#0066cc',
    minWidth: '32px',
  },
  comboStat: { display: 'flex', alignItems: 'baseline', gap: '12px', flex: 1 },
  totalPrice: { fontSize: '24px', fontWeight: 'bold', color: '#e6003e' },
  discount: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#0066cc',
    background: '#e8f0ff',
    padding: '2px 8px',
  },
  comboMeta: { fontSize: '13px', color: '#666' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#fafafa' },
  th: {
    padding: '9px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #eee',
    fontWeight: 'bold',
    color: '#555',
    fontSize: '13px',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  tdCover: { padding: '10px 12px', width: '70px' },
  cover: { width: '50px', display: 'block' },
  td: { padding: '10px 12px', fontSize: '14px', color: '#222' },
  tdCenter: { padding: '10px 12px', textAlign: 'center' },
  tdRight: { padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' },
  conditionBadge: {
    background: '#f0f5ff',
    color: '#0066cc',
    border: '1px solid #0066cc',
    padding: '2px 6px',
    fontSize: '12px',
  },
  price: { color: '#e6003e', fontWeight: 'bold' },
  freeShip: { color: '#0066cc', fontWeight: 'bold' },
  discountBadge: { color: '#e6003e', fontWeight: 'bold' },
  link: {
    background: '#0066cc',
    color: '#fff',
    padding: '4px 10px',
    fontSize: '12px',
    display: 'inline-block',
  },
  comboFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #eee',
    display: 'flex',
    gap: '16px',
    fontSize: '14px',
    color: '#555',
    justifyContent: 'flex-end',
  },
  totalFinal: { fontWeight: 'bold', color: '#e6003e' },
};
