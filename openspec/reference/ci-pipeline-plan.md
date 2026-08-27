# CI 建置計劃 —— GitHub Actions 自動化檢查

> 狀態：**規劃中（尚未實作）。** 本檔為 reference 架構草案，含實測數據，供拍板決策與後續開 openspec change 使用。
> 分析日期：2026-08-27
>
> 觸發原因：專案完全沒有 CI，`package.json` 沒有 `lint`/`test`/`typecheck` script，
> 全靠人工記得跑 `npm run dev`/`npm run build` 確認沒壞——這次多個 session 同時改動同一批檔案，
> 更凸顯了缺乏自動化安全網的風險。

---

## 0. 一句話結論

**不能一次全部打開。** 專案裝了 `@nuxt/eslint`／`prettier`／`playwright`／`@nuxt/test-utils` 這些工具但從沒接起來過，
今天第一次實際跑 `nuxt typecheck`，**現在就會失敗**（12 個檔案、約 50 個既有型別錯誤，見第 2 節）。
CI 要分階段導入：**先上零風險的 build 檢查，typecheck 跟 lint 各自處理完既有違規後再逐一升級成阻斷式檢查**，
不要一次把所有既有債務攤在同一個 PR 擋所有人。

---

## 1. 現況盤點

| 項目 | 現況 |
|---|---|
| CI 平台設定 | 完全沒有，`.github/workflows/` 不存在 |
| `package.json` scripts | 只有 `dev`/`build`/`generate`/`preview`/`postinstall`，沒有 `lint`/`test`/`typecheck` |
| ESLint | `@nuxt/eslint@^1.15.2` 是 devDependency，但**沒有任何設定檔**、`nuxt.config.ts` 也沒註冊這個 module——現在執行等於沒接起來 |
| Prettier | `prettier@^3.8.1` 是 devDependency，同樣**沒有設定檔** |
| 測試框架 | `playwright@^1.60.0`、`@nuxt/test-utils@^4.0.0` 都是 devDependency，**專案裡一個測試檔案都沒有**（`find . -iname "*.test.ts" -o -iname "*.spec.ts"` 零結果） |
| TypeScript | `tsconfig.json` 靠 `nuxt prepare` 產生的 `.nuxt/tsconfig.*.json`，`nuxt typecheck` 指令存在但從未被執行過 |
| Node 版本 | `package.json` 的 `volta.node` 釘在 `22.22.2` |
| 套件鎖定檔 | `package-lock.json` 存在（729KB），可以用 `npm ci` 做可重現安裝 |
| Git 平台 | `origin` 是 `github.com:wutony76/nuxt_personal_proj.git` → GitHub Actions 是自然的選擇，不需要另外申請服務 |
| 分支保護 | 未知（GitHub repo 設定，不在 codebase 裡，需要另外去 GitHub 網頁設定，workflow YAML 本身管不到） |

---

## 2. 實測結果（決定分階段順序的關鍵數據）

### ✅ `npm run build` —— 現在就是乾淨的

這幾次改動（socket 規劃、TS 規範統一、match3 任務機制）過程中反覆手動跑過，全部正常結束、無 error。
**這是唯一一個「現在就能直接打開、零準備成本」的檢查。**

### ❌ `npx nuxt typecheck` —— 現在會失敗

實際執行結果：**12 個檔案、約 50 個既有型別錯誤**，全部集中在少數幾處：

