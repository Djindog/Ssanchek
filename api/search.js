const TTB_KEY = process.env.ALADIN_TTB_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { query, queryType = 'Title', start = 1 } = req.query;
  if (!query) return res.status(400).json({ error: 'query 파라미터가 필요합니다' });

  const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(query)}&QueryType=${queryType}&SearchTarget=Book&output=js&Version=20131101&MaxResults=20&start=${start}&Cover=Mid&OptResult=usedList`;

  try {
    const apiRes = await fetch(url);
    const data = await apiRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
