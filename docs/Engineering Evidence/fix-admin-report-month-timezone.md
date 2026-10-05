# Engineering Evidence：後台報表月份初始值的時區不一致

## 變更摘要

- **對應變更**：`fix-admin-report-month-timezone`
- **Commit**：`6b09cf9`
- **變更檔案**：`app/composables/useAdminReportData.ts`

### 問題

報表月份原本是 `ref(dayjs().format('YYYY-MM'))`，SSR 和 client hydration 各算一次。

伺服器通常跑在 UTC，瀏覽器在台灣是 UTC+8。每月 1 號台灣時間 00:00～08:00 之間，伺服器算出上個月、瀏覽器算出這個月，結果是：

- 月份選擇器顯示的月份和 SSR 抓回來的資料不一致。
- 可能出現 hydration mismatch。

### 修法

```ts
const month = useState(`admin-report-month-${key}`, () => dayjs().format('YYYY-MM'))
```

月份由伺服器算一次並寫進 payload，client hydration 時直接沿用同一個值。

### 行為變化

`useState` 在 client 端會保留整個 app 生命週期。在報表頁切換月份後離開再回來，會停在上次選的月份；分頁長時間開著跨月時，也不會自動跳到新的月份。目前視為可接受，若之後希望每次進頁面都重設成當月，可以在進入頁面時重設。

## 驗證

| 項目 | 方法 | 結果 |
|---|---|---|
| SSR 月份正確 | `curl` 檢查 SSR 回應 | 含正確月份 |
| Hydration | Playwright 檢查 console | 無 mismatch 警告 |
| 月份切換 | Playwright 操作上月 / 下月 | `v-model` 切換與資料重抓正常 |

## 封存前檢查

- [x] `validation.md` 結論為「通過」
- [x] 變更檔案、風險整理完成
- [ ] `openspec archive`
