# Engineering Evidence: 測試腳本補強 + CI 自動化測試管線

## 變更摘要

- 對應 openspec change：`add-ci-test-pipeline`
- 前置狀態：這次 session 在幫忙評估「這個 repo 拿去面試可不可以」時，建立了 `scripts/test-bg-all.mjs`
  （BG 15 盤口彙總，6hc-cd 因限額機制尚不完整故意排除）跟 `scripts/test-games-all.mjs`
  （retro 30 款 + 童玩 8 款彙總），跑 `test:games` 時發現**全部 8 支童玩測試腳本壞掉**（retro 30 款正常）
- 根因：`feat(toy-shop)` 那次 commit（柑仔店櫥仔新增難度/賠率倍數設定）重新校準了 8 款玩法的派彩倍數、
  並把「中不中獎」接進 `difficulty.ts` 的 `resolveFate()`/`resolveWithFate()` 難度機制，但沒有同步更新
  任何一支既有測試腳本——壞了但沒人發現，直到這次用彙總器一次跑過才曝光

| # | 項目 | 內容 |
|---|------|------|
| 1 | 修復範圍 | 8 支童玩測試腳本（lucky-draw/big-pig/cards/soda-whistle/bamboo-copter/gummy/whistle-candy/pog） |
| 2 | 新增測試 | `scripts/test-roles.mjs`（後台 RBAC）、`scripts/test-chat.mjs`（WebSocket 聊天室）、
  `scripts/test-bg-all.mjs`、`scripts/test-games-all.mjs`（彙總器） |
| 3 | CI 管線 | `scripts/ci-test-all.mjs`（動態彙總全部 `test:*`）、`package.json` 新增 `npm test`、
  `.github/workflows/ci.yml` 新增 `test` job |
| 4 | 共用工具擴充 | `scripts/_test-utils.mjs` 新增 `createHttpClient()`／`actor()`，支援同一支腳本內
  多個身分各自登入（角色權限測試需要同時模擬 admin／demo／一般會員／未登入四種身分） |

## 驗證佐證

- **8 支童玩測試修復根因分類**（兩種各自獨立的問題，修法不同）：
  1. **賠率/機率常數過期**：每款玩法的實際派彩倍數、汽水笛獎金表（`SODA_PRIZES`）都改了，
     測試裡的硬編碼期望值（例如大豬公「一般勝 1.9 倍」「金豬 5 倍」）全部要照新常數重算，
     已用一支一次性 Node 探測腳本（非 repo 永久檔案，驗證完即刪除）直接呼叫真正的 service 函式
     取得實際輸出，避免手算浮點數/四捨五入（`number-precision` 的 `NP.round`）出現誤差
  2. **`resolveFate()` 會多燒一次 `rng()`**：難度機制在真正骰骰子/抽牌「之前」會先呼叫一次 `rng()`
     決定這局目標輸贏，大豬公／紙牌／尪仔標(新版，但其序列退化成常數，故免疫)這幾支用「有限序列」
     （`createSequenceRng`／自訂 `scripted()`）模擬骰子/抽牌的測試，序列會被這多出來的一次呼叫整個
     錯位，甚至把序列抽乾拋例外；修法是在序列最前面插入一個跟「這把牌/骰子實際輸贏」一致的
     燒棄值，讓 `resolveWithFate` 第一次就命中、不觸發重骰迴圈（詳見各腳本內新增的 `guessRng()`/
     `fateTarget` 參數與行內註解）
  3. **`isSodaBust()` 門檻方向整個反過來**：難度校準前是「roll 低＝爆」，校準後改成
     `roll >= scaleWinProbability(1-rate, difficulty)`，變成「roll 高＝爆」——舊測試沿用舊直覺
     （用 `0.99` 代表「安全」、`0` 代表「爆」），新版下這組值的意義完全相反，若未發現會讓整組
     後續「不應該爆」的斷言全部連帶算錯，已重新設計每一步要用的 roll 值並逐一用探測腳本核對
- 修復後逐一重跑：
  - `npm run test:toy-lucky-draw` 17/17、`test:toy-big-pig` 9/9、`test:toy-cards` 22/22、
    `test:toy-soda-whistle` 15/15、`test:toy-bamboo-copter` 10/10、`test:toy-gummy` 9/9、
    `test:toy-whistle-candy` 9/9、`test:toy-pog` 9/9，皆全數通過
  - `npm run test:games`（彙總 retro 30 款 + 童玩 8 支）：9/9 腳本全過
- 新增測試驗證：
  - `npm run test:roles`：33/33 通過（存取邊界 401/403/200、自訂角色 CRUD、角色 x 遊戲權限開關、
    `setRole` 自我保護規則、多 admin 升降級情境）——全程只操作腳本自建的臨時帳號，驗證後確認
    `test01~05` 種子帳號與既有 admin 白名單完全未被影響
  - `npm run test:chat`：24/24 通過（WebSocket 連線生命週期、發言驗證、asAdmin 權限邊界、
    聊天室排程權限邊界）；在線人數斷言刻意用相對變化（不假設絕對值），避免跟 dev server 上
    其他真實連線的瀏覽分頁互相干擾
- CI 管線驗證：
  - `npm test` 本機執行：36/36 支 `test:*` 腳本全過，總耗時 32 秒
  - `.github/workflows/ci.yml` 以 `python3 -c "import yaml; yaml.safe_load(...)"` 驗證語法正確
  - 走讀 `ci-test-all.mjs` 確認用 `Object.keys(pkg.scripts).filter(startsWith('test:'))` 動態抓取，
    無寫死清單，新增測試腳本自動被涵蓋

## 風險與後續追蹤

- **GitHub Actions 實際執行結果尚未驗證**：本機模擬（已有長跑 dev server 可直接打）跟 CI 全新 VM
  啟動 dev server 的情境不完全相同，push 後需要到 Actions 頁面確認 `test` job 真的綠燈，若 dev server
  在 CI VM 上啟動較慢，60 秒逾時門檻可能需要調高
- **`npm test` 對 `test:bg`／`test:games` 內部子腳本有重複執行**：刻意的取捨（見
  `add-ci-test-pipeline/design.md` 第 2 節），目前總時間可接受，測試數量大幅成長後需要重新評估
- **發現但本次未處理**：執行期間另外發現白名單裡有一個非本次建立的 admin 帳號
  （`promote-e2e-*@test.cc`），疑似先前某次手動測試升級後忘記降回來，已回報給使用者、
  尚待使用者決定是否要降回 user
- **尚未接上分支保護規則**：CI 綠燈/紅燈目前只有顯示作用，要讓它真的擋住 merge 需要到 GitHub repo
  的 Settings → Branches 另外設定（`ci-pipeline-plan.md` 踩雷點⑤已註明，不在本次變更範圍）

## 封存前檢查

- [x] 8 支童玩測試腳本修復完成並重新驗證全過
- [x] 新增測試（roles/chat/games 彙總/bg 彙總）皆已驗證通過
- [x] CI 管線（`ci-test-all.mjs` + `ci.yml` test job）本機驗證通過、YAML 語法正確
- [ ] push 後於 GitHub Actions 確認 `test` job 實際綠燈，才建議 `openspec archive`

---
最後更新：2026-10-02
