const TTB_KEY = process.env.ALADIN_TTB_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { isbn13, isbn, itemId } = req.query;
  const id = isbn13 || isbn || itemId;
  const itemIdType = isbn13 ? 'ISBN13' : isbn ? 'ISBN' : 'ItemId';
  if (!id) return res.status(400).json({ error: 'isbn13, isbn, 또는 itemId 파라미터가 필요합니다' });

  const url = `http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${TTB_KEY}&itemIdType=${itemIdType}&ItemId=${id}&output=js&Version=20131101&Cover=Mid&OptResult=usedList`;

  try {
    const apiRes = await fetch(url);
    const data = await apiRes.json();

    if (!data.item || data.item.length === 0) {
      return res.status(404).json({ error: '책을 찾을 수 없습니다' });
    }

    const book = data.item[0];
    return res.status(200).json({
      isbn13: book.isbn13,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      cover: book.cover,
      priceStandard: book.priceStandard,
      priceSales: book.priceSales,
      link: book.link,
      usedList: book.subInfo?.usedList ?? null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
