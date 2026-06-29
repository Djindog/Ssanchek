export const config = { maxDuration: 60 };

const CONDITION_RANK = { '최상': 3, '상': 2, '중': 1, '하': 0 };
const BUDGET_UNIT = 100;
// aladinUsed는 sellerId를 'aladin' 고정으로 취급 — spaceUsed와 동일한 2만원 무료 로직
const ALADIN_SELLER_ID = 'aladin';

// ─── Min-Heap (할인율 기준) ───────────────────────────────────────────────────

class MinHeap {
  constructor() { this.data = []; }
  get size() { return this.data.length; }
  peek() { return this.data[0]; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._siftDown(0); }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].realDiscount <= this.data[i].realDiscount) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _siftDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].realDiscount < this.data[smallest].realDiscount) smallest = l;
      if (r < n && this.data[r].realDiscount < this.data[smallest].realDiscount) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ─── 전처리 ───────────────────────────────────────────────────────────────────

function preprocess(books, minCondition) {
  const minRank = CONDITION_RANK[minCondition] ?? 0;

  // 1. 새책 기준가 필터 + 등급 필터
  for (const book of books) {
    const newOpt = book.options.find(o => o.sellerType === 'new');
    const newPrice = newOpt ? newOpt.price : Infinity;

    book.options = book.options.filter(o =>
      o.sellerType === 'new' ||
      (
        (CONDITION_RANK[o.condition] ?? 0) >= minRank &&
        o.price + o.shipping <= newPrice
      )
    );

    // 2. 같은 판매처·같은 등급 중 비싼 것 제거
    // sellerId+condition 기준으로 총비용 최저 1개만 유지
    const best = new Map(); // key: `${sellerId}|${condition}`
    for (const o of book.options) {
      if (o.sellerType === 'new') continue;
      const key = `${o.sellerId}|${o.condition}`;
      const prev = best.get(key);
      const cost = o.price + o.shipping;
      if (!prev || cost < prev.price + prev.shipping) best.set(key, o);
    }
    book.options = [
      ...book.options.filter(o => o.sellerType === 'new'),
      ...best.values(),
    ];
  }

  // 3. 멀티판매처 식별 (sellerId 기준, aladinUsed는 ALADIN_SELLER_ID로 통일)
  const sellerBooks = new Map(); // sellerId → Set<isbn13>
  for (const book of books) {
    for (const o of book.options) {
      if (o.sellerType === 'new') continue;
      const sid = o.sellerType === 'aladinUsed' ? ALADIN_SELLER_ID : o.sellerId;
      if (!sellerBooks.has(sid)) sellerBooks.set(sid, new Set());
      sellerBooks.get(sid).add(book.isbn13);
    }
  }
  const multiSellers = new Set(
    [...sellerBooks.entries()].filter(([, s]) => s.size >= 2).map(([id]) => id)
  );

  // 4. 멀티판매처 → bitmask index 부여
  const multiIndex = new Map();
  for (const sid of multiSellers) multiIndex.set(sid, multiIndex.size);
  const M = multiIndex.size;

  // 5. 각 책의 choices 압축
  for (const book of books) {
    const multiOpts = [];
    let bestSingle = null; // 싱글판매처 최저가 1개

    for (const o of book.options) {
      if (o.sellerType === 'new') continue;
      const sid = o.sellerType === 'aladinUsed' ? ALADIN_SELLER_ID : o.sellerId;
      if (multiSellers.has(sid)) {
        multiOpts.push({ ...o, _sid: sid });
      } else {
        const cost = o.price + o.shipping;
        if (!bestSingle || cost < bestSingle.price + bestSingle.shipping) {
          bestSingle = { ...o, _sid: 'single' };
        }
      }
    }

    const newOpt = book.options.find(o => o.sellerType === 'new');

    // choices: skip / new / single최저 / 멀티각각
    book.choices = [{ type: 'skip' }];
    if (newOpt) book.choices.push({ type: 'new', cost: newOpt.price, opt: newOpt, _sid: 'new' });
    if (bestSingle) book.choices.push({ type: 'single', cost: bestSingle.price + bestSingle.shipping, opt: bestSingle, _sid: 'single' });
    for (const o of multiOpts) book.choices.push({ type: 'multi', cost: o.price, opt: o, _sid: o._sid });
  }

  // 6. 순서 최적화: 멀티판매처 없는 책 먼저
  books.sort((a, b) => {
    const aHasMulti = a.choices.some(c => c.type === 'multi');
    const bHasMulti = b.choices.some(c => c.type === 'multi');
    return aHasMulti - bHasMulti;
  });

  // 7. pruning용 suffix 배열
  // 각 책의 최대 절감액 = priceStandard - min(선택지 총비용) (skip은 0원 절감)
  const suffixMaxSavings  = new Array(books.length + 1).fill(0);
  const suffixStandard    = new Array(books.length + 1).fill(0);
  for (let i = books.length - 1; i >= 0; i--) {
    const b = books[i];
    const minCost = Math.min(0, ...b.choices.map(c => c.type === 'skip' ? 0 : (c.cost ?? 0)));
    const maxSaving = Math.max(0, b.priceStandard - minCost);
    suffixMaxSavings[i] = suffixMaxSavings[i + 1] + maxSaving;
    suffixStandard[i]   = suffixStandard[i + 1]   + b.priceStandard;
  }

  return { books, multiIndex, M, suffixMaxSavings, suffixStandard };
}

