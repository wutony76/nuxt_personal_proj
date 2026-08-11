export default [
  {
    name: '連碼',
    key: 'lianma',
    // 連碼：玩家自選一組號碼，依「命中幾個正碼／是否含特別號」分檔派彩。
    //
    // ⚠️ 本檔結構與 c_tema / c_zhengma / c_zhengmate / c_qima 不同 ——
    // 那四個玩法的注項可列舉（49 顆號碼、8 個兩面…），所以用 tabGroup[].groupList 列出來；
    // 連碼的注項是玩家「組」出來的：三選要從 49 選 3，共 C(49,3) = 18,424 種組合，
    // 二選也有 C(49,2) = 1,176 種，都不可能寫進 config。因此改成兩塊：
    //   settings.combo —— 選號規格（一注幾個號、複式最少／最多可選幾個號）
    //   tiers          —— 命中檔次與賠率（取代 tabGroup / groupList）
    //
    // ── 賠率怎麼定的 ──────────────────────────────────────────────
    // 機率基準（49 選 7：6 個正碼 + 1 個特別號，其餘 42 個號皆未開出）：
    //   3 個號全中正碼      C(6,3)/C(49,3)      = 0.108554%（公平賠率  921.20）
    //   2 正碼 + 1 個非正碼  C(6,2)×43/C(49,3)   = 3.500868%（公平賠率   28.56）
    //   2 個號全中正碼      C(6,2)/C(49,2)      = 1.275510%（公平賠率   78.40）
    //   1 正碼 + 特別號      C(6,1)×1 /C(49,2)   = 0.510204%（公平賠率  196.00）
    //
    // ⚠️ 這裡與 c_qima 的「每個注項各 ×0.97」不同，不可照抄：
    //    七碼的每個注項是各自獨立的一注，逐項 ×0.97 剛好就是 97% RTP；
    //    連碼的多個檔次是「同一注的互斥結果」（三中二一注同時可能中三或中二），
    //    逐檔 ×0.97 會讓一注的 RTP 疊加成 290%。
    //    正確做法是讓「整注」的 RTP = 97%，再把預算分給各檔：
    //
    //        odds(檔) = 公平賠率(檔) × 0.97 / 檔數
    //
    //    亦即每一檔都以相同折扣定價，賠率高低完全跟著稀有度走，
    //    各分頁實際 RTP 落在 96.6% ~ 96.9%（取整後）。
    //
    // ⚠️ 營運可調（改 tiers[].odds 即可，判定邏輯與注單結構都不受影響）：
    //    上面是「等比例分攤」的中性定價，實務盤口通常把常中的「中二」拉高、
    //    難中的「中三」壓低（例如 中三 190 / 中二 20），整體 RTP 反而降到 90% 上下。
    //    若要改走市場行情，只要維持 Σ 機率×賠率 ≈ 目標 RTP 即可自由重分配。
    //
    // ── 爆池分配權重 ──────────────────────────────────────────────
    // 沿用既有分級（公平賠率 ≥ 20 → 3、2.5 ~ 20 → 2、< 2.5 → 1）。
    // 連碼最容易的一檔「中二」公平賠率也有 28.56，故所有檔次一律落在權重 3。
    //
    // ── 實作提醒（此檔尚未在 shared/config/cd/plays.ts 註冊）─────────
    //   1. 註冊前需先完成 judgeCreditLianmaBet 與 Lianma 看板，否則玩法分頁會是空白看板；
    //      且 creditOddsOf('lianma', …) 目前會落到 default 分支被當成特碼解讀
    //      （數字注項回 48），必須一併補上 case。
    //   2. 一注帶多個號碼，注單的 bet_code 要存整組（如 ['03','15','22']），
    //      結算端目前只取 betCode[0]，需擴充。
    //   3. 賠率是「檔次表」不是單一值，注單要鎖整組 tiers 快照，
    //      結算時再依命中檔次取 odds。
    //   4. 複式展開（選 N 個號 → C(N, pick) 注）務必在伺端做：
    //      限額與扣款要以展開後的實際注數計算，不能信前端。
    list: [
      {
        tabId: 6000,
        tabName: '三全中',
        // 選 3 個號，3 個都必須是正碼（特別號不算命中）
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          combo: {
            pick: 3,     // 一注固定 3 個號
            minPick: 3,  // 至少選 3 個號才能組單
            maxPick: 10, // 複式上限：選 10 個號 = C(10,3) = 120 注
          },
        },
        tiers: [
          { key: 'all3', name: '三全中', odds: 890, weight: 3 }, // 0.108554%（公平 921.20 × 0.97）
        ],

        // 號碼池：連碼的注項是玩家自己組的，這裡只提供 01~49 供看板渲染與選取；
        // 單一號碼沒有賠率，賠率與爆池權重都在上方 tiers（命中檔次）
        tabGroup: [
          {
            groupName: '三全中',
            weight: 3,
            groupList: [
              { playId: '6000-001', name: '1' },
              { playId: '6000-002', name: '2' },
              { playId: '6000-003', name: '3' },
              { playId: '6000-004', name: '4' },
              { playId: '6000-005', name: '5' },
              { playId: '6000-006', name: '6' },
              { playId: '6000-007', name: '7' },
              { playId: '6000-008', name: '8' },
              { playId: '6000-009', name: '9' },
              { playId: '6000-010', name: '10' },
              { playId: '6000-011', name: '11' },
              { playId: '6000-012', name: '12' },
              { playId: '6000-013', name: '13' },
              { playId: '6000-014', name: '14' },
              { playId: '6000-015', name: '15' },
              { playId: '6000-016', name: '16' },
              { playId: '6000-017', name: '17' },
              { playId: '6000-018', name: '18' },
              { playId: '6000-019', name: '19' },
              { playId: '6000-020', name: '20' },
              { playId: '6000-021', name: '21' },
              { playId: '6000-022', name: '22' },
              { playId: '6000-023', name: '23' },
              { playId: '6000-024', name: '24' },
              { playId: '6000-025', name: '25' },
              { playId: '6000-026', name: '26' },
              { playId: '6000-027', name: '27' },
              { playId: '6000-028', name: '28' },
              { playId: '6000-029', name: '29' },
              { playId: '6000-030', name: '30' },
              { playId: '6000-031', name: '31' },
              { playId: '6000-032', name: '32' },
              { playId: '6000-033', name: '33' },
              { playId: '6000-034', name: '34' },
              { playId: '6000-035', name: '35' },
              { playId: '6000-036', name: '36' },
              { playId: '6000-037', name: '37' },
              { playId: '6000-038', name: '38' },
              { playId: '6000-039', name: '39' },
              { playId: '6000-040', name: '40' },
              { playId: '6000-041', name: '41' },
              { playId: '6000-042', name: '42' },
              { playId: '6000-043', name: '43' },
              { playId: '6000-044', name: '44' },
              { playId: '6000-045', name: '45' },
              { playId: '6000-046', name: '46' },
              { playId: '6000-047', name: '47' },
              { playId: '6000-048', name: '48' },
              { playId: '6000-049', name: '49' },
            ],
          }
        ]
      },

      {
        tabId: 6001,
        tabName: '三中二',
        // 選 3 個號：3 個都是正碼為「中三」；恰 2 個是正碼為「中二」
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 10, // C(10,3) = 120 注
          },
        },
        // ⚠️ 「2 正碼 + 特別號」各家盤口規則不同：併入中二（本檔採用，最常見）／
        //    另立一檔（機率 0.081416%、公平 1228.27）／視為不中 都有。
        //    若要另立一檔，在此加一列並把三檔的 odds 依「公平 × 0.97 / 3」重算，
        //    同時判定端要先比對它再落回 hit2。
        tiers: [
          { key: 'hit3', name: '中三', odds: 445, weight: 3 },  // 0.108554%（公平 921.20 × 0.485）
          { key: 'hit2', name: '中二', odds: 13.8, weight: 3 }, // 3.500868%（公平  28.56 × 0.485）
        ],

        // 號碼池：連碼的注項是玩家自己組的，這裡只提供 01~49 供看板渲染與選取；
        // 單一號碼沒有賠率，賠率與爆池權重都在上方 tiers（命中檔次）
        tabGroup: [
          {
            groupName: '三中二',
            weight: 3,
            groupList: [
              { playId: '6001-001', name: '1' },
              { playId: '6001-002', name: '2' },
              { playId: '6001-003', name: '3' },
              { playId: '6001-004', name: '4' },
              { playId: '6001-005', name: '5' },
              { playId: '6001-006', name: '6' },
              { playId: '6001-007', name: '7' },
              { playId: '6001-008', name: '8' },
              { playId: '6001-009', name: '9' },
              { playId: '6001-010', name: '10' },
              { playId: '6001-011', name: '11' },
              { playId: '6001-012', name: '12' },
              { playId: '6001-013', name: '13' },
              { playId: '6001-014', name: '14' },
              { playId: '6001-015', name: '15' },
              { playId: '6001-016', name: '16' },
              { playId: '6001-017', name: '17' },
              { playId: '6001-018', name: '18' },
              { playId: '6001-019', name: '19' },
              { playId: '6001-020', name: '20' },
              { playId: '6001-021', name: '21' },
              { playId: '6001-022', name: '22' },
              { playId: '6001-023', name: '23' },
              { playId: '6001-024', name: '24' },
              { playId: '6001-025', name: '25' },
              { playId: '6001-026', name: '26' },
              { playId: '6001-027', name: '27' },
              { playId: '6001-028', name: '28' },
              { playId: '6001-029', name: '29' },
              { playId: '6001-030', name: '30' },
              { playId: '6001-031', name: '31' },
              { playId: '6001-032', name: '32' },
              { playId: '6001-033', name: '33' },
              { playId: '6001-034', name: '34' },
              { playId: '6001-035', name: '35' },
              { playId: '6001-036', name: '36' },
              { playId: '6001-037', name: '37' },
              { playId: '6001-038', name: '38' },
              { playId: '6001-039', name: '39' },
              { playId: '6001-040', name: '40' },
              { playId: '6001-041', name: '41' },
              { playId: '6001-042', name: '42' },
              { playId: '6001-043', name: '43' },
              { playId: '6001-044', name: '44' },
              { playId: '6001-045', name: '45' },
              { playId: '6001-046', name: '46' },
              { playId: '6001-047', name: '47' },
              { playId: '6001-048', name: '48' },
              { playId: '6001-049', name: '49' },
            ],
          }
        ],
      },

      {
        tabId: 6002,
        tabName: '二全中',
        // 選 2 個號，2 個都必須是正碼（含特別號則不中）
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 10, // C(10,2) = 45 注
          },
        },
        tiers: [
          { key: 'all2', name: '二全中', odds: 76, weight: 3 }, // 1.275510%（公平 78.40 × 0.97）
        ],

        // 號碼池：連碼的注項是玩家自己組的，這裡只提供 01~49 供看板渲染與選取；
        // 單一號碼沒有賠率，賠率與爆池權重都在上方 tiers（命中檔次）
        tabGroup: [
          {
            groupName: '二全中',
            weight: 3,
            groupList: [
              { playId: '6002-001', name: '1' },
              { playId: '6002-002', name: '2' },
              { playId: '6002-003', name: '3' },
              { playId: '6002-004', name: '4' },
              { playId: '6002-005', name: '5' },
              { playId: '6002-006', name: '6' },
              { playId: '6002-007', name: '7' },
              { playId: '6002-008', name: '8' },
              { playId: '6002-009', name: '9' },
              { playId: '6002-010', name: '10' },
              { playId: '6002-011', name: '11' },
              { playId: '6002-012', name: '12' },
              { playId: '6002-013', name: '13' },
              { playId: '6002-014', name: '14' },
              { playId: '6002-015', name: '15' },
              { playId: '6002-016', name: '16' },
              { playId: '6002-017', name: '17' },
              { playId: '6002-018', name: '18' },
              { playId: '6002-019', name: '19' },
              { playId: '6002-020', name: '20' },
              { playId: '6002-021', name: '21' },
              { playId: '6002-022', name: '22' },
              { playId: '6002-023', name: '23' },
              { playId: '6002-024', name: '24' },
              { playId: '6002-025', name: '25' },
              { playId: '6002-026', name: '26' },
              { playId: '6002-027', name: '27' },
              { playId: '6002-028', name: '28' },
              { playId: '6002-029', name: '29' },
              { playId: '6002-030', name: '30' },
              { playId: '6002-031', name: '31' },
              { playId: '6002-032', name: '32' },
              { playId: '6002-033', name: '33' },
              { playId: '6002-034', name: '34' },
              { playId: '6002-035', name: '35' },
              { playId: '6002-036', name: '36' },
              { playId: '6002-037', name: '37' },
              { playId: '6002-038', name: '38' },
              { playId: '6002-039', name: '39' },
              { playId: '6002-040', name: '40' },
              { playId: '6002-041', name: '41' },
              { playId: '6002-042', name: '42' },
              { playId: '6002-043', name: '43' },
              { playId: '6002-044', name: '44' },
              { playId: '6002-045', name: '45' },
              { playId: '6002-046', name: '46' },
              { playId: '6002-047', name: '47' },
              { playId: '6002-048', name: '48' },
              { playId: '6002-049', name: '49' },
            ],
          }
        ],
      },

      {
        tabId: 6003,
        tabName: '二中特',
        // 選 2 個號：2 個都是正碼為「中二」；1 個正碼 + 特別號為「中特」
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 10, // C(10,2) = 45 注
          },
        },
        // 中特比中二稀有（0.51% vs 1.28%），故賠率較高
        tiers: [
          { key: 'hit2', name: '中二', odds: 38, weight: 3 }, // 1.275510%（公平  78.40 × 0.485）
          { key: 'hitT', name: '中特', odds: 95, weight: 3 }, // 0.510204%（公平 196.00 × 0.485）
        ],

        // 號碼池：連碼的注項是玩家自己組的，這裡只提供 01~49 供看板渲染與選取；
        // 單一號碼沒有賠率，賠率與爆池權重都在上方 tiers（命中檔次）
        tabGroup: [
          {
            groupName: '二中特',
            weight: 3,
            groupList: [
              { playId: '6003-001', name: '1' },
              { playId: '6003-002', name: '2' },
              { playId: '6003-003', name: '3' },
              { playId: '6003-004', name: '4' },
              { playId: '6003-005', name: '5' },
              { playId: '6003-006', name: '6' },
              { playId: '6003-007', name: '7' },
              { playId: '6003-008', name: '8' },
              { playId: '6003-009', name: '9' },
              { playId: '6003-010', name: '10' },
              { playId: '6003-011', name: '11' },
              { playId: '6003-012', name: '12' },
              { playId: '6003-013', name: '13' },
              { playId: '6003-014', name: '14' },
              { playId: '6003-015', name: '15' },
              { playId: '6003-016', name: '16' },
              { playId: '6003-017', name: '17' },
              { playId: '6003-018', name: '18' },
              { playId: '6003-019', name: '19' },
              { playId: '6003-020', name: '20' },
              { playId: '6003-021', name: '21' },
              { playId: '6003-022', name: '22' },
              { playId: '6003-023', name: '23' },
              { playId: '6003-024', name: '24' },
              { playId: '6003-025', name: '25' },
              { playId: '6003-026', name: '26' },
              { playId: '6003-027', name: '27' },
              { playId: '6003-028', name: '28' },
              { playId: '6003-029', name: '29' },
              { playId: '6003-030', name: '30' },
              { playId: '6003-031', name: '31' },
              { playId: '6003-032', name: '32' },
              { playId: '6003-033', name: '33' },
              { playId: '6003-034', name: '34' },
              { playId: '6003-035', name: '35' },
              { playId: '6003-036', name: '36' },
              { playId: '6003-037', name: '37' },
              { playId: '6003-038', name: '38' },
              { playId: '6003-039', name: '39' },
              { playId: '6003-040', name: '40' },
              { playId: '6003-041', name: '41' },
              { playId: '6003-042', name: '42' },
              { playId: '6003-043', name: '43' },
              { playId: '6003-044', name: '44' },
              { playId: '6003-045', name: '45' },
              { playId: '6003-046', name: '46' },
              { playId: '6003-047', name: '47' },
              { playId: '6003-048', name: '48' },
              { playId: '6003-049', name: '49' },
            ],
          }
        ],
      },

      {
        tabId: 6004,
        tabName: '特串',
        // 選 2 個號，必須「1 個正碼 + 1 個特別號」才中（2 個都是正碼不算）
        // 判定條件與二中特的「中特」相同，但為獨立玩法（只有這一種中法），
        // 故不需分攤預算，賠率為公平值 × 0.97
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 10, // C(10,2) = 45 注
          },
        },
        tiers: [
          { key: 'chain', name: '特串', odds: 190, weight: 3 }, // 0.510204%（公平 196.00 × 0.97）
        ],

        // 號碼池：連碼的注項是玩家自己組的，這裡只提供 01~49 供看板渲染與選取；
        // 單一號碼沒有賠率，賠率與爆池權重都在上方 tiers（命中檔次）
        tabGroup: [
          {
            groupName: '特串',
            weight: 3,
            groupList: [
              { playId: '6004-001', name: '1' },
              { playId: '6004-002', name: '2' },
              { playId: '6004-003', name: '3' },
              { playId: '6004-004', name: '4' },
              { playId: '6004-005', name: '5' },
              { playId: '6004-006', name: '6' },
              { playId: '6004-007', name: '7' },
              { playId: '6004-008', name: '8' },
              { playId: '6004-009', name: '9' },
              { playId: '6004-010', name: '10' },
              { playId: '6004-011', name: '11' },
              { playId: '6004-012', name: '12' },
              { playId: '6004-013', name: '13' },
              { playId: '6004-014', name: '14' },
              { playId: '6004-015', name: '15' },
              { playId: '6004-016', name: '16' },
              { playId: '6004-017', name: '17' },
              { playId: '6004-018', name: '18' },
              { playId: '6004-019', name: '19' },
              { playId: '6004-020', name: '20' },
              { playId: '6004-021', name: '21' },
              { playId: '6004-022', name: '22' },
              { playId: '6004-023', name: '23' },
              { playId: '6004-024', name: '24' },
              { playId: '6004-025', name: '25' },
              { playId: '6004-026', name: '26' },
              { playId: '6004-027', name: '27' },
              { playId: '6004-028', name: '28' },
              { playId: '6004-029', name: '29' },
              { playId: '6004-030', name: '30' },
              { playId: '6004-031', name: '31' },
              { playId: '6004-032', name: '32' },
              { playId: '6004-033', name: '33' },
              { playId: '6004-034', name: '34' },
              { playId: '6004-035', name: '35' },
              { playId: '6004-036', name: '36' },
              { playId: '6004-037', name: '37' },
              { playId: '6004-038', name: '38' },
              { playId: '6004-039', name: '39' },
              { playId: '6004-040', name: '40' },
              { playId: '6004-041', name: '41' },
              { playId: '6004-042', name: '42' },
              { playId: '6004-043', name: '43' },
              { playId: '6004-044', name: '44' },
              { playId: '6004-045', name: '45' },
              { playId: '6004-046', name: '46' },
              { playId: '6004-047', name: '47' },
              { playId: '6004-048', name: '48' },
              { playId: '6004-049', name: '49' },
            ],
          }
        ],
      },

    ],
  }
]
