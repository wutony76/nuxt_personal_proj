import { mazeTemplates, validateMazeRows } from 'serv/services/game/retro/mazeTemplates'
import { adminGameHistoryService } from './modules/gameHistory'
import { adminRetroGameRatesService } from './modules/retroGameRates'

/**
 * 經典遊戲（復古小遊戲）後台管理入口，掛在 Storage.manager.gameRetro（見 storage.ts）。
 * 實作仍在各自的 service 檔，這裡只組裝成具名屬性。
 */
export default class HFYYGameRetro {
  readonly gameHistory = adminGameHistoryService
  readonly retroGameRates = adminRetroGameRatesService
  readonly mazeTemplates = mazeTemplates
  readonly validateMazeRows = validateMazeRows
}
