import * as cheerio from 'cheerio';
import { prisma } from './db.js';

export const config = { maxDuration: 60 };

const CACHE_TTL_HOURS = 24;

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
    const conditionText = $(row).find('.Ere_sub_top, .Ere_sub_middle, .Ere_sub_low').first().text().trim();
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

    // 판매처 유형 판별 및 판매자명/링크 추출
    let sellerName = '';
    let sellerHref = '';
    let detectedType = sellerType;

    const spaceEl = $(row).find('.Ere_used_store');
    const aladinEl = $(row).find('.Ere_used_aladin');
    const storeNameEl = $(row).find('.Ere_store_name a');

    if (spaceEl.length) {
      // 광활한우주점
      detectedType = 'spaceUsed';
      sellerName = storeNameEl.text().replace(/\s+/g, ' ').trim();
      sellerHref = storeNameEl.attr('href') || '';
    } else if (aladinEl.length) {
      // 알라딘 직접 배송
      detectedType = 'aladinUsed';
      sellerName = '';
      sellerHref = '';
    } else {
      // 일반 판매자 - 첫 번째 a가 판매자명 링크
      detectedType = 'userUsed';
      const sellerEl = $(row).find('.seller a').first();
      sellerName = sellerEl.text().trim();
      sellerHref = sellerEl.attr('href') || '';
    }

    const sellerLink = sellerHref.startsWith('http')
      ? sellerHref
      : sellerHref ? `https://www.aladin.co.kr${sellerHref}` : '';

    const scMatch = sellerHref.match(/SC=(\d+)/);
    const sellerId = scMatch ? scMatch[1] : sellerName;

    const productEl = $(row).find('a[href*="wproduct"]').first();
    const productHref = productEl.attr('href') || '';
    const productLink = productHref.startsWith('http')
      ? productHref
      : `https://www.aladin.co.kr${productHref}`;

    results.push({
      sellerType: detectedType,
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
  if (!books || !Array.isArray(books)) {
    return res.status(400).json({ error: 'books 배열이 필요합니다' });
  }

  try {
    const now = new Date();
    const byIsbn = {};
    for (const book of books) {
      byIsbn[book.isbn] = { isbn: book.isbn, options: [], fromCache: false };
    }

    // 1. 캐시 확인 — 유효한 캐시 있는 책은 DB에서 바로 가져오기
    const cachedRows = await prisma.crawlCache.findMany({
      where: {
        isbn13: { in: books.map(b => b.isbn) },
        expiresAt: { gt: now },
      },
    });

    const cachedIsbns = new Set();
    for (const row of cachedRows) {
      byIsbn[row.isbn13].options.push({
        sellerType: row.sellerType,
        sellerId:   row.sellerId,
        sellerName: row.sellerName,
        sellerLink: row.sellerLink,
        productLink: row.productLink,
        price:      row.price,
        shipping:   row.shipping,
        discount:   row.discount,
        condition:  row.condition,
      });
      cachedIsbns.add(row.isbn13);
    }

    // 2. 캐시 없는 책만 크롤링
    const urlList = [];
    for (const book of books) {
      if (cachedIsbns.has(book.isbn)) continue;
      if (book.aladinUsedLink) urlList.push({ url: book.aladinUsedLink, type: 'aladinUsed', isbn: book.isbn });
      if (book.userUsedLink)   urlList.push({ url: book.userUsedLink,   type: 'userUsed',   isbn: book.isbn });
      if (book.spaceUsedLink)  urlList.push({ url: book.spaceUsedLink,  type: 'spaceUsed',  isbn: book.isbn });
    }

    if (urlList.length > 0) {
      const allOptions = await fetchAll(urlList);
      for (const opt of allOptions) {
        if (byIsbn[opt.isbn]) byIsbn[opt.isbn].options.push(opt);
      }

      // 3. 크롤링 결과 DB에 저장 (isbn 단위로 기존 캐시 삭제 후 새로 삽입)
      const crawledIsbns = [...new Set(allOptions.map(o => o.isbn))];
      if (crawledIsbns.length > 0) {
        await prisma.crawlCache.deleteMany({
          where: { isbn13: { in: crawledIsbns } },
        });
        const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
        await prisma.crawlCache.createMany({
          data: allOptions.map(opt => ({
            isbn13:      opt.isbn,
            sellerType:  opt.sellerType,
            sellerId:    opt.sellerId,
            sellerName:  opt.sellerName,
            sellerLink:  opt.sellerLink,
            productLink: opt.productLink,
            price:       opt.price,
            shipping:    opt.shipping,
            discount:    opt.discount,
            condition:   opt.condition,
            expiresAt,
          })),
        });
      }
    }

    return res.status(200).json({ data: Object.values(byIsbn) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