// ─── 배송비 정산 ──────────────────────────────────────────────────────────────

function calcTotalCost(node, multiIndex) {
  // parent-pointer chain 역추적
  const selections = [];
  let cur = node;
  while (cur.parent !== null) {
    selections.push(cur.choice);
    cur = cur.parent;
  }

  let bookCost = 0;
  const multiSpend = new Map(); // sid → { total, shipping, isAladin }

  for (const choice of selections) {
    if (!choice || choice.type === 'skip') continue;
    if (choice.type === 'multi') {
      bookCost += choice.cost;
      if (!multiSpend.has(choice._sid)) {
        const st = choice.opt.sellerType;
        multiSpend.set(choice._sid, { total: 0, shipping: choice.opt.shipping, freeEligible: st === 'aladinUsed' || st === 'spaceUsed' });
      }
      multiSpend.get(choice._sid).total += choice.cost;
    } else {
      // new or single (배송비 이미 포함)
      bookCost += choice.cost;
    }
  }

  let shipping = 0;
  for (const { total, shipping: s, freeEligible } of multiSpend.values()) {
    // aladinUsed, spaceUsed만 2만원 이상이면 무료 (판매자 중고 userUsed는 해당 없음)
    const free = freeEligible && total >= 20000;
    shipping += free ? 0 : s;
  }

  return bookCost + shipping;
}

// ─── Sparse DP ────────────────────────────────────────────────────────────────

