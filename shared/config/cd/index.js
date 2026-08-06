import C_TEMA from './c_tema'
import C_ZHENGMA from './c_zhengma'

/**
 * 信用盤（6hc-cd）玩法看板設定
 * 新增玩法時：建立 c_xxx.js（結構同 c_tema）後在此 spread 進來，
 * 玩法頁分頁（BarTabs）與注項池即會自動吃到新設定。
 */
export default [...C_TEMA, ...C_ZHENGMA]
