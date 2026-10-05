# 技術問答筆記

整理這個專案裡值得理解的技術觀念。每題都分成四段：

- **30 秒回答**：口頭說明用的精簡版
- **完整說明**：原理與細節
- **在這個專案**：對應的程式碼與實際數據
- **可能的追問**

新的題目直接加在對應主題底下，沒有合適主題就新增一節。

## 目錄

- [SSR 與資料獲取](#ssr-與資料獲取)
  - [Q1. 為什麼在 `onMounted` 抓資料會讓 SSR 等於白開？](#q1-為什麼在-onmounted-抓資料會讓-ssr-等於白開)
  - [Q2. `useAsyncData` 怎麼避免 hydration 時重複請求？`key` 的作用是什麼？](#q2-useasyncdata-怎麼避免-hydration-時重複請求key-的作用是什麼)
  - [Q3. 伺服器端抓資料為什麼要用 `useRequestHeaders(['cookie'])`？](#q3-伺服器端抓資料為什麼要用-userequestheaderscookie)
  - [Q4. 為什麼原生 ofetch 在 SSR 會壞，Nuxt 的 `$fetch` 不會？](#q4-為什麼原生-ofetch-在-ssr-會壞nuxt-的-fetch-不會)
- [SSR 狀態管理](#ssr-狀態管理)
  - [Q5. 為什麼模組層級的 `reactive` 在 SSR 下危險？](#q5-為什麼模組層級的-reactive-在-ssr-下危險)
  - [Q6. 權限檢查的 hydration 修法，為什麼用 `isHydrating`，不用 `useAsyncData` 包住 guard？](#q6-權限檢查的-hydration-修法為什麼用-ishydrating不用-useasyncdata-包住-guard)
- [時區與測試](#時區與測試)
  - [Q7. 為什麼在 worker thread 改 `TZ` 無效？為什麼測試要用 UTC 跑？](#q7-為什麼在-worker-thread-改-tz-無效為什麼測試要用-utc-跑)

---

## SSR 與資料獲取

### Q1. 為什麼在 `onMounted` 抓資料會讓 SSR 等於白開？

**30 秒回答**

`onMounted` 只在瀏覽器執行，伺服器渲染時永遠不會跑。所以 SSR 產生的 HTML 裡沒有資料，只有空殼或 loading。瀏覽器要等 JS 下載、hydration 完成、`onMounted` 觸發，才開始打 API，資料回來再渲染一次。伺服器渲染的成本照付，首屏有資料的效益卻拿不到。

**完整說明**

Nuxt 處理一個請求分兩段：

```
【伺服器】執行 setup() → 產生 HTML → 連同 payload 送出
【瀏覽器】下載 JS → hydration → onMounted
```

在 `onMounted` 抓資料時，實際流程是一條 CSR waterfall：

```
HTML（空殼）→ 下載 JS → hydration → onMounted 發請求 → 資料回來 → 再渲染
```

每一步都要等上一步完成，資料量大或網路慢時就會出現「白屏加轉圈圈」。

- **白費的地方**：伺服器運算、hydration 的成本都付了。
- **失去的東西**：首屏資料、SEO、資料去重快取。
- **結論**：等於用 Nuxt 的複雜度，換到 SPA 的效能，甚至更差。

**在這個專案**

- 盤點時 `useFetch`/`useAsyncData` 使用 0 次，94 個頁面中有 74 個在 `onMounted` 才抓資料。這和[架構文件](../Architecture/README.md)裡分析的舊公司專案白屏問題是同一個病根。
- `/lottery-hall` 改成 `useAsyncData` 後，「首次出現真實數字」從 486ms 降到 226ms（見 [ssr-performance-log.md](../Engineering%20Evidence/ssr-performance-log.md)）。

**可能的追問**

- **那是不是每一頁都該 SSR？**
  不是。canvas 遊戲頁依賴 `window` 和 `requestAnimationFrame`，SSR 沒有好處，用 `<ClientOnly>` 或 `server: false`。即時資料可以首屏 SSR，之後交給輪詢或 WebSocket 更新。
- **SSR 的代價是什麼？**
  TTFB 會變長，因為伺服器要等資料回來才送出 HTML。這個專案的 API 都在同一個 process 裡，所以 TTFB 只從 17ms 變成 20ms；若改接外部服務，代價會明顯增加。

---

### Q2. `useAsyncData` 怎麼避免 hydration 時重複請求？`key` 的作用是什麼？

**30 秒回答**

`useAsyncData` 在伺服器端執行並等資料回來，再把結果以 `key` 為索引寫進 payload，跟 HTML 一起送到瀏覽器。瀏覽器 hydration 時先用同一個 `key` 查 payload，有就直接用，不會再打一次 API。`key` 就是伺服器和瀏覽器之間對應同一份資料的識別碼。

**完整說明**

| 階段 | 行為 |
|---|---|
| 伺服器 | 執行 handler，等資料回來才產生 HTML |
| 序列化 | 結果以 `key` 寫入 payload（`__NUXT_DATA__`），隨 HTML 送出 |
| 瀏覽器 hydration | 用 `key` 查 payload，有資料就直接用，不呼叫 handler |
| 之後 client 端切換頁面 | 伺服器沒參與，在瀏覽器執行 handler |

**`key` 的用途**

- **對應 payload**：hydration 時靠它找到伺服器的結果。
- **去重複**：多個元件用同一個 `key`，共用同一份資料和同一個進行中的請求。
- **手動控制**：`refreshNuxtData(key)`、`clearNuxtData(key)`。
- **注意**：不同參數必須用不同的 `key`，例如 `` `trend-${lotteryId}` ``，否則會拿到別的參數的快取。

**對照：直接在 setup 裡 `await $fetch()` 會怎樣？**

伺服器會抓一次，但結果不會寫進 payload。瀏覽器 hydration 時 setup 再跑一次，又抓一次，可能出現 hydration mismatch。`useAsyncData` 的核心價值就是「伺服器抓、瀏覽器接手」。

**其他重點**

- `useFetch(url)` 大致等於 `useAsyncData(自動產生的 key, () => $fetch(url))`。已經有集中的 API 層時，用 `useAsyncData(key, () => api.xxx())` 比較能沿用既有封裝。
- `lazy: true`：client 端切換頁面時不擋導航。伺服器端仍會等資料。
- Nuxt 4 的 `data` 預設是 `shallowRef`：修改深層屬性不會觸發更新，要整個重新賦值或加 `deep: true`。

**在這個專案**

- [app/pages/lottery-hall.vue:292](../../app/pages/lottery-hall.vue#L292)：`useAsyncData('lottery-hall-pools', ...)`，搭配 `lazy: true`。
- [app/composables/useAdminReportData.ts](../../app/composables/useAdminReportData.ts)：5 個報表頁共用，每頁傳入不同的 `key`。

**可能的追問**

- **加了 `lazy: true` 之後，為什麼還要 `await`？**
  沒有 `await` 時，程式會立刻往下執行。SSR 階段後面的 watcher 拿到的是 loading 狀態，HTML 就停在「載入中」，雖然 payload 裡其實已經有資料。這是報表頁實際踩過的坑。

---

### Q3. 伺服器端抓資料為什麼要用 `useRequestHeaders(['cookie'])`？

**30 秒回答**

瀏覽器發請求時會自動帶 cookie，但 SSR 時是 Nitro 代替使用者發出新的內部請求，它不知道原始請求是哪個使用者，不會自動帶 cookie。需要登入的 API 就會回 401。`useRequestHeaders(['cookie'])` 讀出原始請求的 cookie，讓我手動轉發給內部請求。

**完整說明**

```
瀏覽器 ──(帶 cookie)──▶ Nuxt SSR
                          │
                          └─(新的內部請求，預設不帶 cookie)──▶ /api/admin/reports
                                                                  └─ requireAdminView() → 401
```

- `useRequestHeaders(['cookie'])` 在伺服器端回傳原始請求的 cookie header，在瀏覽器回傳空物件。所以同一段程式碼兩邊都能用：瀏覽器本來就會自動帶。
- 只轉發 `cookie`，不轉發全部 header。`host`、`content-length` 這類 header 轉發過去可能造成錯誤，也沒必要把多餘資訊傳給內部 API。
- 另一種寫法是 `useRequestFetch()`，它會自動帶上原始請求的 header。

**在這個專案**

- [app/components/admin/Shell.vue:21](../../app/components/admin/Shell.vue#L21)：權限檢查轉發 cookie。
- [app/composables/useAdminReportData.ts:53](../../app/composables/useAdminReportData.ts#L53)：報表資料轉發 cookie。
- 後端驗證在 `sessionController.requireAdminView()`，只認請求本身帶的 `portfolio_auth_token` cookie。

**可能的追問**

- **第一次 SSR 改造時，為什麼沒做需要登入的頁面？**
  第一版刻意先挑公開頁，把「SSR 資料獲取」和「SSR 登入狀態轉發」分開驗證。當時文件寫成「SSR 抓不到 cookie」，這個說法是錯的，之後已經修正，並補做了報表頁。

---

### Q4. 為什麼原生 ofetch 在 SSR 會壞，Nuxt 的 `$fetch` 不會？

**30 秒回答**

原生 ofetch 在 Node 底層呼叫 `fetch`，相對路徑 `'/api/...'` 沒有網域可以接，會直接丟出 `Failed to parse URL`。Nuxt 注入的全域 `$fetch` 在伺服器端碰到內部 API 路徑時不走網路，直接在同一個 process 裡呼叫 Nitro 的 handler，所以不需要完整 URL。在瀏覽器端兩者行為一樣。

**完整說明**

| | 瀏覽器 | 伺服器（SSR） |
|---|---|---|
| `import { $fetch } from 'ofetch'` | 相對路徑接在目前網域後面，正常 | Node 的 `fetch` 無法解析相對路徑，報錯 |
| Nuxt 全域 `$fetch` | 同上，正常 | 內部路由直接交給 Nitro handler 處理，不經過網路 |

- **額外好處**：伺服器端呼叫內部 API 時沒有網路往返和序列化成本，所以 SSR 的 TTFB 幾乎沒增加。
- **修法**：只要拿掉 `import { $fetch } from 'ofetch'`，讓檔案使用自動注入的全域 `$fetch`。呼叫方式和型別都不變。

**在這個專案**

- [app/services/api.ts](../../app/services/api.ts) 第 1 行原本是 `import { $fetch } from 'ofetch'`，改掉後整個 API 層才能在 SSR 使用。
- 這是第一次 SSR 改造時規劃階段沒預見的問題；不修的話，任何頁面改成 `useAsyncData` 都會失敗。

**可能的追問**

- **那為什麼原本 client 端都沒問題？**
  因為原本所有呼叫都發生在 `onMounted`，只在瀏覽器執行，從來沒有在 Node 環境跑過。

---

## SSR 狀態管理

### Q5. 為什麼模組層級的 `reactive` 在 SSR 下危險？

**30 秒回答**

Node server 是長期運作的 process，模組只會載入一次，所有請求共用同一份模組狀態。模組層級的 `reactive({})` 在 SSR 下就是「全站使用者共用一份」：A 使用者的登入狀態可能被 B 的請求讀到或覆蓋。瀏覽器端每個使用者有自己的一份，所以原本 client-only 時不會出事。改成 `useState()` 後，伺服器端每個請求各自獨立。

**完整說明**

```ts
// ❌ 模組層級：整個 Nitro process 只有一份
const state = reactive({ user: null })

// ✅ useState：伺服器端每個請求一份，並自動序列化到瀏覽器
const state = useState('auth-state', () => ({ user: null }))
```

- **為什麼會交錯**：SSR 處理請求時中間有 `await`。請求 A 在等 API 時，請求 B 可以進來執行，兩者讀寫同一個物件。
- **`useState` 的行為**：
  - 伺服器端：狀態存在當次請求的 `nuxtApp` 上，請求之間互不影響。
  - 序列化：結果寫進 payload，瀏覽器 hydration 時直接沿用，不用重新查詢。
  - 瀏覽器端：整個 app 生命週期共用一份，對既有呼叫端來說行為不變。
- **進行中的 promise 去重複**：原本用模組層級的 `let promise`，同樣會跨請求共用。改成 `WeakMap<nuxtApp, Promise>`，每個請求的 `nuxtApp` 是不同物件，自然隔開；請求結束後 `nuxtApp` 被回收，`WeakMap` 的項目也跟著消失。

**在這個專案**

- [app/composables/useAuth.ts](../../app/composables/useAuth.ts)、[app/composables/useAdminAuth.ts](../../app/composables/useAdminAuth.ts)：`useState` 加上 `WeakMap`。
- 這個風險原本是潛在的：這兩支 composable 過去只在 `onMounted` 被呼叫。把後台權限檢查改成 SSR 時才會真正觸發，所以必須先修。對外介面不變，全站 70 多處呼叫點都不用改。

**可能的追問**

- **為什麼 `useNuxtApp()` 要在 `await` 之前呼叫？**
  Nuxt 靠非同步上下文追蹤「現在是哪個請求」。`await` 之後的程式碼，上下文可能已經遺失，此時呼叫 `useNuxtApp()` 會丟出例外（實測會回 500）。所以要在函式開頭、任何 `await` 之前先取得並存起來。
- **Pinia 有同樣的問題嗎？**
  `@pinia/nuxt` 會替每個請求建立獨立的 Pinia 實例，所以透過 store 存狀態是安全的。危險的是在模組頂層直接宣告的 `reactive`、`ref` 或一般變數。

---

### Q6. 權限檢查的 hydration 修法，為什麼用 `isHydrating`，不用 `useAsyncData` 包住 guard？

**30 秒回答**

需求有兩個：hydration 時要沿用 SSR 的結果、不重打 API；但 client 端切換後台頁面時，每次都要重新跟伺服器確認 session。用 `useAsyncData` 包住 guard 能滿足第一個，但會破壞第二個：它的快取是跨元件共用的，切換頁面時新頁面直接沿用舊的結果，權限檢查就被跳過了。`nuxtApp.isHydrating` 只在初次 hydration 那一刻是 true，剛好只命中要跳過的那一種情況。

**完整說明**

**問題的起點**：`Shell.vue` 的 `guard()` 是頂層 `await`，hydration 時會再跑一次。它一開始呼叫 `resetAdminAuth()` 清掉 SSR 帶過來的狀態，再從瀏覽器依序打 `/api/me`、`/api/admin/me`。hydration 要等這兩次往返完成，所以報表頁 SSR 改造後反而從 390ms 變慢到 485ms。

**比較兩種修法**

| | `useAsyncData` 包住 guard | `isHydrating` 判斷（採用） |
|---|---|---|
| 重新整理（hydration） | 0 次重複請求 ✅ | 0 次重複請求 ✅ |
| client 端切換後台頁面 | 0 次：權限檢查被跳過 ❌ | 各 1 次：重新驗證 ✅ |

**為什麼 `useAsyncData` 會跳過**：快取存在 `nuxtApp._asyncData[key]`，所有元件實例共用。切換頁面時，新頁面的 Shell 掛載得比舊頁面卸載、釋放快取還早，於是直接拿到舊資料。這是讀 Nuxt 原始碼（`asyncData.js`）並用 Playwright 數請求數確認的。

**最終條件**

```ts
if (nuxtApp.isHydrating && (checked.value || (authInitialized.value && !isLoggedIn.value))) {
  sessionReady.value = true
  return
}
```

- `checked.value`：SSR 判定已登入，並完整跑過管理員檢查。
- `authInitialized && !isLoggedIn`：SSR 判定未登入。這時管理員檢查不會執行，`checked` 永遠是 false，所以要另外判斷「已經問過伺服器，答案是沒登入」，不能和「還沒問過」混在一起。

**在這個專案**

- [app/components/admin/Shell.vue:83](../../app/components/admin/Shell.vue#L83)
- 修正後 production build p50 186ms / p90 312ms（見 [fix-admin-guard-hydration-duplicate-fetch.md](../Engineering%20Evidence/fix-admin-guard-hydration-duplicate-fetch.md)）。

**可能的追問**

- **為什麼切換頁面時一定要重新驗證？**
  避免 cookie 已過期，但瀏覽器端的快取仍顯示已登入。重新驗證是原本就有的設計，修效能不能破壞它。
- **有沒有其他做法？**
  可以每次導航用不同的 `key`，或在 client 端導航時手動 `refresh()`。但都需要額外判斷「現在是不是 hydration」，最後還是會用到同樣的資訊，不如直接用 `isHydrating` 清楚。

---

## 時區與測試

### Q7. 為什麼在 worker thread 改 `TZ` 無效？為什麼測試要用 UTC 跑？

**30 秒回答**

時區是整個 process 共用的設定。Node 只有在主執行緒修改 `process.env.TZ` 時會重設時區；worker thread 裡的 `process.env` 是一份複本，改了不會生效。`nuxt dev` 的 Nitro 跑在 worker thread，所以時區必須在啟動 process 時就用 `TZ=Asia/Taipei` 決定。測試用 UTC 跑，是因為雲端主機和 CI 預設是 UTC，而開發機在台灣會把問題藏起來；在 UTC 下也通過，才能證明部署後時間正確。

**完整說明**

**worker thread 的實測結果**（`TZ=UTC` 啟動）：

| 位置 | 修改前 | 修改 `process.env.TZ = 'Asia/Taipei'` 後 |
|---|---|---|
| 主執行緒 | UTC+0 | UTC+8 ✅ |
| worker thread | UTC+0 | UTC+0 ❌ |

所以這個專案的時區設定分成三層：

| 機制 | 涵蓋情境 |
|---|---|
| `package.json`：`TZ=Asia/Taipei nuxt dev` 等指令 | dev、preview、start；process 啟動時決定，worker 也沿用 |
| `server/plugins/00.timezone.ts` | 直接 `node .output/server/index.mjs`；主執行緒執行期設定有效，仍不正確時印警告 |
| `nextDrawWindow()` 明確用 UTC+8 計算 | 開獎核心邏輯，完全不依賴前兩層 |

**為什麼測試用 UTC**

- **問題只在伺服器時區不是台灣時出現**：在台灣的開發機上跑，新舊寫法結果一樣，測試等於沒驗證到。
- **舊寫法在 UTC 下的結果**：大樂透 20:00 的鎖單時間，會變成台灣時間隔天 04:00。
- **新寫法**：在 UTC 下 21 個測試全部通過。
- **確保條件成立**：測試裡有一項斷言 `new Date(0).getTimezoneOffset() === 0`，確認真的在 UTC 下執行。

**為什麼台灣時間可以用固定位移計算**

台灣自 1979 年起沒有日光節約時間，固定 UTC+8。所以用 `Date.UTC(...) - 8 小時` 計算即可，不需要時區資料庫。有日光節約時間的地區（例如美國、歐洲）就不能這樣做，要用 `Intl` 或 dayjs 的 timezone 外掛。

**在這個專案**

- [server/services/game/lottery/tw/drawSchedule.ts](../../server/services/game/lottery/tw/drawSchedule.ts)
- [server/plugins/00.timezone.ts](../../server/plugins/00.timezone.ts)
- [test/unit/drawSchedule.test.ts](../../test/unit/drawSchedule.test.ts)
- 詳見 [refactor-tw-draw-schedule-taipei-tz.md](../Engineering%20Evidence/refactor-tw-draw-schedule-taipei-tz.md)

**可能的追問**

- **為什麼不把其他約 90 處本地時間 API 都改成明確時區？**
  改動範圍大、風險高。全域固定時區已經涵蓋，這次先把最核心的開獎計算改成不依賴時區，並用測試鎖住。
- **為什麼共用函式不放進 base class？**
  base class 會載入整個伺服器服務圖，放進去就無法單獨寫單元測試。獨立的純函式沒有相依，測試可以直接 import。
