## ADDED Requirements

### Requirement: 6HC Credit page SHALL provide all required play types
系統必須在 `6hc-cd` 頁面提供 14 個信用盤玩法，且玩法鍵值需與既有來源定義一致：`banbo`、`duoxuanzhongyi`、`ixiaolian`、`lianma`、`qima`、`shengxiao`、`tema`、`touweishu`、`weishulian`、`wuxing`、`zhengma`、`zhengmate`、`zhengterenzhong`、`zixuanbuzhong`。

#### Scenario: Render all required play entries
- **WHEN** 使用者進入 `6hc-cd` 頁面
- **THEN** 畫面可看到以上 14 個玩法項目並可切換

### Requirement: 6HC Credit page SHALL keep a single source of play metadata
系統必須以單一資料來源管理玩法清單（key、名稱、描述），避免在模板中重複硬編碼多份玩法內容。

#### Scenario: Switch active play by metadata list
- **WHEN** 使用者點擊任一玩法
- **THEN** 系統依同一份玩法清單切換 active 狀態並更新內容區

### Requirement: 6HC Credit specification SHALL exist in project specs
系統必須建立專案級 `openspec/specs/6hcCredit.md`，記錄信用盤玩法範圍、頁面行為與後續擴充方向。

#### Scenario: Verify project spec file for 6HC Credit
- **WHEN** 開發者檢查 OpenSpec 規格目錄
- **THEN** 可找到 `openspec/specs/6hcCredit.md` 且內容包含 14 個玩法清單
