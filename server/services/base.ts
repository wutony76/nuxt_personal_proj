
import { SX } from '#shared/config/6hc-cd'

export class MEMORY {
  static now: Date = new Date()
}

export const _handle = {
  currentShengxiao(): string {
    const year = MEMORY.now.getFullYear()
    return SX[((year - 2020) % 12 + 12) % 12] as string
  },
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
