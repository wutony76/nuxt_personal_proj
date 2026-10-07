import { socketHub } from 'serv/services/social/socketHub'
import { chatScheduleService } from 'serv/services/social/chatSchedule'
import { loginHistoryService } from 'serv/services/loginHistory'
import { adminAccessService } from './modules/adminAccess'
import { memberBalanceHistoryService } from './modules/memberBalanceHistory'
import { roleDefsService } from './modules/roleDefs'
import { roleGamePermsService } from './modules/roleGamePerms'
import { npcAutoPlayService } from './modules/npcAutoPlay'
import { encodePassword } from 'serv/utils/encrypt'

/**
 * 後台會員／權限／聊天室管理入口：不分遊戲類別的後台功能掛在這裡。
 * 遊戲類別（經典遊戲／遊戲試算／BG彩票／彩運來）各自的 hfyy*.ts facade
 * 改掛在 Storage.manager 底下，跟這裡是平行關係，不透過 HFYYManage 組裝
 * （見 storage.ts 的 static manager）。
 * init()／circle() 是另一種職責：Nitro plugin 生命週期掛勾（見 server/plugins/init.ts），
 * 跟上面這些請求層的 CRUD service 無關，兩者共存於同一個 class 只是因為都歸「後台」管。
 */
export default class HFYYManage {
  readonly access = adminAccessService
  readonly roleDefs = roleDefsService
  readonly roleGamePerms = roleGamePermsService
  readonly balanceHistory = memberBalanceHistoryService
  readonly loginHistory = loginHistoryService
  readonly chatSchedule = chatScheduleService
  readonly npcAutoPlay = npcAutoPlayService

  constructor() {
    // 改由 Storage.init() 明確呼叫 init()，建構子不自己呼叫，避免重複執行
  }

  async init(): Promise<void> {
    console.log('----- HFYY.Manager.init -----')
    socketHub.init()
    await this.setStartData()
  }
  circle() {
    this.chatSchedule.tick()
    this.npcAutoPlay.tick()
  }

  /**
   * 開機回填 / 種子邏輯（見 openspec/changes/migrate-members-roledefs-postgres/design.md 第 5 節）：
   * - role_defs：`roleDefsService.rehydrateOrSeed()` 內部已經處理「DB 未啟用 / 全新環境 / 已有資料」
   *   三種情況，這裡只需要呼叫，且必須排在 members 之前（members.role_id 外鍵依賴 role_defs 先存在）
   * - members：DB 已有資料時，直接從 DB 回填、完全跳過下面的種子迴圈；DB 是空的（全新環境）或
   *   未啟用 DB 時，照原本邏輯跑種子（write-through 會自然把這些寫進 DB，如果有接的話），
   *   跑完後額外把 `Storage.init()` 已經直接建立、沒有經過 createMember() 的 2 筆種子 admin
   *   帳號也補寫進 DB
   */
  async setStartData(): Promise<void> {
    // 聊天室排程：啟動時建幾筆 interval 測試排程，方便驗證聊天室訊息推播
    const SEED_ADMIN_ID = 'U0xA000001'
    const SEED_ADMIN_NAME = 'Admin'
    ;[30, 20, 10, 5].forEach((seconds) => {
      this.chatSchedule.add({
        text: `${seconds}s 發送測試訊息`,
        repeat: 'interval',
        intervalSeconds: seconds,
        createdBy: SEED_ADMIN_ID,
        createdByName: SEED_ADMIN_NAME
      })
    })

    await this.roleDefs.rehydrateOrSeed()

    const hasExistingMembers = await this.access.hasExistingDbMembers()
    if (hasExistingMembers) {
      await this.access.rehydrateFromDb()
    } else {
      // SEED_DEMO_DATA=false（正式環境建議）時完全跳過 test/NPC 假帳號種子，只留下面的 admin
      // 補寫（見 openspec/changes/harden-postgres-for-production/design.md 第 2、4 節）
      const seedDemoData = process.env.SEED_DEMO_DATA !== 'false'
      if (seedDemoData) {
        // 初始會員：啟動時建幾筆測試帳號，方便本機／測試環境驗證後台會員功能。
        // 密碼固定 222222，對應 app/pages/login.vue 畫面上寫的「測試帳號 test02~04@test.cc / 222222」
        // 提示文字——之前這裡是 123456，跟畫面上的提示對不起來，照著提示登入會失敗。
        // test04 固定指派 demo 角色，方便重啟後不用每次手動重新設定即可驗證唯讀後台體驗。
        for (const n of ['01', '02', '03', '04', '05']) {
          const email = `test${n}@test.cc`
          await this.access.createMember({
            name: `test${n}`,
            email,
            // createMember() 現在預期收到的 password 已經是前端雜湊過的值（見 api.ts），
            // 這裡是伺服器內部直接呼叫、沒有經過瀏覽器，手動套用同一道 encodePassword() 保持一致。
            password: encodePassword('222222', email),
            role: n === '04' ? 'demo' : undefined
          })
        }

        // 初始 NPC：啟動時自動建立 20 個 NPC 會員（從單字庫隨機組名）
        for (let i = 0; i < 20; i++) {
          try {
            await this.npcAutoPlay.autoCreateMember()
          } catch {
            // 名稱重複加後綴已由 autoCreateMember 處理，其餘例外略過
          }
        }
      }

      // Storage.init() 已經直接建立的 2 筆種子 admin 帳號沒有經過 createMember()，
      // 不會自動 write-through，這裡補寫一次（僅在確認 DB 是空的情況下才會真的執行 INSERT）。
      // 不受 SEED_DEMO_DATA 影響：admin 帳號本身不是「demo 資料」，任何環境都需要能登入。
      await this.access.seedBootAdminsToDb([SEED_ADMIN_ID, 'U0xA666666'])
    }

    // 不管上面走哪個分支，都獨立再檢查一次「DB 裡有沒有 admin」——修正 hasExistingDbMembers()
    // 為 true 但剛好沒有任何 admin 的邊界情況（見 harden-postgres-for-production/design.md 第 4 節）
    const hasAdmin = await this.access.hasExistingAdmin()
    if (!hasAdmin) {
      await this.access.seedMissingAdmin()
    }

    // NPC 自動遊玩：預設開啟
    this.npcAutoPlay.setEnabled(true)
  }
}
