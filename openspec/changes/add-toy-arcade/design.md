# Design

## Context

專案是 Nuxt 4（`nuxt@^4.4.2`）+ Vue 3（`vue@^3.5.31`）+ Vite / Nitro。樣式是 Tailwind v4 與 SCSS（`@use` / `@forward`）。頁面在 `app/pages/`，元件在 `app/components/`，composable 在 `app/composables/`，純邏輯在 `app/utils/`，前端常數在 `app/config/`。

現況掃描：

| 項目 | 現況 |
| --- | --- |
| 路由 | 檔案路由。複古遊戲 `/game/<slug>`，大廳 `/game-hall`。彩票 `/lottery-hall`、`/lottery-hall-taiwan`、`/lottery/bg/*`、`/lottery/tw/*` |
| 遊戲頁 | `app/pages/game/*.vue` 約 30 款。邏輯多在 `app/utils/*Engine.ts`，頁面只鏡像 snapshot |
| 視覺 | `/game-hall` 是 Cyberpunk 機台卡（`GameMachineCard`、街機車道元件），不是童玩館 |
| 貨幣 | 帳號 F 幣。`server/services/walletBalance.ts`，複古遊戲用分數打 `/api/games/retro/:slug/history` 換 coin |
| 權限 | `app/middleware/game-access.global.ts` 只攔 `/game/`、`/lottery/bg/`、`/lottery/tw/` |
| Pinia | `pinia` 與 `@pinia/nuxt` 在 `package.json`，`nuxt.config.ts` 未註冊，程式沒有 `defineStore`。全域狀態是 composable 單例 `reactive` |
| Canvas | `app/` 內沒有 `canvas` / `getContext` |
| 測試 | 沒有 Vitest 單元測試。既有是 `scripts/test-*.mjs`，多數要登入並打正在跑的 dev server |
| 版面 | 沒有 `app/layouts/` |

限制：不使用 Canvas、不加大型套件、不把童玩館耦進彩票或複古遊戲、不重構既有大廳、第一個可玩切片只有抽抽樂。

## Goals / Non-Goals

**Goals:**

- 在彩運來大廳下方加柑仔店櫥仔，遊戲頁與結算各自走既有目錄。
- 抽抽樂玩法正確：扣款、加權抽獎、獎勵、繼續抽、失敗歸零、領取一次、快速連點不重複結算。
- 結果先算出，動畫只負責顯示那個結果。
- 結算函式可被 Node 腳本直接測，不經過 Vue、不經過 HTTP。

**Non-Goals:**

- 其餘 7 款的玩法實作、圖鑑、後端錢包、金流、登入門檻。
- 改 `RETRO_GAMES`、`useGameHistory`、遊戲中心、`AppTopbar.vue`。`walletBalance.ts` 只加 toys 異動類型。
- 另開 `/toy-hall`，或把櫥仔做成第二個大廳。
- Canvas、遊戲引擎迴圈、新的 npm dependency。
- 把 8 款做成同一種押大小。

## 可重用盤點

| 項目 | 現有位置 | 是否重用 | 原因 |
| --- | --- | --- | --- |
| 頁面 + 純函式分層 | `app/pages/game/*.vue`、`app/utils/*Engine.ts` | 重用模式，不重用程式 | 頁面不管隨機，邏輯不進 template。不要沿用 `*Engine` 命名，避免被當成遊戲引擎 |
| `number-precision` | 已安裝 | 重用 | 倍率有小數，入帳前 `NP.round`，不加套件 |
| `GameMachineCard` | `app/components/GameMachineCard.vue` | 不重用 | Cyberpunk 切角、START/LOCKED，和童玩館視覺衝突 |
| `GameHallArcadeLane` / `GameHallInvasionLane` | `app/components/` | 不重用 | 現有大廳舞台，不是卡片入口 |
| `Dialog.vue` | `app/components/Dialog.vue` | 不重用 | 全站系統對話框，約 47 個呼叫點。遊戲結算是一局的節拍，不是系統彈窗 |
| `GameRuleDialog` / `GameRateDialog` / `GameHistoryDialog` | `app/components/` | 不重用 | 綁複古遊戲分數與 coin rate |
| `useGameHistory` | `app/composables/useGameHistory.ts` | 不重用 | 綁 retro API 與帳號發幣 |
| `useGameAccess` | `app/composables/useGameAccess.ts` | 不重用 | 只服務 retro / bg / tw 權限 |
| `useAuth` | `app/composables/useAuth.ts` | 不重用在玩法 | 童玩館是公開 Demo，不要求登入 |
| 帳號錢包 | `server/services/walletBalance.ts` | 重用 | 下注與領取寫進同一顆 F 幣。只加 `toy-bet`、`toy-reward`，不改公式 |
| `shared/config/gameSlugs.js` | `shared/config/` | 不修改 | 寫進去會被 middleware 與權限當成既有遊戲 |
| `AppTopbar.vue` | `app/components/AppTopbar.vue` | 不改 | 入口在彩運來頁的櫥仔，不加頂欄 |
| 彩票 `Coin.vue` | `app/components/lottery/...` | 不重用 | 盤口籌碼，領域不同 |

