import { Storage } from '../services/storage'

export function prodId(): string {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const created = globalThis as { __prodIdSet__?: Set<string> }
  if (!created.__prodIdSet__) {
    created.__prodIdSet__ = new Set<string>()
  }
  const usedSet = created.__prodIdSet__ as Set<string>
  const existingAuthIds = new Set<string>()
  const authStore = (
    Storage as unknown as { getAccount?: () => Readonly<Record<string, { id?: string }>> }
  ).getAccount?.() ?? {}

  for (const id of Object.keys(authStore)) {
    if (id) {
      existingAuthIds.add(id)
    }
  }

  const randomInt = (min: number, max: number) => {
    const range = max - min + 1
    if (globalThis.crypto?.getRandomValues) {
      const buf = new Uint32Array(1)
      globalThis.crypto.getRandomValues(buf)
      const randomValue = buf[0] ?? 0
      return min + (randomValue % range)
    }
    return Math.floor(Math.random() * range) + min
  }

  let nextId = ''
  do {
    const randomDigit = randomInt(0, 9)
    const randomLetter = LETTERS[randomInt(0, LETTERS.length - 1)]
    const randomSerial = randomInt(0, 999999).toString().padStart(6, '0')
    nextId = `U0${randomDigit}${randomLetter}${randomSerial}`
  } while (usedSet.has(nextId) || existingAuthIds.has(nextId))

  usedSet.add(nextId)
  return nextId
}