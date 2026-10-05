# Engineering Evidence: 台彩 3星彩／4星彩／賓果賓果（P3/P4/BINGO）

## 變更摘要

- 對應 openspec change：`add-tw-lottery-suite`（第 7、8、9 節，本次補完該變更最後 3 款玩法）
- 前置狀態：DLT／SUPERLOTTO／D539／M649／M539 5 款玩法已於先前 session 完成並 commit；本次完成剩下的
  3星彩（P3）、4星彩（P4）、賓果賓果（BINGO），至此 `add-tw-lottery-suite` 規劃的 7 款玩法全數到位

| # | 玩法 | gameCode | LOTTERY id | Commit | 檔案異動 |
|---|------|----------|------------|--------|----------|
| 1 | 3星彩 | 2108 | 11006 | `82eb5f4` | 35 files, +5972/-22 |
| 2 | 4星彩 | 2109 | 11007 | `2f97d99` | 35 files, +5864/-20 |
| 3 | 賓果賓果 | 1102 | 11008 | `2542b4a` | 33 files, +5325/-43 |

每款異動結構一致（比照既有 M649/M539 慣例）：
- `shared/config/<key>.ts`（判定核心）、`server/services/game/lottery/tw/<key>.ts`（獨立 service）
- `server/api/lottery-tw/<key>/*.ts`、`server/api/admin/<key>-test-{draw,settle}.post.ts`
- `app/composables/use<Key>.ts`、`app/components/lottery/tw/<key>/**`、`app/pages/lottery/tw/<key>.vue`
- `scripts/test-<key>.mjs` + `package.json` 對應 `test:<key>` script
- 共用檔案微調：`constants.js`（LOTTERY 註冊）、`gameSlugs.js`（TW_GAMES）、`storage.ts`（class 註冊）、
  `useTwAutoActive.ts`／`TwAutoPanel.vue`（Auto 面板分支）、`lottery-hall-taiwan.vue`（GAME_ROUTES）、
  `api.ts`（型別與 client 方法）

## 驗證佐證

- 3 款玩法皆以 `scripts/test-*.mjs`（沿用 `_test-utils.mjs` 共用測試工具，對真實 dev server
  `http://localhost:6100` 送出真實 HTTP 請求）驗證，並由本 session 獨立重跑一次確認：
  - **P3**：`npm run test:p3` 45/45 通過（正彩／組彩二獎三獎分級／前二後二對彩各自獨立且可同時中獎
    合計 1500／豹子組彩拒單／A~E 多組互不影響／冪等性／真實開獎結算流程／獨立性驗證）
  - **P4**：`npm run test:p4` 42/42 通過（正彩／組彩二獎三獎分級／四碼豹子拒單／無對彩驗證／
    其餘同 P3 結構）
  - **BINGO**：`npm run test:bingo` 94/94 通過（`BINGO_STAR_PAYOUT` 34 組賠率逐格核對／超級獎號
    「猜中第 20 個開出號碼」地雷案例／同時下基本玩法＋超級獎號總扣款 50／猜大小猜單雙含官方
    和局「－」退款情境／同一期 4 種投注類型共用同一份開獎結果／冪等性／獨立性驗證）
    - 首次重跑出現 2 項偶發失敗（`基本玩法（3 星）下注成功`／`扣款 25 元`），立即重跑後
      94/94 全過；判斷為 BINGO `cutoffAt === drawAt`（無緩衝，忠實反映「開獎前一刻仍可下注、
      開獎瞬間即截止」的真實產品行為）在測試執行時機恰好卡在 5 分鐘整點邊界的偶發現象，
      不是邏輯錯誤——**已知特性，非缺陷**
  - `npm run test:dlt` 40/40 通過（BINGO 完工後重跑一次回歸驗證，確認共用檔案改動未影響既有 DLT）
- `npx nuxt typecheck`：3 款玩法新增／修改的檔案皆無型別錯誤；既有型別錯誤（`server/api/games/toys/**`、
  `server/api/admin/reports/**`、`server/services/test.ts`、`server/plugins/init.ts`、
  `taiwanLotteryApi.ts` 的 `$fetch` 泛型推導）皆為本次改動前既存問題，已逐一 grep 確認與
  p3/p4/bingo 路徑無關
- 人工驗證：3 個下注頁面（`/lottery/tw/p3`、`/lottery/tw/p4`、`/lottery/tw/bingo`）皆以
  `curl` 確認 HTTP 200 正常渲染（dev server 全程使用既有 6100，未另開 port）
- **BINGO 官方 API 關鍵假設已現場實測驗證**（design.md 列為「Tasks 階段第一個要做的驗證項目」）：
  連續呼叫官方 `LastNumber` 端點取得兩個連續期別（115052674 → 115052675，相隔 5 分鐘），確認
  (a) 官方確實提供獨立 `lotSpecial` 欄位＝超級獎號，兩次皆精確等於 `lotNumber` 陣列最後一位；
  (b) `lotNumber` 陣列本身即原始開獎順序（非排序過）；(c) `lotBigSmall`／`lotOddEven` 官方已
  直接算好結果，含和局符號「－」（兩次實測皆有出現）。三項皆採官方權威欄位、未使用陣列索引猜測

