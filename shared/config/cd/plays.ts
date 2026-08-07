import C_TEMA from '#shared/config/cd/c_tema'
import C_ZHENGMA from '#shared/config/cd/c_zhengma'
import C_ZHENGMATE from '#shared/config/cd/c_zhengmate'
import C_QIMA from '#shared/config/cd/c_qima'
import C_LIANMA from '#shared/config/cd/c_lianma'
import C_WUXING from '#shared/config/cd/c_wuxing'
import C_BANBO from '#shared/config/cd/c_banbo'

/**
 * 信用盤（6hc-cd）玩法看板設定
 * 新增玩法時：建立 c_xxx.js（結構同 c_tema）後在此 spread 進來，
 * 玩法頁分頁（BarTabs）、注項池、賠率與限額讀取層即會自動吃到新設定。
 *
 * 排列順序需與 CREDIT_PLAY_DEFINITIONS 一致，玩法頁上方分頁才不會跳序。
 *
 * 注意：此檔為 .ts（會被打包）且一律使用 #shared 別名 —
 * shared/ 下若改用 .js 聚合檔並由伺端匯入，Nitro 會走 Node 原生解析而找不到模組。
 * 同理，需要 import 才能產生號碼的設定檔（c_wuxing / c_banbo）本身也必須是 .ts。
 */
export default [
  ...C_TEMA,
  ...C_ZHENGMA,
  ...C_ZHENGMATE,
  ...C_LIANMA,
  ...C_QIMA,
  ...C_WUXING,
  ...C_BANBO,
]
