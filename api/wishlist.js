import { prisma } from './db.js';

export default async function handler(req, res) {
  const { method } = req;
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: '인증 필요' });

  // 유저 upsert (최초 요청 시 자동 생성)
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@ssanchek.com` },
    });
  } catch (e) {
    console.error('PRISMA ERROR code:', e.code, 'meta:', JSON.stringify(e.meta), 'message:', e.message, 'cause:', e.cause?.message);
    return res.status(500).json({ error: e.code, meta: e.meta, message: e.message });
  }

  // 위시리스트 1개만 사용 (유저당)
  async function getOrCreateWishlist() {
    let wishlist = await prisma.wishlist.findFirst({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }
    return wishlist;
  }

  if (method === 'GET') {
    const wishlist = await getOrCreateWishlist();
    const items = await prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      orderBy: { addedAt: 'asc' },
    });
    return res.status(200).json(items);
  }

  if (method === 'POST') {
    const { isbn13, title, author, publisher, cover, priceStandard, priceSales } = req.body;
    const wishlist = await getOrCreateWishlist();
    const item = await prisma.wishlistItem.upsert({
      where: { wishlistId_isbn13: { wishlistId: wishlist.id, isbn13 } },
      update: {},
      create: { wishlistId: wishlist.id, isbn13, title, author, publisher, cover, priceStandard, priceSales },
    });
    return res.status(200).json(item);
  }

  if (method === 'DELETE') {
    const { isbn13 } = req.query;
    const wishlist = await getOrCreateWishlist();
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, isbn13 },
    });
    return res.status(200).json({ ok: true });
  }

  if (method === 'PATCH') {
    const { isbn13, mustInclude } = req.body;
    const wishlist = await getOrCreateWishlist();
    await prisma.wishlistItem.updateMany({
      where: { wishlistId: wishlist.id, isbn13 },
      data: { mustInclude },
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
