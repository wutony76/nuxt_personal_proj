#!/usr/bin/env node
/**
 * 「其他遊戲」（retro 遊戲中心 30 款 + 復古童玩 8 款）一鍵依序執行既有端到端測試腳本，
 * 彙總成單一結果報告，跟 test-bg-all.mjs 是同一套設計：每個子腳本都是獨立 child
 * process 依序執行，避免任何一支腳本的 process.exit() 提早中斷後面其他腳本。
 *
 * 用法：
 *   npm run test:games
 *   node test/test-games-all.mjs
 *   BASE_URL=http://localhost:6100 node test/test-games-all.mjs
 *
 * 前提：同各子腳本——dev server 要跑著、用種子帳號登入。
 *
 * 說明：retro 遊戲中心（2048、小蜜蜂、小精靈…等 30 款）共用同一套「送分→換算
 * coin」機制，已經由 test-retro.mjs 一支腳本涵蓋全部 30 款，不需要每款遊戲
 * 各自一支腳本；復古童玩（扭蛋機、彈珠台…等）因為各自獨立的中獎機率/賠付邏輯，
 * 延續既有慣例每款一支腳本。
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const GAME_SCRIPTS = [
  { key: 'retro 遊戲中心（30 款）', file: 'test-retro.mjs' },
  { key: '童玩-扭蛋機', file: 'test-toy-lucky-draw.mjs' },
  { key: '童玩-卡片', file: 'test-toy-cards.mjs' },
  { key: '童玩-吹泡泡汽水笛', file: 'test-toy-soda-whistle.mjs' },
  { key: '童玩-竹蜻蜓', file: 'test-toy-bamboo-copter.mjs' },
  { key: '童玩-軟糖', file: 'test-toy-gummy.mjs' },
  { key: '童玩-大胖豬', file: 'test-toy-big-pig.mjs' },
  { key: '童玩-哨子糖', file: 'test-toy-whistle-candy.mjs' },
  { key: '童玩-POG 尪仔標', file: 'test-toy-pog.mjs' }
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
  console.log(`其他遊戲彙總測試開始（共 ${GAME_SCRIPTS.length} 支腳本，涵蓋 retro 30 款 + 童玩 8 款）`)

  const results = []
  for (const script of GAME_SCRIPTS) {
    results.push(await runOne(script))
  }

  console.log(`\n========================================`)
  console.log('其他遊戲彙總結果')
  console.log(`========================================`)
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✔' : '✘'} ${r.key}（${r.file}）`)
  }

  const failed = results.filter((r) => r.code !== 0)
  console.log(`\n共 ${results.length} 支，成功 ${results.length - failed.length} 支，失敗 ${failed.length} 支`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main()
