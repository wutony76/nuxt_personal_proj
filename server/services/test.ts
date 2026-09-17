import { spawn } from 'node:child_process'
import { join } from 'node:path'

/**
 * bg 系列全部盤口的測試腳本（見 scripts/test-*.mjs），依序執行、不平行，
 * 避免多支腳本同時打同一個 session 互相干擾。
 */
const BG_TEST_SCRIPTS = [
  'test-k3-cd.mjs', 'test-k3-of.mjs',
  'test-6hc-cd.mjs', 'test-6hc-of.mjs',
  'test-pk10-cd.mjs', 'test-pk10-of.mjs',
  'test-ssc-cd.mjs', 'test-ssc-of.mjs',
  'test-x5-cd.mjs', 'test-x5-of.mjs',
  'test-eggs.mjs', 'test-kl10.mjs', 'test-kl8.mjs',
  'test-fc3d.mjs', 'test-pl3.mjs'
]

/** 台彩系列（大樂透 DLT、威力彩 SUPERLOTTO、今彩539 D539、49樂合彩 M649、39樂合彩 M539）的測試腳本 */
const TW_TEST_SCRIPTS = [
  'test-dlt.mjs',
  'test-superlotto.mjs',
  'test-d539.mjs',
  'test-m649.mjs',
  'test-m539.mjs'
]

/** retro 遊戲中心（得分→coin 換算）的測試腳本 */
const RETRO_TEST_SCRIPTS = [
  'test-retro.mjs'
]

/** 等 dev server 真的開始接受連線再開始跑，避免第一支腳本因為 server 還沒起來而登入失敗 */
async function waitForServerReady(baseUrl: string, maxAttempts = 60): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(baseUrl)
      if (res.status < 500) return true
    } catch {
      // 還沒起來，忽略錯誤繼續重試
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

/** 用子程序跑一支測試腳本，繼承 stdio 讓輸出直接印在同一個終端機 */
function runTestScript(scriptPath: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), stdio: 'inherit' })
    child.on('close', () => resolve())
    child.on('error', (err) => {
      console.error(`[TESTING] 執行 ${scriptPath} 失敗：`, err)
      resolve()
    })
  })
}

/**
 * 開發用測試工具：依序把 scripts/test-*.mjs 跑一輪，不用手動一支一支下指令。
 *
 *   new TestClass().bg()      // bg 系列（K3／6HC／PK10／SSC／X5／EGGS／KL10／KL8／FC3D／PL3）
 *   new TestClass().tw()      // 台彩系列（DLT）
 *   new TestClass().retro()   // retro 遊戲中心（得分→coin 換算）
 */
export default class TestClass {
  private async run(label: string, scripts: string[]): Promise<void> {
    const port = process.env.PORT || 6100
    const baseUrl = `http://localhost:${port}`

    console.log(`\n[TESTING] (${label}) 等待 dev server 就緒...`)
    const ready = await waitForServerReady(baseUrl)
    if (!ready) {
      console.error(`[TESTING] (${label}) dev server 逾時未就緒，放棄自動測試`)
      return
    }

    console.log(`\n[TESTING] === (${label}) 開始依序執行測試腳本 ===\n`)
    for (const script of scripts) {
      console.log(`\n[TESTING] --- 執行 ${script} ---`)
      await runTestScript(join(process.cwd(), 'scripts', script))
    }
    console.log(`\n[TESTING] === (${label}) 全部測試腳本執行完畢 ===\n`)
  }

  /** 依序跑完 bg 系列全部測試腳本，單一腳本失敗不影響後面繼續跑 */
  async bg(): Promise<void> {
    await this.run('bg', BG_TEST_SCRIPTS)
  }

  /** 依序跑完台彩系列全部測試腳本 */
  async tw(): Promise<void> {
    await this.run('tw', TW_TEST_SCRIPTS)
  }

  /** 依序跑完 retro 遊戲中心全部測試腳本 */
  async retro(): Promise<void> {
    await this.run('retro', RETRO_TEST_SCRIPTS)
  }
}