## Decisions

### 1. 目錄對齊現有彩票與複古遊戲，不新建根目錄

- **頁面**：`app/pages/toys/`。抽抽樂是 `app/pages/toys/lucky-draw.vue`，路由 `/toys/lucky-draw`。
- **結算**：`server/services/game/toys/`。比照 `server/services/game/retro/` 與 `server/services/game/lottery/` 的分層，但是第三個目錄，不繼承那兩支基底。
- **薄 API**：`server/api/games/toys/`。只轉呼叫 service。公式不寫在 route，頁面也不直接 import server 檔。
- **元件**：`app/components/toys/`，頁面 explicit import，避免自動命名變成 `ToysToyGameHeader`。
- **否決** 根目錄 `games/toy/`：Nuxt 頁面在 `app/pages/`，服務在 `server/services/game/`。

### 2. 入口是彩運來頁上的一區，不是新大廳

- **選擇**：改 `app/pages/lottery-hall-taiwan.vue`。插入點在玩法貨架 `.tw-content` 結束之後、`.tw-footer` 之前。錨點 `id="tw-shelf"`。
- 版面對照設計稿 154–171 行：標題「柑仔店櫥仔」、副標「懷舊零嘴 · 古早玩具」、圓章卡片格。卡片資料照稿：

| 名稱 | 種類 | 圓章 |
| --- | --- | --- |
| 大豬公 | 懷舊零嘴 | 豬 |
| 抽抽樂 | 懷舊零嘴 | 抽 |
| 橡皮糖 | 懷舊零嘴 | 糖 |
| 哨子糖 | 懷舊零嘴 | 哨 |
| 尪仔標 | 古早玩具 | 標 |
| 竹蜻蜓 | 古早玩具 | 蜓 |
| 汽水笛 | 古早玩具 | 笛 |
| 紙牌 | 古早玩具 | 牌 |

- 只有抽抽樂連到 `/toys/lucky-draw`。其餘 7 張同款卡片、不可點、沒有路由。
- 設計稿下面三張照片位 phase 1 不做。沒有素材，也不改既有彩票卡的插畫。
- **否決** `/toy-hall` 與 `AppTopbar.vue` 加連結。回程是遊戲頁的「轉去大廳」，回到 `/lottery-hall-taiwan#tw-shelf`。
- **否決** `/game/lucky-draw`：`game-access.global.ts` 會把 `/game/` 當成 retro。`/toys/` 不在攔截範圍。

### 3. 帳號 F 幣扣款入帳，toys 只有一份共用彩池

已確認。兩筆錢不要混成同一個欄位。

