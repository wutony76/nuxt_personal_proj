#!/usr/bin/env node
/**
 * CI 用的「跑完全部 test:* 腳本」彙總器。
 *
 * 直接從 package.json 的 scripts 動態抓出所有 `test:` 開頭的項目依序執行——
 * 刻意不手刻一份清單（跟 test-bg-all.mjs／test-games-all.mjs 那種「固定列舉」不同），
 * 這樣以後新增任何 `test:xxx` 腳本都會自動被 CI 涵蓋，不會發生「加了新測試但忘記
 * 同步更新 CI 清單」這種靜默漏測試的情況。
 *
 * 用法：
 *   npm test
 *   node test/ci-test-all.mjs
 *   BASE_URL=http://localhost:6100 npm test
 *
 * 前提：同所有子腳本——dev server 要跑著、種子帳號存在。
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const testScripts = Object.keys(pkg.scripts ?? {})
  .filter((name) => name.startsWith('test:'))
  .sort()

function runOne(name) {
  return new Promise((resolve) => {
    console.log(`\n========================================`)
    console.log(`▶ npm run ${name}`)
    console.log(`========================================`)

    const child = spawn('npm', ['run', name], {
      stdio: 'inherit',
      cwd: rootDir,
      env: process.env
    })

    child.on('close', (code) => {
      resolve({ name, code: code ?? 1 })
    })
  })
}

async function main() {
  if (testScripts.length === 0) {
    console.log('package.json 裡沒有任何 test:* 腳本，沒有東西可以跑。')
    return
  }

  console.log(`CI 測試彙總開始，共 ${testScripts.length} 支 npm test:* 腳本`)

  const results = []
  for (const name of testScripts) {
    results.push(await runOne(name))
  }

  console.log(`\n========================================`)
  console.log('CI 測試彙總結果')
  console.log(`========================================`)
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✔' : '✘'} npm run ${r.name}`)
  }

  const failed = results.filter((r) => r.code !== 0)
  console.log(`\n共 ${results.length} 支，成功 ${results.length - failed.length} 支，失敗 ${failed.length} 支`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main()
