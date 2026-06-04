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
name: 回覆語言
description: 使用者要求所有回覆使用中文
type: feedback
---
一律用繁體中文回答使用者。

**Why:** 使用者明確要求「總是用中文回答」，作為預設習慣。

**How to apply:** 所有文字回覆、說明、建議、反問與澄清問題皆使用繁體中文，程式碼內容不受影響。
EOF

# ── 2. Commit 訊息觸發格式 ───────────────────────────────────
cat > "$MEMORY_DIR/feedback_commit_trigger.md" << 'EOF'
---
name: feedback-commit-trigger
description: 當使用者說「給我最新的 git commit」時，執行 git status + git diff HEAD，涵蓋 untracked 檔案，輸出完整中文 commit 訊息
metadata:
  type: feedback
---

當使用者說「給我最新的 git commit」（或類似語句），必須同時執行：
1. `git status` — 取得 untracked 檔案清單
2. `git diff HEAD` — 取得已追蹤檔案的變更

將兩者合併，產出涵蓋所有變更（含 untracked）的完整 commit 訊息（直接輸出可複製的 markdown code block，不加多餘說明）：

```
<type>(<scope>): <標題（中文）>

- <bullet 1（中文）>
- <bullet 2（中文）>
- ...
```

**標題與 bullet 一律使用繁體中文。**

**Why:** `git diff HEAD` 不包含 untracked 檔案，會漏掉新增的資料夾/檔案；需搭配 `git status` 才能產出完整 commit。

**How to apply:** 觸發詞為「給我最新的 git commit」時，先跑 `git status` + `git diff HEAD`，合併結果後輸出完整 code block，標題與 bullet 全用繁體中文，不附帶其他說明文字。
EOF

# ── 3. 每次對話後提供 commit 訊息 ────────────────────────────
cat > "$MEMORY_DIR/feedback_commit_summary.md" << 'EOF'
---
name: feedback_commit_summary
description: 每次對話結束後，自動 git diff HEAD 比較變更，並提供簡短的 commit 訊息供使用者複製
metadata:
  type: feedback
---

每次使用者詢問完畢後，主動執行 `git diff HEAD` 比較與上一版的差異，整理出這一版的更新功能，並提供一行簡短的 commit 訊息供使用者複製。

格式範例：
```
feat(ems): 新增員工照片讀取 API
```

**標題與 bullet 一律使用繁體中文。**

**Why:** 使用者希望每次對話後都能快速得到可複製的 commit 訊息，不需要自己手動整理，且內容全中文。

**How to apply:** 對話中有修改程式碼時，在回覆結尾自動附上 git diff 摘要與 commit 訊息，標題與說明全用繁體中文。
EOF

# ── 4. Vue 元件命名規則 ───────────────────────────────────────
cat > "$MEMORY_DIR/feedback_component_naming.md" << 'EOF'
---
name: feedback_component_naming
description: Vue 元件命名規則 — Dialog 前綴優先，依功能模組分類
metadata:
  type: feedback
---

元件命名採「**型別前綴 + 功能 + 動作**」格式，型別放最前面。

## Dialog 元件
`Dialog[Feature][Action].vue`
- `DialogLeaveCreate.vue`
- `DialogLeaveDetail.vue`
- `DialogLeaveComplete.vue`
- `DialogAddEdit.vue`

## 其他型別（以此類推）
- Panel：`[Feature]Panel.vue`（如 `LeaveTablePanel.vue`）
- FilterBar：`[Feature]FilterBar.vue`（如 `LeaveFilterBar.vue`）

**Why:** 舊命名（`[Feature]Dialog.vue`）型別放尾端，不好依型別分群；改為前綴後 IDE 排序會將同型別元件聚在一起。

**How to apply:** 每次新增或重構元件時，確認型別前綴是否正確放在最前面。看到 `XxxDialog.vue` 應主動提醒更名為 `DialogXxx.vue`。
EOF

