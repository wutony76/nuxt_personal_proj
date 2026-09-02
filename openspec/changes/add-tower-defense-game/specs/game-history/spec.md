## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在既有遊戲清單任一遊戲進入明確結束狀態（含 game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷或關卡全破／完成接龍／戰艦全滅／清除全部關卡磚塊或生命值歸零／**塔防 HP 歸零**）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: TOWER DEFENSE 玩家 HP 歸零結束遊戲
- **WHEN** 玩家的 HP 因敵人抵達終點扣血而歸零
- **THEN** 系統立即結束遊戲並顯示 `GAME OVER`，寫入一筆 `gameKey: 'towerDefense'` 的紀錄，`score` 為當下累積的擊殺獎勵與波次通過獎勵總和，`meta` 記錄 `waveReached`

#### Scenario: TOWER DEFENSE 沒有波次上限，MUST NOT 因抵達特定波次而結束遊戲
- **WHEN** 玩家清空任一波次（包含第 20 波）的所有敵人，且 HP 仍大於 0
- **THEN** 系統 MUST NOT 結束遊戲、MUST NOT 顯示任何「破關/通關」畫面，僅進入 Wave 強化選擇後開始下一波，波次持續遞增直到玩家 HP 歸零

### Requirement: Server 端服務層 SHALL 比照既有架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
既有遊戲清單與 **towerDefense** SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: towerDefense 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 towerDefense 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: TOWER DEFENSE 防禦塔 MUST NOT 建造於路徑格
系統 SHALL 將地圖每一格標記為 `path` 或 `grass`；玩家 SHALL 只能在 `grass` 格建造防禦塔，
`path` 格 MUST NOT 接受建塔請求，系統 SHALL 給予明確的無法建造提示。

#### Scenario: 玩家嘗試在路徑格建塔
- **WHEN** 玩家點擊一個標記為 `path` 的格子並選擇建塔
- **THEN** 系統拒絕該次建塔請求，MUST NOT 扣除 Gold，MUST NOT 產生防禦塔

#### Scenario: 玩家在草地格建塔成功
- **WHEN** 玩家點擊一個標記為 `grass` 且尚未有塔的格子，並持有足夠 Gold
- **THEN** 系統扣除對應花費並在該格生成防禦塔

### Requirement: TOWER DEFENSE 防禦塔 SHALL 自動索敵並在射程與冷卻條件下攻擊
每座防禦塔 SHALL 每個 tick 檢查射程內是否有敵人；當射程內存在敵人且冷卻時間已過，
系統 SHALL 觸發一次攻擊並依塔的類型與等級套用對應傷害／範圍／減速效果，MUST NOT 需要玩家手動觸發攻擊。

#### Scenario: 敵人進入塔的射程且冷卻完成時自動攻擊
- **WHEN** 一隻敵人進入某座防禦塔的射程範圍，且該塔距離上次攻擊已超過其攻速冷卻時間
- **THEN** 系統立即觸發一次攻擊，對目標造成該塔當前等級的傷害（炮塔另對範圍內其他敵人造成傷害、冰塔另施加減速）

#### Scenario: 冷卻中的塔 MUST NOT 重複攻擊
- **WHEN** 某座防禦塔距離上次攻擊尚未超過其攻速冷卻時間
- **THEN** 系統 MUST NOT 觸發該塔的攻擊，即使射程內存在敵人

### Requirement: TOWER DEFENSE 防禦塔升級 MUST NOT 在 Gold 不足時執行
玩家對防禦塔發起升級請求時，系統 SHALL 檢查目前 Gold 是否達到該塔下一等級所需花費；
Gold 不足時 MUST NOT 扣款、MUST NOT 提升塔的等級；已達最高等級（Lv3）的塔 MUST NOT 再接受升級請求。

#### Scenario: Gold 足夠時升級成功
- **WHEN** 玩家對一座 Lv1 防禦塔發起升級請求，且目前 Gold ≥ 該塔 Lv2 所需花費
- **THEN** 系統扣除對應花費，該塔的 Damage／Attack Speed／Range 依 Lv2 數值更新

