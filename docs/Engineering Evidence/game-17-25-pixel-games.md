# Engineering Evidence: GAME 17-25 像素遊戲批次

## 變更摘要

- 對應 openspec changes：`add-2048-game`、`add-flappy-game`、`add-frogger-game`、`add-connect4-game`、`add-whack-a-mole-game`、`add-lights-out-game`、`add-tower-stack-game`、`add-arkanoid-game`
- game-hall id：17-24（原規劃含 DINO RUN id 25，已拍板不實作，名額不遞補）
- 依 `prompt/pixel_game_prompts_17-25.txt` 的開發計畫，2026-09-01 建立對應提案文件（純文件），2026-09-01～09-02 完成實作並逐款 commit

| # | 遊戲 | gameKey | Commit | 日期 | 檔案異動 |
|---|------|---------|--------|------|----------|
| 17 | 2048 | `2048` | `1cb3991` | 2026-09-01 | 13 files, +1259/-7 |
| 18 | FLAPPY | `flappy` | `451875f` | 2026-09-01 | 13 files, +1130/-7 |
| 19 | FROGGER | `frogger` | `aef29de` | 2026-09-01 | 13 files, +1701/-7 |
| 20 | CONNECT 4 | `connect4` | `ffd39f1` | 2026-09-01 | 13 files, +1362/-7 |
| 21 | WHACK-A-MOLE | `whackAMole` | `c12759c` | 2026-09-02 | 13 files, +1355/-7 |
| 22 | LIGHTS OUT | `lightsOut` | `25eb094` | 2026-09-02 | 13 files, +1214/-7 |
| 23 | TOWER STACK | `towerStack` | `6572f48` | 2026-09-02 | 13 files, +1433/-7 |
| 24 | ARKANOID | `arkanoid` | `cc856a9` | 2026-09-02 | 13 files, +1752/-7 |

每款遊戲異動結構一致：
- `app/pages/game/<game>.vue`（頁面）
- `app/utils/<game>Engine.ts`（零 Vue 依賴的規則核心）
- `server/api/games/retro/<game>/history.{get,post,delete}.ts` + `server/services/game/retro/<game>.ts`（紀錄存取）
- 共用檔案微調：`GameHistoryDialog.vue`、`useGameHistory.ts`、`gameSprites.ts`、`admin/games.vue`、`game-hall.vue`、`services/api.ts`、`server/services/storage.ts`

## 驗證佐證

- 每款遊戲皆：
  - 規則核心抽成 `app/utils/<game>Engine.ts`，附獨立單元測試
  - 以 Playwright 實際啟動瀏覽器操作驗證核心玩法／計分／Pause-Resume／Restart，通過後才 commit
- **ARKANOID**：採方案 b 獨立實作 `arkanoidEngine.ts`，全程確認未修改既有 `app/pages/game/breakout.vue`（共用 engine 重構方案 a 未執行）
- **CONNECT 4**：計分採「固定基礎分＋落子效率加成」（`WIN_BASE=60` + 最高 40 效率加成，`DRAW=20`，`LOSE=0`），非單純固定值模型
- **FLAPPY／TOWER STACK**：沿用 DOM/CSS 渲染，未使用 Canvas，符合全專案既有渲染慣例

## 風險與後續追蹤

- **DINO RUN（原規劃 id 25）**：已拍板方案 B，不新增為獨立遊戲；`openspec/changes/add-dino-run-game/` 下 README/proposal/design/tasks 已標記「不執行，保留為分析紀錄」
- Double Jump／Day-Night／Challenge Mode 改列入未來 RUNNER 擴充提案（例如 `update-runner-game-endless-extras`，**尚未建立**），需使用者明確指示才會建立
- 實作期間偵測到同一 repo 有其他並行 session 在修改 `api.ts`／`game-hall.vue`（後台角色管理／聊天排程功能），改用「只 patch 自己新增的行到 git index」手法（`git apply --cached` + 手刻 diff）避免夾帶對方未完成工作
- `server/api/admin/members.post.ts`（對方檔案）曾有 import 路徑錯誤（多一層 `../`）導致整個 dev server 起不來，已就地修正兩行 import 路徑但**未 commit**（屬另一 session 工作範圍）

## 封存前檢查

- [x] 8 款遊戲皆完成 validation（單元測試 + Playwright 手動驗證）
- [x] 8 款遊戲皆已 commit（見上方 commit 清單）
- [ ] `add-2048-game` ～ `add-arkanoid-game` 8 個 openspec change 尚未執行 `openspec archive`
- [ ] `add-dino-run-game` 尚未決定是否直接 archive（方案 B 不實作，需使用者確認保留現況或封存）

---
最後更新：2026-09-09
