import { socketHub } from '../../services/social/socketHub'

/**
 * 全站 WebSocket 端點：/api/ws/social（Nitro 對 server/api/** 自動加前綴，
 * 跟既有 REST 路由的檔案位置慣例一致，見 add-socket-social design.md 的路徑差異說明）。
 *
 * 這裡是薄轉發層，唯一職責是把三個生命週期事件轉給 socketHub，並且是「例外隔離」的最後防線：
 * socketHub 跟遊戲引擎／彩票下注結算同一個 Nitro process，任何未接住的例外都有機會拖垮整個
 * server，所以三個 hook 各自包 try/catch，例外只能在「這一個 peer」範圍內處理掉
 * （回一個 error envelope 或安全關閉該連線），絕不允許往上炸穿。
 */
export default defineWebSocketHandler({
  open(peer) {
    try {
      socketHub.onOpen(peer)
    } catch (err) {
      console.error('[ws/social] onOpen error', err)
      try {
        peer.close()
      } catch {
        // 已經在錯誤處理路徑，忽略二次錯誤
      }
    }
  },
  message(peer, message) {
    try {
      socketHub.onMessage(peer, message.text())
    } catch (err) {
      console.error('[ws/social] onMessage error', err)
      try {
        peer.send(JSON.stringify({ type: 'error', payload: { code: 'internal_error', message: '伺服器內部錯誤' }, ts: Date.now() }))
      } catch {
        // 連線可能已經不可用，忽略
      }
    }
  },
  close(peer) {
    try {
      socketHub.onClose(peer)
    } catch (err) {
      // 連線已經關閉，沒有對象可以回應，只記 log
      console.error('[ws/social] onClose error', err)
    }
  },
  error(peer, error) {
    console.error('[ws/social] transport error', error)
  }
})
