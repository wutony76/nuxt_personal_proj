# Design

## 根因

`ref(dayjs().format('YYYY-MM'))` 是一般的 Vue `ref`，沒有任何跨「伺服器渲染」
與「瀏覽器 hydration」的狀態傳遞機制——兩次執行都是各自獨立呼叫 `dayjs()`，
用的是當下執行環境的系統時鐘與時區設定。

`useState()` 不同：它背後是 Nuxt 的 payload 機制，伺服器算出的值會被序列化
寫進 `__NUXT_DATA__`，client hydration 讀取 `useState` 時，若 payload 裡已經
有對應 key 的資料，會直接複用、不重新呼叫初始化函式。這正是修正這類「初始值
不該因執行環境不同而不同」問題的標準做法——跟這次 SSR 系列改動裡其他地方
（`useAuth.ts`／`useAdminAuth.ts` 的狀態改 `useState`）用的是同一個機制，差別
只在於那邊存的是登入狀態，這裡存的是一個日期字串。

## 實作

```ts
const month = useState(`admin-report-month-${key}`, () => dayjs().format('YYYY-MM'))
```

`key` 沿用呼叫端已經為 `useAsyncData` 準備的唯一字串（例如
`'admin-report-index'`），用 `admin-report-month-` 前綴避免跟其他地方的
`useState`／`useAsyncData` key 撞名。由於 `useAsyncData` 跟 `useState` 底層
分別存在 `nuxtApp._asyncData`／`nuxtApp.payload.state`（不同物件），就算字串
前綴沒加也不會真的衝突，但加上前綴能讓 payload 內容在除錯時更容易辨識用途。

返回介面完全不變：`useState()` 回傳的也是一個標準 Vue `Ref`，外部呼叫者（5
個報表頁的 `AdminMonthPicker v-model="month"`、`month.value` 讀取）不需要
任何修改。
