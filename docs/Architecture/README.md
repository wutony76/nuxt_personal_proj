# 專案架構：my-portfolio（nuxt_personal_proj）

定位：Frontend / Full Stack Engineering Project。

## 技術棧

- 框架：Nuxt 4（Vite + Nitro）
- 狀態管理：Pinia
- 路由：Nuxt file-based routing（`app/pages/`）
- HTTP：`ofetch`（`$fetch`）+ `axios`
- 驗證：`vee-validate` + `zod`
- 樣式：Tailwind CSS v4 + SCSS（`@use`/`@forward`）
- UI/內容模組：`@nuxt/ui`、`@nuxt/image`、`@nuxt/content`
- 工具庫：`lodash-es`、`dayjs`、`number-precision`、`crypto-js`、`bcryptjs`、`dexie`
- Runtime：Node.js 22.x（Volta）、npm

## 技術選型決策

### 為什麼選用 Nuxt

- **背景**：專案需求是開發一個新版的 BG 彩票前端，技術指定為 Nuxt，此為公司技術決策。
- **實際發展**：開發過程中，團隊決定沿用既有的 Vue 寫法來架構專案，導致最終呈現「包了一層 Nuxt 外殼的 Vue」，並未真正落地 Nuxt 的核心優勢（例如 SSR、file-based routing、Nitro server API 等）。
- **已驗證的效能問題**：這種架構方式偏離了 Nuxt 應有的用法，效能確實受到影響（例如喪失 SSR 帶來的效益）。實際觀察到：資料量大時需要長時間等待，畫面會出現白屏（blank screen），且伴隨長時間 loading。
- **根因分析（舊公司專案，非本 repo）**：
  - **SSR 被 routeRules 全面關閉**：全域設 SSR，但把幾乎所有實際頁面覆蓋成 CSR —「有資料、有邏輯」的頁面全部關掉 SSR，只剩框架的殼。
  - **沒有用 Nuxt 官方的資料獲取方式**：全專案完全沒用到 Nuxt 提供的 `useAsyncData`/`useFetch`，還是照舊 Vue 的寫法：等頁面元件掛載完成後，才在 `onMounted` 裡手動打 API 拿資料，loading 狀態也是自己土法煉鋼控制，不是交給 Nuxt 內建機制處理。這種寫法在整個專案裡到處都是（多達 44 個檔案），例如 `trend.vue` 這種報表頁，就是進頁面之後才發 API 去要資料。
  - **CSR waterfall 是白屏／長 loading 的根因**：頁面先送出空殼 HTML（因為 `ssr:false`），瀏覽器要等 JS 下載、執行、掛載，`onMounted` 才觸發 fetch，資料回來才 render——典型 CSR waterfall（HTML → JS → 掛載 → fetch → render），而非 SSR 直接吐出含資料的 HTML。報表類頁面（trend、bet_search、coin_ledger）資料量大時這個 waterfall 被放大，體驗上就是「白屏 + 轉圈圈」。
  - **代價**：連帶讓 Nuxt 其他核心優勢（SEO、首屏 TTFB、資料去重快取）全部作廢，等於用 Nuxt 的建置複雜度，換來 Vue SPA 的效能天花板，且更差（多一層框架開銷）。
  - 註：以上檔案／行號引用的是舊公司專案，**非本 repo**；本 repo（`nuxt_personal_proj`）的 `nuxt.config.ts` 目前沒有 `routeRules`，純粹作為個人作品集展示用途，記錄於此作為之後開發的借鏡。
- **參考 URL**：http://104.199.176.35/credit/#/?domain=fntuser-dev.tlsanheng.com&searchCode=96225&nuxt
  - 測試帳密: newt02b0022/newt02b0022
