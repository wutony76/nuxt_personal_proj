/**
 * 快3 看板設定總表
 *
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名，
 *    只要設定檔內出現 `#shared/...` 的 import，伺端一載入就會炸
 *    「Package import specifier "#shared/..." is not defined」。
 *    需要 import 才能產生內容的設定檔必須改成 .ts（見 shared/config/cd/plays.ts 的同一條規則）。
 *
 * 玩法順序即前端玩法列表的顯示順序，需與 k3-cd.ts 的 K3_PLAY_DEFINITIONS 一致。
 */
import C_HEZHI from '#shared/config/k3cd/c_hezhi'
import C_DAXIAO from '#shared/config/k3cd/c_daxiao'
import C_SANJUN from '#shared/config/k3cd/c_sanjun'
import C_WEITOU from '#shared/config/k3cd/c_weitou'
import C_DUIZI from '#shared/config/k3cd/c_duizi'
import C_ERTONGHAO from '#shared/config/k3cd/c_ertonghao'
import C_SANBUTONG from '#shared/config/k3cd/c_sanbutong'

export default [
  ...C_HEZHI,
  ...C_DAXIAO,
  ...C_SANJUN,
  ...C_WEITOU,
  ...C_DUIZI,
  ...C_ERTONGHAO,
  ...C_SANBUTONG
]
