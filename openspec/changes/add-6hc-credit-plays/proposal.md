## Why

目前 `6hc-cd` 頁面僅有空白標題，缺少信用版六合彩的核心玩法切換與展示，無法支援日常測試與後續下注流程串接。  
本次需依照既有 `pcv2_0223` 的 6HC 玩法清單補齊 `6hc-cd`，並同步建立對應規格文件，避免玩法定義與實作脫節。

## What Changes

- 在 `app/pages/lottery/bg/6hc-cd.vue` 實作信用版玩法頁基礎結構，包含玩法選單、當前玩法說明與玩法內容區塊。
- 導入 14 個指定玩法（banbo、duoxuanzhongyi、ixiaolian、lianma、qima、shengxiao、tema、touweishu、weishulian、wuxing、zhengma、zhengmate、zhengterenzhong、zixuanbuzhong）的統一配置與切換。
- 建立 `openspec/specs/6hcCredit.md`，明確定義 6HC 信用版玩法覆蓋範圍、頁面行為與驗證需求。

## Capabilities

### New Capabilities
- `6hc-credit`: 定義 6HC 信用版玩法頁需提供 14 種玩法切換與內容呈現能力。

### Modified Capabilities
- （無）

## Impact

- 前端頁面：`app/pages/lottery/bg/6hc-cd.vue`
- 規格文件：`openspec/specs/6hcCredit.md`
- 影響範圍：信用版六合彩頁面導覽與玩法展示流程
