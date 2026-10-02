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
description: 6hc-cd 投注限額只做到「分頁層級」，跨分頁單期總上限與玩家層級限額（P2）使用者決定暫不處理
metadata:
  node_type: memory
  type: project
---

**待決事項（2026-08-06 記錄，使用者明確表示目前不處理）**：6hc-cd 信用盤的投注限額目前只到「分頁層級」，由 `c_tema.js` / `c_zhengma.js` 各分頁的 `settings.quota` 提供，經 `shared/config/cd/helpers.ts` 的 `creditQuotaOf()` 讀取，伺端在 `server/services/lottery6hcCd.ts` 的 `handle.validateBetQuota()` 驗證（擋在扣款與建單之前）。

**已實作**：單注上下限 `item.min` / `item.max`；單期上限 `issue.max`，以「同一玩家＋同一期＋**同一分頁**」累計（`orders.get.issueTabCoin()`），`max: 0` 視為不限。

**尚未實作（P2）**：
- 跨分頁的單期總投注上限（例如同一期在 特碼A＋特碼B＋正碼A… 的合計上限）
- 玩家層級限額（依帳號個別設定），需要在 user 資料結構（`server/services/storage.ts` / `users.ts`）新增欄位，並可能需要後台設定介面

**Why:** 使用者評估後決定先停在分頁層級，P2 涉及資料結構變更與營運設定，暫不投入。

**How to apply:** 不要主動實作 P2；若使用者提到「限額不夠用」「跨分頁上限」「單一玩家限額」再提出這份紀錄。實作時注意限額設定與賠率同源（都在各分頁 config），新增層級應延伸 `creditQuotaOf()` 的 fallback 鏈而不是另開一套解析。相關待決項另見 [[project-jackpot-weight-zhengma]]。
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

# ── MEMORY.md 索引 ────────────────────────────────────────────
cat > "$MEMORY_DIR/MEMORY.md" << 'EOF'
# Memory Index

- [語言偏好：繁體中文](feedback_language.md) — 所有回覆一律使用繁體中文
- [git commit 訊息格式](feedback_git_commit_format.md) — 「給我最新的 git commit」→ 產生可複製的 conventional commit 訊息草稿（非 git log）
- [修改後必須完善測試](feedback_testing.md) — 每次程式碼變更後，必須實際測試確認功能正常才算完成
- [SCSS 巢狀語法](feedback_scss_nesting.md) — 產生的 SCSS 一律使用巢狀語法，不平鋪展開
- [專案規範強制遵循](feedback_project_spec.md) — 改 code 前讀 openspec/project.md；reactive 統一 state、私有邏輯封裝 _handlers/_actions/click、非同步三段狀態
- [同步 setup script](feedback_sync_setup_script.md) — 新增/修改 agent 或記憶後，必須同步更新 ~/setup-claude-memory.sh 與 claude/setup-claude-memory.sh 兩個檔案
- [暫不處理：限額 P2](project_quota_p2_pending.md) — 6hc-cd 限額只到分頁層級，跨分頁單期總上限與玩家層級限額使用者決定不做
- [遊戲紀錄 coin 每日上限](project_game_history_coin_reward.md) — 三款遊戲皆訂 100000；之後需要後台管理介面調整這些常數
- [GAME 17-25 openspec 提案](project_pixel_games_17-25_proposals.md) — 8 款遊戲已全數實作、測試、commit 完成（Dino Run 不新增）
- [驗證改動用既有 dev server](feedback_temp_dev_server_testing.md) — 不要另開 npm run dev -- --port N，直接用 6100，避免殭屍進程
- [「先幫我規劃」只寫 spec](feedback_plan_first_spec_only.md) — 只建立 OpenSpec 文件，不寫程式碼，等使用者明確要求才實作
- [OpenSpec 流程擴充為 6 階段](project_openspec_workflow_6stages.md) — 新增 Validation、Engineering Evidence 兩份文件與範本（僅文件層級，未動 CLI schema）
- [六階段流程為強制要求](feedback_openspec_6stage_required.md) — 之後所有修改都要落地產出 docs/Architecture、docs/Engineering Evidence 文件，非一次性要求
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
echo "✓ 設定完成，共 13 條記憶 + 2 個 Agents："
echo "  記憶："
echo "  - 語言偏好：繁體中文"
echo "  - git commit 訊息格式（「給我最新的 git commit」觸發）"
echo "  - 修改後必須完善測試"
echo "  - SCSS 巢狀語法"
echo "  - 專案規範強制遵循（openspec/project.md）"
echo "  - 同步 setup script（新增記憶或 agent 時立刻更新兩個 script）"
echo "  - 暫不處理：限額 P2"
echo "  - 遊戲紀錄 coin 每日上限（100000，待後台管理介面）"
echo "  - GAME 17-25 openspec 提案（8 款已完成）"
echo "  - 驗證改動用既有 dev server（直接用 6100）"
echo "  - 「先幫我規劃」只寫 spec（不寫程式碼）"
echo "  - OpenSpec 流程擴充為 6 階段（新增 Validation、Engineering Evidence）"
echo "  - 六階段流程為強制要求（每次修改都要落地產出 docs/Architecture、docs/Engineering Evidence）"
echo "  Agents："
echo "  - my-reviewer（程式碼審查 + 補測試）"
echo "  - my-create（新功能／組件建立）"
echo ""
echo "記憶目錄：$MEMORY_DIR"
echo "Agents 目錄：$AGENTS_DIR"
