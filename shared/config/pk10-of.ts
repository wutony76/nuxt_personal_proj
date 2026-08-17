/**
 * PK10 官方盤（PK10-OF）：直選玩法與前三直選的獎金分層
 *
 * ── 玩法（對照 pcv2_0223 的 conf_pk10_og.js）────────────
 *   前一直選  選冠軍車號                 賠率制（母數 10）
 *   前二直選  選冠軍 + 亞軍車號（有序）    賠率制（母數 90）
 *   前三直選  選冠軍 + 亞軍 + 季軍（有序）  ★ 彩池分層（母數 720）
 *   定位膽    10 個名次各選車號            賠率制（母數 10）
 *
 *   前一／前二／定位膽的注碼與賠率走 shared/config/pk10og.ts（判定共用 pk10.ts）；
 *   只有前三直選改吃共用彩池，因為 1/720 的機率配固定賠率不好看 ——
 *   分層之後「猜中 2 個名次」也有獎，畫面上才有東西可拿。
 *
 * ── 複式（pcv2 的「複式」）──────────────────────────────
 *   每個名次可以複選車號，送單前展開成一注一注的直選：
 *     冠軍選 {1,2}、亞軍選 {3} → 前二 2 注（1-3、2-3）
 *   同一台車不能同時佔兩個名次，展開時會濾掉這種組合（見 pk10DirectCombos）。
 *   ⚠️ pcv2 另有「單式」（貼上注碼字串）模式，本專案未實作。
 *
 * ── 前三命中數的定義：逐位比對 ──────────────────────────
 *   快3 的骰子沒有順序，所以那邊算的是多重集交集；
 *   PK10 的名次有序，所以這裡是「第 i 個猜的車號 === 第 i 名的車號」逐位比對。
 *   例：猜 [3,5,7]、開前三名 [3,7,5] → 只有冠軍對 → 命中 1
 *
 * ── 前三的機率（前三名共 10 × 9 × 8 = 720 種等機率結果）──
 *   命中 3：1 種      （0.1389%）
 *   命中 2：21 種     （2.9167%）  ← 兩個名次對、第三個名次開出其餘 7 台車之一
 *   命中 1：171 種    （23.7500%）
 *   命中 0：527 種    （73.1944%）
 *   由 pk10OfMatchCounts() 窮舉驗證，不寫死。
 *
 * ── 與 PK10-CD 的關係 ───────────────────────────────────
 *   開獎號與彩池由 server/services/pk10Shared.ts 共用，
 *   本檔只負責「一注怎麼判、命中幾個屬哪一層」，不碰狀態。
 */
import { pk10CarCode, pk10CarsOf, PK10_CAR_COUNT } from '#shared/config/pk10'

/** 前三直選要猜幾個名次（冠、亞、季） */
export const PK10_OF_PICK_COUNT = 3

/**
 * 獎金分層（前三直選專用）
 *   pool  —— 從該期可發放獎池按 ratio 切一塊，再依中獎者的下注額比例分配
 *            minAmount 為「每單位下注」的最低保障（僅頭獎設，避免下全注套利）
 *   fixed —— 固定倍數，直接按下注倍數發放
 * ⚠️ 未產生中獎者的 pool 層，該層獎金整塊滾存至下期（與 6hc-of / k3-of 相同）
 */
export type Pk10OfPrizeTier =
  | { match: number; type: 'pool'; ratio: number; minAmount?: number; name: string }
  | { match: number; type: 'fixed'; amount: number; name: string }

export const PK10_OF_PRIZE_TIERS: Pk10OfPrizeTier[] = [
  { match: 3, type: 'pool', ratio: 0.70, minAmount: 20000, name: '頭獎' },
  { match: 2, type: 'pool', ratio: 0.20, name: '二獎' },
  { match: 1, type: 'fixed', amount: 2, name: '三獎' }
]

/**
 * pool 型分層的 ratio 總和（未派出時的滾存計算會用到）
 * ⚠️ 要收斂小數：0.70 + 0.20 的浮點結果是 0.8999999999999999，
 *    直接拿去乘獎池會產生一分錢級別的誤差
 */
export const PK10_OF_POOL_RATIO_TOTAL = Number(
  PK10_OF_PRIZE_TIERS
    .filter((tier): tier is Extract<Pk10OfPrizeTier, { type: 'pool' }> => tier.type === 'pool')
    .reduce((sum, tier) => sum + tier.ratio, 0)
    .toFixed(4)
)

/**
 * 把前三直選的注碼正規化成 3 個車號
 * ⚠️ 不排序 —— 順序就是名次，排序會把「猜錯名次」變成「猜對」
 * @returns [冠, 亞, 季] 的車號；格式不合（長度不對、超出 1 ~ 10、有重複）回 null
 */
