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

- **背景**：專案需求是開發一個新版的 BG 彩票前端，技術指定為 Nuxt。
- **實際發展**：開發過程中，團隊決定沿用既有的 Vue 寫法來架構專案，導致最終呈現「包了一層 Nuxt 外殼的 Vue」，並未真正落地 Nuxt 的核心優勢（例如 SSR、file-based routing、Nitro server API 等）。
- **待釐清疑慮**：這種架構方式可能偏離 Nuxt 應有的用法，效能上也可能因此打折扣（例如喪失 SSR 帶來的效益）。此為現階段的個人觀察與推測，尚未實測驗證，之後若有具體效能數據或案例可再補充修正。
- **參考 URL**：http://104.199.176.35/credit/#/?domain=fntuser-dev.tlsanheng.com&searchCode=96225&nuxt
  - 測試帳密: newt02b0022/newt02b0022

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

## shared/config/

- 各盤口純資料設定（cd、of、eggscd、fc3dof、k3cd/of、kl10cd、kl8cd、pk10cd/of、pl3of、ssccd/of、x5cd/of）
- 特例：此目錄下皆為純 JS 宣告檔，禁止 `import`（Nitro 對 `shared` 走 Node 原生 ESM，不認別名）

## 開發規範重點（詳見 `openspec/project.md`）

- 命名：TS 為主（僅 `shared/config` 例外）；composable=`useXxx`、store=`storeXxx`、action=`fetchXxx`/`submitXxx`
- 狀態：組件/composable 內以單一 `reactive` 物件為主；全域用 Pinia setup store
- 邏輯分層：`click`（UI 入口）→ `actions`（業務流程，需 loading guard）→ `_handlers`（私有工具）
- 非同步需有 loading/success/error 三段狀態，不可吞錯
- SCSS 用巢狀語法、`@use`/`@forward`（禁止 `@import`）
- 新遊戲一律走 OpenSpec 六階段流程：Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence

---

最後更新：2026-09-09
