
import { Storage } from '../services/storage'
import BaseClass from '../services/base'
import TestClass from '../services/test'
import { isDbEnabled, ping } from '../services/db'
import { SyncScheduler } from '../services/sync'

export default defineNitroPlugin((_nitroApp) => {
  console.log('')
  console.log('')
  console.log('')
  console.log('')
  console.log('***NEW---------SERV.INIT')
  Storage.init()

  // 定時同步（見 openspec/changes/add-postgres-docker/design.md 第 8 節）：
  // 跟下面的 300ms 遊戲 tick 是各自獨立的 timer，避免同步耗時卡住遊戲邏輯。
  // isDbEnabled() 為 false 時完全不啟動，不是啟動了但每輪都靜默失敗。
  if (isDbEnabled()) {
    void ping()
      .then(() => console.log('SUCCESS ---BASE>db.ping'))
      .catch((error) => console.error('FAILED ---BASE>db.ping', error))
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
  if (process.env.NODE_ENV !== 'production') {
    void (async () => {
      console.log('***---START.TESTING.RUN')
      await new TestClass().bg()
      await new TestClass().tw()
      await new TestClass().retro()
      console.log('***---END.TESTING.RUN')
    })()
  }
})