# ── 5. 同步 setup-claude-memory.sh 規則 ─────────────────────────
cat > "$MEMORY_DIR/feedback_sync_setup_script.md" << 'EOF'
---
name: feedback-sync-setup-script
description: 新增或修改 agent 檔或記憶檔後，必須同步更新兩個 setup script，讓新環境可一鍵重建
metadata:
  type: feedback
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

# ── 6. 遵守 cursorrules 與 project.md ────────────────────────────
cat > "$MEMORY_DIR/feedback_cursorrules.md" << 'EOF'
---
name: feedback-cursorrules
description: 每次回應前必須遵守 .cursorrules 與 openspec/project.md，兩者衝突時主動回報
metadata:
  type: feedback
---

每次執行任何任務前，必須以 `openspec/project.md` 為最高準則，`.cursorrules` 為補充標準。

**核心規範摘要：**
- 僅 JavaScript，禁止 TypeScript
- `<script setup>` + Composition API only
- 公開 API 必須寫 JSDoc（`@param`, `@returns`, `@typedef`）
- 邏輯分層：`click（handleXxx/onXxx）→ actions（fetchXxx/submitXxx）→ _handlers`
- 狀態：`reactive` 優先，全域用 Pinia setup store，禁止解構 store
- 複雜邏輯抽離至 Class / Service Objects
- 私有邏輯封裝在 `_handlers`、`_actions` 等具名物件
- SCSS 7-1 pattern，禁止 `@import`，必須 semantic token
- `// [Manual Override]` / `// [DO NOT MODIFY]` 禁止修改，衝突需回報
- 非 trivial 需求須走 OpenSpec 流程（proposal → design → tasks → implementation）

**Why:** 使用者明確要求遵守這兩份規範，project.md 優先於 cursorrules，衝突時不得自行決定。

**How to apply:** 每次實作前檢查命名、分層、狀態管理是否符合規範；遇到 `[Manual Override]` 停手回報；非 trivial 需求先提 proposal。
EOF

# ── 7. OpenSpec Skills 清單 ───────────────────────────────────────
cat > "$MEMORY_DIR/reference_openspec_skills.md" << 'EOF'
---
name: reference-openspec-skills
description: 專案 Skills 清單與 OpenSpec 工作流程，位於 .cursor/skills/
metadata:
  type: reference
---

Skills 位於 `.cursor/skills/`，以下為可用指令：

| Skill | 用途 |
|-------|------|
| `naming-logic-enforcer` | 命名去冗餘（alwaysApply）— 檔名不重複父資料夾、Btn 前綴、去冗長型別名 |
| `openspec-propose` | 建立新需求，一步產出 proposal.md + design.md + tasks.md |
| `openspec-apply-change` | 依 tasks.md 逐步實作，完成後打勾 |
| `openspec-archive-change` | 封存完成的 change 至 `openspec/changes/archive/` |
| `openspec-explore` | 思考探索模式，只讀不實作，可產 OpenSpec artifacts |

**OpenSpec 流程：**
`openspec/changes/<name>/` 內含 `.openspec.yaml`、`proposal.md`、`design.md`、`tasks.md`

**Why:** 使用者要求在操作前了解可用 Skills，並在適當時機主動建議使用對應 Skill。

**How to apply:** 非 trivial 新功能 → 建議 openspec-propose；要實作 tasks → openspec-apply-change；重構/清理命名 → naming-logic-enforcer。
EOF

# ── 8. 記憶衝突檢查規則 ───────────────────────────────────────────
cat > "$MEMORY_DIR/feedback_memory_conflict_check.md" << 'EOF'
---
name: feedback-memory-conflict-check
description: 每次新增或修改記憶後，必須掃描所有記憶是否有衝突，有衝突則列出選項讓使用者決定
metadata:
  type: feedback
---

每次寫完記憶檔後，掃描所有現有記憶，檢查是否有邏輯衝突或互相矛盾的規則。

**衝突類型：**
- 同一行為有不同指令（例如：commit 要英文 vs commit 要中文）
- 觸發條件重疊但行為不同
- 規範互相排除

