# Design

## 1. API client（`app/services/api.ts`）

新增型別與 `bgLottery` 命名空間方法：

```ts
export type SixhccdQuotaMemberOverride = { userId: string; crossTabIssueMax: number }
export type SixhccdQuotaSettings = {
  globalCrossTabIssueMax: number
  memberOverrides: SixhccdQuotaMemberOverride[]
}

bgLottery: {
  poolAudit: (...) => ...,
  sixhccdQuota: () => $fetch<SixhccdQuotaSettings>('/api/admin/bg-lottery/6hccd-quota'),
  setSixhccdQuota: (crossTabIssueMax: number) =>
    $fetch<{ crossTabIssueMax: number }>('/api/admin/bg-lottery/6hccd-quota', {
      method: 'PATCH', body: { crossTabIssueMax }
    }),
  setSixhccdMemberQuota: (userId: string, crossTabIssueMax: number | null) =>
    $fetch<{ userId: string; crossTabIssueMax: number | null }>(
      `/api/admin/bg-lottery/6hccd-quota/members/${userId}`,
      { method: 'PATCH', body: { crossTabIssueMax } }
    )
}
```

## 2. 新元件 `app/components/admin/SixhccdQuotaPanel.vue`

比照 `NpcPanel.vue` 的「全域設定 + 逐會員覆寫列表」版面，但規模小很多（不需要分頁/多子
標籤）：

- 重用 `api.admin.roles()`（既有「全部會員清單」端點，`CreateMember.vue`/`RoleList.vue`
  已在用）取得會員清單，不新增端點
- 狀態機沿用既有 `AsyncStatus` 三段式慣例（`idle`/`loading`/`success`/`error`）+
  `_actions`/`click` 封裝慣例
- 全站預設值：單一數字輸入框 + 儲存按鈕，顯示目前值
- 會員覆寫列表：搜尋框（比對 name/email/id，比照 `CreateMember.vue` 的
  `filteredUsers` 寫法）+ 清單，每列顯示「目前生效上限（覆寫優先，沒覆寫顯示全站預設）」+
  一個輸入框 + 「套用覆寫」/「清除覆寫」兩個按鈕
- `isDemo` 唯讀模式：寫入控制項包在 `<fieldset class="admin-fieldset-reset" :disabled="isDemo">`
  （既有全站慣例）

## 3. `bg-lottery.vue` 新增第 4 個分頁

`state.activeTab` 型別擴充為 `'overpay' | 'reseed' | 'summary' | 'quota'`，新增一個 tab
按鈕，`quota` 分頁直接掛載 `<AdminSixhccdQuotaPanel :is-demo="isDemo" />`（自己管理自己的
fetch/狀態，不混進既有 `state.reseed`/`state.overpay` 的 fetch 流程）。
