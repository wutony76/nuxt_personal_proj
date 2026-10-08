/**
 * pm2 設定。每次部署會隨版本一起放進 /srv/portfolio/releases/<版本>/。
 *
 * - 只跑 1 個 process（fork 模式）：資料、開獎排程與 WebSocket 連線都在記憶體裡，開多個會不一致。
 * - cwd 用 __dirname：Node 載入設定檔時會解析 symlink，所以就算從 /srv/portfolio/current 載入，
 *   拿到的也是實際的版本目錄，回滾時不會混用到別的版本。
 * - 環境變數：機密放在 /srv/portfolio/shared/.env（不進版控），用 Node 的 --env-file 載入；
 *   非機密的固定值寫在下面的 env。
 */
module.exports = {
  apps: [
    {
      name: 'portfolio',
      cwd: __dirname,
      script: '.output/server/index.mjs',
      node_args: '--env-file=/srv/portfolio/shared/.env',
      exec_mode: 'fork',
      instances: 1,
      // e2-micro 只有 1GB 記憶體；超過就重啟，避免整台 VM 卡死
      max_memory_restart: '700M',
      // 關閉前會先把記憶體資料同步到 DB（Nitro close hook），pm2 預設 1.6 秒就強制終止，
      // 來不及寫完（見 openspec/changes/add-sync-flush-on-shutdown）
      kill_timeout: 15000,
      time: true,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Taipei',
        // 只聽本機，對外一律經過 Caddy（HTTPS）
        HOST: '127.0.0.1',
        PORT: '3000'
      }
    }
  ]
}
