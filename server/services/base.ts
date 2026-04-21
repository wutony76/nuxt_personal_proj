
export default class BaseClass {
  protected isRunning = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private intervalMs = 300

  protected circle(task: () => void) {
    const runTask = () => {
      task()
      if (!this.isRunning) return
      this.timer = setTimeout(runTask, this.intervalMs)
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
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
