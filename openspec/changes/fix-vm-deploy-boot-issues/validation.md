# Validation

## 驗證範圍

- 對應變更：`fix-vm-deploy-boot-issues` — 修正 VM 首次實機部署發現的兩個開機問題
- 驗證環境：
  - 本機 dev server（`npm run dev`，接 Docker Postgres 16）
  - 本機 Docker 模擬 linux/amd64 + `node:22.22.2-bookworm`，執行 production build（純記憶體模式）
  - GCP VM `hfyy-instance-1`（e2-micro、Ubuntu 24.04、Node 22.23.3、pm2 + Caddy，純記憶體模式）

## 功能驗證

- 依 proposal 的「成功標準」逐項驗證：
  - [x] 純記憶體模式開機 log 不再出現 `BOOT.admin-db-init.failed` — 實際結果：
    - 本機 production build（`DATABASE_URL=`）：出現 0 次，`SKIP ---BASE>sync.scheduler` → `SERV.RUN` → `Listening`，首頁 200
    - VM 新版本 `20261008065615-fixboot`：本次啟動後 error log 出現 0 次（修正前的版本 `20261008063833-14bc0dc` 每次開機都會出現）
  - [x] 接 DB 模式 F 幣餘額回填行為不變，`npm test` 全數通過 — 實際結果：dev server 重新載入後
    無 `BOOT.*` 錯誤；等 server 內建的啟動測試跑完後執行 `npm test`，**38/38 支全數通過**
  - [x] VM 第二次部署成功，不觸發回滾 — 實際結果：`remote-deploy.sh` exit 0，依序完成
    解壓 → migration（純記憶體模式略過）→ 切換 → 健康檢查 → 清理，`current` 指向新版本，pm2 restarts 0

## 視覺驗證

- 不適用（無 UI 變更）

## 回歸驗證

- 受影響既有流程檢查：
  - 流程：線上登入（`https://8-231-244-199.sslip.io`）
  - 結果：
    - `test04@test.cc` / `222222` 登入成功，cookie 帶 `secure`
    - `admin@example.com` / `.env` 密碼登入成功
    - `admin@example.com` / `123456` 被拒絕（400）
  - 流程：純記憶體模式 NPC 自動遊玩
  - 結果：修正後 try 區塊會完整跑完（`dbInitSucceeded = true`），但 `!isDbEnabled()` 為 true，
    仍會呼叫 `npcAutoPlay.setEnabled(true)`；VM log 可見 NPC 持續下注，行為不變
  - 流程：部署腳本語法
  - 結果：`bash -n deploy/gcp-vm/remote-deploy.sh` 通過

## 問題與修正紀錄

- 問題：proposal 原本把 e2-micro 冷啟動寫成固定約 106 秒
  - 發現方式：第二次部署實測冷啟動只要 12 秒（06:56:42 `SERV.INIT` → 06:56:54 `Listening`）
  - 修正方式：文件與腳本註解改為「一般約 12 秒，CPU burst 額度用完時曾慢到 106 秒」；
    106 秒那次發生在剛安裝完 Node/pm2/Caddy 之後，推測是共享 CPU 的 burst 額度已用完
  - 是否已重新驗證：是，180 秒上限仍以最壞情況為基準，不需要調整

## 結論

- 是否通過：是
- 已知限制或風險：
  - 這次部署實際只花 12 秒，**180 秒健康檢查上限沒有在慢啟動情境下被實際觸發驗證**；
    依據是第一次部署 106 秒的實測值
  - VM 上執行的 `remote-deploy.sh` 是修改註解前的版本，只差註解，邏輯相同
- 後續追蹤事項：
  - 縮短開機時間本身：25 個種子帳號在開機時同步做 bcrypt cost 12 雜湊，是慢啟動的主因