- **沒有新幣別。** 不建童玩幣、不加幣種欄位、不做第二個餘額。畫面上看到的就是帳號 F 幣。下注扣、領取加，都走 `walletBalanceService.appendChange`。
- 異動類型新增 `toy-bet`、`toy-reward`。只改型別聯合，不改餘額公式。扣款失敗沿用既有「餘額不足」錯誤，F 幣不變。
- 開局必須已登入。未登入不可扣款。
- **否決** 任何名為童玩幣的餘額，也否決像 retro 那樣直接改 `user.coin`。toys 走錢包服務，稽核才進同一張餘額變動表。
- **彩池**：`server/services/game/toys/pool.ts` 一份，8 款遊戲讀寫同一份。不是每款一池，也不是彩票的 K3／蛋蛋彩池。
- 彩池上記的是該使用者目前未領金額，以及產生它的遊戲與當初注額。換到其他 toys 遊戲仍看得到同一筆。抽到空，這筆未領金額歸零，F 幣不加。領取把未領金額寫入 F 幣，並清掉彩池。
- 有未領金額時，其他 toys 遊戲不得另開一局。只能在原遊戲繼續，或領取。
- 離開頁面不自動入帳，也不把未領金額丟掉。它留在伺服器彩池，直到領取或歸零。
- **否決** Pinia：套件在、模組沒接、專案沒有 store。頁面仍用 composable 讀 API 回傳。

### 4. 共用局狀態只有一層，遊戲只擴充 `result`

```ts
type ToyRoundStatus = 'idle' | 'playing' | 'result'

type ToyRoundState = {
  status: ToyRoundStatus
  bet: number
  pot: number
  reward: number
  result: unknown
  round: number
  history: ToyHistoryItem[]
  settling: boolean
  claimed: boolean
  error: string | null
}
```

- `idle`：可改注、可開始。
- `playing`：已扣款或已鎖注，動畫進行中，不可再下注、不可領取。
- `result`：結果已顯示。有未領彩池時只能領取或繼續；已結算後只能再玩一次或回館。
- 局的動畫狀態放在頁面。未領金額放在伺服器共用彩池，離開頁面仍在。
- **否決** 每款自訂 `ready/spinning/done` 這類平行詞彙。特殊欄位放進 `result`，不另開一套 status。

### 5. 抽抽樂：服務先出結果，頁面再播翻牌

```text
click.start / click.pick / click.claim / click.continue
        │
        ▼
actions（settling guard、餘額檢查、early return）
        │
        ▼
POST /api/games/toys/lucky-draw/roll
        │
        ▼
server/services/game/toys 算出唯一結果   ← 唯一隨機點
        │
        ▼
state.result / state.pot
        │
        ▼
CSS transition（只讀 state.result）
        │
        ▼
animation 結束只把 revealed 設為 true，不准再 roll
```

- 玩家選的格子只決定哪一格翻面，不決定獎項。獎項在點擊當下就由加權表抽出。
- 其他格子保持蓋著。不要翻開「假特獎」，避免畫面和結算不一致。
- 動畫期間的 `Math.random` 禁止。

### 6. 繼續抽：不加注，共用彩池連乘，空獎歸零

這是本設計對需求留白的預設，若你要改，先改規格再寫程式。

- 已確認。開局只扣一次 F 幣。繼續抽不再扣款。風險是共用彩池上的未領金額歸零，不是再付一次。
- 第一次抽出的倍率 `m`：`pot = round(bet * m)`。`m === 0` 則本局結束，沒有繼續。
- 有彩池時：領取會入帳 `pot`；繼續抽再 roll。
  - 再抽到 `m === 0`：`pot = 0`，本局結束，不加帳。
  - 再抽到 `m > 0`：`pot = round(pot * m)`，仍可領取或繼續。
- 彩池上限：`pot` 不得超過 `bet * maxPotMultiplier`。設定預設 `500`。超過就夾住，並強制進入可領取、不可再繼續。避免 `×50` 連乘把 Demo 餘額打穿。
- **否決** 繼續抽再扣一次注：需求寫的是「失敗歸零」的風險選擇，不是再買一張。
- 作者機率表單抽期望值約 `1.43`（玩家有利）。Demo 照表，不改數字。測試只驗證「抽到的獎落在表內、權重和為 10000 個基點」，不驗證長期期望。

機率在設定檔用基點，畫面不要寫死：

