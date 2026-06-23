# Ssanchek 프로젝트 핸드오프 문서

## 프로젝트 개요

**싼책(Ssanchek)** — 알라딘 중고책 최적 구매 조합 분석기.
위시리스트에 책을 담으면 크롤링으로 중고 가격을 수집하고, Sparse DP 알고리즘으로 배송비 포함 최저 비용 조합을 찾아준다.

- **로컬 개발**: 터미널 2개 필요
  - `npm run api` — Express API 서버 (port 3000)
  - `npm run dev` (frontend/) — Vite 개발 서버 (port 5173, /api → 3000 프록시)
- **배포**: Vercel (`npx vercel --prod`)
- **DB**: Supabase PostgreSQL + Prisma 7

---

## 기술 스택 및 주요 설정

| 항목 | 내용 |
|------|------|
| Frontend | React (Vite), 인라인 스타일 (CSS-in-JS 없음) |
| Backend | Node.js Express (로컬), Vercel Serverless Functions (프로덕션) |
| DB | Supabase PostgreSQL |
| ORM | Prisma 7 — `@prisma/adapter-pg` 필수 (아래 참고) |
| 인증 | Supabase Auth (이메일 `@ssanchek.com` 도메인) |
| 크롤링 | cheerio (서버사이드, Aladin HTML 파싱) |

### Prisma 7 주의사항 (중요)
Prisma 7은 반드시 adapter 패턴을 써야 함. `new PrismaClient()` 단독 사용 불가.