- **本 repo 的改正（2026-10）**：盤點後發現本 repo 原本也是同一個模式（`useFetch`/`useAsyncData`
  使用 0 次，94 個頁面中有 74 個在 `onMounted` 才抓資料），因此挑兩類頁面改成 SSR 資料獲取：
  - **公開頁：`/lottery-hall`**（`add-ssr-lottery-hall-pools`）
    - 彩池首次抓取改用 `useAsyncData`，既有的 10 秒輪詢保留。
    - `app/services/api.ts` 原本 `import { $fetch } from 'ofetch'`。原生 ofetch 在 SSR 端無法解析相對路徑，
      改用 Nuxt 注入的全域 `$fetch`，伺服器端呼叫 `/api/*` 時會直接在同一個 process 內執行 handler。
    - 首次真實數字 486ms → 226ms；TTFB 17ms → 20ms。
  - **需登入頁：`/admin/reports`**（`add-ssr-admin-reports-cookie-forward`）
    - 報表資料抽成 `useAdminReportData`，以 `useRequestHeaders(['cookie'])` 轉發 cookie。
    - `AdminShell.vue` 的權限檢查改成 setup 頂層 `await`，SSR 階段就完成驗證。
    - **修掉跨請求狀態污染**：`useAuth`/`useAdminAuth` 原本是模組層級的 `reactive({})`，
      在 SSR 下整個 Nitro process 共用一份，會讓不同帳號的登入狀態互相覆蓋。
      改用 `useState()`，進行中的 promise 改用以 `nuxtApp` 為 key 的 `WeakMap` 去重複。
    - 第一版反而變慢（390ms → 485ms），根因是 hydration 時 `guard()` 清掉 SSR 狀態後又重打 API；
      以 `nuxtApp.isHydrating` 修正後，production build p50 186ms / p90 312ms
      （`fix-admin-guard-hydration-duplicate-fetch`；改造前基準尚待以 production build 重新量測）。
  - **刻意不轉換的頁面**：遊戲頁（canvas、`requestAnimationFrame`）和下注頁。前者 SSR 沒有好處；
    後者的存取檢查 `app/middleware/game-access.global.ts` 目前只在 client 端執行，另案處理。
  - 量測方法、完整數據與更正紀錄見
    [`docs/Engineering Evidence/ssr-performance-log.md`](../Engineering%20Evidence/ssr-performance-log.md)。

## 部署架構

線上 Demo 部署在 Google Cloud：e2-micro VM（Caddy + pm2 + Cloud SQL Auth Proxy + 刮刮樂試算 Python 服務）+ Cloud SQL PostgreSQL。
架構圖、部署流程、開機順序與資料流向見 [`docs/deployment/architecture.md`](../deployment/architecture.md)，
建置步驟見 [`docs/deployment/gcp-vm.md`](../deployment/gcp-vm.md)。

## 頂層目錄

```
├─ app/            前端主程式（Nuxt 4 app 目錄結構）
├─ server/         Nitro 後端 API / 服務層
├─ shared/         前後端共用設定（純資料，禁止 import 的 JS 宣告檔）
├─ openspec/       規格驅動開發文件（proposal/design/tasks/validation/engineering-evidence 流程）
├─ docs/           工程文件（Architecture、Engineering Evidence）
├─ public/         靜態資源
├─ assets/         全域資源（svg 等）
├─ prompt/         提示詞/文件相關素材
├─ SAMPLE/         設計參考樣本
├─ nuxt.config.ts
├─ tsconfig.json
└─ package.json
```

## app/ 前端結構

```
app/
├─ app.vue                     根組件
├─ pages/                      檔案式路由
│  ├─ index.vue / login.vue / game-hall.vue
│  ├─ lottery-hall.vue / lottery-hall-taiwan.vue / taiwan-lottery-hall.vue
│  ├─ admin/                   後台頁（games / roles / reports / bg-lottery...）
│  ├─ game/                    各款小遊戲頁（2048、pac-man、tetriminos...約30款）
│  └─ lottery/bg/              各盤口玩法頁（6hc-cd/of、kl8、pl3、fc3d...）
├─ components/
│  ├─ admin/                   後台專用組件（Shell、GameNav、RoleList...）
│  ├─ lottery/bg/<game>/       依「盤口」分層：
│  │    <game>/            共用（cd 與 of 都用）
│  │      base/ 原子元件、block/ 版面區塊、block/footer/ 頁尾共用
│  │    <game>/cd/         信用盤專屬（base/block/block/footer）
│  │    <game>/of/         官方盤專屬（base/block/block/footer）
│  └─ social/                  社交/聊天相關組件
├─ composables/                useXxx（useAuth、useDialog、use6hcCredit、useSocket...）
├─ services/                   API 封裝層（api.ts、authService、lottery*Service）
├─ config/                     前端常數與設定（constants.js、gameSprites.ts）
├─ middleware/                 路由中介層（game-access.global.ts）
├─ plugins/                    Nuxt 插件（handle.ts）
├─ utils/                      純函式與各遊戲引擎（*Engine.ts）
└─ types/                      前端型別定義
```