export function pk10OfPicksOf(betCode: Array<string | number>): number[] | null {
  const raw = Array.isArray(betCode) ? betCode : []
  if (raw.length !== PK10_OF_PICK_COUNT) return null
  const picks = raw.map((code) => Number(code))
  if (picks.some((car) => !Number.isInteger(car) || car < 1 || car > PK10_CAR_COUNT)) return null
  // 同一台車不可能同時佔兩個名次
  if (new Set(picks).size !== PK10_OF_PICK_COUNT) return null
  return picks
}

/**
 * 前三直選的命中數（逐位比對前三名）
 * @returns 0 ~ 3；注碼或開獎格式不合回 null（呼叫端應視為無效注單）
 */
export function pk10OfMatchCount(
  betCode: Array<string | number>,
  openCode: Array<string | number>
): number | null {
  const picks = pk10OfPicksOf(betCode)
  const cars = pk10CarsOf(openCode)
  if (!picks || !cars) return null
  return picks.filter((car, idx) => car === cars[idx]).length
}

/** 命中數 → 所屬分層；不中回 null */
export function pk10OfTierOf(matchCount: number): Pk10OfPrizeTier | null {
  const count = Number(matchCount)
  if (!Number.isInteger(count) || count <= 0) return null
  return PK10_OF_PRIZE_TIERS.find((tier) => tier.match === count) ?? null
}

/**
 * 窮舉前三名的 720 種結果，統計固定一注的命中數分布
 * （機率對帳與測試用；註解裡的 1 / 21 / 171 / 527 就是這支算出來的）
 * @returns index 0 ~ 3 對應命中 0 ~ 3 的結果數
 */
export function pk10OfMatchCounts(picks: number[] = [1, 2, 3]): number[] {
  const table = [0, 0, 0, 0]
  for (let first = 1; first <= PK10_CAR_COUNT; first++) {
    for (let second = 1; second <= PK10_CAR_COUNT; second++) {
      if (second === first) continue
      for (let third = 1; third <= PK10_CAR_COUNT; third++) {
        if (third === first || third === second) continue
        const top3 = [first, second, third]
        const matched = picks.filter((car, idx) => car === top3[idx]).length
        table[matched] = Number(table[matched] ?? 0) + 1
      }
    }
  }
  return table
}

// ── 複式展開 ────────────────────────────────────────────────────────────────

/**
 * 直選複式展開：每個名次選一組車號 → 展開成一注一注的名次組合
 *
 * @param sets 依名次排列的車號集合（sets[0] = 冠軍可選車號、sets[1] = 亞軍…）
 * @returns 每一注的車號陣列（順序即名次）；任一名次沒選車號則回空陣列
 *
 * ⚠️ 會濾掉「同一台車佔兩個名次」的組合 —— 那種結果不可能開出，
 *    留著只會讓玩家白花錢（pcv2 的前端也是這樣擋）。
 */
export function pk10DirectCombos(sets: Array<Array<number | string>>): number[][] {
  const lists = (Array.isArray(sets) ? sets : []).map((list) => {
    const cars = (Array.isArray(list) ? list : [])
      .map((car) => Number(car))
      .filter((car) => Number.isInteger(car) && car >= 1 && car <= PK10_CAR_COUNT)
    // 同一個名次選到重複車號只算一次
    return Array.from(new Set(cars)).sort((a, b) => a - b)
  })
  if (lists.length === 0 || lists.some((list) => list.length === 0)) return []

  let combos: number[][] = [[]]
  lists.forEach((list) => {
    const next: number[][] = []
    combos.forEach((prefix) => {
      list.forEach((car) => {
        // 車號不可重複（同一台車不能同時是冠軍與亞軍）
        if (prefix.includes(car)) return
        next.push([...prefix, car])
      })
    })
    combos = next
  })
  return combos
}

/** 前二直選的注碼字串：[5, 3] → "前二05-03" */
export function pk10FirstTwoCode(cars: Array<number | string>): string {
  const list = (Array.isArray(cars) ? cars : []).map((car) => Number(car))
  if (list.length !== 2) return ''
  return `前二${pk10CarCode(list[0] as number)}-${pk10CarCode(list[1] as number)}`
}

/** 前一直選的注碼字串：5 → "前一05" */
export function pk10FirstCode(car: number | string): string {
  const value = Number(car)
  if (!Number.isInteger(value) || value < 1 || value > PK10_CAR_COUNT) return ''
  return `前一${pk10CarCode(value)}`
}

/**
 * 官方盤玩法定義（順序即前端玩法列的顯示順序，需與 pk10og/plays.ts 一致）
 * `pool: true` 代表該玩法走彩池分層而不是固定賠率
 */
export const PK10_OF_PLAY_DEFINITIONS: Array<{ key: string; name: string; pool: boolean }> = [
  { key: 'qianyi', name: '前一直選', pool: false },
  { key: 'qianer', name: '前二直選', pool: false },
  { key: 'qiansan', name: '前三直選', pool: true },
  { key: 'dingwei', name: '定位膽', pool: false }
]

/** 走彩池分層的玩法 key（伺端據此把注單分流到兩條結算路） */
export const PK10_OF_POOL_PLAY_KEY = 'qiansan'
