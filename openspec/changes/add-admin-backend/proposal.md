## Why

遊戲中心與 BG彩票平台目前完全沒有真正的後台管理機制。Coin 兌換三常數（`coinRate`／`coinCapPerRun`／`coinDailyCap`，涵蓋 12 款經典遊戲）與 PAC-MAN 固定樣板迷宮（`FIXED_MAZE_TEMPLATES`）都還是寫死在程式碼裡，要調整都得改程式碼＋重新部署；BG彩票的下注量／輸贏、coin 發放狀況、彩池應派與實派金額是否吻合，目前也完全沒有監控介面。`app/pages/admin.vue` 雖然已經有一個佔位頁面（登入即可看到 3 張靜態卡片，卡片文字本身就寫著「之後可串接真實 API」），但只檢查「有沒有登入」，不是「是不是管理員」，也沒有任何實質功能。

本次新增完整的登入後台，把上述「先用程式碼常數頂著、之後要做後台」的既有技術債一次補齊，並建立後續可持續擴充的後台導覽架構：總覽／角色權限／BG彩票／台彩甘仔店／經典遊戲／遊戲試算／報表分析七大項。其中台彩甘仔店、遊戲試算與報表分析範圍尚未定案，本次只先佔位（導覽入口＋空頁面），實質功能規格留待各自獨立的後續 change。

## What Changes

- **管理員身份判斷**：伺服器端維護一份管理員白名單（比照現有「先用程式碼常數頂著」的慣例，不做角色分級——目前只分「是不是 admin」，是的話後台全部可見，不做細部權限控管）。`app/pages/admin.vue` 從「只檢查 `isLoggedIn`」升級為「檢查是否在管理員白名單內」，非管理員導向首頁或顯示無權限訊息。本次不做「新增/移除管理員」的 UI，避免「要先是 admin 才能管理誰是 admin」的雞生蛋問題，白名單異動仍需改程式碼。
- **登入導向邏輯修正**：現有 `app/pages/login.vue` 不論身份一律導向 `/admin`（開發階段留下的暫時邏輯），`/admin` 改成管理員限定後，一般玩家會被導去又立刻被踢出來；使用者拍板改成更單純的做法：**登入一律導向首頁 `/`，不分是否為管理員**，登入流程不用查管理員身份。管理員要進後台改走既有的 `AppTopbar.vue`「後台」連結。
- **`/admin` 本身就是「總覽」**，後台的入口頁（不是登入後自動導向的頁面），卡片內容改成其餘 6 大項的入口，`/admin` 之外新增 6 個子路由：
  - `/admin/roles`：顯示目前管理員白名單（唯讀）
  - `/admin/bg-lottery`：BG彩票監控報表（唯讀），涵蓋：
    - 各彩種（六合彩／K3／PK10／SSC／X5／PC蛋蛋／快樂十分／快樂8／福彩3D／排列3，信用盤／官方盤分開）：下注量、輸贏、coin 發放總量
    - 每日活躍會員數
    - 彩池補貼追蹤：實測確認現有 10 種彩種的彩池目前是純公式算出來的數字（永遠不會不夠付），完全沒有「系統額外補了多少錢」的記錄機制；本次新增兩種追蹤（詳見 design.md）：①彩池低於門檻被重新擲骰時的前後金額，②頭獎保底金額超過彩池預算分配時的超付差額，**只記總金額、不分獎項分級**——這是新增的結算旁路記錄邏輯，不是接現成資料
  - `/admin/taiwan-lottery`：台彩甘仔店管理，本次僅佔位（導覽入口＋「即將推出」空頁面），實質功能留待後續 change
  - `/admin/games`：經典遊戲管理，含三塊：
    - Coin 兌換常數編輯（12 款遊戲的 `coinRate`／`coinCapPerRun`／`coinDailyCap`）
    - 固定樣板迷宮管理（PAC-MAN `FIXED_MAZE_TEMPLATES` 的新增／編輯，重用既有的 BFS 連通性驗證邏輯，驗證失敗不得存檔）
    - 玩家遊戲紀錄與 coin 兌換查詢（可查任一玩家的遊戲紀錄與對應兌換出去的 coin 明細）
    - 每款遊戲附一個直達實際遊玩頁面的連結（例如 `/game/snake`、`/game/pac-man`），方便管理員改完設定直接點過去試玩驗證
  - `/admin/game-simulator`：遊戲試算，本次僅佔位，實質功能留待後續 change
  - `/admin/reports`：報表分析，本次僅佔位，實質功能留待後續 change
