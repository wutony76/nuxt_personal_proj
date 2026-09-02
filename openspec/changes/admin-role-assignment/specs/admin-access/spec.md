## ADDED Requirements

### Requirement: 系統 SHALL 允許管理員在後台將帳號設為 admin 或 user
系統 SHALL 提供僅管理員可用的帳號角色 API：列出所有帳號及其目前角色（`admin`／`user`），
並允許將指定帳號設為 `admin` 或 `user`。角色變更 SHALL 立即影響後台存取與管理者發言白名單判斷。
系統 MUST NOT 允許移除最後一位 admin，MUST NOT 允許操作者將自己降為 user。
角色清單 MAY 於伺服器重啟後回復為程式碼種子預設。

#### Scenario: 將一般帳號提升為 admin
- **WHEN** 管理員對一筆 `role: user` 的帳號送出設為 `admin`
- **THEN** 該帳號之後通過 `requireAdmin`，並可出現在管理員列表

#### Scenario: 將 admin 降為 user
- **WHEN** 管理員對非自己、且非最後一位 admin 的帳號設為 `user`
- **THEN** 該帳號失去後台權限，之後 `requireAdmin` 回傳權限錯誤

#### Scenario: 禁止移除最後一位 admin
- **WHEN** 系統僅剩一位 admin，管理員嘗試將其設為 `user`
- **THEN** 系統回傳錯誤，MUST NOT 變更該帳號角色

#### Scenario: 禁止自我降權
- **WHEN** 管理員嘗試將自己的帳號設為 `user`
- **THEN** 系統回傳錯誤，MUST NOT 變更角色

#### Scenario: 總覽權限設定雙欄操作
- **WHEN** 管理員在總覽「權限設定」左側點選帳號並在右側切換角色成功
- **THEN** 左側列表對應帳號的角色標示更新為 Admin 或 User