| 結果 | 機率 | 基點 | 倍率 |
| --- | ---: | ---: | ---: |
| 空 | 45% | 4500 | 0 |
| 小獎 | 30% | 3000 | 1.2 |
| 中獎 | 15% | 1500 | 2 |
| 大獎 | 8% | 800 | 5 |
| 特獎 | 1.8% | 180 | 15 |
| 超級獎 | 0.2% | 20 | 50 |

基點合計必須是 `10000`。載入時斷言，測試再斷言一次。

### 7. 結算鎖

- `actions` 開頭若 `settling === true` 或狀態不允許該動作，直接 return。
- 扣款成功後才進入 `playing`。扣款失敗停留 `idle`，錯誤寫進 `state.error`，餘額不變。
- 領取由服務先把共用彩池標成已結算，再 `appendChange` 入帳。同一筆未領金額第二次領取直接 return，不再加 F 幣。
- 入帳金額為整數。自訂注額必須是 `>= 1` 的整數，且 `<=` 帳號 F 幣。籌碼：`10 / 50 / 100 / 500 / 自訂`。
- 回大廳或離開頁面：動畫狀態可丟。未領金額留在 toys 共用彩池，不自動入帳，也不歸零。

### 8. 設定放在 service，不放 Vue template

- **選擇**：`server/services/game/toys/catalog.ts` 持有 8 款目錄、籌碼、獎勵基點、動畫毫秒、彩池上限。service 不 `import` `Storage`、`walletBalance`、retro 或彩票 class。
- `GET /api/games/toys/catalog` 給櫥仔與下注面板讀。頁面不寫死倍率。
- **否決** `shared/config/toys.js`：這批表只有 toys service 與它的 API 要讀，不必再進 Nitro 的 shared 宣告檔。
- **否決** `app/config/toyGames.ts` 再抄一份：兩份表會漂。

### 9. 視覺沿用 `.theme-taiwan-lottery`，不另做主題

- 櫥仔區塊的樣式寫在 `lottery-hall-taiwan.vue` 的 scoped SCSS，只用頁面已有的 `--color-surface`、`--color-accent-2-*`、`--color-neutral-*`、`--font-heading`。
- 遊戲頁根節點同樣掛 `.theme-taiwan-lottery`，才吃得到這組變數。不新增 `toy.scss`，不加進 `nuxt.config` 的 `css`。
- 動畫只用 `transform` / `transition`。翻牌約 600ms，時長來自 catalog。
- 不做 Canvas。設計稿的三張貨架照片先空著不做。

### 10. 測試用 Node 直接載入純函式

- 新腳本 `scripts/test-toy-lucky-draw.mjs`，`package.json` 加 `test:toy-lucky-draw`。這是既有腳本慣例，不是新測試框架。
- 腳本直接 import `server/services/game/toys/` 的純函式，不打 HTTP、不登入。型別必須可被 Node 22 抹除。
- 隨機函式接受注入的 `() => number`。測試不用 `Math.random`。
- **否決** 沿用 `scripts/test-retro.mjs`：那要登入並打帳號發幣 API。

### 11. 八款都先寫進規格，實作仍一次一款

每款只加：`app/pages/toys/<slug>.vue`、`server/services/game/toys/<slug>.ts`、catalog 一個區塊、一支測試腳本。共用殼不為單一玩法開後門。圖鑑另開 change。

| Phase | 遊戲 | slug | 結算 |
| --- | --- | --- | --- |
| 1 | 抽抽樂 | `lucky-draw` | 共用彩池，可繼續 |
| 2 | 紙牌 | `cards` | 共用彩池，可繼續 |
| 3 | 汽水笛 | `soda-whistle` | 共用彩池，可繼續 |
| 4 | 竹蜻蜓 | `bamboo-copter` | 同一請求結清 F 幣 |
| 5 | 橡皮糖 | `gummy` | 共用彩池，可繼續 |
| 6 | 大豬公 | `big-pig` | 同一請求結清 F 幣 |
| 7 | 哨子糖 | `whistle-candy` | 同一請求結清 F 幣 |
| 8 | 尪仔標 | `pog` | 五回合打完才結清 F 幣 |

可繼續的四款寫入同一筆未領金額。大豬公、竹蜻蜓、哨子糖、尪仔標不把未領金額留在彩池，但彩池上若還有未領金額，這四款也不能開局。

