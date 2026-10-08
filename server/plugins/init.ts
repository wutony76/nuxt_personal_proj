
import { Storage } from '../services/storage'
import BaseClass from '../services/base'
import TestClass from '../services/test'
import { isDbEnabled, ping } from '../services/db'
import { SyncScheduler } from '../services/sync'
import { registerGameOrdersSyncSource } from '../services/game/lottery/ordersSyncSource'
import { registerRetroHistorySyncSource } from '../services/game/retro/historySyncSource'
import { registerPoolAuditSyncSources } from '../services/game/lottery/bg/poolAuditSyncSource'
import { registerLoginHistorySyncSource } from '../services/loginHistorySyncSource'
import { registerWalletSyncSources } from '../services/walletSyncSource'
import { rehydrateTodayDailyGrantsFromDb } from '../services/game/retro/history'
import RETRO_GAME_BASE from '../services/game/retro/base'

export default defineNitroPlugin(async (_nitroApp) => {
  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('***NEW---------SERV.INIT')
  Storage.init()
  // Storage.init() 本身維持同步，但內部 this.manager.admin.init() 是 async（開機回填，
  // 見 migrate-members-roledefs-postgres/design.md 第 5 節）。這裡 await 該 promise，
  // 確保 Nitro 真正開始接受請求之前，members/role-defs 的 DB 回填已經完成。
  await Storage.adminInitPromise

  // 定時同步（見 openspec/changes/add-postgres-docker/design.md 第 8 節）：
  // 跟下面的 300ms 遊戲 tick 是各自獨立的 timer，避免同步耗時卡住遊戲邏輯。
  // isDbEnabled() 為 false 時完全不啟動，不是啟動了但每輪都靜默失敗。
  if (isDbEnabled()) {
    void ping()
      .then(() => console.log('SUCCESS ---BASE>db.ping'))
      .catch((error) => console.error('FAILED ---BASE>db.ping', error))
    // 遊戲紀錄/配額的批次同步來源（見 openspec/changes/migrate-game-history-postgres/design.md）
    registerGameOrdersSyncSource()
    registerRetroHistorySyncSource()
    registerPoolAuditSyncSources()
    registerLoginHistorySyncSource()
    registerWalletSyncSources()
    // dailyGrants 開機回填（見 migrate-game-history-postgres/design.md 第 4 節）：只回填今天，
    // 修正「重啟導致當日配額歸零」的既有缺口。包 try/catch：DB 當下連不上的話，頂多當天配額計數器
    // 從 0 開始（跟遷移前的既有行為一樣），不能讓這個查詢失敗卡住下面的 SyncScheduler 啟動與遊戲
    // tick 迴圈（見 openspec/changes/harden-postgres-for-production/validation.md 的後續追蹤紀錄）。
    try {
      await rehydrateTodayDailyGrantsFromDb(RETRO_GAME_BASE.formatDateKey(new Date()))
    } catch (error) {
      console.error('BOOT.daily-grants-rehydrate.failed —— 開機回填今日配額計數器失敗，退回從 0 開始', error)
    }
    new SyncScheduler().start()
    console.log('SUCCESS ---BASE>sync.scheduler.start')
  } else {
    console.log('SKIP ---BASE>sync.scheduler（DATABASE_URL 未設定，維持純記憶體模式）')
  }

  new BaseClass().runCircle(() => {
    // console.log('BaseClass.runCircle.Task')
    // console.log(Storage.games)

    // --- 遊戲排程
    Object.values(Storage.games).forEach((game) => {
      if (game && typeof (game as { circle?: () => void }).circle === 'function') {
        ; (game as { circle: () => void }).circle()
      }
    })
    // --- ADMIN 後台排程
    Storage.manager.admin.circle()
  })
  console.log('SERV.RUN')

  //--- TESTING
  // ⚠️ 這段只是「開發時手動跑一輪全部測試」的臨時掛載點：只在非 production 執行，
  //    而且每次 dev server (re)start（包含改檔案觸發的 Nitro 自動重啟）都會重新跑一次
  //    全部測試腳本（約數分鐘）。驗證完畢後應該把這個 if 區塊整個刪掉或註解掉，
  //    避免日常開發時每次存檔都要多等一輪測試。
  // SKIP_STARTUP_TESTS=1 時跳過：CI 會在 dev server 就緒後立刻跑 npm test，兩邊同時用同一個
  // 帳號下注會讓餘額斷言互相干擾（見 openspec/changes/fix-ci-startup-test-interference）。
  const skipStartupTests = process.env.SKIP_STARTUP_TESTS === '1'
  if (process.env.NODE_ENV !== 'production' && !skipStartupTests) {
    void (async () => {
      console.log('***---START.TESTING.RUN')
      await new TestClass().bg()
      await new TestClass().tw()
      await new TestClass().retro()
      console.log('***---END.TESTING.RUN')
    })()
  } else if (skipStartupTests) {
    console.log('SKIP ---TESTING（SKIP_STARTUP_TESTS=1）')
  }
})