## Context

大廳既有玩法（6HC／K3／PK10／SSC）皆為「信用盤（CD）＋官方盤（OF）」雙盤口，`app/pages/lottery-hall.vue` 的卡片產生邏輯（`MODE_META` 固定兩種模式 × 每個玩法）也是基於這個假設寫死的。

PC蛋蛋的玩法來源 `bglottery`（`src/components/room/lotteryAll/pceggs/`）與後台管理專案（`svn-all/lotteryAdmin/**/pcdd/**`）皆顯示 PC蛋蛋 **只有信用模式**（`mode: 2`），無官方盤實作。使用者需求文件（`prompt/pceggs.txt`）也明確只列出單一 `eggs.ts` service 與單一 `egg.vue` page，與 K3／SSC 當初的雙檔命名（`sscCd.ts`/`sscOf.ts`、`ssc-cd.vue`/`ssc-of.vue`）不同。

玩法規則來源比對：
- `bglottery` `pceggs/config_play.js` 與後台 `pcdd/config_paly.js`／`pcdd/hunhe/config.js` 逐項一致：`大小`（含极大/极小）、`单双`（含大单/小单/大双/小双）、`特殊玩法`（豹子/对子/顺子）、`色波`（红/蓝/绿）、`特码`（0~27）共 5 組、28 個獨立注項（不含特碼展開為 28 個共 33 個 playId）。
- 判定邏輯僅 `header.vue` 明確寫出「和值 >13 為大、否則小」「奇偶為单双」；色波對照表在 `dict.js`。
- `极大`／`极小`門檻在所有可查來源中都只有 playId 與名稱、無任何判定邏輯 —— 已由使用者確認：**极小 = 0~5，极大 = 22~27**。
- 豹子/对子/顺子沒有獨立來源定義，但本專案 `shared/config/ssc.ts` 已針對「三球、每球 0~9」建立過牌型判定慣例（`sscTriplePatternOf`），PC蛋蛋開獎結構與其「前中後三」完全相同，直接沿用該慣例（豹子＝三數相同、对子＝恰兩數相同、顺子＝三數相異且連號、不含環狀），非新發明規則。

## Goals / Non-Goals

**Goals:**
- 依 `shared/config/eggs.ts`（機率核心）→ `shared/config/eggs-cd.ts`（判定＋賠率）→ `shared/config/eggscd/plays.js`＋`helpers.ts`（看板設定）→ `server/services/game/lottery/bg/eggs.ts`（單一信用盤 service）→ `useEggs.ts` → `app/components/lottery/bg/eggs/**` → `app/pages/lottery/bg/egg.vue` 的分層，完整複刻 K3-CD 一套但拿掉官方盤與 Shared 共用層。
- 大廳卡片、`BgAutoPanel`、`useBgAutoActive` 均需支援「單模式玩法」，不能沿用寫死兩張卡片的邏輯。
- 賠率一律「公平賠率（216 種結果窮舉的等價物：10³=1000 種）× RTP」推導，不寫死拍板數字，與 K3/SSC 慣例一致。

**Non-Goals:**
- 不建立官方盤（OF）與彩池玩法（來源本身沒有）。
- 不修改既有 6hc／k3／pk10／ssc 的任何邏輯與規格。
- 不追加來源中未定義、且使用者未確認的規則（例如若日後要做「極大極小」以外的門檻類玩法，需再次確認）。

## Decisions

### 1. 單一信用盤 service，不建 Shared／OF
K3/SSC 用 `*Shared.ts` 是因為 CD 與 OF 要共用同一份開獎期表與彩池；PC蛋蛋只有一個盤口，沒有「共用」的對象。`eggs.ts` 直接繼承 `LOTTERY_BASE`（比照 `k3Cd.ts` 的寫法），自己管理期表與開獎，不拆 Shared 檔。日後如果真的要補官方盤，再依 K3 的模式把期表抽出成 `eggsShared.ts`——現在硬做等於無中生有一個沒有使用者的抽象層。

### 2. 玩法判定沿用「注碼 descriptor」模式（比照 `ssc-cd.ts` 而非 `k3-cd.ts` 的字串正則堆疊）
`ssc-cd.ts` 的 `_parseBet` → descriptor → `sscChanceOf`/`sscIsHit` 兩張表對應寫法比 `k3-cd.ts` 的一長串正則判斷更不容易在新增玩法時漏改一邊（k3-cd.ts 本身也有此隱憂，見檔頭註解）。PC蛋蛋玩法種類少（8 種 kind：大/小/单/双/极大/极小/色波/豹子/对子/顺子/特碼，其中大小单双极值可收斂成同一種 `side` kind），適合套用這個更新的模式。

`EggsBet` descriptor：
```ts
type EggsBet =
  | { kind: 'side'; side: '大' | '小' | '单' | '双' | '极大' | '极小' | '大单' | '小单' | '大双' | '小双' }
  | { kind: 'wave'; wave: '红波' | '蓝波' | '绿波' }
  | { kind: 'pattern'; pattern: '豹子' | '对子' | '顺子' }
  | { kind: 'sum'; sum: number } // 特碼 0~27
```
大單/小單/大双/小双直接判 `(大或小的sum條件) && (单或双的sum條件)`，本身不是獨立的機率窮舉分支，用組合判斷即可（複用 `_sumSide`／奇偶判斷）。