#### Scenario: Gold 不足時升級被拒絕
- **WHEN** 玩家對一座防禦塔發起升級請求，但目前 Gold 小於下一等級所需花費
- **THEN** 系統拒絕該次升級請求，MUST NOT 扣除 Gold，塔的等級與數值 MUST NOT 改變

### Requirement: TOWER DEFENSE 每波清完 SHALL 提供強化選擇，且下一波開始前 MUST 完成選擇
每波敵人（含生成佇列）全數清空後，系統 SHALL 從固定強化選項池中隨機抽取 3 個供玩家選擇；
玩家 MUST 選擇其中 1 個後才能開始下一波，選擇後的效果 SHALL 套用為全域倍率並與先前已選的強化疊加。

#### Scenario: 波次清空後彈出強化選擇
- **WHEN** 當前波次的所有敵人與待生成敵人皆已清空
- **THEN** 系統暫停進入下一波，隨機顯示 3 個強化選項供玩家選擇

#### Scenario: 玩家選擇強化後效果疊加生效
- **WHEN** 玩家在強化選擇中點選其中 1 個選項
- **THEN** 系統將對應的全域倍率（攻擊力／攻速／Gold 收益／射程／減速強度）疊乘更新，且下一波開始後立即生效

### Requirement: TOWER DEFENSE Boss 波 SHALL 每 10 波固定重複觸發，永不停止
系統 SHALL 在每一個波次為 10 的倍數（第 10、20、30、40…波，無上限）的出怪內容中包含 Boss，
且 Boss HP SHALL 依波次對應的 Boss 序號呈等比成長；非 10 倍數的波次 MUST NOT 出現 Boss。

#### Scenario: 第 10 波觸發首個 Boss
- **WHEN** 玩家的波次進度到達第 10 波
- **THEN** 系統在該波出怪內容中生成 1 隻 Boss（連同護衛怪）

#### Scenario: 第 30 波觸發強度更高的第 3 隻 Boss
- **WHEN** 玩家的波次進度到達第 30 波
- **THEN** 系統生成 1 隻 Boss，其 HP 高於第 10 波與第 20 波出現的 Boss

#### Scenario: 非 Boss 波 MUST NOT 出現 Boss
- **WHEN** 玩家的波次進度不為 10 的倍數（例如第 1～9、11～19、21～29 波）
- **THEN** 系統該波出怪內容 MUST NOT 包含 Boss 類型敵人

### Requirement: TOWER DEFENSE 場上同時存活敵人數 MUST NOT 超過系統上限
無論波次多高，系統 SHALL 限制場上同時存活的敵人數量不超過固定上限；
超過上限時，待生成的敵人 SHALL 留在生成佇列中等待，MUST NOT 被跳過或直接消失，MUST NOT 無視上限直接生成。

#### Scenario: 高波次出怪佇列超過上限時排隊等待
- **WHEN** 某高波次（例如 wave40）依難度公式應生成的敵人數量超過系統設定的同時存活上限
- **THEN** 系統僅生成至上限數量，其餘敵人留在佇列中，待場上敵人數量下降後才依序生成，MUST NOT 一次全部生成、也 MUST NOT 捨棄未生成的敵人

### Requirement: TOWER DEFENSE Restart SHALL 完整重置所有對局狀態
執行 Restart 時，系統 SHALL 重置所有已建造的防禦塔、場上敵人與子彈、Gold、HP、Wave 進度、
已選擇的 Wave 強化倍率與分數，MUST NOT 殘留任何上一局的資料。

#### Scenario: Restart 後所有狀態回到初始值
- **WHEN** 玩家在遊戲進行中或結束後觸發 Restart
- **THEN** 系統清空所有防禦塔／敵人／子彈，Gold／HP 恢復初始值，Wave 回到第 1 波，所有 Wave 強化倍率重置為初始值，分數歸零