function sparseDP(books, multiIndex, M, budget, topK, suffixMaxSavings, suffixStandard) {
  const maxSpent = Math.ceil(budget.max / BUDGET_UNIT);

  // 상태: Map<key, node>
  // key = spent * (2^M) + bitmask  (Number 안전 범위: M≤20이면 OK)
  // node = { savingsSum, standardSum, spent, mask, parent, choice }
  const encode = (spent, mask) => spent * (1 << M) + mask;

  let dp = new Map();
  const rootNode = { savingsSum: 0, standardSum: 0, spent: 0, mask: 0, parent: null, choice: null };
  dp.set(encode(0, 0), rootNode);

  const heap = new MinHeap();

  const [mustBooks, optBooks] = [
    books.filter(b => b.mustInclude),
    books.filter(b => !b.mustInclude),
  ];

  for (let bi = 0; bi < books.length; bi++) {
    const book = books[bi];
    const next = new Map();
    const threshold = heap.size >= topK ? heap.peek().realDiscount : -Infinity;

    for (const [, state] of dp) {
      // pruning: 지금까지 절감액 + 남은 책 최대 절감액 / 지금까지 정가 + 남은 정가
      const totalStandardUB = state.standardSum + suffixStandard[bi];
      if (totalStandardUB > 0) {
        const upperBound = (state.savingsSum + suffixMaxSavings[bi]) / totalStandardUB;
        if (upperBound < threshold) continue;
      }

      for (const choice of book.choices) {
        if (choice.type === 'skip' && book.mustInclude) continue;

        const addCost = choice.type === 'skip' ? 0 : Math.ceil(choice.cost / BUDGET_UNIT);
        const newSpent = state.spent + addCost;
        if (newSpent > maxSpent) continue;

        const newMask = choice.type === 'multi'
          ? state.mask | (1 << multiIndex.get(choice._sid))
          : state.mask;

        const saving = choice.type === 'skip' ? 0 : (book.priceStandard - choice.cost);
        const newSavings  = state.savingsSum  + Math.max(0, saving);
        const newStandard = choice.type === 'skip' ? state.standardSum : state.standardSum + book.priceStandard;

        const key = encode(newSpent, newMask);
        const existing = next.get(key);
        // 같은 key면 실질 할인율(savingsSum/standardSum) 높은 것 유지
        if (!existing || newSavings / newStandard > existing.savingsSum / existing.standardSum) {
          next.set(key, { savingsSum: newSavings, standardSum: newStandard, spent: newSpent, mask: newMask, parent: state, choice });
        }
      }
    }
    dp = next;
  }

  // 결과 수집 — 예산 범위 필터 + heap으로 Top-K 유지
  const minSpent = Math.floor(budget.min / BUDGET_UNIT);

  for (const [, node] of dp) {
    if (node.spent < minSpent) continue;

    const totalCost = calcTotalCost(node, multiIndex);
    if (totalCost < budget.min || totalCost > budget.max) continue;

    const totalStandard = node.standardSum;
    if (totalStandard === 0) continue;

    const realDiscount = (totalStandard - totalCost) / totalStandard;

    if (heap.size < topK) {
      heap.push({ realDiscount, node, totalCost, totalStandard });
    } else if (realDiscount > heap.peek().realDiscount) {
      heap.pop();
      heap.push({ realDiscount, node, totalCost, totalStandard });
    }
  }

  // heap → 결과 배열 (역추적으로 selections 복원)
  return heap.data
    .sort((a, b) => b.realDiscount - a.realDiscount)
    .map(({ realDiscount, node, totalCost, totalStandard }) => {
      const selections = [];
      let cur = node;
      let bi = books.length - 1;
      while (cur.parent !== null) {
        if (cur.choice && cur.choice.type !== 'skip') {
          selections.unshift({ isbn13: books[bi].isbn13, title: books[bi].title, cover: books[bi].cover, choice: cur.choice });
        }
        cur = cur.parent;
        bi--;
      }
      return { selections, totalCost, totalStandard, realDiscount: Math.round(realDiscount * 1000) / 10 };
    });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { books, constraints = {} } = req.body;
  if (!books || !Array.isArray(books) || books.length === 0) {
    return res.status(400).json({ error: 'books 배열이 필요합니다' });
  }

  const {
    minCondition = null,
    budget = { min: 0, max: 400000 },
    topK = 20,
  } = constraints;

  try {
    // 깊은 복사 (원본 훼손 방지)
    const booksCopy = JSON.parse(JSON.stringify(books));

    const { books: processed, multiIndex, M, suffixMaxSavings, suffixStandard } = preprocess(booksCopy, minCondition);

    if (M > 20) {
      return res.status(200).json({ warning: `멀티판매처 수(${M})가 20 초과 — SA 폴백 미구현`, results: [] });
    }

    const results = sparseDP(processed, multiIndex, M, budget, topK, suffixMaxSavings, suffixStandard);

    return res.status(200).json({ M, stateCount: null, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
