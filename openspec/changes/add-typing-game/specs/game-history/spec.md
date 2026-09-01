## MODIFIED Requirements

### Requirement: 遊戲結束時 SHALL 記錄一筆遊戲紀錄
系統 SHALL 在 snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing 任一遊戲進入明確結束狀態（game over／時間到／步數用完／局數打完／撞到障礙物／生命值歸零／踩到地雷／敵機隊形觸底／牌局完成或玩家主動結束／單字漏接導致生命值歸零）時，
透過 `useGameHistory().actions.record()` 寫入一筆包含遊戲種類、分數、時間的紀錄；
暫停或離開頁面 MUST NOT 視為結束、MUST NOT 產生紀錄。

#### Scenario: TYPING 生命值歸零
- **WHEN** 玩家操作 TYPING 的剩餘生命值歸零（單字漏接次數達 3 次）
- **THEN** 系統寫入一筆 `gameKey: 'typing'` 的紀錄，`score` 為當局累計分數

#### Scenario: 暫停遊戲不產生紀錄
- **WHEN** 玩家在遊戲進行中按下暫停
- **THEN** 系統 MUST NOT 寫入任何遊戲紀錄

### Requirement: Server 端服務層 SHALL 比照 6hc 架構，以基底類別＋每款遊戲一個服務檔組成
`server/services/game/retro/` SHALL 提供共用基底類別（含紀錄寫入、查詢、統計等共用邏輯），
snake／racing／tetriminos／match3rush／match3classic／pong／runner／spaceShooter／minesweeper／pacman／spaceInvaders／solitaire／typing SHALL 各自有獨立服務檔繼承基底；新增遊戲時 SHALL 比照此結構擴充，
MUST NOT 把多款遊戲的邏輯合併在單一服務檔內用條件式分流。

#### Scenario: typing 與其他遊戲各自獨立結算，互不干擾
- **WHEN** 已登入使用者同一天內分別玩了 typing 與其他任一款遊戲
- **THEN** 兩者的 coin 每日上限各自獨立計算，一款達到每日上限 MUST NOT 影響另一款的可核發額度

## ADDED Requirements

### Requirement: TYPING 畫面上有多個待打單字時 SHALL 依玩家輸入的第一個字元自動鎖定目標
系統 SHALL 在玩家沒有鎖定任何單字、且輸入一個可印字元時，於所有待打（`waiting`）單字中尋找第一個字元（不分大小寫）與輸入相符的單字並鎖定為目前輸入目標（`typing`）；
若有多個候選，SHALL 優先鎖定最接近畫面頂端（最快將要漏接）的單字；鎖定期間之後的輸入 MUST NOT 影響其他未鎖定的單字。

#### Scenario: 鎖定唯一相符的單字
- **WHEN** 畫面上只有一個待打單字的第一個字元與玩家輸入相符
- **THEN** 系統將該單字鎖定為輸入目標

#### Scenario: 多個候選時鎖定最接近頂端者
- **WHEN** 畫面上有多個待打單字的第一個字元都與玩家輸入相符
- **THEN** 系統鎖定其中最接近畫面頂端的單字

#### Scenario: 鎖定期間不影響其他單字
- **WHEN** 玩家已鎖定某個單字並持續輸入
- **THEN** 系統的後續字元比對 MUST NOT 影響其他未鎖定單字的狀態

### Requirement: TYPING 逐字元輸入驗證 SHALL 不分大小寫，錯誤字元 MUST NOT 加入輸入
系統 SHALL 將玩家輸入字元與目標單字對應位置的字元皆轉換為同一大小寫後比對；
比對正確時 SHALL 立即推進輸入進度；比對錯誤時 MUST NOT 將該字元加入已輸入內容，且 SHALL 給予明確的視覺回饋。

#### Scenario: 大小寫不同仍判定正確
- **WHEN** 目標單字為 `HELLO`，玩家輸入小寫 `h`
- **THEN** 系統判定字元正確並推進輸入進度

#### Scenario: 輸入錯誤字元不採用
- **WHEN** 玩家鎖定目標單字後，輸入與下一個目標字元不符的字元
- **THEN** 系統 MUST NOT 將該字元加入已輸入內容，且觸發明確的錯誤視覺回饋，玩家可立即輸入正確字元繼續

### Requirement: TYPING 單字完成時 SHALL 得分並觸發飄走動畫，未完成飄出畫面 SHALL 判定 MISS 並扣血
當已輸入內容與目標單字完全相同（不分大小寫）時，系統 SHALL 判定該單字為 `completed`：依字長給分並疊加當下連擊倍率、播放往上飄走並淡出的動畫、解鎖輸入目標。
當某個單字（不論是否已鎖定）的畫面位置超出頂端邊界仍未完成時，系統 SHALL 判定為 `missed`：扣除玩家 1 條命、連擊倍率歸零；若該單字為目前鎖定中的目標，SHALL 一併解鎖。

#### Scenario: 完成單字得分
- **WHEN** 玩家輸入內容與鎖定的目標單字完全相同
- **THEN** 系統加上該單字字長對應的分數乘以當下連擊倍率，並播放完成動畫

#### Scenario: 連續完成提升連擊倍率
- **WHEN** 玩家在未發生 MISS 的情況下連續完成多個單字
- **THEN** 系統提升連擊倍率，後續完成的加分依新倍率計算

#### Scenario: 單字飄出畫面判定 MISS
- **WHEN** 某個單字的位置超出畫面頂端邊界時仍未被完成
- **THEN** 系統扣除玩家 1 條命、連擊倍率歸零

### Requirement: TYPING SHALL 採生命值機制，命數歸零才判定遊戲結束
玩家 SHALL 擁有 3 條命；每次 MISS 判定 SHALL 扣除 1 條命；僅當生命值歸零時系統 SHALL 判定遊戲結束並依目前分數結算。

#### Scenario: 扣命但遊戲繼續
- **WHEN** 玩家在剩餘生命大於 1 的情況下發生一次 MISS
- **THEN** 系統扣除 1 條命，遊戲繼續進行，新單字持續生成

#### Scenario: 生命值歸零才結束遊戲
- **WHEN** 玩家的剩餘生命值因 MISS 降為 0
- **THEN** 系統判定遊戲結束並依目前分數寫入紀錄

### Requirement: TYPING 難度 SHALL 隨等級提升，生成間隔縮短且單字長度增加
系統 SHALL 依玩家累計分數提升等級；等級越高，SHALL 縮短單字生成間隔，且 SHALL 提高抽到較長單字的機率。

#### Scenario: 等級提升後生成更頻繁
- **WHEN** 玩家的累計分數跨過等級門檻
- **THEN** 系統將等級提升，後續單字生成間隔縮短

#### Scenario: 等級提升後單字變長
- **WHEN** 玩家的等級提升
- **THEN** 系統從包含更長單字的單字池抽取新生成的單字，抽到長字的機率提高
