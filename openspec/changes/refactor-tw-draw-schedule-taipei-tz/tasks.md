# Tasks

## 1. 規格與設計

- [x] 逐行比對 7 份 `_nextDrawWindow()`，確認只差常數
- [x] 盤點 server 端本地時間 API 的使用範圍（約 90 處）
- [x] 實測 worker thread 與主執行緒修改 `process.env.TZ` 的差異

## 2. 單元測試基礎設施

- [x] 安裝 `vitest`（配合 `@nuxt/test-utils` 的 peer 版本 `^4.0.2`）
- [x] 新增 `vitest.config.ts`（node 環境，只收 `test/unit/**/*.test.ts`）
- [x] 新增 `npm run test:unit`（`TZ=UTC vitest run`），`npm test` 會自動納入

## 3. 開獎時間模組

- [x] 新增 `server/services/game/lottery/tw/drawSchedule.ts`
- [x] 7 個彩種改用 `nextDrawWindow(now, DRAW_SCHEDULE)`，刪除各自的 `_nextDrawWindow()`
- [x] 更新檔頭與呼叫處註解中對舊函式的引用

## 4. 全域時區

- [x] `package.json`：`dev`、`preview` 加上 `TZ=Asia/Taipei`，新增 `start`
- [x] 新增 `server/plugins/00.timezone.ts`

## 5. 驗證

- [x] `test/unit/drawSchedule.test.ts`：21 項通過
- [x] 以舊寫法在 UTC 下重跑同樣案例，確認問題可被重現（鎖單時間差 8 小時）
- [x] dev server：7 款台彩與 bingo E2E 全數通過
- [x] production build（`TZ=UTC`）：`/api/lottery-tw/*/current` 回傳正確台灣時間
- [x] production build 的 E2E 與改動前版本對照，失敗分布相同（既有問題，另案追蹤）

## 6. 文件

- [x] `docs/Engineering Evidence/refactor-tw-draw-schedule-taipei-tz.md`
- [x] `docs/Architecture/README.md`、`README.md` 補充時區與單元測試說明
