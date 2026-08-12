/**
 * 快3 看板設定總表
 *
 * 分頁結構參照 pcv2_0223 的 conf_k3_cd.js：三個分頁對應那邊的 playTabId
 *   40000 三軍/大小/點數  ← pcv2 122101
 *   40001 圍骰/全骰       ← pcv2 122102
 *   40002 長牌/短牌       ← pcv2 122103
 *
 * ⚠️ 設定檔一律用 .js（不 import 任何東西）——
 *    Nitro 對 shared 下的檔案走 Node 原生 ESM 解析、不認得 `#shared` 別名，
 *    只要設定檔內出現 `#shared/...` 的 import，伺端一載入就會炸
 *    「Package import specifier "#shared/..." is not defined」。
 */
import C_SANJUN from '#shared/config/k3cd/c_sanjun'
import C_WEITOU from '#shared/config/k3cd/c_weitou'
import C_CHANGDUAN from '#shared/config/k3cd/c_changduan'

export default [
  ...C_SANJUN,
  ...C_WEITOU,
  ...C_CHANGDUAN
]
