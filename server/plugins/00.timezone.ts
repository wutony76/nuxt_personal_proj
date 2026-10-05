/**
 * 伺服器時區固定為台灣時間（Asia/Taipei）。
 *
 * 台彩與 BG 盤口大量使用 `getHours()`／`setHours()`／`getDay()`／`getFullYear()` 這類
 * 「本地時間」API（開獎日、鎖單時間、民國年期別…），本地時間取決於伺服器所在時區。
 * 開發機在台灣不會出問題，但雲端主機與 GitHub Actions 預設是 UTC，所有時間會差 8 小時。
 *
 * 設定方式分兩層：
 * 1. `package.json` 的 dev / preview / start 指令啟動時就帶 `TZ=Asia/Taipei`（主要機制）。
 *    `nuxt dev` 的 Nitro 跑在 worker thread，worker 內改 `process.env.TZ` 不會生效，
 *    只有 process 啟動時的 TZ 才算數。
 * 2. 這支 plugin：production 直接 `node .output/server/index.mjs`（主執行緒）時，
 *    執行期設定 `process.env.TZ` 仍然有效，作為漏帶環境變數時的保底。
 *
 * 檔名 `00.` 開頭讓它在其他 plugin（例如 init.ts 啟動遊戲排程）之前載入；設定寫在模組頂層，
 * 在 plugin 模組被 import 時就執行，早於其他 plugin 模組的頂層程式碼。
 *
 * 開獎時間的核心計算（`server/services/game/lottery/tw/drawSchedule.ts`）另外明確以 UTC+8
 * 計算，不依賴這裡的設定。
 */
const TAIPEI_TZ = 'Asia/Taipei'
/** 台灣固定 UTC+8，`getTimezoneOffset()` 回傳 -480（分鐘） */
const TAIPEI_OFFSET_MINUTES = -480

if (process.env.TZ !== TAIPEI_TZ) {
  process.env.TZ = TAIPEI_TZ
}

export default defineNitroPlugin(() => {
  const offset = new Date().getTimezoneOffset()
  if (offset !== TAIPEI_OFFSET_MINUTES) {
    console.warn(
      `TTT---WARN.TIMEZONE 伺服器時區不是 ${TAIPEI_TZ}（目前 UTC 位移 ${-offset / 60} 小時），`
      + '開獎與鎖單時間會錯位。請用 `npm run dev` / `npm run preview` / `npm run start` 啟動，'
      + '或在環境變數設定 TZ=Asia/Taipei。'
    )
  }
})
