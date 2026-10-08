#!/usr/bin/env bash
# 用途：在指定的 Claude Code 專案下建立通用記憶檔
# 使用方式：bash setup-claude-memory.sh <專案絕對路徑>
# 範例：bash setup-claude-memory.sh /Users/tony.wu/SelfCode/Git/my-project

set -e

# ── 參數檢查 ─────────────────────────────────────────────────
# 預設使用 script 所在目錄的上層（即專案根目錄）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PROJECT_PATH="$(dirname "$SCRIPT_DIR")"

PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"
echo "專案路徑：$PROJECT_PATH"

# 計算與 Claude Code 相同的路徑 hash（將 / 轉為 -）
HASH=$(echo "$PROJECT_PATH" | sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$HASH/memory"

mkdir -p "$MEMORY_DIR"
echo "建立記憶目錄：$MEMORY_DIR"

# ── 1. 回覆語言 ──────────────────────────────────────────────
cat > "$MEMORY_DIR/feedback_language.md" << 'EOF'
---
name: feedback-language
description: 使用者偏好用繁體中文溝通
metadata:
  node_type: memory
  type: feedback
  originSessionId: 23930678-786a-46b6-9ab5-27e5d84b6234
---

一律用繁體中文回覆。

**Why:** 使用者明確要求中文，之前設定曾遺失。

**How to apply:** 所有回覆、說明、建議一律使用繁體中文，程式碼內容（變數名、英文 API）維持原文不翻譯。
EOF

# ── 2. git commit 訊息格式 ────────────────────────────────────
cat > "$MEMORY_DIR/feedback_git_commit_format.md" << 'EOF'
---
name: feedback-git-commit-format
description: 當使用者說「給我最新的 git commit」，要提供可直接複製的 commit 訊息（非 log），格式為 conventional commits + 繁體中文條列說明
metadata:
  node_type: memory
  type: feedback
  originSessionId: ce5eb96b-8345-4230-85d9-1c46b7bee515
---

當使用者輸入「給我最新的 git commit」時，不是顯示 git log，而是：
1. **先執行 `git add .`，確保 nuxt_personal_proj 下所有檔案變動（含新增、修改、刪除）都已追蹤**
2. 再執行 `git diff --stat HEAD` 取得所有變更檔案清單（**不可省略任何檔案**）
3. 同時執行 `git status` 確認無遺漏
4. 逐一讀取所有變更檔案與新檔案的完整內容
5. 根據所有變更產生一則可直接複製的 commit 訊息

**變更檔案清單必須完整列出**，不可用「...以及其他檔案」等省略語。

格式如下（**輸出的 code block 必須包含 `git add .`**）：
```
git add .
git commit -m "$(cat <<'COMMITEOF'
type(scope): 一行摘要

- 條列說明變更點 1（檔案或功能）
- 條列說明變更點 2
- ...
COMMITEOF
)"
```

**Why:** 使用者明確要求「列出所有變更檔案，不要省略」，需要完整、可直接複製的 commit 訊息草稿，而非 git log 記錄。

**How to apply:** 每次收到「給我最新的 git commit」，**先 `git add .`** 追蹤所有變動，再跑 `git diff --stat HEAD` + `git status`，確認完整檔案清單後，產生上述格式的 commit 訊息，用 code block 包起來方便複製。
EOF

# ── 3. 修改後必須完善測試 ──────────────────────────────────────
cat > "$MEMORY_DIR/feedback_testing.md" << 'EOF'
---
name: feedback_testing
description: 每次修改程式碼後，必須做完善的測試才算完成
metadata:
  node_type: memory
  type: feedback
  originSessionId: 66b12cee-2373-4c21-9ea8-b4b1dc85a51b
---

每次修改程式碼，完成後必須做完善的測試。

**Why:** 使用者明確要求，避免改完就回報完成但實際功能有問題。

**How to apply:** 任何程式碼變更（功能、修 bug、重構）完成後，使用 verify 或 run skill 實際跑起來測試，確認功能正常、邊界情況也涵蓋，才能回報完成。不能只憑程式碼邏輯推斷正確就結束。
EOF

# ── 4. SCSS 巢狀語法 ──────────────────────────────────────────
cat > "$MEMORY_DIR/feedback_scss_nesting.md" << 'EOF'
---
name: feedback_scss_nesting
description: 產生的 SCSS 要用巢狀（nested）語法撰寫
metadata:
  node_type: memory
  type: feedback
  originSessionId: 411cb8ff-3260-4371-8206-b3de048546f7
---

產生的 SCSS 一律使用巢狀語法，不要平鋪展開。

**Why:** 使用者偏好巢狀 SCSS，維持與專案現有風格一致。

**How to apply:** 任何新增或修改的 SCSS，子選擇器、偽類、媒體查詢等都應巢狀在父規則內，例如 `.parent { .child { ... } &:hover { ... } }`。
EOF

# ── 5. 專案規範強制遵循 ────────────────────────────────────────
cat > "$MEMORY_DIR/feedback_project_spec.md" << 'EOF'
---
name: feedback-project-spec
description: 改 code 前必須讀取 openspec/project.md 並嚴格遵循其規範
metadata:
  node_type: memory
  type: feedback
  originSessionId: a404c6d1-eb02-45a1-924c-c079bea80e41
---

改任何程式碼前，必須先讀取 `openspec/project.md` 並嚴格遵循規範。

**Why:** 使用者明確要求，且 spec 中有硬性執行規範（Mandatory Enforcement）。

**How to apply:**

每次寫/改 Vue 組件或 composable 時強制執行以下規則：

1. **State Object 優先**：用單一 `reactive({})` 管理所有相關狀態，禁止在同一模組內散落多個 `ref`（僅框架介面限制時才補 `ref`）
2. **私有邏輯封裝**：輔助函式必須封裝在具名私有物件中
   - `const _handlers = { ... }` — 資料轉換、工具方法
   - `const _actions = { ... }` — 業務流程（需 loading guard、early return、錯誤處理）
   - `const click = { ... }` — UI 入口事件
   - 禁止將函式散落在 `<script setup>` 頂層
3. **非同步三段狀態**：API 流程必須有 loading / success / error 狀態，不可吞錯
4. **SCSS**：使用巢狀語法，禁止 `@import`（用 `@use` / `@forward`）
5. **命名**：composable `useXxx`、store `storeXxx`、actions `fetchXxx`/`submitXxx`、private `_xxx`
EOF

# ── 6. 同步 setup script ──────────────────────────────────────
cat > "$MEMORY_DIR/feedback_sync_setup_script.md" << 'EOF'
---
name: feedback-sync-setup-script
description: 新增或修改 agent 檔或記憶檔後，必須同步更新兩個 setup script，讓新環境可一鍵重建
metadata:
  node_type: memory
  type: feedback
  originSessionId: c5d44d39-c295-4415-9fdb-587717de1d0b
---

每次新增或修改以下任一項目後，必須同步更新兩個 setup script：

**涵蓋範圍：**
- `~/.claude/agents/*.md`（custom agents）
- `~/.claude/projects/.../memory/*.md`（記憶檔）

**兩個 script 都要更新：**
- `~/setup-claude-memory.sh` — 全域通用版（換任何新環境都執行這個）
- `claude/setup-claude-memory.sh` — 此專案版（含專案特定記憶）

**Why:** 使用者希望換環境時執行 script 就能還原所有設定，包含 agents 與記憶，不需要手動重建。

**How to apply:**
寫完記憶或 agent 檔的當下，立刻（同一次回覆內）更新兩個 script，不可拆成兩步或等使用者提醒：
1. 新增記憶 → 兩個 script 的記憶區塊各加一段 `cat > "$MEMORY_DIR/xxx.md"` heredoc，並更新 script 內的 MEMORY.md 區塊
2. 新增 agent → 兩個 script 的 Agents 區塊各加一段 `cat > "$AGENTS_DIR/xxx.md"` heredoc
3. 修改內容 → 同步更新 script 內對應的 heredoc 內容
4. 每次都更新結尾的 echo 計數與說明
EOF

# ── 7. 暫不處理：限額 P2 ──────────────────────────────────────
cat > "$MEMORY_DIR/project_quota_p2_pending.md" << 'EOF'
---
name: project-quota-p2-pending
description: 6hc-cd 投注限額 P2（跨分頁單期總上限+玩家層級覆寫）後端+後台 UI 皆已實作完成並驗證通過
metadata:
  node_type: memory
  type: project
---

**後台 UI 已補完（2026-10-08）**：`openspec/changes/add-6hccd-quota-admin-ui/`，`/admin/bg-lottery`
新增第 4 個分頁「限額設定」，掛載新元件 `app/components/admin/SixhccdQuotaPanel.vue`
（全站預設值輸入框+儲存、可搜尋會員的逐會員覆寫列表，`isDemo` 唯讀鎖定），純前端串接既有
3 支 API、無新增後端邏輯。驗證：API 資料流 17 項斷言全數通過（含「重新讀取確認落地」）；
無瀏覽器自動化工具，分頁切換/按鈕點擊的畫面互動以程式碼走查確認，未實際點擊測試。
`test:bg`/`test:6hc-cd`/`test:roles` 全數通過，無回歸。這個待辦**已全部完成**，不用再主動
提起。

**後端已實作完成並驗證通過（2026-10-08）**：2026-10-07 使用者重提此待辦要求規劃，建立
`openspec/changes/add-6hccd-quota-p2/`，確認三項設計決策後（種子值 `0`／後台 UI 本批不做／
**重啟後當期已用額度歸零一併解決**）直接實作完成。

關鍵設計：
- enforcement **不需要新表**——`server/services/game/lottery/bg/orders.ts` 的
  `get.members.issue(issue, userId)` 本來就是「跨所有分頁、同玩家同期」的累計投注額計算器，
  只是原本沒用在限額驗證上
- 新增 4 張表：`sixhccd_quota_settings`（全站預設，singleton，比照 `toy_shop_settings`）+
  `sixhccd_member_quota`（玩家覆寫，override-only 稀疏表，比照 `retro_game_rates`）+
  `sixhccd_tab_issue_spent`/`sixhccd_issue_spent`（兩個 write-through counter，比照
  `retro_daily_grants` 的「原子累加 + `.returning()` 回填記憶體」模式）
- 不擴充 `creditQuotaOf()`（shared 純函式，前後端共用，無法做 DB I/O）；跨分頁上限是獨立於
  `CreditQuota` 之外、在 `validateBetQuota()` 額外檢查的新概念
- `6hcCd.ts` 的 `validateBetQuota()`：既有 per-tab 單期檢查改讀新 counter（取代
  `orders.get.issueTabCoin()` 記憶體重算，順便修正「重啟後當期已用額度歸零」這個繼承的舊
  限制），新增跨分頁總上限檢查；`playBets()` 建單成功後 fire-and-forget 累加兩個 counter，
  不擋下注流程
- 新增 3 支 admin API（`GET/PATCH /api/admin/bg-lottery/6hccd-quota`、
  `PATCH .../members/[userId]`），**後台 UI 留到下一個 change**

驗證：真實下注流程確認跨分頁合計超過上限正確拒單（訊息/數字精確吻合）、DB counter 正確
寫入、重啟後設定值正確回填（settings 與 counter 共用同一個 `rehydrateFromDb()`）。
`npm test` 全數通過，`test:6hc-cd`（涵蓋大量既有 per-tab 限額情境）改讀新 counter 後重跑仍
56/56 全數通過，證實既有行為無回歸。DB enabled/disabled 兩種設定下皆測試過。

**原始待決事項（2026-08-06 記錄，已解決）**：6hc-cd 信用盤的投注限額當時只到「分頁層級」，
由 `c_tema.js` / `c_zhengma.js` 各分頁的 `settings.quota` 提供，經
`shared/config/cd/helpers.ts` 的 `creditQuotaOf()` 讀取，伺端在
`server/services/game/lottery/bg/6hcCd.ts` 的 `handle.validateBetQuota()` 驗證（擋在扣款
與建單之前）——單注上下限 `item.min`/`item.max`、單期上限 `issue.max`（同玩家+同期+同分頁
累計）都已實作，缺的是跨分頁總上限與玩家層級限額（即上方已完成的這批）。

**Why:** 原本評估後決定先停在分頁層級，P2 涉及資料結構變更與營運設定，暫不投入；
2026-10-07 使用者在完成整批 Postgres 持久化工作後主動重提，規劃並實作完成。

**How to apply:** 這份待辦（後端+後台 UI）已全部完成，不用再主動提起。相關待決項另見
[[project-jackpot-weight-zhengma]]。
EOF

# ── 8. 遊戲紀錄 coin 每日上限 ──────────────────────────────────
cat > "$MEMORY_DIR/project_game_history_coin_reward.md" << 'EOF'
---
name: project-game-history-coin-reward
description: 遊戲紀錄 coin 兌換機制的每日上限拍板值，以及後續需要後台管理介面調整這些參數的提醒
metadata:
  type: project
---

game-hall 的遊戲紀錄功能（`openspec/changes/add-game-history/`）已登入使用者結算後會把分數依固定倍率換算成 coin。三個常數目前寫死在 `server/services/game/retro/{snake,racing,tetriminos}.ts` 各自的 `super()` 參數：

- `coinRate`：snake ×5、racing ×0.5、tetriminos ×0.05（依實際計分邏輯估算，未實測校準）
- `coinCapPerRun`（單局上限）：三款皆 300，暫定值
- `coinDailyCap`（每人每遊戲每日上限）：**三款皆 100000**（使用者 2026-08-27 拍板定案）

**Why:** 原本規劃階段抓每日上限 1000 只是拍腦袋起始值；使用者要求先改成 100000（相當於實質不設限），目的是先讓遊戲紀錄機制跑起來，不急著卡玩家。同時使用者明確提到「後續會需要用後台管理」——這幾個常數目前改值要改程式碼＋重啟服務，之後應該要有後台介面能直接調整（可能也包含查看/清除玩家遊戲紀錄），但這個後台管理功能**尚未排入任何 change 的範圍**，只是先記錄需求來源。

**How to apply:**
- 之後如果要調整 coin 兌換相關數值（`coinRate`/`coinCapPerRun`/`coinDailyCap`），先確認這三個檔案的現況值，不要憑空假設還是舊的 1000。
- 如果對話中聊到「遊戲紀錄」「coin 兌換」「後台」相關話題，主動提醒使用者：這幾個常數還沒有後台管理介面，目前只能改程式碼，可以問要不要現在規劃一個新的 OpenSpec change 來做。
- 若使用者之後說要開始做這個後台管理功能，這則記憶就是它的需求起點，設計時記得涵蓋：調整 coin 兌換三常數、（可能）查看/清除玩家遊戲紀錄。
EOF

# ── 9. GAME 17-25 openspec 提案 ────────────────────────────────
cat > "$MEMORY_DIR/project_pixel_games_17-25_proposals.md" << 'EOF'
---
name: project-pixel-games-17-25-proposals
description: GAME 17-25 全數完成並已上線；8 款（2048/Flappy/Frogger/Connect4/Whack-a-mole/Lights Out/Tower Stack/Arkanoid）皆已實作、測試、commit；Dino Run 不新增
metadata:
  type: project
---

依 `prompt/pixel_game_prompts_17-25.txt` 的 9 款遊戲開發計畫（2048/Flappy/Frogger/Connect4/Whack-a-mole/Lights Out/Tower Stack/Arkanoid/Dino Run），已於 2026-09-01 建立對應 9 個 openspec 提案（`openspec/changes/add-<game>-game/`，各含 README/proposal/design/tasks/specs/game-history/spec.md），純文件、未動任何 `app/`/`server/`/`shared/` 程式碼。

game-hall id 依序登記 17~25，gameKey：`2048`／`flappy`／`frogger`／`connect4`／`whackAMole`／`lightsOut`／`towerStack`／`arkanoid`／`dinoRun`。

**Why:** 使用者要求依序（一次全部輸出）建立這 9 款遊戲的第一階段分析＋openspec 提案，格式比照既有 `add-battleship-game` 範例，深度用平行 subagent 產出。

**2026-09-01 使用者已拍板 4 項關鍵決議（對應文件已同步更新為「已拍板」狀態）：**
- **add-dino-run-game → 方案 B**：**不新增 DINO RUN 這款獨立遊戲**。README/proposal/design/tasks 已全部更新標記「不執行，保留為分析紀錄」。Double Jump／Day-Night／Challenge Mode 改由未來獨立的 RUNNER 擴充提案（例如 `update-runner-game-endless-extras`，**尚未建立**，需使用者指示才會動工）處理，繼續用 RUNNER 既有 `gameKey`。**本批遊戲最終為 8 款**（2048/Flappy/Frogger/Connect4/Whack-a-mole/Lights Out/Tower Stack/Arkanoid），game-hall id 17-24，DINO RUN 的 id 25 名額不遞補。
- **add-arkanoid-game → 方案 b**：ARKANOID 獨立實作 `app/utils/arkanoidEngine.ts`，**不修改 `breakout.vue`**，共用 engine 重構（方案 a）不執行。
- **add-connect4-game → 效率加成計分**：採「固定基礎分＋落子效率加成」（`WIN_BASE=60`＋最高 40 效率加成，`DRAW=20`，`LOSE=0`），非單純固定值模型。
- **add-flappy-game／add-tower-stack-game → 沿用 DOM/CSS**：確認不使用 Canvas，與全專案既有渲染慣例一致。

**2026-09-02 8 款遊戲全部實作完成並各自 commit（game-hall id 17-24）：**
- `1cb3991` 2048、`451875f` FLAPPY、`aef29de` FROGGER、`ffd39f1` CONNECT 4、`c12759c` WHACK-A-MOLE、`25eb094` LIGHTS OUT、`6572f48` TOWER STACK、`cc856a9` ARKANOID。
- 每款皆：規則核心抽成 `app/utils/<game>Engine.ts`（零 Vue 依賴）、附獨立單元測試、並用 Playwright 實際啟動瀏覽器操作驗證核心玩法/計分/Pause-Resume/Restart，才進行 commit。
- ARKANOID 全程確認 `app/pages/game/breakout.vue` 未被修改（方案 b 獨立實作）。
- 過程中發現這個 repo 有另一個並行 session 在做 admin 角色管理／聊天排程功能，共用檔案（`api.ts`／`game-hall.vue`）多次交錯修改；改用「只 patch 自己新增的行到 git index」的手法（`git apply --cached` 搭配手刻 diff）避免把對方未完成的工作意外夾帶進本批 commit。若之後又遇到類似情境（同一 repo 有其他 session 同時在跑），記得比照這個做法。
- 過程中 `server/api/admin/members.post.ts`（對方的檔案）有個 import 路徑寫錯（多一層 `../`）導致整個 dev server 起不來，已就地修正兩行 import 路徑但**沒有 commit**（那屬於對方的工作範圍），只是為了讓自己能繼續測試。

**下一步**：若要處理 RUNNER 的 Double Jump／Day-Night／Challenge Mode 擴充（見上方 Dino Run 決議），需使用者明確指示才建立新提案。這批 9 款遊戲的規劃與實作至此全部結束。
EOF

# ── 10. 驗證改動用既有 dev server ────────────────────────────
cat > "$MEMORY_DIR/feedback_temp_dev_server_testing.md" << 'EOF'
---
name: feedback-temp-dev-server-testing
description: 驗證 UI 改動時，優先用使用者既有的 dev server（通常 6100），不要另外起 npm run dev -- --port N
metadata:
  type: feedback
---

用 Playwright 驗證頁面改動時，不要用 `npm run dev -- --port N` 另外起臨時 dev server。

**Why:** `package.json` 的 `dev` script 已經寫死 `nuxt dev --port 6100`，追加 `-- --port N` 會變成命令列有兩個 `--port`，Nuxt/citty 解析不穩定——有時吃到後面那個成功綁定到 N，有時仍嘗試 6100、觸發 get-port fallback 悄悄跳到別的隨機 port（觀察到會落在 3000-3004 這種連號範圍）。因為進程實際監聽的 port 跟我以為的 N 對不上，事後用 `lsof -ti:N | xargs kill` 清理時完全找不到該 PID，導致清不掉、留下殭屍 node 進程（一次工作階段內就這樣意外留下 7 個沒清乾淨的 nuxt dev process，其中還有子進程 fork 出的 @nuxt/cli worker 沒被一併殺掉）。

**How to apply:** 動手改 `.vue` 檔前後，先用 `curl -s -o /dev/null -w "%{http_code}" http://localhost:6100/` 確認使用者原本的 dev server 是否還活著——通常一直是活的（HMR 會自動套用檔案變更）。直接對 6100 開 Playwright 驗證即可，不需要另開實例。真的必須隔離測試（例如要試會讓伺服器掛掉的操作）才考慮開臨時 server，且此時要用 `ps -eo pid,command | grep nuxt` realtime 核對「實際監聽的 port」而不是假設命令列參數會生效，收工時用 `lsof -ti:實際port` 而非假設的 port 做 kill，且優先 `kill -9`（SIGTERM 對 nuxt dev 有時只會關掉 listener、留下 hung 的 parent process）。
EOF

# ── 11. 「先幫我規劃」只寫 spec ──────────────────────────────
cat > "$MEMORY_DIR/feedback_plan_first_spec_only.md" << 'EOF'
---
name: feedback-plan-first-spec-only
description: 使用者說「先幫我規劃」時，只建立 OpenSpec 文件（proposal/design/tasks/specs），不寫任何程式碼
metadata:
  type: feedback
---

當使用者說「先幫我規劃」（或類似措辭，如「先規劃就好」），代表這次只要產出 OpenSpec 規劃文件
（`openspec/changes/<change-id>/` 底下的 `proposal.md`、`design.md`、`tasks.md`、`specs/*/spec.md`），
**不要動任何程式碼**（不用 Edit/Write 修改 `app/`、`server/` 下的實作檔案，也不要跑 dev server 驗證）。

**Why:** 使用者明確要求「都先幫我建立 spec 文件，都不寫 code」，是針對「先規劃」這個工作流程的
固定期待，而不是單次任務的例外要求。

**How to apply:**

- 看到「先幫我規劃」時，不要用 EnterPlanMode 直接進入實作規劃流程；規劃的產出物就是 OpenSpec
  文件本身，而不是等待 ExitPlanMode 核准後接著寫程式碼。
- 流程比照 feedback-project-spec 提到的 OpenSpec 慣例（proposal → design → tasks），可參考既有
  change（如 `openspec/changes/admin-role-assignment/`、`openspec/changes/add-dynamic-roles/`）的檔案
  結構與格式。
- 文件寫完後停下來，等使用者明確要求實作（例如「開始寫」「照這個做」）才動手改程式碼。
- 若使用者沒有加「先」這個字、直接描述需求要做，才照一般流程走（可能需要 EnterPlanMode 規劃後
  直接實作）；「先規劃」是明確訊號，代表這次只要文件。
EOF

# ── 12. OpenSpec 流程擴充為 6 階段 ──────────────────────────────
cat > "$MEMORY_DIR/project_openspec_workflow_6stages.md" << 'EOF'
---
name: project-openspec-workflow-6stages
description: OpenSpec 文件流程已從 4 階段擴充為 6 階段（新增 Validation、Engineering Evidence）
metadata:
  type: project
---

自 2026-09-09 起，OpenSpec 文件流程由 Proposal → Design → Tasks → Implementation 擴充為六階段：

Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence

- 新增 `openspec/templates/validation.md`：記錄實際驗證結果（功能／視覺／回歸、問題與修正、結論）
- 新增 `openspec/templates/engineering-evidence.md`：整理交付佐證（變更摘要、驗證佐證、風險與後續追蹤、封存前檢查）
- `openspec/project.md` 的 Development Workflow、語言規範、OpenSpec Progress 段落已同步更新

**Why:** 使用者要求之後所有 OpenSpec 流程都採用這個六階段架構，作為交付前更完整的驗證與稽核紀錄。

**How to apply:** 之後只要涉及 openspec 流程（新增 proposal/design/tasks、規劃新功能）時，除了既有三份文件，實作完成後應提醒／協助補上 validation.md 與 engineering-evidence.md 兩份文件。

**範圍澄清：** 這次只改文件規範層級（project.md + templates），**沒有**動到實際 OpenSpec CLI 的 `spec-driven` schema（該 schema 仍是 proposal → specs → design → tasks → apply，不會自動要求 validation / engineering-evidence 產物）。若之後使用者要連 CLI 一起改，需另外執行 `openspec schema fork spec-driven <name>` 並編輯 schema.yaml。
EOF

# ── 13. 六階段流程為強制要求 ──────────────────────────────
cat > "$MEMORY_DIR/feedback_openspec_6stage_required.md" << 'EOF'
---
name: feedback-openspec-6stage-required
description: 之後所有程式碼修改都必須走 OpenSpec 六階段流程，且要落地產出 docs/Architecture 與 docs/Engineering Evidence 文件
metadata:
  type: feedback
---

之後任何非 trivial 的程式碼修改，都必須走 [[project_openspec_workflow_6stages]] 定義的六階段：

Proposal → Design → Tasks → Implementation → Validation → Engineering Evidence

且這不只是流程描述，兩份對應文件要實際落地：

- **Architecture**：`docs/Architecture/README.md` — 專案架構的單一事實來源，若變更牽動到目錄結構 / 技術棧 / 開發規範重點，需同步更新這份文件
- **Engineering Evidence**：`docs/Engineering Evidence/<主題>.md` — 每個變更（或一批相關變更）完成 Validation 後，都要依 `openspec/templates/engineering-evidence.md` 的結構（變更摘要、驗證佐證、風險與後續追蹤、封存前檢查）產出一份文件，範例見 `docs/Engineering Evidence/game-17-25-pixel-games.md`

**Why:** 使用者在建立 GAME 17-25 的 Engineering Evidence 文件後明確要求「之後修改都需要這些流程」，代表這是往後所有變更的固定期待，不是這批遊戲的一次性要求。

**How to apply:**

1. 開始寫程式碼前，先確認是否需要 proposal/design/tasks（比照 feedback-project-spec 既有 OpenSpec 慣例）
2. 實作完成、驗證通過後，**不要只停在 commit**：在 `docs/Engineering Evidence/` 下新增或更新對應文件，記錄變更摘要、驗證佐證、風險與後續追蹤、封存前檢查
3. 若這次變更影響到專案架構（新增目錄、調整技術棧、改變開發規範），一併更新 `docs/Architecture/README.md`
4. 若使用者只說「先幫我規劃」，比照 feedback-plan-first-spec-only，只到 proposal/design/tasks 為止，Validation／Engineering Evidence 等實際動手實作後才補
EOF

# ── 14. 台彩7款玩法全數完工 ──────────────────────────────
cat > "$MEMORY_DIR/project_tw_lottery_suite_complete.md" << 'EOF'
---
name: project-tw-lottery-suite-complete
description: add-tw-lottery-suite 的 7 款台彩玩法已全數實作完成（P3/P4/BINGO 是最後 3 款），含已知待辦
metadata:
  type: project
---

`openspec/changes/add-tw-lottery-suite/` 規劃的 7 款台彩玩法（DLT/SUPERLOTTO/D539/M649/M539/P3/P4/BINGO 為 8 款，扣除 DLT 屬更早的 `add-dlt` 變更）已在 2026-09-17 全數完工：3星彩（P3）、4星彩（P4）、賓果賓果（BINGO）這最後 3 款由本次 session 依序完成，各自 commit（`82eb5f4`/`2f97d99`/`2542b4a`），Engineering Evidence 見 `docs/Engineering Evidence/tw-lottery-suite-p3-p4-bingo.md`。

**Why:** 使用者在 `lottery-hall-taiwan.vue` 頁面上看到 8 款玩法只有 5 款能點進去下注，要求「繼續處理未完成的玩法」，比對 openspec tasks.md 才發現 P3/P4/BINGO 尚未實作。

**How to apply:**

- 若之後被要求「調整某款台彩玩法的下注規則/賠率」，先確認是這 8 款的哪一款，每款都是獨立 service（`server/services/game/lottery/tw/<key>.ts`），彼此不互相 import（design.md Decision 3 的獨立性要求）
- **已知待辦，尚未執行**（見 Engineering Evidence 文件「風險與後續追蹤」）：
  1. `tasks.md` 第 2 節「期別 helper 重構」（DLT/D539/M649/M539/P3/P4 目前各自複製一份 `_nextDrawWindow`/`_parseOfficialPeriod`，未抽共用 helper）
  2. `tasks.md` 第 10 節「全站回歸與交付檢查」（後台 roleGamePerms UI 能否看到/停用 P3/P4/BINGO 尚未人工確認）
  3. **4星彩「組彩」二獎/三獎分級規則是假設**（4 碼互異→二獎，任何重複→三獎），非官方文件確認，見 `shared/config/p4.ts` 註解
  4. BINGO 沒有跨玩家單期總量限額（quota），也沒有 `Road.vue`（冷熱號）/`PopularPicks.vue`（熱門選號）
  5. BINGO 無法回填開獎歷史（官方 1102 沒有單期查詢端點）
- 這 3 款玩法都是委託 general-purpose agent 依 P3→P4→BINGO 順序實作（P4/BINGO 各自以「複製前一款的架構」為範本），每款完工後獨立重跑測試腳本驗證、只 `git add` 明確路徑清單再 commit（避免夾帶同 repo 並行 session 的其他未完工變更，見 [[project_pixel_games_17-25_proposals]] 提過的相同手法）
- BINGO 的官方 API 行為（`lotSpecial`＝超級獎號、`lotNumber` 保留原始開獎順序、`lotBigSmall`/`lotOddEven` 官方已算好含和局「－」）已現場實測驗證過兩個連續期別，不是假設
EOF

# ── 15. Postgres 遷移規劃（Phase 1-3） ──────────────────────────────
cat > "$MEMORY_DIR/project_postgres_migration_plan.md" << 'EOF'
---
name: project-postgres-migration-plan
description: Postgres+Docker 持久化遷移（Phase 1/2/3）、正式環境種子資料強化、角色遊戲權限持久化皆已實作完成並驗證通過
metadata:
  type: project
---
使用者決定把目前完全純記憶體（重啟全歸零）的架構導入 PostgreSQL（Docker 部署），拆成三個獨立 OpenSpec
change，**全部已實作完成並驗證通過（2026-10-06）**：

- `openspec/changes/add-postgres-docker/`（Phase 1）：Docker Compose（postgres:16-alpine + named
  volume）、`server/services/db.ts`（Drizzle + postgres.js，`isDbEnabled()` 統一判斷點、`ping()`）、
  `server/services/sync.ts`（`SyncScheduler` 5 分鐘批次、`SyncSource` 介面）。ORM 定案 **Drizzle**。
- `openspec/changes/migrate-members-roledefs-postgres/`（Phase 2）：`role_defs`/`members` schema
  （`role_id` 與 `is_admin` 正交欄位），CRUD 方法改 async write-through（先 DB 後記憶體），開機回填
  （`Storage.adminInitPromise`，`Storage.init()` 簽名維持同步不變）。
- `openspec/changes/migrate-game-history-postgres/`（Phase 3）：`game_orders`（增量同步+裁剪記憶體，
  只保留最近 2 期）、`retro_game_history`/`pool_audit_*`（全量快照）、`retro_daily_grants`
  （write-through，修正重啟配額歸零 bug）。`SyncSource` 介面擴充 `onSynced` 回呼。後台報表
  （members.get.ts/bg-summary.get.ts）改合併查詢記憶體+DB。

**三個 Phase 共通的重要技術細節（下次有人問起/要繼續擴充時參考）：**

- `isDbEnabled()`（`server/services/db.ts`）是全站唯一的「有沒有接 DB」判斷點，所有 DB 相關程式碼
  （開機回填、write-through、批次同步）都檢查這個，未接 DB 時完全退回純記憶體行為
- write-through（Phase 2 members/role-defs、Phase 3 dailyGrants）vs 批次同步（Phase 1 機制、
  Phase 3 orders/retro-history/pool-audit）的選擇原則：低頻+不可接受遺失 → write-through；
  高頻+可接受最終一致 → 批次同步
- `Storage.init()` 簽名全程維持同步不變，async 的開機回填邏輯（Phase 2 的 admin 帳號/角色、
  Phase 3 的 dailyGrants）都是額外用 `Storage.adminInitPromise` 或獨立函式讓
  `server/plugins/init.ts`（已改成 async plugin）另外 await，避免牽動全站 ~20 處 `Storage.get.*()`
  內的防呆呼叫
- **已踩過的 bug**（下次寫類似同步/查詢程式碼時注意）：
  1. `server/services/sync.ts` 的通用 `_buildUpsertSql()` 用 drizzle `sql` 模板手刻 SQL 時，直接把
     `Date` 物件當參數丟給 postgres.js 會炸 `ERR_INVALID_ARG_TYPE`——已修正為統一轉 ISO 字串
     （`_toSqlParam()`）；任何地方只要用這種「手刻 sql 模板」而非 drizzle 的 `.values()/.set()`
     query builder，傳 Date 都要自己轉字串
  2. `seedBootAdminsToDb()`（Phase 2）一度把已經透過 `createMember()` write-through 寫入的帳號又
     整批重 INSERT 一次，撞 primary key——教訓是寫「補寫特定幾筆」的函式時要用明確的 id 清單，
     不要讀「目前記憶體裡的全部」
- **尚未解決、記錄在案的限制**：
  - ~~`test-roles.mjs` 的臨時 QA 會員沒有刪除能力~~ **已解決**，見下方
    `add-delete-member`（2026-10-07）
  - BG 玩法的 `OrderRow` 沒有真實下注時間戳，`game_orders.created_at` 對 BG 列只是同步時間，報表
    月份判斷正確地改用 `issue` 字串而非這個欄位
  - 重啟會遺失「進行中期別」的 orders（配額驗證對那期重新從 0 算），刻意取捨，Phase 3 design.md
    已記錄為已知限制

**`openspec/changes/harden-postgres-for-production/`（2026-10-07，已實作完成並驗證通過）**：
上線前把 Phase 2 開機種子邏輯（原本寫死 admin 密碼 `admin@example.com`/`123456`、自動產生 5 筆
測試+20 筆 NPC 假帳號）改成環境變數可控：

- `SEED_DEMO_DATA`（預設 true）：`false` 時正式環境不會自動產生測試/NPC 假帳號
- `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`：種子 admin 帳號（`U0xA000001`）改讀這兩個環境變數
- **新增 `hasExistingAdmin()` 獨立判斷**（使用者明確要求）：跟「DB 有沒有任何 member」是兩個不同
  判斷，修正了一個真實存在的缺口——原本 admin 建立綁死在「DB 是否已有任何會員」的分支下，若 DB
  已有一般會員但沒有任何 admin（例如 admin 被誤刪），開機永遠不會補建，後台會永遠進不去。現在
  `hasExistingAdmin()` 在既有的 `hasExistingDbMembers()`/`rehydrateFromDb()` 分支執行後獨立再檢查
  一次，沒有 admin 就呼叫 `seedMissingAdmin()` 補建
- **實作階段的設計調整**：`seedMissingAdmin()` 原規劃吃 `ids: string[]` 參數、重用記憶體裡現有的
  帳號資料，但發現 `rehydrateFromDb()` 會整個重建 `Storage.account`，不保證特定 id 還在記憶體裡
  ——改成不吃參數、直接用環境變數現場組一筆並對 DB 做 upsert（`ON CONFLICT DO UPDATE SET
  is_admin = true`），不依賴記憶體現況
- 另外整理了 `docs/deployment/postgres-production-checklist.md` 部署檢查清單（密碼/防火牆/備份/
  監控/開機自我檢查）

已用三種情境實測驗證：全新 DB + 自訂帳密（只產生 2 筆 admin）、「有會員無 admin」邊界情況（重啟
自動補建）、未設定新環境變數（行為與現狀一致）。

**追加修正（同一天，使用者問「dev 執行步驟需不需要調整」後發現並修正）**：實測
「`DATABASE_URL` 有設定但 Postgres 當下連不上」（例如忘記先開 Docker）這個情境，發現嚴重缺口——
`hfyyManage.ts` 的 `roleDefs.rehydrateOrSeed()` 丟出未捕捉例外時，會讓
`server/plugins/init.ts` 的 `await Storage.adminInitPromise` 整個中斷，後面的
`SyncScheduler.start()`／300ms 遊戲 tick 迴圈／`SERV.RUN` 全部不會執行——HTTP 健康檢查仍回 200，
但整個遊戲引擎實質沒啟動，且沒有任何畫面提示。修正：`hfyyManage.ts` 的 admin/role-defs 開機邏輯
整段包 try/catch（失敗退回純記憶體模式繼續開機）；`server/plugins/init.ts` 的
`rehydrateTodayDailyGrantsFromDb()` 同樣包 try/catch。**重要教訓：這類「DB 設定了但連不上」的
開機情境，先前所有 Phase 的測試都沒有刻意模擬過（都是先確保 Docker 開著才重啟測試），直到使用者
問了一個實務操作問題才促使我實際測試出來**——以後類似「開機時依賴外部服務」的設計，要記得測試
「服務設定了但當下不可用」這個情境，不能只測「服務完全沒設定」跟「服務設定了且正常」兩種。

**`openspec/changes/migrate-role-game-perms-postgres/`（2026-10-07，已實作完成並驗證通過）**：
使用者請我盤點「後台功能 vs DB 實際記錄」並給優先建議後，選定第一項（角色遊戲權限開關）實作。
`role_game_perms`（`role_id` FK `ON DELETE CASCADE`）+ `game_global_disabled` 兩張表，稀疏表示法
（一列存在=被關閉），套用 write-through。這份資料沒有「種子」概念——空 DB 天然對應「全部開啟」
的記憶體預設值，比 Phase 2 更簡單（不需要「空就跑種子」的分支）。`clearRole()` 維持純記憶體，
DB 層級聯清理交給 `ON DELETE CASCADE`，已實測刪除角色後自動清空對應列。

**`openspec/changes/migrate-login-history-postgres/`（2026-10-07，已實作完成並驗證通過）**：
盤點清單第二項，登入稽核紀錄（`server/services/loginHistory.ts` 的 `byUser` Map）改走批次同步
（全量快照，不裁剪，比照 `retro_game_history`/`pool_audit_*`），刻意不做 write-through（登入是
主流程，稽核寫入失敗不該擋登入；遺失幾分鐘稽核紀錄可接受）。新增 `loginHistoryService.snapshotAll()`
供 `loginHistorySyncSource.ts` 使用，不做開機回填（重啟後記憶體清空，比照既有 precedent）。已用
真實登入流量（curl + 背景測試腳本產生 22 筆）實測驗證下一輪排程同步正確落地 Postgres，DB
enabled/disabled 兩種設定下 `npm test`（38 支）皆通過（3 支已知 BG/Bingo flaky 測試重跑後正常）。

**`openspec/changes/migrate-game-settings-postgres/`（2026-10-07，已實作完成並驗證通過）**：
使用者直接指定下一批優先序「遊戲的設定 → 聊天室排程設定 → NPC 設定」，先處理「遊戲的設定」，
實際涵蓋三個獨立純記憶體模組：`retroGameRates.ts`（30 款復古遊戲 coin 兌換三常數）、
`toyShop.ts`（柑仔店全站開關+8 款玩法賠率/難度/上下架）、`mazeTemplates.ts`（Pac-Man 自訂迷宮
樣板）。新增 `retro_game_rates`/`toy_shop_games`/`toy_shop_settings`/`pacman_maze_templates`
四張表，皆 write-through。前兩者是「override-only」（缺列＝用程式碼/模組預設值，沒有種子分支，
跟 `role_game_perms` 同一種「DB 空＝目前預設行為」邏輯）；迷宮樣板因為是陣列型態、管理員手刻
沒有程式碼預設值可回退，套用 `roleDefs.rehydrateOrSeed()` 的「空則種子、有則整個覆蓋記憶體」
模式。已用真實 API 呼叫+重啟驗證四張表的 override-only/種子回填語意皆正確，DB enabled/disabled
兩種設定下 `npm test` 通過。

**`openspec/changes/migrate-chat-schedule-postgres/`（2026-10-07，已實作完成並驗證通過）**：
`chatSchedule.ts` 設定欄位（text/hour/minute/repeat/enabled）write-through，運行游標
（lastFiredKey/lastFiredAt）刻意不持久化（300ms tick 熱路徑不依賴 DB，重啟後 interval 排程
計時重置、daily/once 視為尚未觸發，風險可忽略）。**順手修正一個實際缺口**：`hfyyManage.ts`
原本每次開機無條件新增 4 筆種子排程，持久化後會無限疊加並撞上 `MAX_SCHEDULES=30`——改成
`rehydrateOrSeed()`（DB 是空的才種子、已有資料則回填記憶體），比照 `roleDefs` 模式。已用真實
API 呼叫 + 連續 2 次重啟驗證種子不再重複累加，DB enabled/disabled 兩種設定下 `npm test` 通過。
（過程中意外撞見既有「No worker available」flaky 問題在單次 nohup 啟動內部重試 3 次、製造出
12 筆種子資料——證實 `rehydrateOrSeed()` 的 select-then-insert 對併發重啟沒有防護，但這跟
`roleDefs`/`mazeTemplates` 既有同構寫法一致，屬於「假設單一 boot 實例」的既有設計慣例，不是
本次新增的缺陷，清乾淨單次重啟驗證無誤後繼續）

**`openspec/changes/migrate-npc-settings-postgres/`（2026-10-07，已實作完成並驗證通過，盤點清單
最後一項）**：`npcAutoPlay.ts` 的 7 個記憶體 store，新增 5 張表（`npc_settings` 全域單例、
`npc_game_presets`、`npc_member_settings` 全列寫入、`npc_member_games` 稀疏表示法「列存在=允許」、
`npc_daily_spent` PK 只用 user_id），皆 write-through（`_dailySpent` 因高頻改 fire-and-forget，
不擋 300ms tick）。**這批不只是設定遺失**：重啟後 `_allowedGamesByUser`/`_memberSettings` 清空
會讓 fallback 邏輯把所有 NPC 打回「全選+同權重」，正是 `fix-npc-game-diversity` 想修的問題會
重新發生——持久化後才真正解決。順手修正 `hfyyManage.ts` 結尾無條件 `setEnabled(true)` 覆蓋管理員
設定的問題（改成只在 DB 未啟用/回填失敗時才強制開啟）。**意外發現並修正 Area 1 遺留 bug**：
drizzle 的 `numeric()` 欄位型別是 `string`，`retroGameRates.ts`/`toyShop.ts` 原本直接塞 number
在 `onConflictDoUpdate` 會型別檢查失敗（當時 typecheck 核對不夠仔細沒抓到），這次一併修正三個
檔案。已用真實 API 呼叫+重啟驗證核心問題確實修正，`_gamePresetSeq` 不衝突，DB enabled/disabled
兩種設定下 `npm test` 通過。

**`openspec/changes/add-delete-member/`（2026-10-07，已實作完成並驗證通過）**：後台一直只有
新增/編輯會員、沒有刪除，是多次盤點都提到的既有功能缺口。新增 `adminAccessService.deleteMember
(userId, actorId)`：`members` 表 write-through delete（既有 `ON DELETE CASCADE` 自動清
`npc_member_settings`/`npc_member_games`/`npc_daily_spent` 三張 NPC 附屬表，不用額外處理），
記憶體清理涵蓋 `Storage.account`/`Storage.users`（一次清掉 coin + 23 款彩種的
balanceChanges/betHistory）/`adminIds`/`memberRoleId`/`loginHistory`/`npcAutoPlay` 的
4 個 Map，並讓被刪除帳號的有效 session 立即失效（走訪 `Storage.sessions` 比對 `user.id`）。
保護規則沿用既有 `setRole()` 的邏輯：不可刪除自己、不可直接刪除管理員帳號（需先降級）。**刻意
不處理**的範圍（寫進 design.md 當已知限制）：`game_orders`/`retro_game_history`/
`retro_daily_grants`/`login_history`/`chat_schedules.created_by` 本來就沒有 FK，刪除後變孤兒
但維持「歷史稽核資料」定位；23 款彩種/30 款復古遊戲的記憶體歷史紀錄（`OrdersClass`/
`RetroHistoryClass`）、`toys/pool.ts`/`whistleCandy.ts`/`chatService.ts` 的小型 per-user Map
不處理，純粹殘留不影響功能。前台比照 `RoleList.vue` 既有的二次點擊確認模式。已用真實 API 呼叫
驗證完整流程（含 session 失效），並**直接用新功能清除了 5 筆先前測試遺留、文件記錄為需要手動
SQL 清理的 `qa-role-test-*` 帳號**——不只是理論驗證，是真的解決了那個待辦。UI 二次點擊確認流程
因環境無瀏覽器自動化工具，沒有實際開瀏覽器點擊驗證，已在 validation.md 誠實記錄此限制。

**`openspec/changes/migrate-wallet-and-reports-postgres/`（2026-10-07，已實作完成並驗證通過，
盤點清單最後 5 項全數完成）**：F幣餘額/交易明細持久化（本批工程量最大）+ 遊戲紀錄/彩池稽核/
F幣統計/台彩派彩共 4 條查詢路徑接 DB。**F幣部分刻意不走 write-through**：`coin` 分散在 23 款
遊戲（15 BG + 8 TW）**46 處**直接賦值，`balanceChanges` 分散在 **25 處** push（其中 23 處
`pushBalanceChange()` 形狀幾乎逐字相同），若要 write-through 必須把這 71 個呼叫點全部改
async，風險極高且不符合這個專案的規模（個人作品集 Demo，非真實金流系統）。改成新增
`wallet_coin`/`wallet_balance_changes`/`tw_payout_events` 三張表走**批次同步**（5 分鐘），
**完全不觸碰既有 23 款遊戲的任何結算/下注程式碼**。`coin` 做開機回填（**修正「重啟後 F幣全部
變回 100000」這個長期存在的痛點**），交易明細/台彩中獎事件刻意不回填記憶體（比照
`login_history` 既有慣例，只當永久備份，查詢路徑改合併查詢）。四條查詢路徑比照既有
`queryArchivedOrdersForMonth` 樣板：記憶體（近期）+ DB（完整歷史）合併，以 id 去重（記憶體
優先）。**額外發現**：深入確認後發現台彩的「中獎」（`betHistory` 結算當下寫入）跟「領獎」
（`balanceChanges` 的 `type:'claim'`，玩家手動點擊才寫入，可能延後或從未發生）是兩個不同
時間點的事件，不能互相替代，所以台彩派彩統計需要獨立新增 `tw_payout_events` 持久化中獎事件，
不能靠 F幣交易明細代替。已用真實背景測試流量驗證：三張新表的批次同步（**實測發現前兩輪同步
剛好撲空**——背景測試還沒累積出交易資料，第三輪才真正驗證成功，誠實記錄這個過程而非只挑
成功的那次）、`coin` 開機回填（重啟後 96077，不是 100000）、四條查詢路徑的記憶體+DB 合併
（重啟後記憶體幾乎清空時立即查詢，四條路徑都顯示遠超記憶體當下內容量的數字，證實合併查詢
真的在讀 DB）皆正確運作。DB enabled/disabled 兩種設定下 `npm test` 通過（2 支已知 BG flaky
測試重跑後 100% 通過）。

**`openspec/changes/fix-member-balance-history-tw-gap/`（2026-10-07，已實作完成並驗證通過）**：
使用者在「盤點清單全數完成」後追問「db 還未處理的部分」，對照 `migrate-wallet-and-reports-postgres`
明確記錄的延後事項，補上 `memberBalanceHistoryService`（後台「會員個人異動明細」）缺漏的 8 個
台彩來源（既有缺陷，過去完全看不到任何台彩下注/派彩紀錄）+ 接上 `wallet_balance_changes` 的
記憶體+DB 合併查詢，讓這條查詢路徑跟其他 4 條（遊戲紀錄/彩池稽核/F幣統計/台彩派彩）看齊。
已用真實 API 呼叫驗證：22 個來源全部正確顯示，重啟後記憶體清空時立即查詢回傳 300 筆（上限），
證實資料來自 DB。DB enabled/disabled 兩種設定下 `npm test` 全數通過（38/38，0 失敗）。

**盤點清單全貌（已全數完成，使用者的「後台功能 vs DB 持久化」盤點到此告一段落）**：已處理
（members/role-defs/game-orders/retro-history/pool-audit/daily-grants/role-game-perms/
登入紀錄/遊戲的設定/聊天室排程/NPC設定/刪除會員/F幣餘額與交易明細/遊戲紀錄查詢路徑/
彩池稽核查詢路徑/F幣統計報表/台彩派彩統計報表/會員個人異動明細的台彩缺口）。使用者當初
指定的優先序批次（遊戲設定→聊天室排程→NPC設定）+ 後續主動要求的刪除會員功能 +「都幫我一起
完善處理」的剩餘 5 項 + 事後追問「db 還未處理的部分」挖出的會員異動明細缺口，已全數完成。

**2026-10-08 總驗證（使用者要求「總驗證改DB後的功能，加上點擊測試」）**：環境無瀏覽器自動化
工具，以 API 層級模擬點擊流程（直接呼叫每個管理後台互動實際觸發的 API，依真實使用順序）
涵蓋全部 12 個 DB 持久化領域（角色權限/全域遊戲開關/會員CRUD/NPC設定與個別遊戲開關/復古
遊戲與柑仔店設定/Pac-Man迷宮樣板/聊天排程/6hc-cd限額/報表4條查詢路徑），48 項斷言全數通過；
重啟伺服器驗證 write-through 設定正確回填、override-only 表（retro_game_rates/
toy_shop_games）正確回退程式碼預設值；直接查 Postgres 確認批次同步表（game_orders/
retro_game_history/pool_audit_*/login_history/wallet_balance_changes/wallet_coin/
tw_payout_events/retro_daily_grants）持續有新資料寫入，時間戳與 NPC 背景活動一致；
`wallet_balance_changes` 的 22 個 source 分組與 `fix-member-balance-history-tw-gap` 記錄的
22 個來源數字吻合。完整 `npm test`（38 支）：35 支一次通過，3 支（kl10/kl8/pk10-cd）個別
重跑後 100% 通過——同一批既有的期別邊界時序 flakiness，與 DB 遷移無關。測試過程中建立的
自訂角色/NPC會員/排程/樣板/組合全數清理，retro_game_rates 與 toy_shop_games 兩張 override-only
表也確認沒有殘留測試列。結論：所有已完成的 DB 遷移功能經過這次獨立總驗證，行為正確、無回歸。

**Why:** 架構決策分階段是為了控制風險——Phase 1 先打地基，Phase 2/3 各自選擇適合自己資料特性的同步
策略。使用者每個 Phase 完成後都明確回覆「好的」確認才繼續下一個。

**How to apply:**

- 三個 change 都還沒 `openspec archive`，因為想留著讓後續有需要擴充（例如 Phase 4 Redis、或 tasks.md
  第 7/8 節記錄的各種「視需求開新 change」項目）時方便參照既有設計決策
- 若使用者要繼續擴充（Phase 4 Redis、`claimableIssues` 上限、quota P2 擴充、BG `createdAt` 欄位…），
  延續「先問資料特性該用 write-through 還是批次同步」的判斷框架，並維持「先規劃不執行」直到使用者
  明確要求 Implementation（見 [[feedback_plan_first_spec_only]]），完成後記得走六階段流程更新
  `tasks.md`/`validation.md`/`engineering-evidence.md`（見 [[feedback_openspec_6stage_required]]）
- 操作上的教訓：手動重啟 dev server 時容易因為舊 process 沒有真正死掉而產生殭屍 `nuxt dev` process
  （埠號衝突、Nitro 噴 `No worker available` 並陷入重啟迴圈），下次需要重啟時務必先
  `pkill -9 -f "nuxt dev"` 徹底清乾淨再啟動單一實例，不要疊加 `nohup npm run dev &`
- 與 [[project_quota_p2_pending]]、[[project_game_history_coin_reward]] 兩份既有待辦互相呼應，
  Phase 3 design.md 明確把這兩塊列為排除範圍，仍待使用者決定是否要另開 change
- **drizzle `numeric()` 欄位踩過的坑**：型別是 `string`，不是 `number`——寫入/更新時直接塞
  JS number 在 `onConflictDoUpdate` 會型別檢查失敗（`retroGameRates.ts`/`toyShop.ts`/
  `npcAutoPlay.ts` 都中過），一律要 `String(n)` 轉換；讀回來時用 `Number(row.x)` 轉回數字。
  以後新表只要用到 `numeric()` 型別都要記得這點，`npm run dev`/`npm test` 不會抓到（postgres.js
  底層照樣把 number 轉成字串送出去，只有 TypeScript 編譯期型別檢查會過不了），要跑
  `npx nuxi typecheck` 才看得到
- **重要分辨：「還未處理的 DB 工作」vs「刻意的架構決策」**——使用者問過一次「db 還未處理的
  部分」，答案是 `memberBalanceHistory.ts` 缺 8 個 TW 來源這種**真的被明確記錄為延後處理**
  的項目（design.md/validation.md 寫「不在本次範圍」）。以下這些是**刻意決策、不是待辦**，
  不要被問到類似問題時誤認成還要修：`coin` 批次同步 5 分鐘延遲（不是 write-through）、
  `wallet_balance_changes`/`tw_payout_events`/`retro_game_history`/`pool_audit_*`/
  `login_history` 都不回填記憶體（只當 DB 永久備份）、刪除會員後 `game_orders` 等 5 張無 FK
  表會變孤兒資料、23 款彩種/30 款復古遊戲的記憶體歷史結構不會被刪除會員清理、聊天室排程運行
  游標不持久化、NPC 既有（上線前）未寫入過的資料不會回填、quota P2（見
  [[project_quota_p2_pending]]，使用者已明確決定不做）。真的要重新考慮這些取捨，要等使用者
  明確提出，不要主動「順便修掉」
EOF

# ── 16. GCP VM 已部署（純記憶體） ──────────────────────────────
cat > "$MEMORY_DIR/project_gcp_vm_deployed.md" << 'EOF'
---
name: project-gcp-vm-deployed
description: 專案已部署到 GCP VM（hfyy-instance-1，8.231.244.199），2026-10-08 起接 Cloud SQL（hfyy-db / HFYY-DATABASE），含 SSH、網址、部署方式與待辦
metadata:
  node_type: memory
  type: project
  originSessionId: 4c46fe7a-f690-43fa-babf-a60ec567abe2
  modified: 2026-10-08T06:58:38.681Z
---

2026-10-08 專案首次實機上線：**https://8-231-244-199.sslip.io**

- VM：GCP `hfyy-instance-1`，us-west1-b，e2-micro，Ubuntu 24.04，外部 IP `8.231.244.199`（靜態，名稱 hfyy-home）。開機磁碟 **pd-balanced 30GB**（2026-10-08 由 10GB 加大，不在免費額度內，約 US$3/月），root ext4 約 29G。VM 上的 gcloud（服務帳戶 fatyoyo，scope cloud-platform）可直接 `gcloud compute disks resize`，加大後跑 `sudo growpart /dev/sda 1 && sudo resize2fs /dev/sda1`，不用停機
- SSH：`ssh wutony76@8.231.244.199`（本機 `~/.ssh/id_rsa`，公鑰已加到 VM 的 SSH 金鑰）
- 架構：Caddy（sslip.io 自動 HTTPS）→ pm2 `portfolio`（127.0.0.1:3000）；`/srv/portfolio/{releases,current,shared/.env}`
- **資料庫：Cloud SQL**（2026-10-08 從純記憶體模式切換）：執行個體 `hfyy-db`（Enterprise、PG16、us-west1-b、無 HA），連線名稱 `fatdemo-260226001:us-west1:hfyy-db`，資料庫 `HFYY-DATABASE`，使用者 `portfolio`（密碼使用者自訂，含 `\` `)`，URL 需編碼成 %5C %29）。VM 上 systemd `cloud-sql-proxy`（v2.26.0，127.0.0.1:5432，已 enable），pm2 unit 有 drop-in 讓它排在 proxy 之後啟動。VM 服務帳戶 `fatyoyo@fatdemo-260226001.iam.gserviceaccount.com` 有 cloudsql.client；存取權範圍必須是 cloud-platform，主控台找不到選項，是用 Cloud Shell `gcloud compute instances set-service-account ... --scopes=cloud-platform`（需停機）才改成功。純記憶體模式的舊 .env 備份在 `/srv/portfolio/shared/.env.bak-memory-mode`
- 本機 Docker Postgres 也改成同一組帳密與 `HFYY-DATABASE`（本機 .env 已更新，舊的 `portfolio` 資料庫仍保留未刪）
- login_history、遊戲紀錄等走 SyncScheduler 每 5 分鐘批次同步；2026-10-08 起關閉前會 flush（Nitro close hook + pm2 kill_timeout 15s，`add-sync-flush-on-shutdown`，VM 實測通過）。只有 SIGKILL/當機/斷電才會遺失最多 5 分鐘
- 管理員密碼是隨機產生的，只存在 VM 的 `/srv/portfolio/shared/.env`（不要寫進對話或 repo）
- 部署方式：**GitHub Actions**（2026-10-08 已設定 4 個 Secrets 並實際部署成功）。流程：`git push` → Actions → Deploy (GCP VM) → Run workflow（需使用者在網頁點，本機沒有 gh CLI）。部署金鑰是本機 `~/.ssh/portfolio_deploy`（VM authorized_keys 註解 `github-actions-deploy`）。備用：本機 Docker `--platform linux/amd64 node:22.22.2-bookworm` build 後 scp + `remote-deploy.sh`
- VM 上原本的 `~/hfyy`（舊 repo clone，605MB）已於 2026-10-08 依使用者要求刪除
- **刮刮樂試算 Python 服務**（2026-10-08 起）：`py3_AVScratch_proj`（https://github.com/wutony76/py3_AVScratch_proj，私有 repo，本機在 `~/SelfCode/Self/git_proj/py3_AVScratch_proj`）部署在 VM `/srv/avscratch/{app,venv}`，systemd `avscratch`（gunicorn 只綁 127.0.0.1:8000，MemoryMax 400M，約 150MB）。必須用 Python 3.10 + Pillow 9.5（程式用 ImageDraw.textsize，Pillow 10 已移除），由 uv 安裝。更新方式：本機 `AVSCRATCH_DIR=... VM=wutony76@8.231.244.199 bash deploy/gcp-vm/avscratch/deploy-avscratch.sh`（部署 HEAD 已 commit 內容，VM 沒有 rsync）。VM 磁碟剩約 22G
- e2-micro 冷啟動差異大（12 秒～106 秒），健康檢查已改為 180 秒（`fix-vm-deploy-boot-issues`，commit eb2c682）。接 DB 後：空 DB 首次開機種子寫入約 3 分 20 秒（已做完），之後從 DB 回填約 30 秒

**Why:** 之後要更新線上版本、查 log 或排查問題時，需要知道連線方式與目前的部署形態。

**How to apply:** 部署新版本先 push，再請使用者觸發 workflow，可在背景監看 VM 的 `/srv/portfolio/current` 是否換成 `*-<commit短碼>` 再驗證；IP 已改靜態（名稱 hfyy-home）。2026-10-08 已完成：CI 修正（`SKIP_STARTUP_TESTS=1` + waitForOpen 130s，CI 轉 passing）、關閉前 flush、setup-vm.sh/gcp-vm.md 依實際部署更新。剩餘待辦：縮短開機時的 bcrypt 種子雜湊時間；台彩 20:00～20:30 封盤時 CI 台彩測試仍可能逾時；GitHub API 匿名額度每小時 60 次，輪詢 CI 別每分鐘查（改看 badge：/actions/workflows/ci.yml/badge.svg）。相關：[[project_postgres_migration_plan]]
EOF

# ── MEMORY.md 索引 ────────────────────────────────────────────
cat > "$MEMORY_DIR/MEMORY.md" << 'EOF'
# Memory Index

- [語言偏好：繁體中文](feedback_language.md) — 所有回覆一律使用繁體中文
- [git commit 訊息格式](feedback_git_commit_format.md) — 「給我最新的 git commit」→ 產生可複製的 conventional commit 訊息草稿（非 git log）
- [修改後必須完善測試](feedback_testing.md) — 每次程式碼變更後，必須實際測試確認功能正常才算完成
- [SCSS 巢狀語法](feedback_scss_nesting.md) — 產生的 SCSS 一律使用巢狀語法，不平鋪展開
- [專案規範強制遵循](feedback_project_spec.md) — 改 code 前讀 openspec/project.md；reactive 統一 state、私有邏輯封裝 _handlers/_actions/click、非同步三段狀態
- [同步 setup script](feedback_sync_setup_script.md) — 新增/修改 agent 或記憶後，必須同步更新 ~/setup-claude-memory.sh 與 claude/setup-claude-memory.sh 兩個檔案
- [6hc-cd 限額 P2](project_quota_p2_pending.md) — 跨分頁單期總上限+玩家層級覆寫，後端+後台 UI 皆已完成並驗證通過
- [遊戲紀錄 coin 每日上限](project_game_history_coin_reward.md) — 三款遊戲皆訂 100000；之後需要後台管理介面調整這些常數
- [GAME 17-25 openspec 提案](project_pixel_games_17-25_proposals.md) — 8 款遊戲已全數實作、測試、commit 完成（Dino Run 不新增）
- [驗證改動用既有 dev server](feedback_temp_dev_server_testing.md) — 不要另開 npm run dev -- --port N，直接用 6100，避免殭屍進程
- [「先幫我規劃」只寫 spec](feedback_plan_first_spec_only.md) — 只建立 OpenSpec 文件，不寫程式碼，等使用者明確要求才實作
- [OpenSpec 流程擴充為 6 階段](project_openspec_workflow_6stages.md) — 新增 Validation、Engineering Evidence 兩份文件與範本（僅文件層級，未動 CLI schema）
- [六階段流程為強制要求](feedback_openspec_6stage_required.md) — 之後所有修改都要落地產出 docs/Architecture、docs/Engineering Evidence 文件，非一次性要求
- [台彩7款玩法全數完工](project_tw_lottery_suite_complete.md) — P3/P4/BINGO 補完，含期別helper重構/quota/組彩分級假設等已知待辦
- [Postgres 遷移規劃（Phase 1-3）](project_postgres_migration_plan.md) — 全部盤點項目已完成並驗證通過，2026-10-08 再做一次 API 點擊流程總驗證+重啟+回歸測試全數通過
- [GCP VM 已部署（Cloud SQL）](project_gcp_vm_deployed.md) — https://8-231-244-199.sslip.io，DB 為 Cloud SQL hfyy-db/HFYY-DATABASE，ssh wutony76@8.231.244.199，push 後用 GitHub Actions「Deploy (GCP VM)」手動觸發部署
EOF

# ── Agents ───────────────────────────────────────────────────
AGENTS_DIR="$HOME/.claude/agents"
mkdir -p "$AGENTS_DIR"
echo "建立 Agents 目錄：$AGENTS_DIR"

cat > "$AGENTS_DIR/my-reviewer.md" << 'AGENTEOF'
---
name: my-reviewer
description: 程式碼審查專家。當使用者要求 code review、審查 PR、檢查程式碼品質、找出潛在問題、或提到需要補測試時主動使用。
model: claude-opus-4-8
effort: max
tools: Read, Grep, Glob, Bash, Edit, Write
---

你是一位嚴格的程式碼審查專家，專注於找出真正重要的問題，不做無謂的稱讚。

## 審查面向（依優先順序）

1. **邏輯錯誤與 bug**：邊界條件、race condition、空值處理、錯誤流程
2. **安全性**：XSS、injection、敏感資料外洩、不安全的依賴
3. **規範違反**：不符合專案既有慣例、命名不一致、狀態管理錯誤
4. **可維護性**：過度複雜、重複邏輯、未來會踩坑的設計
5. **測試覆蓋**：缺少測試的關鍵邏輯、未覆蓋的邊界條件

## 測試處理規則

- 審查過程中若發現**缺少測試**，直接補寫，不只是建議
- 優先補覆蓋率最低、風險最高的路徑（錯誤處理、邊界條件）
- 測試檔案命名與位置遵循專案既有慣例（先用 Glob 確認）
- 補完後在回傳格式的「測試」區塊列出新增的檔案與測試案例

## 回傳格式

### 🔴 嚴重（必須修正）
- 具體說明問題位置（檔案:行號）與原因

### 🟡 建議（可改善）
- 具體說明改善方向

### ✅ 沒問題
- 一行帶過即可，不需展開

### 🧪 測試（若有補寫）
- 列出新增的測試檔案與涵蓋的案例

## 原則

- 只回報有根據的問題，不猜測
- 每個問題附上具體的檔案位置
- 若問題有明確修法，直接給出修改建議
- 回覆使用繁體中文
AGENTEOF

cat > "$AGENTS_DIR/my-create.md" << 'AGENTEOF'
---
name: my-create
description: 新功能／組件建立專家。當使用者要建立全新功能、新 Vue 組件、新頁面、新 composable 或新 service 時主動使用。已存在的程式碼修改不適用。
model: claude-opus-4-8
effort: max
tools: Read, Grep, Glob, Bash, Edit, Write
---

你是一位熟悉此專案慣例的資深前端工程師，負責從零建立高品質的新功能或組件。

## 開始前必做

1. 讀取 `openspec/project.md` 確認最新規範
2. 用 Glob 確認目標目錄結構與既有命名慣例
3. 若是組件，先找同層級的相似組件作為參考風格

## 建立規範（強制遵守）

### Vue 組件
- 使用 `<script setup lang="ts">`
- 狀態以單一 `reactive` 物件管理，避免散落的 `ref`
- 私有邏輯封裝在具名物件：
  - `const _handlers = { ... }` — 資料轉換、工具方法
  - `const _actions = { ... }` — 業務流程（含 loading guard、錯誤處理）
  - `const click = { ... }` — UI 事件入口
- 非同步操作必須有 loading / success / error 三段狀態
- Props 與 Emits 使用 TypeScript 型別定義

### SCSS
- 一律使用巢狀語法，不平鋪
- 使用 `@use` / `@forward`，禁止 `@import`
- 顏色優先使用 CSS variable（`var(--color-red-main)` 等），避免硬編碼

### 檔案位置
- 頁面：`app/pages/`
- 組件：`app/components/`
- Composable：`app/composables/` 命名 `useXxx`
- Store：Pinia setup store，命名 `storeXxx`
- 常數／設定：`app/config/`
- 工具函式：`app/utils/`

## 回傳格式

### 📁 建立的檔案
列出每個新增檔案的路徑與用途

### 🔗 整合提示
說明需要在哪些現有檔案引入或註冊（若有）

### ⚠️ 注意事項
列出使用時需要留意的限制或待補事項

## 原則

- 寧可少做但做好，不做半成品
- 不建立用不到的 props 或功能
- 回覆使用繁體中文
AGENTEOF

echo ""
echo "✓ 設定完成，共 14 條記憶 + 2 個 Agents："
echo "  記憶："
echo "  - 語言偏好：繁體中文"
echo "  - git commit 訊息格式（「給我最新的 git commit」觸發）"
echo "  - 修改後必須完善測試"
echo "  - SCSS 巢狀語法"
echo "  - 專案規範強制遵循（openspec/project.md）"
echo "  - 同步 setup script（新增記憶或 agent 時立刻更新兩個 script）"
echo "  - 6hc-cd 限額 P2（後端+後台 UI 皆已完成並驗證通過）"
echo "  - 遊戲紀錄 coin 每日上限（100000，待後台管理介面）"
echo "  - GAME 17-25 openspec 提案（8 款已完成）"
echo "  - 驗證改動用既有 dev server（直接用 6100）"
echo "  - 「先幫我規劃」只寫 spec（不寫程式碼）"
echo "  - OpenSpec 流程擴充為 6 階段（新增 Validation、Engineering Evidence）"
echo "  - 六階段流程為強制要求（每次修改都要落地產出 docs/Architecture、docs/Engineering Evidence）"
echo "  - GCP VM 已部署（Cloud SQL，8-231-244-199.sslip.io）"
echo "  Agents："
echo "  - my-reviewer（程式碼審查 + 補測試）"
echo "  - my-create（新功能／組件建立）"
echo ""
echo "記憶目錄：$MEMORY_DIR"
echo "Agents 目錄：$AGENTS_DIR"
