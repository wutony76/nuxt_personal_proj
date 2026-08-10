
import { shengxiaoOfYear } from '#shared/config/6hc-cd'

export const _handle = {
  // 年份 → 生肖的算法統一放在 shared（一肖玩法的號碼表也走同一支），避免兩處各算各的
  currentShengxiao(): string {
    return shengxiaoOfYear(MEMORY.now.getFullYear())
  },
}
export class MEMORY {
  static now: Date = new Date()
  static animal: string = _handle.currentShengxiao()
}

export default class BaseClass {
  protected isRunning = false
  private _loopTimer: ReturnType<typeof setTimeout> | null = null
  private intervalMs = 300

  protected circle(task: () => void) {
    const runTask = () => {
      MEMORY.now = new Date()
      task()
      if (!this.isRunning) return
      this._loopTimer = setTimeout(runTask, this.intervalMs)
    }
    runTask()
  }

  public runCircle(task: () => void) {
    this.isRunning = true
    this.circle(task)
    return this
  }

  public stopCircle() {
    this.isRunning = false
    if (this._loopTimer) {
      clearTimeout(this._loopTimer)
      this._loopTimer = null
    }
  }
}
