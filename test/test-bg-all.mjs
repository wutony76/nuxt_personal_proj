#!/usr/bin/env node
/**
 * BG 所有盤口（11x5／六合彩官方盤／k3／pk10／ssc／kl8／kl10／pl3／fc3d／egg）
 * 一鍵依序執行既有各盤口端到端測試腳本，彙總成單一結果報告。
 *
 * 用法：
 *   npm run test:bg
 *   node test/test-bg-all.mjs
 *   BASE_URL=http://localhost:6100 node test/test-bg-all.mjs
 *
 * 前提：同各盤口個別腳本——dev server 要跑著、用種子帳號登入。
 *
 * ⚠️ 六合彩信用盤（6hc-cd）不包含在這支彙總腳本裡，需要時請另外跑
 * `npm run test:6hc-cd`：6hc-cd 的單期限額目前只做到分頁層級（跨分頁單期
 * 總上限、玩家層級限額仍是待辦，見 openspec 與工程文件），跟這裡其他已經
 * 定案的盤口測試放在一起彙總容易混淆「失敗」與「已知待補」，所以刻意分開。
 *
 * 每款盤口都是獨立 child process 依序執行（沿用各腳本自己的 login/斷言/
 * summary()，不重寫、不共用同一個 process，避免任何一款腳本的
 * `process.exit(1)`（例如登入失敗）提早中斷後面其他盤口的測試）。
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BG_SCRIPTS = [
  { key: '11x5-cd', file: 'test-x5-cd.mjs' },
  { key: '11x5-of', file: 'test-x5-of.mjs' },
  { key: '六合彩-官方盤', file: 'test-6hc-of.mjs' },
  { key: '蛋蛋', file: 'test-eggs.mjs' },
  { key: 'fc3d', file: 'test-fc3d.mjs' },
  { key: 'k3-信用盤', file: 'test-k3-cd.mjs' },
  { key: 'k3-官方盤', file: 'test-k3-of.mjs' },
  { key: 'kl8', file: 'test-kl8.mjs' },
  { key: 'kl10', file: 'test-kl10.mjs' },
  { key: 'pk10-信用盤', file: 'test-pk10-cd.mjs' },
  { key: 'pk10-官方盤', file: 'test-pk10-of.mjs' },
  { key: 'pl3', file: 'test-pl3.mjs' },
  { key: 'ssc-信用盤', file: 'test-ssc-cd.mjs' },
  { key: 'ssc-官方盤', file: 'test-ssc-of.mjs' }
]

function runOne({ key, file }) {
  return new Promise((resolve) => {
    console.log(`\n========================================`)
    console.log(`▶ ${key}（${file}）`)
    console.log(`========================================`)

    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
      env: process.env
    })

    child.on('close', (code) => {
      resolve({ key, file, code: code ?? 1 })
    })
  })
}

async function main() {
  console.log(`BG 所有玩法彙總測試開始（共 ${BG_SCRIPTS.length} 款，6hc-cd 另外跑 npm run test:6hc-cd）`)

  const results = []
  for (const script of BG_SCRIPTS) {
    results.push(await runOne(script))
  }

  console.log(`\n========================================`)
  console.log('BG 彙總結果')
  console.log(`========================================`)
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✔' : '✘'} ${r.key}（${r.file}）`)
  }

  const failed = results.filter((r) => r.code !== 0)
  console.log(`\n共 ${results.length} 款，成功 ${results.length - failed.length} 款，失敗 ${failed.length} 款`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main()