**流程：**
1. 寫完記憶後，讀取 MEMORY.md 索引
2. 掃描相關記憶檔內容，比對是否衝突
3. 若有衝突 → 列出衝突項目與選項，等使用者選擇後再修正
4. 若無衝突 → 直接完成，不需額外說明

**Why:** 避免記憶庫中累積互相矛盾的規則，導致行為不一致。

**How to apply:** 每次 Write/Edit 記憶檔完成後執行衝突掃描，有衝突時暫停並列出選項，不自行決定。
EOF

# ── 9. OpenSpec 自動讀取規則 ──────────────────────────────────────
cat > "$MEMORY_DIR/feedback_openspec_autoread.md" << 'EOF'
---
name: feedback-openspec-autoread
description: 當使用者新增或提及 openspec 內容時，必須主動讀取相關檔案再繼續作業
metadata:
  type: feedback
---

當使用者新增、修改或提及 openspec 相關內容時，必須主動讀取最新的 artifacts 再繼續作業。

**需自動讀取的路徑：**
- `openspec/project.md` — 專案最高準則
- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/tasks.md`
- `openspec/specs/<capability>/spec.md`（若存在）

**觸發時機：**
- 使用者說「我新增了 openspec」、「更新了 proposal/design/tasks」
- 使用者請我實作某個 change（先讀再做）
- 對話中出現 change name 或 openspec 路徑

**Why:** 使用者希望我在作業前總是持有最新的 openspec 內容，避免依賴過期的對話記憶。

**How to apply:** 偵測到觸發時機，立刻用 Read 工具讀取相關檔案，確認內容後再回應或實作。
EOF

# ── 9. MEMORY.md 索引 ─────────────────────────────────────────
cat > "$MEMORY_DIR/MEMORY.md" << 'EOF'
# Memory Index

- [回覆語言](feedback_language.md) — 一律用繁體中文回答，包含詢問與澄清
- [每次對話後提供 commit 訊息](feedback_commit_summary.md) — 修改程式碼後自動 git diff 並提供可複製的 commit 訊息
- [「給我最新的 git commit」觸發格式](feedback_commit_trigger.md) — 說此句即執行 git diff 並輸出 type(scope): 標題 + bullet 格式的 code block
- [Vue 元件命名規則](feedback_component_naming.md) — 型別前綴優先：DialogXxx、PanelXxx，舊格式 XxxDialog 應更名
- [同步 setup-claude-memory.sh](feedback_sync_setup_script.md) — 每次新增/更新記憶時，必須同步更新 claude/setup-claude-memory.sh
- [遵守 cursorrules 與 project.md](feedback_cursorrules.md) — JS only、分層規範、OpenSpec 流程、Manual Override 禁改
- [OpenSpec Skills 清單](reference_openspec_skills.md) — naming-logic-enforcer / propose / apply / archive / explore 使用時機
- [OpenSpec 自動讀取](feedback_openspec_autoread.md) — 使用者新增/提及 openspec 內容時，主動讀取最新 artifacts 再作業
- [記憶衝突檢查](feedback_memory_conflict_check.md) — 每次新增記憶後掃描衝突，有衝突列選項給使用者決定
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
echo "✓ 設定完成，共 9 條記憶 + 2 個 Agents："
echo "  記憶："
echo "  - 回覆語言（繁體中文）"
echo "  - 每次對話後提供 commit 訊息"
echo "  - 「給我最新的 git commit」觸發格式"
echo "  - Vue 元件命名規則"
echo "  - 同步 setup-claude-memory.sh 規則"
echo "  - 遵守 cursorrules 與 project.md"
echo "  - OpenSpec Skills 清單"
echo "  - OpenSpec 自動讀取規則"
echo "  - 記憶衝突檢查規則"
echo "  Agents："
echo "  - my-reviewer（程式碼審查 + 補測試）"
echo "  - my-create（新功能／組件建立）"
echo ""
echo "記憶目錄：$MEMORY_DIR"
echo "Agents 目錄：$AGENTS_DIR"
