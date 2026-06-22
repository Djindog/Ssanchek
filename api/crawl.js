import * as cheerio from 'cheerio';

export const config = { maxDuration: 60 };

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseUsedList(html, sellerType) {
  const $ = cheerio.load(html);
  const results = [];

  $('tr').each((_, row) => {
    const conditionText = $(row).find('.Ere_sub_top').first().text().trim();
    if (!conditionText) return;

    const priceText = $(row).find('.Ere_fs20.Ere_sub_pink').text().replace(/,/g, '').trim();
    const price = parseInt(priceText);
    if (!price) return;

    const shippingLi = $(row).find('li').filter((_, el) =>
      $(el).text().includes('배송비')
    ).first().text();
    const shipping = parseInt(shippingLi.replace(/[^0-9]/g, '') || '0');

    const discountLi = $(row).find('li').filter((_, el) =>
      $(el).text().includes('할인')
    ).first().text();
    const discount = parseInt(discountLi.replace(/[^0-9]/g, '') || '0');

    const sellerEl = $(row).find('.seller a').first();
    const sellerName = sellerEl.text().trim();
    const sellerHref = sellerEl.attr('href') || '';
    const sellerLink = sellerHref.startsWith('http')
      ? sellerHref
      : `https://www.aladin.co.kr${sellerHref}`;

    // 판매자 ID 추출 (SC=xxxxx)
    const scMatch = sellerHref.match(/SC=(\d+)/);
    const sellerId = scMatch ? scMatch[1] : sellerName;

    const productEl = $(row).find('a[href*="wproduct"]').first();
    const productHref = productEl.attr('href') || '';
    const productLink = productHref.startsWith('http')
      ? productHref
      : `https://www.aladin.co.kr${productHref}`;

    results.push({
      sellerType,
      sellerId,
      sellerName,
      sellerLink,
      productLink,
      price,
      shipping,
      discount,
      condition: conditionText,
    });
  });

  return results;
}

// URL들을 병렬로 fetch (최대 concurrency 제한)
async function fetchAll(urls, concurrency = 10) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(({ url, type, isbn }) =>
        fetchPage(url).then(html =>
          parseUsedList(html, type).map(opt => ({ ...opt, isbn }))
        )
      )
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  }
  return results;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { books } = req.body;
  // books: [{ isbn, aladinUsedLink, userUsedLink, spaceUsedLink }]

  if (!books || !Array.isArray(books)) {
    return res.status(400).json({ error: 'books 배열이 필요합니다' });
  }

  try {
    // 모든 책의 크롤링 URL 목록 생성
    const urlList = [];
    for (const book of books) {
      if (book.aladinUsedLink) urlList.push({ url: book.aladinUsedLink, type: 'aladinUsed', isbn: book.isbn });
      if (book.userUsedLink)   urlList.push({ url: book.userUsedLink,   type: 'userUsed',   isbn: book.isbn });
      if (book.spaceUsedLink)  urlList.push({ url: book.spaceUsedLink,  type: 'spaceUsed',  isbn: book.isbn });
    }

    const allOptions = await fetchAll(urlList);

    // isbn별로 그룹화
    const byIsbn = {};
    for (const book of books) {
      byIsbn[book.isbn] = { isbn: book.isbn, options: [] };
    }
    for (const option of allOptions) {
      if (byIsbn[option.isbn]) {
        byIsbn[option.isbn].options.push(option);
      }
    }

    return res.status(200).json({ data: Object.values(byIsbn) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
