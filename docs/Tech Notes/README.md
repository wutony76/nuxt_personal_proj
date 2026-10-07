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
- [部署與維運](#部署與維運)
  - [Q8. 為什麼這個專案只能跑 1 個 Node process？](#q8-為什麼這個專案只能跑-1-個-node-process)
  - [Q9. 為什麼 production 一定要 HTTPS？](#q9-為什麼-production-一定要-https)
  - [Q10. 為什麼 `import 'crypto-js/enc-base64'` 在 dev 正常，production 卻啟動失敗？](#q10-為什麼-import-crypto-jsenc-base64-在-dev-正常production-卻啟動失敗)
  - [Q11. 為什麼用 Cloud SQL Auth Proxy，不直接連資料庫 IP？](#q11-為什麼用-cloud-sql-auth-proxy不直接連資料庫-ip)
  - [Q12. 部署失敗怎麼自動回滾？為什麼 migration 要跟上一版相容？](#q12-部署失敗怎麼自動回滾為什麼-migration-要跟上一版相容)

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

---

## 部署與維運

### Q8. 為什麼這個專案只能跑 1 個 Node process？

**30 秒回答**

開獎排程、WebSocket 連線和部分遊戲狀態都存在 process 的記憶體裡。開兩個 process，各自會有一份狀態和一組排程：同一期可能被結算兩次，使用者連到不同 process 會看到不同資料，聊天室訊息也只會送給連到同一個 process 的人。所以部署時固定只跑 1 個，水平擴展要先把狀態移到外部（資料庫、Redis）才行。

**完整說明**

| 狀態 | 存在哪裡 | 多 process 的後果 |
|---|---|---|
| 開獎與結算排程 | `server/plugins/init.ts` 的背景迴圈 | 每個 process 都跑一份，重複結算 |
| 彩票當期狀態、彩池 | 記憶體 | 各 process 數字不同 |
| WebSocket 連線 | 各 process 自己持有 | 廣播只送到同一個 process 的連線 |
| 會員、權限、遊戲紀錄 | 資料庫（有設定 `DATABASE_URL` 時） | 不受影響 |

這也影響平台選擇：Cloud Run 這類會自動擴縮的服務，必須設定最少、最多都是 1 台，並開啟 CPU 常駐（否則沒有請求時背景排程會停），費用因此比 VM 高。

**在這個專案**

- [deploy/gcp-vm/ecosystem.config.cjs](../../deploy/gcp-vm/ecosystem.config.cjs)：`exec_mode: 'fork'`、`instances: 1`。

**可能的追問**

- **如果要擴展到多台怎麼做？**
  排程改成只在一個 leader 執行（或用外部排程器），即時狀態移到 Redis，WebSocket 廣播透過 Redis pub/sub 轉發到所有 process。

---

### Q9. 為什麼 production 一定要 HTTPS？

**30 秒回答**

登入 cookie 在 production 設了 `secure: true`，瀏覽器只會在 HTTPS 連線下儲存和送出這個 cookie。如果用純 HTTP 部署，登入 API 會回成功，但 cookie 存不下來，下一個請求就變回未登入。所以部署架構裡用 Caddy 自動申請 Let's Encrypt 憑證提供 HTTPS。

**完整說明**

```ts
// server/services/auth.ts
{ httpOnly: true, sameSite: 'lax', secure: isProduction, ... }
```

| 屬性 | 作用 |
|---|---|
| `secure` | 只在 HTTPS 傳送，避免 cookie 在網路上被竊聽 |
| `httpOnly` | JavaScript 讀不到，降低 XSS 偷 cookie 的風險 |
| `sameSite: 'lax'` | 跨站請求不帶 cookie，降低 CSRF 風險 |

dev 環境是 `http://localhost`，所以 `secure` 只在 production 開啟。

**在這個專案**

- [deploy/gcp-vm/Caddyfile.template](../../deploy/gcp-vm/Caddyfile.template)：Caddy 反向代理並自動處理憑證；Node 只聽 `127.0.0.1`，外部無法繞過 HTTPS 直接連線。
- 沒有網域時可以用 `sslip.io`（例如 `34-82-1-2.sslip.io`），一樣能申請憑證。

---

### Q10. 為什麼 `import 'crypto-js/enc-base64'` 在 dev 正常，production 卻啟動失敗？

**30 秒回答**

dev 和前端打包由 Vite 處理，Vite 會自動補上副檔名。production 的 `.output` 由 Node 直接以 ESM 載入，而 `crypto-js` 是沒有 `exports` 欄位的舊式套件，Node 在 ESM 模式下不會替子路徑補 `.js`，所以找不到檔案。補上 `.js` 後兩邊都能解析。這個問題存在了兩天沒被發現，因為 CI 只做 build、不會實際啟動，所以我另外在 CI 加了 production 啟動的 smoke test。

**完整說明**

| 環境 | 誰負責解析 import | `crypto-js/enc-base64` |
|---|---|---|
| `nuxt dev` | Vite | 自動找到 `enc-base64.js` ✅ |
| 前端打包 | Vite / Rollup | 同上 ✅ |
| production server（`.output`） | Node ESM | 不補副檔名，`ERR_MODULE_NOT_FOUND` ❌ |

- 新式套件會在 `package.json` 用 `exports` 明確宣告子路徑，Node 就能正確解析。
- 舊式套件只有 `main` 欄位，ESM 匯入子路徑時必須寫出完整檔名。

**在這個專案**

- [server/utils/encrypt.js](../../server/utils/encrypt.js)：4 個 import 補上 `.js`。
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)：build job 增加 smoke test，啟動 production 產物並確認首頁有回應。
- 是用 Docker 模擬部署時發現的，接著在 Mac 上用同一份產物重現，確認不是平台差異。

**可能的追問**

- **為什麼 build 成功卻執行失敗？**
  build 只負責打包和追蹤相依檔案，不會實際執行 import 解析；問題要到 Node 載入時才會出現。所以「能 build」不等於「能跑」，CI 需要實際啟動驗證。

---

### Q11. 為什麼用 Cloud SQL Auth Proxy，不直接連資料庫 IP？

**30 秒回答**

直接連公開 IP 要在 Cloud SQL 開放 IP 白名單，還要自己處理 TLS 憑證；資料庫暴露在網路上。Auth Proxy 跑在 VM 本機，用 VM 的服務帳戶向 Google 驗證，連線自動加密，應用程式只要連 `127.0.0.1:5432`。權限由 IAM 控管（`roles/cloudsql.client`），VM 上也不用放任何金鑰檔。

**完整說明**

| 做法 | 驗證方式 | 加密 | 缺點 |
|---|---|---|---|
| 公開 IP + 白名單 | IP + 資料庫密碼 | 要自己設定 TLS | 資料庫暴露在網路上；IP 變了要改白名單 |
| 私有 IP（VPC） | 網路隔離 + 密碼 | 依設定 | 要設定 VPC peering，步驟較多 |
| **Auth Proxy** | IAM 服務帳戶 + 密碼 | 自動 | 多一個常駐服務 |

**在這個專案**

- [deploy/gcp-vm/cloud-sql-proxy.service.template](../../deploy/gcp-vm/cloud-sql-proxy.service.template)：以 systemd 常駐，`DynamicUser=yes` 不需要特定系統帳號。
- `DATABASE_URL=postgres://portfolio:密碼@127.0.0.1:5432/portfolio`，應用程式不需要知道 Cloud SQL 在哪裡。

---

### Q12. 部署失敗怎麼自動回滾？為什麼 migration 要跟上一版相容？

**30 秒回答**

每次部署都解壓到新的版本目錄，用 `current` 這個 symlink 指向目前執行的版本。切換後做健康檢查，失敗就把 `current` 指回上一版再重啟。但 migration 在切換前就套用了，回滾只換回程式，資料庫維持新的結構，所以 migration 要寫成舊版程式也能運作，例如先新增欄位，確定不會回滾後才刪除舊欄位。

**完整說明**

```
releases/A  ← current（舊版）
releases/B  新版：解壓 → migration → current 指向 B → 健康檢查
                                            ├─ 成功：保留，清理更舊的版本
                                            └─ 失敗：current 指回 A，重啟
```

- **migration 在切換前執行**：migration 失敗時不會切換，舊版繼續服務。
- **用 `pm2 delete` + `start`，不用 `reload`**：reload 不保證會換成新的程式路徑，可能繼續跑舊版目錄。代價是重啟期間約數秒無法服務。
- **第一次部署沒有上一版**：腳本會先確認 `current` 是否存在，避免誤把新版本當成「上一版」重啟。這是在 Docker 模擬部署時抓到的 bug。

**在這個專案**

- [deploy/gcp-vm/remote-deploy.sh](../../deploy/gcp-vm/remote-deploy.sh)
- 模擬驗證：部署一個啟動即拋錯的版本，健康檢查失敗後自動回到上一版，首頁回應 200。

**可能的追問**

- **怎麼做到零停機部署？**
  開兩個 port 輪流使用（blue-green），新版本健康檢查通過後再切換 Caddy 的轉發目標。但這個專案的狀態在記憶體裡，兩個版本同時運作會重複執行排程，需要先處理 Q8 的問題。

