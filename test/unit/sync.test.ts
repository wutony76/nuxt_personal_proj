import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// runSyncTick() 會呼叫 getDb().execute()；這裡換成可控制完成時間的假 DB，
// 用來驗證 stopAndFlush() 跟進行中那一輪的先後順序。
const execute = vi.fn()
vi.mock('../../server/services/db', () => ({
  getDb: () => ({ execute })
}))

const { SyncScheduler, registerSyncSource, _clearSyncSourcesForTest } = await import('../../server/services/sync')

/** 回傳一個可以從外部手動 resolve 的 promise */
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe('SyncScheduler.stopAndFlush', () => {
  let snapshotCalls = 0

  beforeEach(() => {
    vi.useFakeTimers()
    execute.mockReset()
    snapshotCalls = 0
    _clearSyncSourcesForTest()
    registerSyncSource({
      table: 'login_history',
      primaryKey: ['id'],
      snapshot: () => {
        snapshotCalls++
        return [{ id: `row-${snapshotCalls}` }]
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    _clearSyncSourcesForTest()
  })

  it('沒有進行中的同步時，立刻再同步一次', async () => {
    execute.mockResolvedValue(undefined)
    const scheduler = new SyncScheduler(300_000).start()
    await vi.advanceTimersByTimeAsync(0) // 讓 start() 觸發的第一輪跑完
    expect(execute).toHaveBeenCalledTimes(1)

    await scheduler.stopAndFlush()
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('有進行中的同步時，先等它完成再執行最後一次，不會同時跑兩輪', async () => {
    const first = deferred()
    execute.mockImplementationOnce(() => first.promise).mockResolvedValue(undefined)
    const scheduler = new SyncScheduler(300_000).start()
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).toHaveBeenCalledTimes(1) // 第一輪卡在 DB 寫入中

    const flushing = scheduler.stopAndFlush()
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).toHaveBeenCalledTimes(1) // 還在等第一輪，最後一次尚未開始

    first.resolve()
    await flushing
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('stopAndFlush 之後不再排下一輪', async () => {
    execute.mockResolvedValue(undefined)
    const scheduler = new SyncScheduler(300_000).start()
    await vi.advanceTimersByTimeAsync(0)
    await scheduler.stopAndFlush()
    expect(execute).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(300_000 * 3)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('DB 寫入失敗時不會拋錯（關閉流程不能卡住）', async () => {
    execute.mockRejectedValue(new Error('connection refused'))
    const scheduler = new SyncScheduler(300_000).start()
    await vi.advanceTimersByTimeAsync(0)
    await expect(scheduler.stopAndFlush()).resolves.toBeUndefined()
  })
})