| 檔案 | 錯誤數 | 典型錯誤 |
|---|---|---|
| `app/components/lottery/bg/6hc/of/block/footer/Auto.vue` | 15 | 大量 `implicitly has an 'any' type`、`Type '...' is not assignable to type 'never'` |
| `app/components/lottery/bg/6hc/cd/PlayTabs.vue` | 6 | `Property 'key' does not exist on type '{}'`、`'play' is of type 'unknown'` |
| `app/components/lottery/bg/6hc/cd/PlayPanel.vue` | 5 | 參數隱式 `any` |
| `app/components/lottery/bg/6hc/cd/play-panels/GenericOptions.vue` | 4 | 參數隱式 `any`、`option` 是 `unknown` |
| `app/components/lottery/bg/6hc/cd/play-panels/SimpleTableOptions.vue` | 5 | 同上 + `Property 'label' does not exist on type '{}'` |
| `app/components/lottery/bg/6hc/cd/base/Ball.vue`、`6hc/of/base/Ball.vue` | 各 1 | 參數隱式 `any` |
| `app/components/lottery/bg/kl10/block/DialogRule.vue`、`kl8/block/DialogRule.vue` | 各 2 | 排序函式參數是 `unknown` |
| `shared/config/kl8.ts` | 3（同一行報 3 次） | `Object is possibly 'undefined'` |

**這批錯誤剛好集中在我們上次「補齊 33 個 `.vue` 缺漏的 `lang="ts"`」那批檔案裡**——這些檔案原本用純 JS 寫、沒有型別標註，
新加上 `lang="ts"` 讓編譯器開始檢查後，原本就存在的隱式 `any`／型別不符就浮出來了。這不是新增的 bug，是「規則跟現況對齊」
之後自然會發生的既有債務曝光，跟第 6 節「踩雷點①」是同一件事，本來就在預期內。

### ⚠️ ESLint —— 連跑都跑不起來，不是「有沒有違規」的問題

沒有設定檔，`npx eslint .` 現在只會報「找不到設定檔」，不會產生有意義的 lint 結果。
要先完成第 4 節「前置準備」才有辦法知道有多少既有違規。

---

## 3. 分階段導入順序（依風險與準備成本排序）

```
Phase 1  build 檢查        零準備，立刻上，阻斷式
Phase 2  typecheck         需先清掉 ~50 個既有錯誤，清完才能設成阻斷式；清之前先用「非阻斷」上車
Phase 3  ESLint            需先接好設定檔 + 跑第一次看違規量，再決定阻斷或非阻斷
Phase 4  Prettier 格式檢查  低優先，可選；沒有既有規範文件講到 Prettier，屬於待拍板
Phase 5  自動化測試         目前零測試，先讓 CI 準備好「有測試就會跑」，不要為了填格子硬寫假測試
```

每個 phase 是獨立的 PR，不要一次全上——這樣任何一個 phase 卡住都不影響其他已經上線的檢查繼續擋線。

---

## 4. 各階段前置準備

### Phase 1：build —— 無前置準備

直接加 `npm run build` 到 workflow，今天就能設成 required check。

### Phase 2：typecheck —— 前置：清掉第 2 節列出的 ~50 個錯誤

兩個選項：

| 方案 | 做法 | 取捨 |
|---|---|---|
| **先清完再上（建議）** | 逐一修掉 12 個檔案的型別錯誤，`nuxt typecheck` 乾淨後才把它設成阻斷式 required check | 一次性成本，但上線那天就是乾淨、可信任的阻斷式檢查 |
| 先用非阻斷上車 | CI 跑 `nuxt typecheck`，但用 `continue-on-error: true`，先讓大家看到報告、不擋 merge，之後再拔掉這個 flag | 上得快，但「非阻斷的檢查」很容易被長期忽略，錯誤數只會越滾越多 |

考量到錯誤集中在少數幾個檔案（不是散落全專案），**建議先清完**——工作量可控，且能一併把 6hc/cd 那批已知有問題的元件補上型別。

### Phase 3：ESLint —— 前置：接上設定檔 + 跑第一次看違規量

1. `nuxt.config.ts` 的 `modules` 加入 `'@nuxt/eslint'`（已是 devDependency，只差註冊）
2. 用 `@nuxt/eslint` 的 flat config 產生器建立 `eslint.config.mjs`（Nuxt 官方推薦寫法，會自動涵蓋 Vue + TypeScript 規則）
3. 跑一次 `npx eslint .` **看實際違規數量**——這個數字現在無法預估（零基礎），很可能不小，因為：
   - `.cursorrules` 明訂「僅 JavaScript / 禁止 TypeScript」（已在這次修正為「TypeScript 為主」，但程式碼本身從來沒被 lint 規則強制過）
   - `.cursorrules` 還有「私有邏輯必須用 `_handlers`／`_actions` 命名慣例」「State Object 優先」等規範，這些從來沒有自動化工具檢查過，違規機率高
