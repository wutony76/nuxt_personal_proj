## ADDED Requirements

### Requirement: 系統 SHALL 允許自訂角色個別開關「BG 彩票」與「遊戲中心」項目
系統 SHALL 提供僅管理員可用的角色權限 API：查詢指定角色在 `bg`（15 個盤口，CD／OF 各自獨立）與
`retro`（26 款小遊戲）兩分類下每個項目的開關狀態、切換單一項目的開關。新角色 MUST 預設全部項目
開啟。內建角色（`admin`／`user`／`npc`）MUST NOT 被限制，永遠回報全部項目開啟且 MUST NOT 可被
切換。系統 MAY 保留其他分類（例如「彩運來」）的欄位供後續擴充，但本次 MUST NOT 對該分類提供任何
清單或開關。

#### Scenario: 查詢自訂角色的項目開關清單
- **WHEN** 管理員呼叫 `GET /api/admin/role-defs/:id/games`，`:id` 為自訂角色
- **THEN** 系統回傳 `bg` 15 個盤口與 `retro` 26 款遊戲的清單，每項帶 `enabled` 狀態，
  尚未關閉過的角色全部為 `true`

#### Scenario: 關閉自訂角色的單一項目
- **WHEN** 管理員呼叫 `PATCH /api/admin/role-defs/:id/games`，body 為某自訂角色、指定分類
  （`bg` 或 `retro`）與一個該分類下合法的 key、`enabled: false`
- **THEN** 系統更新成功，後續查詢該項目 `enabled` 為 `false`，其餘項目不受影響

#### Scenario: 內建角色拒絕切換
- **WHEN** 管理員嘗試對 `admin`／`user`／`npc` 呼叫 `PATCH /api/admin/role-defs/:id/games`
- **THEN** 系統回傳錯誤，MUST NOT 變更任何開關狀態

#### Scenario: 無效分類或 key 拒絕
- **WHEN** 管理員呼叫 `PATCH /api/admin/role-defs/:id/games` 帶不存在的分類或該分類下不存在的 key
- **THEN** 系統回傳錯誤，MUST NOT 建立任何紀錄

### Requirement: 系統 SHALL 在前台強制生效自訂角色的項目關閉設定
被自訂角色關閉的項目（`bg` 玩法或 `retro` 遊戲），該角色的登入會員 MUST NOT 能透過頁面導覽或直接
呼叫對應 API 存取。訪客與內建角色會員的存取行為 MUST NOT 受影響。

#### Scenario: 會員自查目前可玩項目
- **WHEN** 已登入會員呼叫 `GET /api/games/access`
- **THEN** 系統依其目前角色回傳被關閉的 `{category, key}` 清單；內建角色會員收到空陣列

#### Scenario: 遊戲中心頁面導覽被攔截
- **WHEN** 自訂角色會員被關閉了某款遊戲中心項目，仍嘗試瀏覽該遊戲的 `/game/:slug` 頁面
- **THEN** 系統導向 `/game-hall`，MUST NOT 顯示原遊戲頁面內容

#### Scenario: BG 彩票頁面導覽被攔截
- **WHEN** 自訂角色會員被關閉了某個 BG 彩票盤口（例如 `LHC-CD`），仍嘗試瀏覽該盤口的頁面
- **THEN** 系統導向 `/lottery-hall`，MUST NOT 顯示原盤口頁面內容；同玩法未被關閉的另一盤口
  （例如 `LHC-OF`）MUST NOT 受影響

#### Scenario: 直接呼叫遊戲中心 API 被攔截
- **WHEN** 自訂角色會員被關閉了某款遊戲中心項目，仍直接呼叫該遊戲的 `/api/games/retro/:key/*` 端點
- **THEN** 系統回傳 403，MUST NOT 執行原本的讀寫邏輯

#### Scenario: 直接呼叫 BG 彩票下注 API 被攔截
- **WHEN** 自訂角色會員被關閉了某個 BG 彩票盤口，仍直接呼叫 `POST /api/lottery/bet` 對該盤口下注
- **THEN** 系統拒絕下注，MUST NOT 扣款或建立注單；對同玩法未被關閉的另一盤口下注 MUST NOT 受影響

#### Scenario: 訪客與內建角色不受影響
- **WHEN** 未登入訪客，或內建角色（Admin／User／NPC）會員存取任一分類項目的頁面或 API
- **THEN** 系統行為與本變更實作前一致，MUST NOT 被攔截