- **新增後台專屬 server API**（`server/api/admin/**`），在既有 `sessionController.require` 之外再加一層「是否為管理員」的門禁檢查
- **Server 端資料可變化**：把原本寫死在建構子的 coin 三常數、client 端寫死的 PAC-MAN 固定樣板迷宮，改為可被後台 API 讀寫的可變狀態，沿用現有 in-memory `Storage` 架構、不引入資料庫（代表後台改的值伺服器重啟就會消失，這點需要在 design.md 明確跟使用者確認是否可接受，或是否要加一層簡單的檔案持久化）

## Capabilities

### Added Capabilities

- `admin-access-control`：管理員身份判斷（白名單）與後台頁面／API 的存取門禁
- `admin-bg-lottery-dashboard`：BG彩票監控報表（下注量／輸贏／coin 發放總量／活躍會員數／彩池核對），唯讀
- `admin-classic-games`：經典遊戲後台管理（coin 兌換常數／固定樣板迷宮／玩家紀錄與 coin 兌換查詢）

### Modified Capabilities

- `game-history`：既有的 coin 兌換三常數從「服務類別建構子寫死」改為「後台可讀寫的可變狀態」，影響 12 款遊戲的 server 端服務檔（`server/services/game/retro/*.ts`）與其共用基底（`base.ts`）

台彩甘仔店、遊戲試算與報表分析本次僅新增導覽佔位入口，不算實質新增 capability，三者的完整規格留待各自獨立的後續 change 補上。

## Impact

- 新增檔案（client）：`app/pages/admin/roles.vue`、`app/pages/admin/bg-lottery.vue`、`app/pages/admin/taiwan-lottery.vue`、`app/pages/admin/games.vue`、`app/pages/admin/game-simulator.vue`、`app/pages/admin/reports.vue`（實際檔名／路由設計待 design.md 確認）
- 修改檔案（client）：
  - `app/pages/admin.vue`：從靜態卡片頁改為真正的權限判斷＋總覽（後台入口頁，非登入後自動導向）
  - `app/pages/login.vue`：登入導向邏輯簡化為一律導向首頁 `/`，不查身份（見 What Changes）
  - `app/pages/game/pac-man.vue`：`FIXED_MAZE_TEMPLATES` 改為向後台 API 拉取，而非本地程式碼常數
- 新增檔案（server）：`server/api/admin/**` 下的多支 API 路由（管理員白名單查詢、BG彩票報表查詢、coin 常數讀寫、固定樣板迷宮讀寫、玩家紀錄查詢）
- 修改檔案（server）：
  - `server/services/game/retro/base.ts` 與 12 款遊戲子類別：coin 三常數改為可變狀態
  - `server/services/storage.ts`：新增管理員白名單設定、後台可變設定（coin 常數／固定樣板迷宮）的儲存位置
- 不引入資料庫，沿用既有 in-memory `Storage` 架構
- 不影響現有玩家端遊戲頁面的操作行為（PAC-MAN 固定樣板迷宮改為 fetch 後台資料後，行為應與現況一致，只是資料來源從程式碼常數換成 API）
- 台彩甘仔店、遊戲試算、報表分析本次只做導覽佔位，不影響現有台彩相關頁面（`lottery-hall-taiwan` 等）的行為