4. 依實測違規量決定：量小可以一次清完直接設阻斷；量大就先非阻斷上車，分批清

### Phase 4：Prettier —— 前置：先拍板要不要做

目前 `.cursorrules`／`project.md` 都沒有明文規定程式碼格式（縮排/引號/分號等），只有規範命名與分層。
加 Prettier 前建議先決定一份 `.prettierrc`，不要用預設值硬套到 260 個 `.vue` 檔案上——這是需要真人拍板的風格選擇，不在本次規劃自動決定。

### Phase 5：測試 —— 前置：無（因為刻意不做假測試）

`@nuxt/test-utils` 已裝好、`playwright` 已裝好，CI workflow 可以先寫好「如果有測試就跑」的 job，
但**不要為了讓 CI 看起來完整就寫幾個沒意義的 placeholder 測試**——等真的開始補測試（例如 match3 引擎那種純邏輯、
最適合寫單元測試的地方）再讓這個 job 動起來。

---

## 5. GitHub Actions Workflow 設計

### 觸發條件

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

即使現在都是直接推 `main`（沒有 PR 流程的既有慣例），`pull_request` 觸發還是先寫上——
之後如果改成多人協作或多 session 並行開發（這次 socket/match3 的情況就是活生生的例子），
會需要 PR 走這層檢查。

### Node 版本與安裝

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22.22.2'  # 對齊 package.json 的 volta.node，兩處要一起維護
    cache: 'npm'
- run: npm ci  # 用 package-lock.json 做可重現安裝，不要用 npm install
```

### Job 拆分建議

依第 3 節分階段順序，每個 phase 各自一個 job（可平行跑，因為互不依賴同一份 build 產物）：

```yaml
jobs:
  build:
    steps: [checkout, setup-node, npm ci, npm run build]

  typecheck:   # Phase 2 上線後才加
    steps: [checkout, setup-node, npm ci, npx nuxt prepare, npx nuxt typecheck]

  lint:        # Phase 3 上線後才加
    steps: [checkout, setup-node, npm ci, npx eslint .]
