#!/usr/bin/env bash
# 用途：在指定的 Claude Code 專案下建立通用記憶檔
# 使用方式：bash setup-claude-memory.sh <專案絕對路徑>
# 範例：bash setup-claude-memory.sh /Users/tony.wu/SelfCode/Git/my-project

set -e

# ── 參數檢查 ─────────────────────────────────────────────────
if [ -z "$1" ]; then
  echo "請提供專案絕對路徑，例如："
  echo "  bash setup-claude-memory.sh /Users/tony.wu/SelfCode/Git/my-project"
  exit 1
fi

PROJECT_PATH="$1"

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
description: 每次新增或更新 Claude 記憶時，必須同步更新專案內的 claude/setup-claude-memory.sh
metadata:
  type: feedback
---

每次新增或修改記憶檔（在 `~/.claude/projects/.../memory/` 下），必須同步更新 `<project>/claude/setup-claude-memory.sh`，讓該 script 能重建出完整最新的記憶狀態。

**Why:** 使用者希望 setup-claude-memory.sh 作為記憶的 source of truth，能在新環境一鍵還原所有記憶。

**How to apply:** 每次寫完記憶檔後，立刻更新 claude/setup-claude-memory.sh：
1. 新增對應的 `cat > "$MEMORY_DIR/<filename>.md"` 區塊
2. 更新 MEMORY.md 的索引條目
3. 更新結尾的 echo 數量與說明
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

echo ""
echo "✓ 記憶檔建立完成，共 9 條通用記憶："
echo "  - 回覆語言（繁體中文）"
echo "  - 每次對話後提供 commit 訊息"
echo "  - 「給我最新的 git commit」觸發格式"
echo "  - Vue 元件命名規則"
echo "  - 同步 setup-claude-memory.sh 規則"
echo "  - 遵守 cursorrules 與 project.md"
echo "  - OpenSpec Skills 清單"
echo "  - OpenSpec 自動讀取規則"
echo "  - 記憶衝突檢查規則"
echo ""
echo "目錄位置：$MEMORY_DIR"
