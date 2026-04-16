export function secureRandomInt(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new TypeError('min and max must be integers')
  }
  if (max < min) {
    throw new RangeError('max must be greater than or equal to min')
  }

  const range = max - min + 1
  // 2^32 (4294967296): Uint32 可覆蓋的總取值空間上限
  if (range <= 0 || range > 0x100000000) {
    throw new RangeError('range must be between 1 and 4294967296')
  }

  /**
   * 如果直接 randomValue % range，某些餘數會比其他餘數多一點點機率
   * 只接受 < unbiasedLimit 的值後再 % range，每個結果機率就一致（公平）
   * 是再處理「公平抽樣的安全邊界」。
   */ 
  const maxUint32 = 0x100000000
  const unbiasedLimit = maxUint32 - (maxUint32 % range)
  const buffer = new Uint32Array(1)

  while (true) {
    globalThis.crypto.getRandomValues(buffer)
    const randomValue = buffer[0]
    if (randomValue < unbiasedLimit) {
      return min + (randomValue % range)
    }
  }
}

export const actions = {
  thousands: (val) => {
    const num = Number(val)
    if (!Number.isFinite(num)) return '0'
    return Math.trunc(num).toLocaleString('en-US')
  }
}




