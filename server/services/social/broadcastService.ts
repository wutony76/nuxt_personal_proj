import { socketHub } from './socketHub'

export type BroadcastLevel = 'info' | 'warning' | 'success'

/**
 * 系統廣播觸發入口，v1 只做這個 service 函式讓其他 service 之後 import 呼叫
 * （例如某彩種爆池中獎時順手廣播），不做管理後台發公告 UI（見 design.md 決策 3）。
 */
export const broadcastService = {
  systemBroadcast: (text: string, level: BroadcastLevel = 'info') => {
    socketHub.broadcast('system:broadcast', { text, level })
  }
}
