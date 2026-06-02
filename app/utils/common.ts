export function secureRandomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new TypeError('min and max must be integers')
  }
  if (max < min) {
    throw new RangeError('max must be greater than or equal to min')
  }

  const range = max - min + 1
  if (range <= 0 || range > 0x100000000) {
    throw new RangeError('range must be between 1 and 4294967296')
  }

  // rejection sampling：捨棄會造成模數偏差的隨機值，確保每個結果機率一致
  const maxUint32 = 0x100000000
  const unbiasedLimit = maxUint32 - (maxUint32 % range)
  const buffer = new Uint32Array(1)

  while (true) {
    globalThis.crypto.getRandomValues(buffer)
    const randomValue = buffer[0]!
    if (randomValue < unbiasedLimit) {
      return min + (randomValue % range)
    }
  }
}

export const actions = {
  thousands: (val: number | string): string => {
    const num = Number(val)
    if (!Number.isFinite(num)) return '0'
    return Math.trunc(num).toLocaleString('en-US')
  },
  comb6: (n: number): number => {
    if (n < 6) return 0
    return Math.round(n * (n - 1) * (n - 2) * (n - 3) * (n - 4) * (n - 5) / 720)
  },
}