```js
// api/db.js
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}
export const prisma = globalThis.prisma ?? createPrisma();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

`schema.prisma`의 datasource에는 `url` 필드가 없어야 함:
```prisma
datasource db {
  provider = "postgresql"
  // url 없음 — adapter로 전달
}
```

---

## 파일 구조

```
Ssanchek/
├── api/                      # Vercel Serverless Functions (로컬에서는 server.js가 라우팅)
│   ├── db.js                 # Prisma 클라이언트 (adapter 패턴)
│   ├── search.js             # GET /api/search?query=
│   ├── lookup.js             # GET /api/lookup?isbn13=
│   ├── crawl.js              # POST /api/crawl — 중고 옵션 크롤링 + CrawlCache DB
│   ├── crawl-result.js       # GET/POST /api/crawl-result — 유저별 크롤 결과 저장
│   └── wishlist.js           # GET/POST/DELETE/PATCH /api/wishlist
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.js   # Supabase 클라이언트
│   │   │   └── api.js        # fetch wrapper (x-user-id 헤더 자동 첨부)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx # 아이디(@ssanchek.com 자동 붙임) + 비번 로그인
│   │   │   └── MainPage.jsx  # 탭 레이아웃 + 상태 관리 허브
│   │   └── components/
│   │       ├── SearchTab.jsx  # 알라딘 API 검색
│   │       ├── WishlistTab.jsx # 위시리스트 + 조합 분석 트리거
│   │       └── ResultTab.jsx  # 크롤 결과 표시 + 정렬/필터
│   └── vite.config.js        # /api → localhost:3000 프록시
├── prisma/schema.prisma      # DB 스키마
├── server.js                 # 로컬 Express 서버
├── vercel.json               # 빌드 설정
└── algorithm.md              # Sparse DP 알고리즘 설계 문서 (반드시 읽을 것)
```

---

## DB 스키마 요약

```
User           — Supabase Auth UID 기반
Wishlist       — 유저당 1개 사용 (현재 멀티 위시리스트 UI 없음)
WishlistItem   — isbn13, title, author, publisher, cover, priceStandard, priceSales, mustInclude
CrawlCache     — isbn13별 크롤 결과, 24시간 TTL
UserCrawlResult — 유저별 마지막 조합 분석 결과 (JSON blob)
```

---

## 데이터 플로우

### 크롤링 흐름
1. `WishlistTab.handleAnalyze()` 실행
2. 현재 `results` state에서 이미 있는 ISBN은 재사용 (delta crawling)
3. 새 책만: `GET /api/lookup?isbn13=` → usedList URL 3개 획득
4. `POST /api/crawl` → 서버에서 알라딘 HTML 크롤링 → CrawlCache DB 저장
5. `onAnalyze()` 콜백으로 results state 업데이트 (streaming 방식, 책마다 즉시 렌더)
6. 크롤 완료 후 `saveCrawlResult()` → `/api/crawl-result` POST → UserCrawlResult DB

### 페이지 로드 시 복원
- `MainPage` 마운트 시 `fetchCrawlResult()` → DB에서 마지막 결과 복원
- wishlist도 동시에 `fetchWishlist()` 로드

### 인증
- 모든 API 요청에 `x-user-id: <supabase_user_id>` 헤더 포함
- wishlist.js, crawl-result.js가 이 헤더로 유저 식별 + User/Wishlist 자동 생성

---

## 크롤링 파서 구조

알라딘 HTML에서 판매처 유형 식별:
- `.Ere_used_store` 있으면 → `spaceUsed` (광활한우주점), 지점명은 `.Ere_store_name a`
- `.Ere_used_aladin` 있으면 → `aladinUsed` (알라딘 직접배송), sellerName = ''
- 둘 다 없으면 → `userUsed` (일반 판매자), 판매자명은 `.seller a`

조건 등급: `.Ere_sub_top`(최상) / `.Ere_sub_middle`(상) / `.Ere_sub_low`(중/하)

---

## ResultTab UI 구조

- 책별 섹션 (파란 left border)
- 각 섹션: 헤더(새책 정보) + 중고 옵션 테이블
- 전역 컨트롤 바: 정렬 드롭다운 + 등급 필터 드롭다운 (체크박스)
- 판매가: `10000원 (40% 할인)` 형식 한 줄
- 배송비: 광활한우주점이면 `3500원 (2만원↑ 무료)` 형식
- 판매자 열: maxWidth 200px + ellipsis

---

## 현재 상태 (2026-06-23 기준)

### 완료된 기능
- [x] 로그인 (Supabase Auth, @ssanchek.com 도메인)
- [x] 책 검색 (알라딘 API)
- [x] 위시리스트 CRUD + DB 영속화
- [x] 크롤링 (알라딘 중고 3종: aladinUsed, userUsed, spaceUsed)
- [x] CrawlCache (24시간 TTL)
- [x] Delta crawling (위시리스트 변경분만 재크롤)
- [x] 크롤 결과 DB 저장/복원 (UserCrawlResult JSON blob)
- [x] ResultTab UI (정렬, 등급 필터, 판매가 할인율 표시)

### 미구현 (다음 작업)
- [ ] **Sparse DP 알고리즘** — `algorithm.md` 참고. 이것이 핵심 미구현 기능
  - 구현 위치 미결정: 백엔드 API (`/api/optimize`) vs 프론트엔드 Web Worker
  - M(멀티판매처 수) 실측 필요 → M≤15면 Sparse DP, M>20이면 SA 폴백
- [ ] 알고리즘 결과를 ResultTab에 표시 (현재는 크롤 결과 나열만)
- [ ] 알고리즘 결과 DB 저장 (UserCrawlResult에 통합 or 별도 모델)

---

## 환경 변수

### 백엔드 (.env in 루트)
```
DATABASE_URL=postgresql://...   # Supabase connection string
ALADIN_API_KEY=...
```

### 프론트엔드 (frontend/.env.local)
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Vercel 대시보드에도 동일하게 등록되어 있음.

---

## 알고리즘 구현 시작점

`algorithm.md`를 먼저 읽을 것. 요약:

1. **전처리**: 등급/배송기한 필터 → 새책 기준가 초과 제거 → 멀티/싱글 판매처 분류 → 싱글은 최저가 압축
2. **Sparse DP**: `Map<(spent, seller_bitmask), {discount, selections}>` — 책 순서대로 처리, 같은 key면 할인율 높은 것 유지
3. **배송비**: 멀티판매처 집합 기준으로 지점별 합산 (우주점 2만원 이상 무료)
4. **필수포함**: mustInclude 책 먼저 처리, 남은 예산으로 탐색
5. **결과**: 예산 [min,max] 필터 후 Top K 반환

입력 데이터 형태 (`results.books` 배열의 각 원소):
```js
{
  isbn13: '9788966260959',
  title: '...',
  cover: '...',
  priceStandard: 18000,
  mustInclude: false,
  options: [
    { sellerType: 'new', price: 16200, shipping: 0, discount: 10, condition: '새책' },
    { sellerType: 'aladinUsed', sellerId: 'aladin', sellerName: '', price: 9000, shipping: 0, discount: 50, condition: '상' },
    { sellerType: 'spaceUsed', sellerId: '123', sellerName: '광활한우주마산점', price: 8000, shipping: 2500, discount: 55, condition: '최상' },
    { sellerType: 'userUsed', sellerId: 'SC456', sellerName: '홍길동책방', price: 7500, shipping: 2500, discount: 58, condition: '중' },
    // ...
  ]
}
```