## app/assets/style/ 樣式結構（7-1 pattern）

```
app/assets/style/
├─ main.scss              唯一 manifest，只做 @use forwarding，不寫實際樣式規則
├─ abstracts/             全域 CSS 變數（:root { --xxx }）
├─ base/                  全域基礎樣式（body、.lottery-scrollbar 等）
├─ vendors/               第三方資源（Google Fonts @import url()）
└─ themes/                依「主題／盤口」分層的 scope 樣式：
   ├─ lottery/            各樂透玩法（.lottery-*／.theme-taiwan-lottery），
   │                      _index.scss 統一 forward 資料夾內 partial
   ├─ admin/               後台管理主題（.admin-scope）
   └─ project/             Portfolio 專案展示主題（.project-scope）
```

`nuxt.config.ts` 的 `css` 陣列只掛兩項：`main.scss`（上述 manifest）+
`app/assets/css/main.css`（Tailwind entry，走 `@layer base`，優先權天生低於
manifest 產出的 non-layered 規則，兩者順序互不影響）。

## server/ 後端結構（Nitro）

```
server/
├─ api/
│  ├─ admin/                   後台管理 API（games、roles、role-defs、members...）
│  ├─ games/                   遊戲存取權限 API
│  ├─ lottery/                 下注、玩家資訊
│  ├─ taiwan-lottery/          台彩相關 API
│  ├─ ws/                      WebSocket（social）
│  └─ login/logout/me/servTime 基礎登入與時間 API
├─ services/
│  ├─ admin/                   後台業務邏輯（hfyyGameCalc、hfyyManage...）
│  ├─ game/
│  │  ├─ retro/                各小遊戲後端邏輯（含 leaderboard、history）
│  │  └─ lottery/bg/           各盤口後端邏輯（依遊戲拆分 cd/of + shared + orders）
│  ├─ social/                  聊天、廣播、socket hub
│  └─ auth / storage / users / walletBalance / loginHistory / base
├─ middleware/                 auth.ts
├─ plugins/                    init.ts
├─ config/                     admin.ts
├─ types/                      storage.ts
└─ utils/                      auth、encrypt、error、socketAuth
```

## 後台存取模型（server/services/admin/modules/adminAccess.ts）

- `adminIds` 白名單（`server/config/admin.ts`，寫死常數，重啟回復）是唯一的「完整管理員」
  身分來源；`role` 欄位本身不授予權限，只是白名單內外的顯示標籤
- `accessLevel(userId)` 回傳 `'admin' | 'demo' | 'none'`：白名單一律 `'admin'`；非白名單
  帳號若被指派了 `demoMode: true` 的角色（內建 `demo` 角色即是）回 `'demo'`，可唯讀瀏覽
  整個後台但打不了任何寫入端點；其餘 `'none'`
- 後台 API 兩種守門：`sessionController.requireAdmin()`（白名單限定，所有寫入端點
  POST/PATCH/PUT/DELETE 用這個）／`requireAdminView()`（admin 或 demo 皆可，只給
  唯讀 GET 端點用）
- 前端 `Shell.vue` 用 `<fieldset disabled>` 包住 demo 帳號看到的頁面內容，UI 層擋掉
  所有表單操作；真正的安全邊界仍在後端 `requireAdmin`

## shared/config/

