# Design

## 1. 架構

```
使用者 ──HTTPS──▶ Caddy（:443）──▶ Node / Nitro（127.0.0.1:3000，pm2）
                                        └─▶ Cloud SQL Auth Proxy（127.0.0.1:5432）──▶ Cloud SQL
```

| 決策 | 理由 |
|---|---|
| e2-micro + Cloud SQL | 主機在免費額度內；資料庫備份與維護交給 Google；與同機 Postgres 價差約每月 US$3 |
| 單一 Node process | 開獎排程、WebSocket、部分資料在記憶體，多 process 會不一致 |
| Caddy | 自動申請與續期 Let's Encrypt 憑證；WebSocket 不需額外設定 |
| Cloud SQL Auth Proxy | 以 VM 服務帳戶（`roles/cloudsql.client`）驗證、連線加密；不需資料庫公開 IP 白名單或金鑰檔 |
| Node 只聽 127.0.0.1 | 對外一律經過 Caddy 的 HTTPS |

## 2. VM 目錄結構

```
/srv/portfolio/
├─ releases/
│  ├─ 20261007120000-abc1234/    每次部署一個目錄：.output、drizzle、migrate、ecosystem.config.cjs
│  └─ …                          保留最近 3 個
├─ current -> releases/<版本>    目前執行的版本
└─ shared/.env                   機密環境變數（權限 600，不進版控）
```

## 3. 部署流程

```
GitHub Actions（ubuntu）
  npm ci → test:unit → build → 打包 release.tgz → scp 到 VM
VM：remote-deploy.sh
  解壓到 releases/<版本> → 安裝 migration 依賴 → 套用 migration
  → 切換 current → pm2 重啟 → 健康檢查（最多 60 秒）
      ├─ 成功：pm2 save、清理舊版本
      └─ 失敗：印出 log，回滾到上一版（第一次部署時沒有上一版則直接失敗）
```

- **在 CI build**：e2-micro 記憶體不足以穩定執行 `nuxt build`；在同為 Linux x86 的環境 build，產物可直接執行。
- **pm2 重啟方式**：用 `pm2 delete` + `pm2 start`，不用 `pm2 reload`。reload 不保證更新 script 路徑與 cwd，
  可能繼續跑舊版本目錄。代價是重啟期間約數秒無法服務，作品集 Demo 可接受。
- **pm2 的 cwd**：設定檔用 `__dirname`。Node 載入設定檔時會解析 symlink，從 `current` 載入也會拿到實際的版本目錄。
- **環境變數**：機密用 Node 22 的 `--env-file` 載入 `shared/.env`；`NODE_ENV`、`TZ`、`HOST`、`PORT` 寫在 pm2 設定。

## 4. Migration

- production 產物不含 `drizzle-kit`，改用 drizzle-orm 內建的 migrator（`deploy/gcp-vm/migrate/migrate.mjs`）。
- 兩者共用 `drizzle.__drizzle_migrations` 紀錄表，本機用 drizzle-kit 跑過的資料庫可以接續。
- 依賴（`drizzle-orm`、`postgres`）版本鎖定與專案根目錄一致，部署時在版本目錄內安裝。
- migration 在切換版本**之前**執行；失敗時不會切換，舊版本繼續服務。

## 5. 種子管理員密碼

```ts
seedPassword('SEED_ADMIN_PASSWORD' | 'SEED_OWNER_PASSWORD')
// 有設定 → 使用設定值
// 沒設定且 NODE_ENV=production → 拋錯，拒絕啟動
// 沒設定且非 production → '123456'（本機開發與 E2E 測試不受影響）
```

- 套用到 `Storage.init()` 的兩個種子帳號，以及 `adminAccess.seedMissingAdmin()`。
- 接資料庫時只在第一次啟動寫入，之後以資料庫為準。

登入頁預填值：`import.meta.dev` 為 true 時維持 `hfyy@cc.cc`；production 改為 `test04@test.cc`（Demo 唯讀角色），
訪客可以直接瀏覽後台但無法寫入。

## 6. crypto-js 匯入

`crypto-js` 沒有 `exports` 欄位。Node 以 ESM 解析這類套件的子路徑時不會補副檔名；Vite 會。
所以 dev 與前端打包正常，production 由 Node 直接載入 `.output` 時失敗。補上 `.js` 後兩邊都能解析。

CI 的 build job 增加 smoke test：以 `NODE_ENV=production` 啟動 `.output/server/index.mjs`，60 秒內首頁需回應成功。
