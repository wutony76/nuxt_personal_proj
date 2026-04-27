# Project Context: nuxt-personal-proj

## Product Overview

- Project name: `nuxt_personal_proj` (`my-portfolio`)
- Purpose: 個人 Nuxt 練習與展示專案，核心場景為彩票大廳、玩法頁與小遊戲頁
- Primary users: 專案維護者、內部測試使用者
- Current brand text in UI: `HappyFatYoYo`

## Current Tech Stack

- Frontend framework: Nuxt 4 (`nuxt@^4.4.2`)
- Build/runtime: Vite + Nitro (Nuxt default)
- State management: Pinia (`pinia` + `@pinia/nuxt`)
- Routing: Nuxt file-based routing（位於 `app/pages/`）
- HTTP client: `ofetch` (`$fetch`) + `axios`
- Validation: `vee-validate` + `zod`
- Utility libs: `lodash-es`, `dayjs`, `number-precision`, `crypto-js`, `bcryptjs`
- Styling: Tailwind CSS v4 + SCSS (`sass`)
- Content/UI modules: `@nuxt/content`, `@nuxt/image`, `@nuxt/ui`
- Runtime/toolchain: Node.js 22.x（Volta: `22.22.2`）, npm

## Repository Conventions

- App source code is under `app/`
- Server-side APIs/services are under `server/`
- UI pages are under `app/pages/`
- UI components are under `app/components/`
- Composables are under `app/composables/`
- Frontend config/constants are under `app/config/`
- Frontend helper functions are under `app/utils/`
- Frontend API wrapper is `app/services/api.ts`
- Server API routes are under `server/api/`
- Server domain logic/services are under `server/services/`

## Development Workflow

- 非 trivial 需求需走 OpenSpec 流程
- 順序：proposal -> design -> tasks -> implementation
- 變更保持小而可審查
- 調整功能行為時需補齊驗證（最少手動測試；可行時加自動化測試）

## Development Conventions (開發規範)

- **語言規範**：
  - OpenSpec 文件（proposal / design / tasks / project）使用繁體中文
  - 代碼命名、註解、commit message 使用英文
- **Vue 規範**：
  - 使用 `<script setup>`
  - 優先採 Composition API
- **狀態管理**：
  - 組件或 composable 內以單一 `reactive` 狀態物件為主（必要時才補 `ref`）
  - 全域狀態優先使用 Pinia setup store，避免在使用端解構 store
- **邏輯分層**：
  - UI 入口使用 `click`（或 `handleXxx` / `onXxx`）
  - 業務流程使用 `actions`（需 loading guard、early return、錯誤處理）
  - 私有資料轉換與工具方法集中在 `_handlers`
- **非同步處理**：
  - API 流程必須有 loading / success / error 三段狀態
  - 不可吞錯，至少需回傳錯誤或落入可觀測 state
  - 高頻事件優先使用 debounce / throttle
- **命名規範**：
  - composable: `useXxx`
  - store: `storeXxx`
  - actions: `fetchXxx` / `submitXxx`
  - private members: `_xxx`

## Style & UI Conventions

- Style 以 SCSS + Tailwind utilities 並行
- SCSS 使用 `@use` / `@forward`（禁止 `@import`）
- 盡量以 semantic token 管理顏色與間距，避免硬編碼 magic number
- 若為管理後台樣式，包在 `.theme-admin {}` scope 內

## Quality Expectations

- 優先可讀性與可維護性，避免無必要的大型重構
- 保持既有頁面路由與互動行為相容
- 交付前至少確認 `npm run dev` 可啟動，必要時驗證 `build` / `preview`
- 若有對應測試，需確保不被破壞

## Domain Notes

- 專案主域為彩票相關互動：
  - 大廳頁（例如 `lottery-hall`）
  - 六合彩玩法頁（例如 `6hc-of`, `6hc-cd`）
  - 下注、路珠、當期資訊等互動
- 另含遊戲展示頁（例如 racing / snake / tetriminos）
- 包含基本登入流程與 session cookie 驗證

## Architecture Snapshot (Latest)

- Nuxt app 以 `app/` + `server/` 雙層結構運作
- 主要前端頁面：
  - `app/pages/index.vue`
  - `app/pages/lottery-hall.vue`
  - `app/pages/lottery/bg/6hc-of.vue`
  - `app/pages/lottery/bg/6hc-cd.vue`
- 主要 composables：
  - `useAuth`
  - `useDialog`
  - `use6hcOfficial`
  - `useA6Official`
- 前端 API 入口：`app/services/api.ts`
  - `auth` / `lottery` / `taiwanLottery` 分組
- 後端 API（Nitro server routes）示例：
  - `/api/login`, `/api/logout`, `/api/me`
  - `/api/lottery/games`, `/api/lottery/bet`
  - `/api/lottery/6hc-of/current`, `/api/lottery/6hc-of/road`
- Server 端以 `server/services/` 組織 auth、storage、orders、lottery 邏輯

## OpenSpec Progress

- Current status: 初始化階段，尚未登記新的活躍 change id
- Next step:
  - 若要新增功能，先建立 proposal / design / tasks
  - 若要修正小問題，可評估是否屬於 trivial change

## Open Questions (Fill as needed)

- 是否要統一既有 `.ts` 檔與「新程式碼以 JavaScript 為主」的規範？
- 是否需要補齊 lint / test script 到 `package.json`（目前未顯式提供）？
- 部署目標（平台、環境變數、CI）是否已有固定策略？
