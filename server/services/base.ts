
export class MEMORY {
  static now: Date = new Date()
}
export default class BaseClass {
  protected isRunning = false
  // protected now: Date = new Date()
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
