/**
 * 快3 官方盤（賠率制）看板設定總表
 *
 * 玩法順序照 pcv2_0223 的 conf_k3_og.js 的 sort：
 *   和值 → 三同號 → 三不同號 → 三連號 → 二同號 → 二不同號
 *
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名，
 *    只要設定檔內出現 `#shared/...` 的 import，伺端一載入就會炸。
 *    本檔是 .ts 因為它需要 import 各個設定檔。
 */
import C_HEZHI from '#shared/config/k3og/c_hezhi'
import C_SANTONG from '#shared/config/k3og/c_santong'
import C_SANBUTONG from '#shared/config/k3og/c_sanbutong'
import C_SANLIAN from '#shared/config/k3og/c_sanlian'
import C_ERTONG from '#shared/config/k3og/c_ertong'
import C_ERBUTONG from '#shared/config/k3og/c_erbutong'

export default [
  ...C_HEZHI,
  ...C_SANTONG,
  ...C_SANBUTONG,
  ...C_SANLIAN,
  ...C_ERTONG,
  ...C_ERBUTONG
]