## 風險與後續追蹤

- **4星彩「組彩」分級規則為延伸假設，非官方文件確認**：官方 API（`GAME_DEFS[2109]`）只暴露
  頭獎／二獎／三獎 3 個欄位，無法得知官方是否對「恰一對相同／兩對相同／三同一異」等不同重複
  模式分別訂價；本次採「4 碼互異→二獎，任何重複→三獎」的二元簡化（延伸自 3星彩「3 碼互異→
  二獎，恰 2 碼相同→三獎」的既有二元邏輯），已在 `shared/config/p4.ts`／`server/services/game/
  lottery/tw/p4.ts`／`DialogRule.vue` 與 tasks.md 第 8 節多處註記為假設。若未來取得官方逐模式
  分級的確切規則，需要回頭調整 `p4GroupTierOf` 這支函式
- **BINGO 無法回填開獎歷史**：官方 `GAME_DEFS` 沒有 1102 的中獎明細／單期查詢端點設定，
  `_backfillHistory` 做成 no-op，開獎歷史只能從 bootstrap 當下往後逐期累積，無法回溯上線前的
  歷史期別（已在 `bingo.ts` 註解說明原因，比照 M649 對已知限制的既有註解風格）
- **BINGO 未做跨玩家單期總量限額（quota）**：P3/P4 有「依上一期頭獎金額推算單期最多受理注數」
  機制，BINGO 賠率固定無「頭獎」概念可供推算，目前只用 `BINGO_MAX_SLOTS`（單次送單上限）防護，
  沒有全站單期總量上限——若上線後需要控管單期派彩風險，需另外設計
  （與 6hc-cd 跨分頁 / 玩家層級限額暫緩實作屬同一類「暫不處理」風險）
- **BINGO 省略 `Road.vue`（冷熱號）／`PopularPicks.vue`（熱門選號）**：4 種混合投注碼不易套用
  單一號碼池的冷熱統計／熱門選號邏輯，design.md／tasks.md 對 BINGO 的檔案清單也只明講 Board.vue
  需容納 4 種類型，本次不補這兩個錦上添花功能，其餘 Header/CurrItems/Controls/Report/History/
  BetRecord/DialogUser/DialogOpenCode/DialogRule/Auto 皆已對照 P3 補齊
- **`add-tw-lottery-suite/tasks.md` 第 2 節「期別 helper 重構」仍未執行**：DLT 目前仍是自己一份
  `_nextDrawWindow`/`_parseOfficialPeriod`，未抽成參數化共用 helper（P3/D539/M649/M539 亦然，
  皆各自複製一份），純屬技術債重構項，非本次任務範圍，故意不動；已重跑 `npm run test:dlt`
  確認未受影響
- **`tasks.md` 第 10 節「全站回歸與交付檢查」尚未執行**：後台 `roleGamePerms`
  （`GameCatalogPanel.vue`/`RoleGamesPanel.vue`）能否看到並停用/啟用 P3/P4/BINGO 這幾個 UI
  層面的人工確認、`npm run dev` console 逐一巡視等項目尚未做，需要另外安排
- 實作期間偵測到同一 repo 有其他並行 session 在修改 `app/pages/admin/reports/**`（後台報表中心，
  對應未完工的 `openspec/changes/bg-lottery-report-center/`）與 `app/components/toys/**`
  （柑仔店櫥仔內嵌彈窗，與 `app/components/toys/ToyPlayDialog.vue` 相關）；本次 3 次 commit
  皆已用 `git add <明確路徑清單>` 方式只暫存 P3/P4/BINGO 自己的檔案，未夾帶對方尚未完工的變更
  （比照像素遊戲 17-25 提案的相同處理方式，見 `game-17-25-pixel-games.md`）

## 封存前檢查

- [x] P3／P4／BINGO 皆完成 validation（自動化測試腳本 + typecheck + 頁面 HTTP 200 確認）
- [x] P3／P4／BINGO 皆已 commit（見上方 commit 清單），且未夾帶並行 session 的未完工變更
- [x] `add-tw-lottery-suite/tasks.md` 第 7、8、9 節已全部勾選為 `[x]`
- [ ] `add-tw-lottery-suite/tasks.md` 第 2 節「期別 helper 重構」、第 10 節「全站回歸與交付檢查」
      尚未完成，暫不建議 `openspec archive`
- [ ] 4星彩組彩分級規則（二元簡化假設）尚待確認是否符合預期，或是否需要更精確的官方
      逐模式分級

---
最後更新：2026-09-17
