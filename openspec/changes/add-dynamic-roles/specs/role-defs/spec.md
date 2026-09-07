## ADDED Requirements

### Requirement: 系統 SHALL 提供可擴充的角色清單查詢與新增
系統 SHALL 提供僅管理員可用的角色清單 API：列出全部角色（含種子角色 Admin／User／NPC 與自訂角色），
並允許新增自訂角色。新增角色 MUST NOT 使用已存在的角色名稱或 `admin` 這個保留 id，MUST NOT 自動取得
後台權限（僅內建 `admin` id 授予 `isAdmin`）。角色清單 MAY 於伺服器重啟後回復為種子預設。

#### Scenario: 查詢角色清單
- **WHEN** 管理員呼叫 `GET /api/admin/role-defs`
- **THEN** 系統回傳角色陣列，至少包含 `admin`／`user`／`npc` 三個內建角色

#### Scenario: 新增自訂角色
- **WHEN** 管理員以未使用過的名稱呼叫 `POST /api/admin/role-defs`
- **THEN** 系統建立 `builtin:false` 的新角色，並可於後續查詢中看到

#### Scenario: 禁止重複角色名稱
- **WHEN** 管理員以已存在的角色名稱（不分大小寫）新增角色
- **THEN** 系統回傳錯誤，MUST NOT 建立新角色

#### Scenario: 新增角色不會取得後台權限
- **WHEN** 管理員新增一個自訂角色，並將某會員設為該角色
- **THEN** 該會員的 `isAdmin` 判斷 MUST 維持 `false`

#### Scenario: 會員角色可指派為任一角色清單中的角色
- **WHEN** 管理員將會員角色設為角色清單中存在的 id（例如 `npc`）
- **THEN** 系統成功更新，該會員之後查詢角色為該 id
- **WHEN** 管理員將會員角色設為角色清單中不存在的 id
- **THEN** 系統回傳錯誤，MUST NOT 變更角色