### 12. 各款玩法

需求沒寫死的倍率，下面當作第一版規則，規格已鎖定。

**抽抽樂** `/toys/lucky-draw`  
3×4 蓋牌。選格只決定翻哪一格。空 45% ×0、小獎 30% ×1.2、中獎 15% ×2、大獎 8% ×5、特獎 1.8% ×15、超級獎 0.2% ×50。繼續不加注、連乘、空獎歸零、上限 `bet * 500`。

**紙牌** `/toys/cards`  
牌面 1–13，無花色，不放回，發完重洗。大、小各走連勝表：第 1 回 ×1.8、第 2 回 ×3、第 3 回 ×5、第 4 回 ×8、第 5 回 ×15。相同固定 ×10，並計入連勝。猜錯歸零。第 5 勝後只能領取。

**汽水笛** `/toys/soda-whistle`  
需求表的 100、150、250、400、700、1200 視為注額 100 的示意。實際未領金額是 `round(bet * 表定金額 / 100)`。爆掉機率依序 2%、4%、7%、12%、20%、30%。爆掉歸零。第 6 次成功後只能領取。

**竹蜻蜓** `/toys/bamboo-copter`  
先抽一個高度，動畫必須播這個高度。高度帶：小於 10m 為 10%，10–19 為 20%，20–29 為 25%，30–39 為 25%，40–49 為 15%，50m 以上為 5%。因此 ≥10/20/30/40/50 的成功率是 90%、70%、45%、20%、5%，倍率 ×1.1、×1.4、×2、×4、×15。達標入帳，未達標不加帳。注額已扣。

**橡皮糖** `/toys/gummy`  
紅黃藍綠各 25%。顯示最近四顆。猜中走紙牌同一張連勝表，猜錯歸零。第 5 勝後只能領取。

**大豬公** `/toys/big-pig`  
雙方各兩顆骰，點數和先比。和局退回下注，包含雙方都是 1+1。玩家點數較高才套特殊：6+6 為金豬 ×5，其他對子為雙豬 ×2.5，其餘 ×1.9。玩家 1+1 且點數較低為小豬 ×0。玩家點數較低且不是小豬，也是 ×0。

**哨子糖** `/toys/whistle-candy`  
短勝長、長勝中、中勝短。相同退回下注。玩家勝 ×1.9，敗不加帳。NPC 用可注入的均勻隨機，最近 8 次必須是實際抽出的選擇。倒數 3、2、1 只是動畫。

**尪仔標** `/toys/pog`  
12 張牌：點數 1–8，加上王、盾、換、炸各一。洗牌後各發 5 張，剩 2 張做重抽。打滿五回合，贏的回合多才算勝 ×1.9，回合數相同退回下注，否則不加帳。王在該回合取勝時，整局倍率再 ×2，只生效一次。盾抵消一次失敗。換在出牌前從剩餘牌重抽。炸讓 NPC 下一張點數 -2，最低 0。NPC 第一版從手牌均勻選一張，不做預測。

## 抽抽樂實作切片

| 層 | 檔案 | 責任 |
| --- | --- | --- |
| 入口 | `app/pages/lottery-hall-taiwan.vue` | 貨架與頁尾之間插入櫥仔 |
| 頁面 | `app/pages/toys/lucky-draw.vue` | click 入口、3×4 格、動畫 class |
| 元件 | `app/components/toys/ToyGameHeader.vue` | 轉去大廳、餘額 |
| 元件 | `app/components/toys/BetPanel.vue` | 籌碼與自訂 |
| 元件 | `app/components/toys/ResultModal.vue` | 領取 / 繼續 / 再玩一次 / 回大廳 |
| 元件 | `app/components/toys/RewardDisplay.vue` | 目前彩池 |
| 元件 | `app/components/toys/ShelfCard.vue` | 圓章、名稱、種類 |
| 元件 | `app/components/toys/GameButton.vue` | 主要 / 次要 / 停用 |
| 餘額 | 既有 `api.lottery.userInfo` / 登入使用者的 `coin` | 顯示與結算都是 F 幣，不新增錢包 composable |
| Composable | `useToyRound.ts` | `idle` / `playing` / `result`、`settling` 鎖 |
| 服務 | `server/services/game/toys/` | catalog、`pickWeighted`、`roll`、彩池計算 |
| API | `server/api/games/toys/` | catalog GET、lucky-draw roll POST |
| 測試 | `scripts/test-toy-lucky-draw.mjs` | 直接測 service |

