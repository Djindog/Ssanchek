import { prisma } from './db.js';

export default async function handler(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: '인증 필요' });

  if (req.method === 'GET') {
    const result = await prisma.userCrawlResult.findUnique({
      where: { userId },
    });
    return res.status(200).json(result ? result.data : null);
  }

  if (req.method === 'POST') {
    const { data } = req.body;
    await prisma.userCrawlResult.upsert({
      where: { userId },
      update: { data, createdAt: new Date() },
      create: { userId, data },
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
