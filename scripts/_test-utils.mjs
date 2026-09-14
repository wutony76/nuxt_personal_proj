/**
 * 各彩種測試腳本共用的小工具（登入、HTTP client、斷言計數）。
 * 抽出自 test-dlt.mjs，供 test-k3-cd.mjs 以及後續各盤口的測試腳本共用，
 * 避免每支腳本各自重複一份幾乎一樣的 login/api/ok/section 樣板。
 */

export function createTestRunner({
  baseUrl = process.env.BASE_URL || 'http://localhost:6100',
  email = process.env.DLT_TEST_EMAIL || process.env.LOTTERY_TEST_EMAIL || 'admin@example.com',
  password = process.env.DLT_TEST_PASSWORD || process.env.LOTTERY_TEST_PASSWORD || '123456'
} = {}) {
  let cookie = ''
  let passCount = 0
  let failCount = 0
  const failures = []

  function ok(label, condition, detail) {
    if (condition) {
      passCount += 1
      console.log(`  ✔ ${label}`)
    } else {
      failCount += 1
      failures.push(label)
      console.log(`  ✘ ${label}${detail ? `  (${detail})` : ''}`)
    }
  }

  function section(title) {
    console.log(`\n── ${title} ──`)
  }

  async function api(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options.headers || {})
      }
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(',').map((c) => c.split(';')[0]).join('; ')
    let body = null
    try { body = await res.json() } catch { /* 204 或非 JSON 回應忽略 */ }
    return { status: res.status, body }
  }

  async function login() {
    section('登入')
    const { status, body } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    ok(`登入成功（${email}）`, status === 200 && body?.user?.id, JSON.stringify(body))
    if (status !== 200) {
      console.error('登入失敗，無法繼續測試，請確認 dev server 是否啟動且種子帳號存在。')
      process.exit(1)
    }
  }

  function summary() {
    console.log(`\n=================================`)
    console.log(`通過 ${passCount} 項，失敗 ${failCount} 項`)
    if (failCount > 0) {
      console.log('失敗項目：')
      failures.forEach((f) => console.log(`  - ${f}`))
      process.exitCode = 1
    } else {
      console.log('全部通過 ✔')
    }
  }

  /**
   * 等真實遊戲回到「開盤中」再進行真實下注測試，避免測試腳本剛好跑在
   * 封盤／開獎中的過渡窗口而誤判為失敗（這不是程式邏輯錯誤，是遊戲週期本身的正常狀態）。
   * currentPath 例如 '/api/lottery/k3-cd/current'。
   */
  async function waitForOpen(currentPath, { timeoutMs = 30000, intervalMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs
    let lastStatus = null
    while (Date.now() < deadline) {
      const { body } = await api(currentPath)
      lastStatus = body?.currentStatus
      if (lastStatus === '開盤中') return true
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    console.log(`  ⚠ 等待開盤逾時（最後狀態：${lastStatus}），下面的真實下注測試可能因此失敗`)
    return false
  }

  return { baseUrl, ok, section, api, login, summary, waitForOpen }
}
