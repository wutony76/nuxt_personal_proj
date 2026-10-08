# 部署到 Google Cloud（Compute Engine VM + Cloud SQL）

把這個專案部署成一台公開的作品集 Demo。

```
使用者 ──HTTPS──▶ Caddy（:443，自動憑證）──▶ Node / Nitro（127.0.0.1:3000，pm2 管理）
                                                  │
                                                  └─▶ Cloud SQL Auth Proxy（127.0.0.1:5432）──▶ Cloud SQL Postgres
```

| 元件 | 規格 | 說明 |
|---|---|---|
| VM | e2-micro、us-west1、Debian 12、30GB 標準磁碟 | 在 Google Cloud 免費額度內 |
| 資料庫 | Cloud SQL Postgres 16、Enterprise 版、db-f1-micro、10GB HDD | 自動每日備份 |
| HTTPS | Caddy + Let's Encrypt | 自動申請與續期 |
| 部署 | GitHub Actions 手動觸發 | 在 CI build，傳到 VM，失敗自動回滾 |

**每月大約費用**：VM 免費、Cloud SQL 約 US$10、外部 IPv4 約 US$3。以 [GCP 價格計算機](https://cloud.google.com/products/calculator) 為準，建議在帳單設定預算提醒。

## 為什麼是這個架構

- **只跑 1 個 Node process**：開獎排程、WebSocket 連線與部分資料都在記憶體裡，開多個會不一致。
- **不在 VM 上 build**：e2-micro 只有 1GB 記憶體，`nuxt build` 容易記憶體不足。改在 GitHub Actions（同為 Linux x86）build 再上傳。
- **一定要 HTTPS**：production 的登入 cookie 設了 `secure`，純 HTTP 下瀏覽器不會儲存，等於無法登入。
- **Cloud SQL Auth Proxy**：用 VM 的服務帳戶驗證，連線自動加密，不用開放資料庫公開 IP 白名單，也不用在 VM 放金鑰檔。

## 檔案

| 檔案 | 用途 |
|---|---|
| `deploy/gcp-vm/setup-vm.sh` | VM 初始設定（只跑一次） |
| `deploy/gcp-vm/remote-deploy.sh` | 每次部署時在 VM 上執行 |
| `deploy/gcp-vm/ecosystem.config.cjs` | pm2 設定 |
| `deploy/gcp-vm/Caddyfile.template` | Caddy 設定範本 |
| `deploy/gcp-vm/cloud-sql-proxy.service.template` | Cloud SQL Auth Proxy 的 systemd 服務 |
| `deploy/gcp-vm/env.production.example` | 環境變數範本 |
| `deploy/gcp-vm/migrate/` | 部署時套用資料庫 migration |
| `.github/workflows/deploy-gcp-vm.yml` | 部署 workflow |

---

## 步驟

以下指令在本機執行，先設定變數（`PROJECT_ID` 換成你的專案 ID）：

```bash
export PROJECT_ID=your-project-id
export REGION=us-west1
export ZONE=us-west1-b
```

### 1. 準備 Google Cloud 專案

1. 安裝 [gcloud CLI](https://cloud.google.com/sdk/docs/install)，登入並選擇專案：

   ```bash
   gcloud auth login
   gcloud config set project $PROJECT_ID
   ```

2. 確認專案已連結帳單帳戶（新帳號通常有試用額度）。
3. 啟用需要的 API：

   ```bash
   gcloud services enable compute.googleapis.com sqladmin.googleapis.com
   ```

### 2. 建立 Cloud SQL

```bash
gcloud sql instances create portfolio-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-f1-micro \
  --region=$REGION \
  --availability-type=zonal \
  --storage-type=HDD \
  --storage-size=10 \
  --backup-start-time=19:00

gcloud sql databases create portfolio --instance=portfolio-db
gcloud sql users create portfolio --instance=portfolio-db --password='換成強密碼'

# 記下這個值，等一下要用（格式：專案ID:us-west1:portfolio-db）
gcloud sql instances describe portfolio-db --format='value(connectionName)'
```

- 一定要指定 `--edition=ENTERPRISE`。主控台預設是 Enterprise Plus，最低規格貴很多。
- `--backup-start-time=19:00` 是 UTC，等於台灣時間凌晨 3 點自動備份。

**改用主控台建立時**（實際部署時的做法）：

- 不要選建立頁上方的「**免費試用 Cloud SQL 30 天**」：那是 Enterprise Plus、8 vCPU / 64GB，30 天後要升級付費才能繼續使用，規格也遠超過需求。
- 選「Enterprise」版本、預設設定選「**沙箱**」。「正式環境」範本會預設開啟高可用性（多一台備援機，費用約兩倍）與較大的機器。
- 資料庫版本 PostgreSQL 16、單一可用區、共用核心 1 vCPU / 0.614GB、HDD 10GB；「連線」保留公開 IP，不需要加授權網路（Auth Proxy 不需要）。
- 建議另外開啟「刪除保護」。
- 資料庫名稱、使用者名稱可以自訂，`DATABASE_URL` 對應修改即可。

### 3. 建立 VM 用的服務帳戶

```bash
gcloud iam service-accounts create portfolio-vm --display-name="Portfolio VM"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:portfolio-vm@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 4. 建立 VM、固定 IP 與防火牆

```bash
gcloud compute addresses create portfolio-ip --region=$REGION
gcloud compute addresses describe portfolio-ip --region=$REGION --format='value(address)'   # 記下 IP

gcloud compute firewall-rules create portfolio-allow-web \
  --allow=tcp:80,tcp:443 --target-tags=portfolio-web

gcloud compute instances create portfolio-vm \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --address=portfolio-ip \
  --tags=portfolio-web \
  --service-account=portfolio-vm@$PROJECT_ID.iam.gserviceaccount.com \
  --scopes=cloud-platform
```

免費額度的條件：e2-micro、us-west1／us-central1／us-east1、標準磁碟 30GB 以內，每個帳單帳戶限 1 台。

**VM 是用主控台建立的**：預設的「存取權範圍」不含 Cloud SQL，Auth Proxy 會出現
`Error 403: Request had insufficient authentication scopes`（`ACCESS_TOKEN_SCOPE_INSUFFICIENT`）。
使用自訂服務帳戶時，主控台的編輯頁可能不會顯示存取權範圍選項，改在 Cloud Shell 執行（需要停機，請先把外部 IP 升級為靜態，避免開機後 IP 改變）：

```bash
gcloud compute instances stop 執行個體名稱 --zone=$ZONE
gcloud compute instances set-service-account 執行個體名稱 --zone=$ZONE \
  --service-account=服務帳戶@$PROJECT_ID.iam.gserviceaccount.com \
  --scopes=cloud-platform
gcloud compute instances start 執行個體名稱 --zone=$ZONE
```

在 VM 上確認（應該看到 `https://www.googleapis.com/auth/cloud-platform`）：

```bash
curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/scopes
```

### 5. 設定網域

二選一：

- **自己的網域**：新增一筆 A 記錄指向上一步的 IP，例如 `portfolio.example.com`。
- **沒有網域**：用 [sslip.io](https://sslip.io)，IP `34.82.1.2` 對應的網域是 `34-82-1-2.sslip.io`，不需要任何設定，Caddy 一樣能申請憑證。

### 6. 初始化 VM

```bash
# 上傳部署檔案
gcloud compute scp --recurse deploy/gcp-vm portfolio-vm:~/ --zone=$ZONE

# 登入 VM
gcloud compute ssh portfolio-vm --zone=$ZONE
```

在 VM 上：

```bash
cd ~/gcp-vm
INSTANCE_CONNECTION_NAME=專案ID:us-west1:portfolio-db \
DOMAIN=portfolio.example.com \
bash setup-vm.sh

# 填寫環境變數
nano /srv/portfolio/shared/.env
```

`.env` 需要填寫：

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | 把 `CHANGE_ME` 換成步驟 2 的資料庫密碼。含特殊字元要 URL encode（例如 `@` → `%40`） |
| `SEED_ADMIN_PASSWORD` | `admin@example.com` 的密碼 |
| `SEED_OWNER_PASSWORD` | `hfyy@cc.cc` 的密碼 |

- production 沒設定這兩個密碼會拒絕啟動，避免沿用公開的預設密碼。
- 這兩個密碼只在資料庫還沒有會員的**第一次啟動**時寫入，之後要改密碼請從後台修改。
- `SEED_DEMO_DATA` 維持 `true`：作品集 Demo 需要 `test04` 唯讀帳號讓訪客瀏覽後台。
  一般正式產品應設為 `false`，其他資料庫上線檢查項目見 [postgres-production-checklist.md](postgres-production-checklist.md)。

確認 Cloud SQL Auth Proxy 正常：

```bash
sudo systemctl status cloud-sql-proxy
```

- 不接資料庫時省略 `INSTANCE_CONNECTION_NAME`，`setup-vm.sh` 會略過 Auth Proxy，`.env` 的 `DATABASE_URL` 留空即可。
- 接上全新的空資料庫後，第一次啟動要寫入種子帳號與 NPC，e2-micro 實測約 3 分鐘才完成初始化（網站在這段期間已可回應）；之後的啟動從資料庫回填，約 30 秒。

### 7. 設定 GitHub Actions 的部署金鑰

在本機產生一組部署專用的 SSH 金鑰：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/portfolio_deploy -C github-actions-deploy -N ""
```

把公鑰加到 VM（在 VM 上執行，貼上 `~/.ssh/portfolio_deploy.pub` 的內容）：

```bash
echo 'ssh-ed25519 AAAA... github-actions-deploy' >> ~/.ssh/authorized_keys
```

取得 VM 的 host key，用來防止中間人攻擊（在 VM 上執行，把輸出的 IP 換成實際 IP）：

```bash
echo "$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip) $(cat /etc/ssh/ssh_host_ed25519_key.pub | cut -d' ' -f1,2)"
```

到 GitHub repo → Settings → Secrets and variables → Actions，新增：

| Secret | 值 |
|---|---|
| `GCP_VM_HOST` | VM 的 IP |
| `GCP_VM_USER` | VM 上的使用者名稱（在 VM 執行 `whoami`） |
| `GCP_VM_SSH_KEY` | `~/.ssh/portfolio_deploy` 私鑰的完整內容 |
| `GCP_VM_KNOWN_HOSTS` | 上一步 host key 指令的輸出 |

### 8. 部署

GitHub → Actions → **Deploy (GCP VM)** → Run workflow。

workflow 會依序執行：單元測試 → build → 打包 → 上傳 → 在 VM 上套用 migration → 切換版本 → 健康檢查。健康檢查失敗時會自動回滾到上一版。

健康檢查預設最多等 180 秒。e2-micro 是共享 CPU，冷啟動時間差異很大：實測一般約 12 秒，CPU burst 額度用完時（例如剛安裝完套件）曾慢到 106 秒（主要是種子帳號的 bcrypt 雜湊）。等待時間太短會把正常版本誤判為失敗並回滾。需要調整時，在 VM 上以 `HEALTH_TIMEOUT_SECONDS=秒數` 執行 `remote-deploy.sh`。

### 9. 驗證

- [ ] 打開 `https://你的網域`，瀏覽器顯示安全連線
- [ ] 登入頁預填 `test04@test.cc`，登入後可以瀏覽後台，但無法修改
- [ ] `admin@example.com` 用 `.env` 設定的密碼可以登入，用 `123456` 不行
- [ ] 台彩大廳的鎖單與開獎時間是台灣時間（例如 20:00 / 20:30）
- [ ] 聊天室可以收發訊息（WebSocket 正常）
- [ ] VM 上 `pm2 logs portfolio --lines 50` 沒有 `TTT---WARN.TIMEZONE`，且有 `SUCCESS ---BASE>sync.scheduler.start`

---

## 刮刮樂試算服務（選用）

後台「刮刮樂試算」（`/admin/game-simulator`）會轉呼叫另一個 repo 的 Python 服務
[`py3_AVScratch_proj`](https://github.com/wutony76/py3_AVScratch_proj)（Django，私有 repo）。
不部署這個服務，網站其他功能不受影響，只有試算頁無法使用。

```
Nuxt（/api/admin/game-simulator/scratch*，需登入）─▶ gunicorn 127.0.0.1:8000 ─▶ py3_AVScratch_proj
```

VM 直接從 GitHub 拉 `main` 最新版。repo 是私有的，第一次要設定 VM 的唯讀部署金鑰：

1. 在 VM 產生金鑰並設定專用 Host 別名（github.com host key 請比對
   [GitHub 官方指紋](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)，
   ED25519 為 `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`）：

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/avscratch_deploy -C "VM avscratch read-only" -N ""
   ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
   cat >> ~/.ssh/config <<'EOF'
   Host github-avscratch
     HostName github.com
     User git
     IdentityFile ~/.ssh/avscratch_deploy
     IdentitiesOnly yes
   EOF
   cat ~/.ssh/avscratch_deploy.pub
   ```

2. 把公鑰加到 GitHub repo → Settings → **Deploy keys** → Add deploy key，**不要勾** Allow write access。
3. 確認：`ssh -T git@github-avscratch` 會顯示 `Hi wutony76/py3_AVScratch_proj!`。

之後在**本機**執行（第一次安裝與之後更新都是這一行）：

```bash
VM=使用者@VM的IP bash deploy/gcp-vm/avscratch/deploy-avscratch.sh
```

- 部署的是 GitHub `main` 的最新版：**記得先 push**，本機未 push 的 commit 不會上線。
- 第一次會 `git clone`，之後是 `git fetch` + `git reset --hard origin/main`（VM 上不要手動改程式碼）。
- 想測試還沒 push 的版本：加上 `AVSCRATCH_DIR=/path/to/py3_AVScratch_proj`，改為上傳本機 HEAD 已 commit 的內容。
- 也可以在 GitHub Actions 部署網站時一起更新：Run workflow 時勾選「**同時更新刮刮樂試算服務**」，網站部署成功後會執行同樣的更新（網站部署失敗時不會執行）。
- VM 上用 `uv` 安裝 Python 3.10 與固定版本套件：程式碼使用 `ImageDraw.textsize()`（Pillow 10 已移除），
  必須用 Pillow 9.5，而 Pillow 9.5 不支援 Ubuntu 24.04 內建的 Python 3.12。
- 服務只綁 `127.0.0.1:8000`，不對外開放（Django 設定為 `DEBUG=True`、`ALLOWED_HOSTS=['*']`）。
- systemd 服務 `avscratch`，開機自動啟動，記憶體上限 400MB（實測約 150MB）。
- Nuxt 預設就呼叫 `http://127.0.0.1:8000`，不需設定 `SCRATCH_PY_API_BASE`。

| 情境 | 做法 |
|---|---|
| 查看狀態 / log | `sudo systemctl status avscratch`、`sudo journalctl -u avscratch -n 50` |
| 重啟 | `sudo systemctl restart avscratch` |
| 確認服務 | `curl -s http://127.0.0.1:8000/api/scratch/info` |

## 日常維運

| 情境 | 做法 |
|---|---|
| 部署新版本 | 再執行一次 Deploy (GCP VM) workflow |
| 查看 log | `pm2 logs portfolio`；資料庫連線問題看 `sudo journalctl -u cloud-sql-proxy -n 50` |
| 重啟 | `pm2 restart portfolio` |
| 手動回滾 | `ls /srv/portfolio/releases` 找到上一版，執行 `ln -sfn /srv/portfolio/releases/<版本> /srv/portfolio/current && pm2 delete portfolio && pm2 start /srv/portfolio/current/ecosystem.config.cjs && pm2 save` |
| 資料庫備份 | Cloud SQL 每日自動備份（預設保留 7 份），可在主控台還原 |
| VM 系統更新 | `sudo apt-get update && sudo apt-get upgrade -y`，必要時重開機，pm2 會自動啟動 |

**migration 注意事項**：回滾只會換回舊版程式，資料庫維持新的結構。新增的 migration 要讓舊版程式也能正常運作，例如先新增欄位，等確定不會回滾後再刪除舊欄位。

## 上線前的已知事項

- **production 模式的 E2E 不穩定**：production build 下約 34 項 E2E 失敗，集中在「強制結算後注單仍為 pending」，dev 模式全過。屬既有問題，尚未追查，見 `docs/Engineering Evidence/refactor-tw-draw-schedule-taipei-tz.md`。
- **資料不會全部保留**：接了資料庫後，會員、角色權限、遊戲紀錄、注單報表等會保留；彩票當期狀態等仍在記憶體，重啟後重置。
- **不接資料庫的部署方式**：略過步驟 2、3 與 `setup-vm.sh` 的 Cloud SQL Auth Proxy，`.env` 的 `DATABASE_URL` 留空即可（migration 會自動略過）。所有資料只存在記憶體，每次重啟或部署都會歸零，適合先快速上線展示。
