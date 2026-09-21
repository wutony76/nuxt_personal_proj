import { adminToyShopService } from './modules/toyShop'

/**
 * 彩運來（台灣彩券）後台管理入口，掛在 Storage.manager.lotteryTw（見 storage.ts）。
 * `toyShop` 是柑仔店櫥仔的後台開關／賠率管理（見 add-toy-shop-admin-controls/design.md）——
 * 柑仔店櫥仔跟台彩鏡射玩法是兩個不同功能，這裡沿用「掛在彩運來後台頁」的使用者指定位置，
 * 不代表兩者資料互通。
 */
export default class HFYYLotteryTw {
  readonly toyShop = adminToyShopService
}