- 各盤口純資料設定（cd、of、eggscd、fc3dof、k3cd/of、kl10cd、kl8cd、pk10cd/of、pl3of、ssccd/of、x5cd/of）
- 特例：此目錄下皆為純 JS 宣告檔，禁止 `import`（Nitro 對 `shared` 走 Node 原生 ESM，不認別名）

## 時區

- 整個 server 固定在 `Asia/Taipei`。台彩、BG 盤口大量使用 `getHours()`／`setHours()`／`getDay()` 等本地時間 API，
  雲端主機與 GitHub Actions 預設 UTC，不固定會讓開獎與鎖單時間差 8 小時。
- 主要機制：`package.json` 的 `dev`／`preview`／`start` 啟動時帶 `TZ=Asia/Taipei`。`nuxt dev` 的 Nitro 跑在
  worker thread，執行期修改 `process.env.TZ` 不會生效，所以必須在 process 啟動時決定。
- 保底：`server/plugins/00.timezone.ts` 在 production 主執行緒執行期設定時區，仍不正確時印出 `TTT---WARN.TIMEZONE`。
- 台彩日曆式開獎（DLT／D539／M539／M649／P3／P4／SUPERLOTTO）共用
  `server/services/game/lottery/tw/drawSchedule.ts` 的 `nextDrawWindow()`，明確以 UTC+8 計算，不依賴上述設定。

## 測試與 CI

- `test/unit/**/*.test.ts` → `npm run test:unit`：Vitest 單元測試，只測不依賴 Nuxt／Nitro runtime 的純函式，
  以 `TZ=UTC` 執行；設定見 `vitest.config.ts`
- `test/test-*.mjs`：對真實 dev server（`http://localhost:6100`）送出真實 HTTP／WebSocket 請求的
  端到端測試腳本，共用 `test/_test-utils.mjs` 的 `createTestRunner()`（login/api/ok/section/summary）；
  需要同一腳本內模擬多個身分（如角色權限測試）時用其 `actor()`／`createHttpClient()`
- 彙總器（固定列舉子腳本，各自表達一個有業務意義的分組）：
  - `test/test-bg-all.mjs` → `npm run test:bg`：BG 15 盤口（6hc-cd 因限額機制尚不完整故意排除，
    單期限額只做到分頁層級，跨分頁與玩家層級限額尚未實作，需要時另外跑 `npm run test:6hc-cd`）
  - `test/test-games-all.mjs` → `npm run test:games`：retro 遊戲中心 30 款 + 復古童玩 8 款
- `test/ci-test-all.mjs` → `npm test`：CI 專用彙總器，動態從 `package.json` 抓出全部 `test:` 開頭的
  script 執行（不手動列舉，新增測試腳本自動被涵蓋），供 `.github/workflows/ci.yml` 的 `test` job 呼叫
- `.github/workflows/ci.yml`：`build`（`npm run build`）與 `test`（背景啟動 dev server + `npm test`）
  兩個獨立 job，詳見 `openspec/reference/ci-pipeline-plan.md`（5 階段 CI 導入規劃，Phase 1/5 已上線）

## 開發規範重點（詳見 `openspec/project.md`）

- 命名：TS 為主（僅 `shared/config` 例外）；composable=`useXxx`、store=`storeXxx`、action=`fetchXxx`/`submitXxx`
- 狀態：組件/composable 內以單一 `reactive` 物件為主；全域用 Pinia setup store
- 邏輯分層：`click`（UI 入口）→ `actions`（業務流程，需 loading guard）→ `_handlers`（私有工具）
- 非同步需有 loading/success/error 三段狀態，不可吞錯
- SCSS 用巢狀語法、`@use`/`@forward`（禁止 `@import`），依 7-1 pattern 收在
  `app/assets/style/`，`main.scss` 為唯一 manifest（見上方「app/assets/style/ 樣式結構」）
- 新遊戲一律走 OpenSpec 六階段流程：Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence

---

最後更新：2026-10-02（補上後台報表頁 SSR + cookie 轉發、useAuth/useAdminAuth 改用 useState 的追蹤記錄）