### 3. 色波表與极值門檻設為具名常數，附來源註解
```ts
export const EGGS_WAVE_MAP: Record<'红波'|'蓝波'|'绿波'|'灰', number[]> = {
  红波: [3, 6, 9, 12, 15, 18, 21, 24],
  蓝波: [2, 5, 8, 11, 17, 20, 23, 26],
  绿波: [1, 4, 7, 10, 16, 19, 22, 25],
  灰:   [0, 13, 14, 27],
}
// 出處：bglottery src/components/room/lotteryAll/pceggs/dict.js
export const EGGS_EXTREME_BIG_RANGE = [22, 27] as const  // 使用者確認
export const EGGS_EXTREME_SMALL_RANGE = [0, 5] as const  // 使用者確認
```
「灰」四色只出現在開獎動畫顯示、目前 config_play.js 沒有對應的可下注 playId，因此不建立下注玩法、只用於 Header 開獎球顯示（若之後要做灰波下注，需另外確認賠率與是否可下注）。

### 4. 大廳／自動下注面板改為支援「單模式玩法」而非寫死雙模式
- `lottery-hall.vue`：新增 `GAME_MODES: Record<string, ModeMeta[]>` 覆寫表，預設沿用現有 `MODE_META`（OF+CD 兩張卡）；`EGGS` 覆寫成只含一個 `CD` 模式的陣列，`buildCards` 依 `GAME_MODES[item.key] ?? MODE_META` 產生卡片，PC蛋蛋在大廳只會出現一張卡。
- `LOTTERY.EGGS` 只登記單一鍵值（無 `sub` 欄位），同時作為大廳分組項與伺端 `Storage.games` 的實際 key（不另外造一個 `EGGS-CD` 假子項）。
- `ROUTE_DICT` 新增 `'EGGS-CD': '/lottery/bg/egg'`（`buildCards` 組出的 routeKey 仍是 `${item.key}-${mode.suffix}`，維持原有格式，只是這個玩法只會產生一張）。
- `useBgAutoActive.ts` 的 `LotteryType` 加入 `'eggs'`；`BgAutoPanel.vue` 加一個 `EggsAuto`／`EggsChat` 分支（無 cd/of 兩份，因為沒有跨盤口污染的風險）。

### 5. 元件目錄不分 `cd/`／`of/`
依 `openspec/project.md` 的「彩票遊戲組件目錄」慣例，分層與否取決於「會不會被兩個盤口同時用到」；PC蛋蛋永遠只有一個盤口，分 `cd/`／`of/` 沒有意義。元件平鋪在 `app/components/lottery/bg/eggs/{base,block,block/footer}/` 下，直接對齊 K3 的 `base/`／`block/` 共用層（Header、History、Road、CurrItems、Controls、Report、Dialog*、Board、Auto、Chat 全部只有一份）。

### 6. RTP 與限額預設值
沿用信用盤慣例 `EGGS_RTP_FALLBACK = 0.97`（同 6hc-cd/k3-cd/ssc-cd）；單注/單期限額預設值比照 `K3_QUOTA_FALLBACK`，之後如需調整由 `plays.js` 的 `settings.quota` 覆寫。

## Risks / Trade-offs

- **[Risk]** 极大/极小門檻是使用者口頭確認、非原始碼依據，未來若原始碼另有官方數據可能需要調整。
  → **Mitigation**：`shared/config/eggs.ts` 把門檻定義成具名常數並附註解「使用者確認，非原始碼依據」，之後要改只需改一處，所有 helpers/判定/前端顯示都會跟著變動。
- **[Risk]** 大廳卡片邏輯從「固定雙模式」改成「可覆寫模式清單」，是共用元件的修改，可能影響既有 4 個玩法的卡片渲染。
  → **Mitigation**：預設值維持 `MODE_META` 不變，只有明確在 `GAME_MODES` 覆寫的玩法才會走新分支；改動後對 6HC/K3/PK10/SSC 四頁做視覺回歸確認。
- **[Risk]** 「灰波」開獎顯示與「特碼 0~27」語意可能被誤認為色波玩法涵蓋所有和值（實際紅/藍/綠只覆蓋 24 個值，灰的 4 個值不可下注）。
  → **Mitigation**：色波玩法下注只出 3 個選項（红/蓝/绿），灰色值開出時色波类玩法一律未中（不退本金），與來源 `config_play.js` 沒有「灰波」playId 的事實一致。

## Migration Plan

全新玩法，無既有資料需要遷移。部署步驟：
1. 依 tasks.md 由 config → server → 前端 依序實作並個別驗證（esbuild／curl／npm run dev）
2. 全部完成後跑一次 `npm run dev`，用 `openspec/reference/ssc-progress.md` 記載的驗證方式跑一輪下注→開獎→結算，對帳機率窮舉數字
3. 若中途要中止，本 change 尚未動到任何既有檔案的核心邏輯（僅新增檔案 + `lottery-hall.vue`/`BgAutoPanel.vue`/`useBgAutoActive.ts`/`constants.js`/`storage.ts` 的追加式修改），可直接刪除新增檔案並回退這幾個檔案的追加段落

## Open Questions

（無 — 极大/极小門檻已由使用者於提案階段確認為 极小 0~5／极大 22~27）