```

**Phase 1 先只有 `build` 這個 job**，之後每上線一個 phase 就加一個 job，不要預先把所有 job 都寫進同一個 workflow 檔案但用 `continue-on-error` 硬撐——那樣 CI 畫面會長期顯示黃色警告，久了沒人看。

---

## 6. 踩雷點

**① 第一次打開 typecheck／lint 一定會炸出既有違規，這是規則跟現況對齊的必經過程，不是新 bug。**
第 2 節已經實測 typecheck 的數字（12 檔／~50 錯），這批錯誤剛好都集中在上次補 `lang="ts"` 的那批檔案——
這就是為什麼要先清完再設成阻斷式，不要讓第一個踩到 CI 紅燈的人去扛所有既有債務。

**② `node-version` 要跟 `package.json` 的 `volta.node` 手動對齊，沒有自動同步機制。**
GitHub Actions 的 `setup-node` 不會自動讀 Volta 設定，兩處版本號要記得一起改，否則本地 `npm run dev`（Volta 管的版本）
跟 CI（workflow YAML 寫死的版本）可能不一致，本地沒事但 CI 炸，或反過來。

**③ ESLint 規則集要用 `@nuxt/eslint` 官方 flat config，不要手刻一份規則清單去對應 `.cursorrules`。**
`.cursorrules` 裡「State Object 優先」「`_handlers`／`_actions` 命名」這類架構慣例，一般 ESLint 規則管不到
（那是設計模式，不是語法規則），不要為了「完全對應 cursorrules」去寫一堆自訂 rule，會花大量時間做報酬遞減的事。
ESLint 這層只負責語法/型別/明顯錯誤（未使用變數、`no-unused-vars`、Vue 官方推薦規則這類），架構慣例還是靠 code review。

**④ `npm ci` 需要 `package-lock.json` 跟 `package.json` 完全同步，否則直接報錯中止。**
如果之後有人手動改 `package.json` 沒有同步跑 `npm install` 更新 lock 檔，CI 會在安裝這一步就死掉——
這其實是好事（提早抓到 lock 檔沒同步的問題），但要跟開發者說清楚錯誤訊息的意思，不然容易誤以為是 CI 設定壞了。

**⑤ Required check 需要另外在 GitHub repo 設定「分支保護規則」，workflow 檔案本身不會自動擋 merge。**
CI 綠燈紅燈只是「顯示結果」，要讓紅燈真的擋住合併，得去 GitHub 網頁的 Settings → Branches 設定
「要求這些 status check 通過才能合併」——這步驟不在程式碼裡，是 repo 層級的手動設定，這次規劃不涵蓋執行，但要知道少了這步 CI 只有「警示」作用，沒有「強制」作用。

---

## 7. 驗證清單（實作完成後逐項過）

- [ ] `.github/workflows/ci.yml` 建立，`push`（main）與 `pull_request`（main）都會觸發
- [ ] Phase 1（build）：故意 push 一個會讓 `npm run build` 失敗的改動 → CI 顯示紅燈
- [ ] Phase 2（typecheck，清完既有錯誤後）：`npx nuxt typecheck` 本地跑起來乾淨；CI 上也是綠燈
- [ ] Phase 2 迴歸：故意加一個型別錯誤 → CI 顯示紅燈
- [ ] Phase 3（lint，接好設定檔後）：`npx eslint .` 本地乾淨；CI 上也是綠燈
- [ ] Node 版本確認：CI 用的版本跟 `package.json` 的 `volta.node` 一致
- [ ] `npm ci` 而非 `npm install`，確認 lock 檔同步無誤能正常安裝
- [ ] （如果要 required check）GitHub repo 的 Settings → Branches 已設定分支保護規則

---

## 8. 落成 openspec change 時的建議切法

本檔是 reference（架構草案 + 實測數據）。正式動工建議開 `openspec/changes/add-ci-pipeline/`，
但因為第 3 節已經明確分五個獨立階段，**建議每個 phase 各自開一個小 change 或至少各自一個 PR**，不要合成一個大 change：

- Phase 1（build）最簡單，可以直接照第 5 節做，不需要正式 proposal，屬於 trivial change
- Phase 2（typecheck）：`proposal.md` 說明「清理既有型別錯誤 + 上線阻斷式 typecheck」，`tasks.md` 依第 2 節的 12 個檔案逐一拆成勾選項
- Phase 3（lint）：等實測出違規量之後再決定要不要正式開 change（量小就直接做，量大才需要正式規劃分批清理的節奏）
- Phase 4／5：先擱置，等真的要拍板 Prettier 風格、或真的要開始寫測試時再各自開新的 reference/change

---

## 9. 本次未涵蓋（明確排除，避免範圍蔓延）

- 實際修復第 2 節列出的 ~50 個型別錯誤——這是 Phase 2 前置準備的執行工作，本檔只列出清單與數量，不在這次規劃裡動手改
- ESLint 規則集的具體選擇與第一次違規清理——需要先接上設定檔才有數字可規劃
- Prettier 風格拍板——需要真人決定縮排/引號等風格偏好，不是 CI 規劃能自動決定的事
- 實際撰寫任何測試案例——目前零測試，等有實際需求（例如幫 match3 引擎、jackpot 計算這類純邏輯補單元測試）再另外規劃
- GitHub repo 的分支保護規則設定——這是網頁操作，不是 codebase 變更，本檔只在踩雷點⑤提醒需要這一步
