export type ToyPoolRecord = {
  userId: string
  unclaimed: number
  gameKey: string
  bet: number
  claimed: boolean
  meta?: Record<string, unknown>
}

const records = new Map<string, ToyPoolRecord>()
const locks = new Set<string>()

/**
 * @param userId 帳號 id
 * @returns 該使用者的未領彩池，沒有則是 null
 */
export function readPool(userId: string): ToyPoolRecord | null {
  return records.get(userId) ?? null
}

/**
 * @param record 要寫入的彩池
 */
export function writePool(record: ToyPoolRecord): void {
  records.set(record.userId, record)
}

/**
 * @param userId 帳號 id
 */
export function clearPool(userId: string): void {
  records.delete(userId)
}

/**
 * @param userId 帳號 id
 * @returns 是否還有未領金額
 */
export function hasUnclaimed(userId: string): boolean {
  return (readPool(userId)?.unclaimed ?? 0) > 0
}

/**
 * @param userId 帳號 id
 * @returns 是否已有未結束的 toys 局
 */
export function hasOpenRound(userId: string): boolean {
  return readPool(userId) != null
}

/**
 * @param userId 帳號 id
 * @returns 沒被鎖住才成功
 */
export function acquireLock(userId: string): boolean {
  if (locks.has(userId)) return false
  locks.add(userId)
  return true
}

/**
 * @param userId 帳號 id
 */
export function releaseLock(userId: string): void {
  locks.delete(userId)
}

/** 測試用：清空記憶體彩池與鎖 */
export function resetToyPool(): void {
  records.clear()
  locks.clear()
}