`GameHistory.vue` 留到紙牌那一 change。抽抽樂只在局狀態留最近幾筆，不另做元件。

測試對照需求第十六節：

| # | 項目 | 抽抽樂怎麼驗 |
| --- | --- | --- |
| 1 | 下注金額 | 非籌碼整數、0、超過餘額被拒 |
| 2 | 扣款 | 成功扣一次；失敗不扣、不進 playing |
| 3 | 勝利獎勵 | `round(bet * multiplier)`，繼續則連乘 |
| 4 | 失敗獎勵 | 空獎 `pot = 0`，不加帳 |
| 5 | 平手 | 不適用，測試註明 skip |
| 6 | 連勝倍率 | 不適用，測試註明 skip |
| 7 | Cash out | 領取入帳等於 pot，餘額增加一次 |
| 8 | 爆掉歸零 | 繼續抽到空獎，pot 歸零且不加帳 |
| 9 | RNG | 固定序的 rng 命中預期獎項；權重和 10000 |
| 10 | 連點 | `settling` 中第二次 start/claim/continue 不改餘額 |
| 11 | 重複領取 | `claimed` 後再領取不加帳 |
| 12 | 回館重置 | 新的一頁局狀態是 idle；錢包餘額保留。未領彩池不入帳 |

## 預計檔案

新增：

- `app/pages/toys/lucky-draw.vue`
- `app/components/toys/ToyGameHeader.vue`
- `app/components/toys/BetPanel.vue`
- `app/components/toys/ResultModal.vue`
- `app/components/toys/RewardDisplay.vue`
- `app/components/toys/ShelfCard.vue`
- `app/components/toys/GameButton.vue`
- `app/composables/useToyRound.ts`
- `server/services/game/toys/catalog.ts`
- `server/services/game/toys/random.ts`
- `server/services/game/toys/reward.ts`
- `server/services/game/toys/pool.ts`
- `server/services/game/toys/luckyDraw.ts`
- `server/api/games/toys/catalog.get.ts`
- `server/api/games/toys/lucky-draw/roll.post.ts`
- `scripts/test-toy-lucky-draw.mjs`

修改：

- `app/pages/lottery-hall-taiwan.vue`：只加櫥仔區與對應 scoped 樣式。
- `package.json`：只加 `test:toy-lucky-draw` script。

修改範圍外：`AppTopbar.vue`、`gameSlugs.js`、`nuxt.config.ts`。`walletBalance.ts` 只加異動類型。

刪除：無。

## Risks / Trade-offs

- [玩家有利的機率表 + 連乘] → Demo 接受；用彩池上限擋爆炸。不偷偷改作者倍率。
- [未領金額留在伺服器] → 換頁還在；抽到空才歸零。領取才寫 F 幣。
- [Node 載入 `.ts` 在舊環境失敗] → 型別必須可抹除；驗證時若失敗，改用 `--experimental-strip-types`，不加 tsx。
- [改到彩運來頁] → 只插入櫥仔，不改玩法貨架與頁尾結構。櫥仔自己的載入失敗不得清空彩票卡。
- [低美術] → 照設計稿做圓章卡片，三張照片位先不做。

## Migration Plan

沒有資料遷移。撤回就是刪掉 `app/pages/toys/`、`server/services/game/toys/`、`server/api/games/toys/`，並拿掉彩運來頁的櫥仔區塊。既有彩票卡與複古遊戲不依賴這些檔案。

## Open Questions

幣別、彩池、繼續抽、目錄與入口都已確認。八款第一版倍率也已寫進第 12 節。沒有未決問題。若要改哨子糖 ×1.9、汽水笛按注額換算、或尪仔標五回合，先改規格再寫程式。
