import type { DetailContent } from '~/types/project'

/**
 * 「HAPPYFATYOYO WORLD」案例頁內容（即本專案自我介紹）。
 * 由詳細頁（精選 Know-how）與 know-how 附頁（完整 Know-how）共用同一份資料，避免內容重複維護。
 */
export const happyfatyoyoPlatform: DetailContent = {
  slug: 'happyfatyoyo-platform',
  overview: '基於多年累積的全端開發經驗，打造一個具備完整產品架構與業務邏輯的展示平台，以' +
    '「線上彩票大廳 + 復古像素小遊戲 + 後台管理」為場景，用 Nuxt 4（Vue 3 + Nitro）建構前後端' +
    '一體的應用。整合下注、開獎、路珠、錢包餘額、角色權限與後台維運，串聯完整的產品生態迴圈。',
  problem: '獨立打造一套產品等級的系統，最容易在幾個面向失守而退化成單一功能的展示 demo：多玩法／' +
    '多角色共用邏輯如何拆分、狀態如何分層管理、沒有團隊 code review 時如何維持品質、每次改動如何' +
    '留下可回溯的紀錄。彩票類玩法天生盤口眾多，若不先訂好分層規則，程式碼很快就會因為複製貼上而失控。',
  solution: [
    '架構規範：click → actions（loading / success / error 三段）→ _handlers（私有轉換）的互動分層，' +
    '單一 reactive state object，全域狀態走 Pinia setup store，避免解構 store',
    '元件分層：彩票遊戲元件依「共用／cd 盤口專屬／of 盤口專屬」三層拆分，避免切換盤口時互相污染狀態',
    '流程規範：導入 OpenSpec 六階段流程（Proposal → Design → Tasks → Implementation → Validation → ' +
    'Engineering Evidence），每個功能變更都在 openspec/changes/ 留下可審查的文件佐證，取代口頭決策'
  ],
  keyFeatures: [
    { title: 'BG 彩票', description: '15 個盤口的完整下注／開獎／路珠／獎金池流程' },
    { title: '彩運來', description: '8 種台彩鏡射玩法，開獎號碼與派彩金額完全比照官方數字' },
    { title: '遊戲中心', description: '30 款經典／像素小遊戲' },
    { title: '柑仔店櫥仔', description: '8 款小遊戲，含 start/claim 多階段流程' },
    { title: '後台管理', description: '角色遊戲權限、彩票報表、NPC 自動遊玩系統、活動日誌' }
  ],
  architecture: {
    nodes: [
      { id: 'browser', label: 'Browser' },
      { id: 'app', label: 'Nuxt app/', detail: 'pages / components / composables / services' },
      { id: 'api', label: 'Nitro server/api', detail: 'API routes' },
      { id: 'services', label: 'server/services', detail: '業務邏輯層' },
      { id: 'storage', label: 'Storage（記憶體）', detail: 'Demo 環境用的 in-memory state layer' }
    ],
    edges: [
      { from: 'browser', to: 'app' },
      { from: 'app', to: 'api' },
      { from: 'api', to: 'services' },
      { from: 'services', to: 'storage' }
    ],
    notes: [
      'Storage service 是記憶體狀態層，統一存取會員、訂單、遊戲狀態 —— 明確標示：In-memory storage，' +
      'Demo environment only，不是正式 Production Database',
      '前端狀態以單一 reactive 為主，跨頁共用狀態走 Pinia setup store',
      '型別統一走 TypeScript；shared/config/** 宣告檔因 Nitro 走 Node 原生 ESM、不認別名，維持純 JS'
    ]
  },
  engineeringEvidence: [
    {
      title: 'OpenSpec 六階段紀錄',
      description: '52 份變更文件，每份含 proposal/design/tasks/validation/engineering-evidence，' +
        '記錄每次變更的原因、做法與驗證結果',
      refLabel: 'openspec/changes/*'
    },
    {
      title: '手動驗證取代自動化測試',
      description: '目前無自動化測試框架，以既有 dev server + 實際操作／curl 驗證，結果固定寫回 validation.md',
      refLabel: 'openspec/changes/*/validation.md'
    },
    {
      title: 'Conventional Commits',
      description: 'commit 訊息統一格式，維持變更歷史可讀、可追溯'
    }
  ],
  knowHow: [
    {
      key: 'research',
      title: 'Research',
      highlights: [
        { title: 'Lottery Domain Modeling', synopsis: '統一四大類玩法的權威清單，避免多處定義不同步' },
        { title: 'Settlement Design', synopsis: '彩運來「不自建開獎/賠率」，完全比照官方數字' }
      ],
      full: [
        { title: 'Lottery Domain Modeling', synopsis: '用 GameCategory（bg/retro/tw）+ NpcGameCategory 疊加 toys 統一四大類玩法，每類各自維護單一「權威清單」（catalog），避免多處各自定義造成不同步' },
        { title: 'API Data Modeling', synopsis: '串接台灣彩券官方 API 時實測到：對外部網址的 $fetch 呼叫加上顯式泛型型別，會跟 Nitro 內部路由的型別推斷互相打架，產生「型別無限展開」的編譯錯誤（TS2321/TS2589），目前列為已知限制、不影響執行期行為' },
        { title: 'Settlement Design', synopsis: '彩運來玩法刻意「不自建開獎、不自建賠率」：開獎號碼與派彩金額完全比照官方當期實際數字，本站只負責判定是否全中；跟自建盤口／自訂賠率的 BG 彩票是兩套並存的結算模型' }
      ]
    },
    {
      key: 'architecture',
      title: 'Architecture',
      highlights: [
        { title: 'Domain Boundary', synopsis: '四大類邊界清楚分離，同一玩法再依共用/cd/of 三層拆分' },
        { title: 'State Management', synopsis: '單一 reactive，全域狀態走 Pinia setup store 且不解構' }
      ],
      full: [
        { title: 'Domain Boundary', synopsis: 'bg/tw/retro/toys 四大類邊界清楚分離，同一玩法內再依「共用／cd 專屬／of 專屬」三層拆分' },
        { title: 'Layering', synopsis: 'click（UI 入口）→ actions（loading/success/error 三段）→ _handlers（私有轉換），不允許工具函式散落在 <script setup> 頂層' },
        { title: 'State Management', synopsis: '單一 reactive state object 為主，全域共用狀態一律走 Pinia setup store 且不在使用端解構' }
      ]
    },
    {
      key: 'decision-log',
      title: 'Decision Log',
      highlights: [
        { title: 'Why Domain Separation?', synopsis: '六合彩曾因共用元件切換盤口殘留狀態、偷偷下注的真實踩坑' },
        { title: 'Why Pinia?', synopsis: 'setup store 明文禁止解構，避免響應性地雷' }
      ],
      full: [
        { title: 'Why Pinia?', synopsis: 'setup store 貼近 Composition API 心智模型，且明文禁止解構，避免最常見的「解構後失去響應性」地雷' },
        { title: 'Why Monthly Reports?', synopsis: '後台報表原本只是佔位畫面，選「以月為單位」呈現銷售／兌獎／佣金，對應真實代理商結算週期，也是用既有 in-memory 訂單資料展示後台數據視覺化能力的最小可行切角' },
        { title: 'Why Domain Separation?', synopsis: '六合彩曾經共用同一個自動下注元件在 cd/of 間切換，Vue 就地 patch 保留了同一份 instance，導致切換盤口時上一個盤口的設定殘留、對另一個盤口偷偷下注；這個真實踩過的坑讓「跨盤口狀態的組件必須各自一份」變成硬性規則' },
        { title: 'Why this API structure?', synopsis: 'server/api 路由依 /api/lottery/*（BG）與 /api/lottery-tw/*（彩運來）分開命名空間，直接對應 bg/tw 的 domain boundary，看路由前綴就能判斷是哪一類玩法' }
      ]
    }
  ],
  techStack: ['Nuxt 4', 'Vue 3', 'TypeScript', 'Pinia', 'vee-validate', 'Zod', 'Tailwind CSS v4', 'SCSS', 'Nitro', 'Node.js 22'],
  result: {
    metrics: [
      { label: 'BG LOTTERY', value: '15', caption: '個盤口' },
      { label: 'TW LOTTERY', value: '8', caption: '種玩法' },
      { label: 'RETRO GAMES', value: '30', caption: '款經典遊戲' },
      { label: 'TOY GAMES', value: '8', caption: '款柑仔店小遊戲' }
    ],
    summary: '更重要的是建立了一套可複用的「規格驅動開發」流程與元件分層規範，之後的個人專案／新功能都' +
      '直接沿用這套模板，開發節奏與程式碼一致性明顯提升。累積 52 份 OpenSpec 變更文件，記錄了每一次' +
      '設計決策的脈絡。'
  },
  knowHowOverflowPath: '/project/happyfatyoyo-platform-know-how'
}
