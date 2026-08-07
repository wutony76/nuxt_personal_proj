import C_TEMA from '#shared/config/cd/c_tema'
import C_ZHENGMA from '#shared/config/cd/c_zhengma'
import C_ZHENGMATE from '#shared/config/cd/c_zhengmate'
import C_QIMA from '#shared/config/cd/c_qima'

/**
 * 信用盤（6hc-cd）玩法看板設定
 * 新增玩法時：建立 c_xxx.js（結構同 c_tema）後在此 spread 進來，
 * 玩法頁分頁（BarTabs）、注項池、賠率與限額讀取層即會自動吃到新設定。
 *
 * 排列順序需與 CREDIT_PLAY_DEFINITIONS 一致，玩法頁上方分頁才不會跳序。
 *
 * 注意：此檔為 .ts（會被打包）且一律使用 #shared 別名 —
 * shared/ 下若改用 .js 聚合檔並由伺端匯入，Nitro 會走 Node 原生解析而找不到模組。
 */
export default [...C_TEMA, ...C_ZHENGMA, ...C_ZHENGMATE, ...C_QIMA]
