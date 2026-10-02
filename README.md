# HAPPYFATYOYO WORLD

> 個人作品集網站，同時也是一個「規格驅動開發（Spec-Driven Development）」的全端工程實驗場。
> 以 Nuxt 4 打造，涵蓋 30+ 款小遊戲、台灣彩券與 BG 風格多盤口模擬玩法、具 RBAC 權限的後台管理系統，以及即時社交聊天室。

## 這是什麼

這個 repo 本身就是作品集的其中一項作品：它不只是靜態的展示頁面，而是一個會持續擴充功能的全端專案，
每一次新增功能都走完整的 **OpenSpec 六階段流程**（Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence），
並留下對應文件（詳見 [`openspec/changes/`](openspec/changes)、[`docs/Architecture`](docs/Architecture)、[`docs/Engineering Evidence`](docs/Engineering%20Evidence)）。

## 功能亮點

- **30+ 款小遊戲**（[`app/pages/game/`](app/pages/game)）：2048、小蜜蜂、小精靈、踩地雷、連連看、塔防、俄羅斯方塊等經典小品，皆為自製遊戲引擎（[`app/utils/*Engine.ts`](app/utils)）。
- **8 款復古童玩**（[`app/pages/toys/`](app/pages/toys)）：扭蛋機、竹蜻蜓、彈珠台等懷舊互動小品。
- **台灣彩券模擬玩法**（[`app/pages/lottery/tw/`](app/pages/lottery/tw)）：威力彩、大樂透、今彩 539、38 選一、3 星彩、4 星彩、BINGO BINGO 共 7 款玩法，含期別計算、開獎邏輯與中獎試算。
- **BG 風格多盤口模擬**（[`app/pages/lottery/bg/`](app/pages/lottery/bg)）：11 x 5、六合彩（信用盤 / 官方盤）、賽車 PK10、速 28、時時彩等 15+ 種盤口，依「信用盤（cd）/ 官方盤（of）」拆分邏輯與樣式。
- **後台管理系統**（[`app/pages/admin/`](app/pages/admin)）：會員管理、角色與動態權限（RBAC）、Demo 唯讀角色、遊戲開關、NPC 自動遊玩、報表中心、彩票後台模擬器。
- **即時社交聊天室**：WebSocket 驅動的聊天與廣播功能（[`server/api/ws/`](server/api/ws)、[`server/services/social/`](server/services/social)）。
- **作品集展示頁**（[`app/pages/project/`](app/pages/project)）：過往主要經手專案的介紹頁面。

## 技術棧

| 分類 | 技術 |
| --- | --- |
| 框架 | Nuxt 4（Vite + Nitro），Vue 3，TypeScript |
| 狀態管理 | Pinia |
| UI / 內容 | `@nuxt/ui`、`@nuxt/image`、`@nuxt/content` |
| 樣式 | Tailwind CSS v4 + SCSS（7-1 pattern，`@use` / `@forward`） |
| 表單驗證 | `vee-validate` + `zod` |
| HTTP | `ofetch`（`$fetch`）/ `axios` |
| 即時通訊 | WebSocket（Nitro `server/api/ws`） |
| 工具庫 | `lodash-es`、`dayjs`、`number-precision`、`crypto-js`、`bcryptjs`、`dexie`、`chart.js` |
| Runtime | Node.js 22.x（Volta）、npm |

## 專案架構

```
├─ app/            前端主程式（Nuxt 4 app 目錄結構：pages / components / composables / services）
├─ server/         Nitro 後端 API 與服務層（含後台、彩票、WebSocket）
├─ shared/         前後端共用純資料設定（各盤口規則）
├─ openspec/       規格驅動開發文件（proposal / design / tasks / validation / engineering-evidence）
├─ docs/           工程文件（Architecture、Engineering Evidence）
├─ public/         靜態資源
└─ nuxt.config.ts
```

完整的前端 / 後端分層、命名規範與開發規則說明，請見 [`docs/Architecture/README.md`](docs/Architecture/README.md) 與 [`openspec/project.md`](openspec/project.md)。

## 快速開始

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（http://localhost:6100）
npm run dev

# 正式建置
npm run build

# 本地預覽正式建置
npm run preview
```

## 測試

各盤口／玩法的派彩與中獎邏輯皆有對應的回歸測試腳本（[`scripts/`](scripts)），例如：

```bash
npm run test:dlt        # 大樂透
npm run test:superlotto # 威力彩
npm run test:bingo      # BINGO BINGO

npm run test:bg         # BG 所有盤口一次跑完（11x5、六合彩官方盤、k3、pk10、ssc、kl8、kl10、pl3、fc3d、egg，共 14 款）
npm run test:6hc-cd     # 六合彩信用盤（獨立執行，見下方說明）

npm run test:games      # retro 遊戲中心（30 款）+ 復古童玩（8 款）一次跑完
npm run test:roles      # 後台角色 / 權限（RBAC）：存取邊界、自訂角色 CRUD、setRole 保護規則
npm run test:chat       # 即時聊天室（WebSocket）：連線生命週期、發言驗證、管理者廣播、排程權限
```

> `test:bg` 不包含六合彩信用盤（6hc-cd）：6hc-cd 的單期限額目前只做到分頁層級（跨分頁單期總上限、玩家層級限額仍是待辦），跟已經定案的其他盤口放在一起彙總容易混淆「真的失敗」與「已知待補」，因此刻意分開、需要時另外執行 `npm run test:6hc-cd`。

完整腳本清單請見 [`package.json`](package.json) 的 `scripts` 區塊。

## 開發規範

- 新功能一律先走 [OpenSpec](openspec) 六階段流程（Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence），再落地程式碼。
- 命名與邏輯分層規則：composable 用 `useXxx`、store 用 `storeXxx`；UI 入口（click）→ 業務流程（actions）→ 私有工具（`_handlers`）三層分離；非同步操作需有 loading / success / error 三段狀態。
- 詳細規範見 [`openspec/project.md`](openspec/project.md)。
