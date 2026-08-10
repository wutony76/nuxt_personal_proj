export default [
  {
    name: '特平中',
    key: 'zhengterenzhong',
    // 特平中（N 粒任中）：選 N 個號，當期 7 顆球中「至少一個」命中即中獎。
    // 「特平」= 特碼 + 平碼（正碼），意即 7 顆球都算，不分正碼或特別號。
    //
    // ⚠️ 與「中一」（c_duoxuanzhongyi）判定完全相同，只是選號數的範圍不同
    //    （本玩法 1 ~ 5 個號、中一 5 ~ 10 個號），因此
    //    「五粒任中」與「五選中一」機率與賠率完全一致（皆 1.75）。
    //    若營運上不打算提供重複的玩法，需決定移除其中一個或改用不同賠率 —— 見下方待確認。
    //
    // ⚠️ 結構同 c_lianma：tabGroup 只是號碼選取池，一注由 settings.combo.pick 個號碼組成；
    //    所有號碼機率相同，賠率不隨所選號碼變動，故寫死在 tiers（單一檔次）。
    //
    // 機率 = 1 - C(49 - N, 7) / C(49, 7)，賠率取公平值 ×0.97，不設和局。
    list: [
      {
        tabId: 18000,
        tabName: '一粒任中',
        // 選 1 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 1 個號，最多可選 3 個組複式（C(3,1) = 3 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 1,
            minPick: 1,
            maxPick: 3,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '一粒任中', odds: 6.79, weight: 2 }, // P = 1 - C(48,7)/C(49,7) = 14.2857%（公平 7.0000）
        ],
        tabGroup: [
          {
            groupName: '一粒任中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 1 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '18000-001', name: '01' },
              { playId: '18000-002', name: '02' },
              { playId: '18000-003', name: '03' },
              { playId: '18000-004', name: '04' },
              { playId: '18000-005', name: '05' },
              { playId: '18000-006', name: '06' },
              { playId: '18000-007', name: '07' },
              { playId: '18000-008', name: '08' },
              { playId: '18000-009', name: '09' },
              { playId: '18000-010', name: '10' },
              { playId: '18000-011', name: '11' },
              { playId: '18000-012', name: '12' },
              { playId: '18000-013', name: '13' },
              { playId: '18000-014', name: '14' },
              { playId: '18000-015', name: '15' },
              { playId: '18000-016', name: '16' },
              { playId: '18000-017', name: '17' },
              { playId: '18000-018', name: '18' },
              { playId: '18000-019', name: '19' },
              { playId: '18000-020', name: '20' },
              { playId: '18000-021', name: '21' },
              { playId: '18000-022', name: '22' },
              { playId: '18000-023', name: '23' },
              { playId: '18000-024', name: '24' },
              { playId: '18000-025', name: '25' },
              { playId: '18000-026', name: '26' },
              { playId: '18000-027', name: '27' },
              { playId: '18000-028', name: '28' },
              { playId: '18000-029', name: '29' },
              { playId: '18000-030', name: '30' },
              { playId: '18000-031', name: '31' },
              { playId: '18000-032', name: '32' },
              { playId: '18000-033', name: '33' },
              { playId: '18000-034', name: '34' },
              { playId: '18000-035', name: '35' },
              { playId: '18000-036', name: '36' },
              { playId: '18000-037', name: '37' },
              { playId: '18000-038', name: '38' },
              { playId: '18000-039', name: '39' },
              { playId: '18000-040', name: '40' },
              { playId: '18000-041', name: '41' },
              { playId: '18000-042', name: '42' },
              { playId: '18000-043', name: '43' },
              { playId: '18000-044', name: '44' },
              { playId: '18000-045', name: '45' },
              { playId: '18000-046', name: '46' },
              { playId: '18000-047', name: '47' },
              { playId: '18000-048', name: '48' },
              { playId: '18000-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 18001,
        tabName: '二粒任中',
        // 選 2 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 2 個號，最多可選 4 個組複式（C(4,2) = 6 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 2,
            minPick: 2,
            maxPick: 4,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '二粒任中', odds: 3.62, weight: 2 }, // P = 1 - C(47,7)/C(49,7) = 26.7857%（公平 3.7333）
        ],
        tabGroup: [
          {
            groupName: '二粒任中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 2 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '18001-001', name: '01' },
              { playId: '18001-002', name: '02' },
              { playId: '18001-003', name: '03' },
              { playId: '18001-004', name: '04' },
              { playId: '18001-005', name: '05' },
              { playId: '18001-006', name: '06' },
              { playId: '18001-007', name: '07' },
              { playId: '18001-008', name: '08' },
              { playId: '18001-009', name: '09' },
              { playId: '18001-010', name: '10' },
              { playId: '18001-011', name: '11' },
              { playId: '18001-012', name: '12' },
              { playId: '18001-013', name: '13' },
              { playId: '18001-014', name: '14' },
              { playId: '18001-015', name: '15' },
              { playId: '18001-016', name: '16' },
              { playId: '18001-017', name: '17' },
              { playId: '18001-018', name: '18' },
              { playId: '18001-019', name: '19' },
              { playId: '18001-020', name: '20' },
              { playId: '18001-021', name: '21' },
              { playId: '18001-022', name: '22' },
              { playId: '18001-023', name: '23' },
              { playId: '18001-024', name: '24' },
              { playId: '18001-025', name: '25' },
              { playId: '18001-026', name: '26' },
              { playId: '18001-027', name: '27' },
              { playId: '18001-028', name: '28' },
              { playId: '18001-029', name: '29' },
              { playId: '18001-030', name: '30' },
              { playId: '18001-031', name: '31' },
              { playId: '18001-032', name: '32' },
              { playId: '18001-033', name: '33' },
              { playId: '18001-034', name: '34' },
              { playId: '18001-035', name: '35' },
              { playId: '18001-036', name: '36' },
              { playId: '18001-037', name: '37' },
              { playId: '18001-038', name: '38' },
              { playId: '18001-039', name: '39' },
              { playId: '18001-040', name: '40' },
              { playId: '18001-041', name: '41' },
              { playId: '18001-042', name: '42' },
              { playId: '18001-043', name: '43' },
              { playId: '18001-044', name: '44' },
              { playId: '18001-045', name: '45' },
              { playId: '18001-046', name: '46' },
              { playId: '18001-047', name: '47' },
              { playId: '18001-048', name: '48' },
              { playId: '18001-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 18002,
        tabName: '三粒任中',
        // 選 3 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 3 個號，最多可選 5 個組複式（C(5,3) = 10 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 3,
            minPick: 3,
            maxPick: 5,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '三粒任中', odds: 2.57, weight: 2 }, // P = 1 - C(46,7)/C(49,7) = 37.6900%（公平 2.6532）
        ],
        tabGroup: [
          {
            groupName: '三粒任中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 3 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '18002-001', name: '01' },
              { playId: '18002-002', name: '02' },
              { playId: '18002-003', name: '03' },
              { playId: '18002-004', name: '04' },
              { playId: '18002-005', name: '05' },
              { playId: '18002-006', name: '06' },
              { playId: '18002-007', name: '07' },
              { playId: '18002-008', name: '08' },
              { playId: '18002-009', name: '09' },
              { playId: '18002-010', name: '10' },
              { playId: '18002-011', name: '11' },
              { playId: '18002-012', name: '12' },
              { playId: '18002-013', name: '13' },
              { playId: '18002-014', name: '14' },
              { playId: '18002-015', name: '15' },
              { playId: '18002-016', name: '16' },
              { playId: '18002-017', name: '17' },
              { playId: '18002-018', name: '18' },
              { playId: '18002-019', name: '19' },
              { playId: '18002-020', name: '20' },
              { playId: '18002-021', name: '21' },
              { playId: '18002-022', name: '22' },
              { playId: '18002-023', name: '23' },
              { playId: '18002-024', name: '24' },
              { playId: '18002-025', name: '25' },
              { playId: '18002-026', name: '26' },
              { playId: '18002-027', name: '27' },
              { playId: '18002-028', name: '28' },
              { playId: '18002-029', name: '29' },
              { playId: '18002-030', name: '30' },
              { playId: '18002-031', name: '31' },
              { playId: '18002-032', name: '32' },
              { playId: '18002-033', name: '33' },
              { playId: '18002-034', name: '34' },
              { playId: '18002-035', name: '35' },
              { playId: '18002-036', name: '36' },
              { playId: '18002-037', name: '37' },
              { playId: '18002-038', name: '38' },
              { playId: '18002-039', name: '39' },
              { playId: '18002-040', name: '40' },
              { playId: '18002-041', name: '41' },
              { playId: '18002-042', name: '42' },
              { playId: '18002-043', name: '43' },
              { playId: '18002-044', name: '44' },
              { playId: '18002-045', name: '45' },
              { playId: '18002-046', name: '46' },
              { playId: '18002-047', name: '47' },
              { playId: '18002-048', name: '48' },
              { playId: '18002-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 18003,
        tabName: '四粒任中',
        // 選 4 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 4 個號，最多可選 6 個組複式（C(6,4) = 15 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 4,
            minPick: 4,
            maxPick: 6,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '四粒任中', odds: 2.06, weight: 1 }, // P = 1 - C(45,7)/C(49,7) = 47.1719%（公平 2.1199）
        ],
        tabGroup: [
          {
            groupName: '四粒任中',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 4 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '18003-001', name: '01' },
              { playId: '18003-002', name: '02' },
              { playId: '18003-003', name: '03' },
              { playId: '18003-004', name: '04' },
              { playId: '18003-005', name: '05' },
              { playId: '18003-006', name: '06' },
              { playId: '18003-007', name: '07' },
              { playId: '18003-008', name: '08' },
              { playId: '18003-009', name: '09' },
              { playId: '18003-010', name: '10' },
              { playId: '18003-011', name: '11' },
              { playId: '18003-012', name: '12' },
              { playId: '18003-013', name: '13' },
              { playId: '18003-014', name: '14' },
              { playId: '18003-015', name: '15' },
              { playId: '18003-016', name: '16' },
              { playId: '18003-017', name: '17' },
              { playId: '18003-018', name: '18' },
              { playId: '18003-019', name: '19' },
              { playId: '18003-020', name: '20' },
              { playId: '18003-021', name: '21' },
              { playId: '18003-022', name: '22' },
              { playId: '18003-023', name: '23' },
              { playId: '18003-024', name: '24' },
              { playId: '18003-025', name: '25' },
              { playId: '18003-026', name: '26' },
              { playId: '18003-027', name: '27' },
              { playId: '18003-028', name: '28' },
              { playId: '18003-029', name: '29' },
              { playId: '18003-030', name: '30' },
              { playId: '18003-031', name: '31' },
              { playId: '18003-032', name: '32' },
              { playId: '18003-033', name: '33' },
              { playId: '18003-034', name: '34' },
              { playId: '18003-035', name: '35' },
              { playId: '18003-036', name: '36' },
              { playId: '18003-037', name: '37' },
              { playId: '18003-038', name: '38' },
              { playId: '18003-039', name: '39' },
              { playId: '18003-040', name: '40' },
              { playId: '18003-041', name: '41' },
              { playId: '18003-042', name: '42' },
              { playId: '18003-043', name: '43' },
              { playId: '18003-044', name: '44' },
              { playId: '18003-045', name: '45' },
              { playId: '18003-046', name: '46' },
              { playId: '18003-047', name: '47' },
              { playId: '18003-048', name: '48' },
              { playId: '18003-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 18004,
        tabName: '五粒任中',
        // 選 5 個號，7 顆球（正碼或特別號皆算）「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 5 個號，最多可選 7 個組複式（C(7,5) = 21 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 5,
            minPick: 5,
            maxPick: 7,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '五粒任中', odds: 1.75, weight: 1 }, // P = 1 - C(44,7)/C(49,7) = 55.3896%（公平 1.8054）
        ],
        tabGroup: [
          {
            groupName: '五粒任中',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 5 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '18004-001', name: '01' },
              { playId: '18004-002', name: '02' },
              { playId: '18004-003', name: '03' },
              { playId: '18004-004', name: '04' },
              { playId: '18004-005', name: '05' },
              { playId: '18004-006', name: '06' },
              { playId: '18004-007', name: '07' },
              { playId: '18004-008', name: '08' },
              { playId: '18004-009', name: '09' },
              { playId: '18004-010', name: '10' },
              { playId: '18004-011', name: '11' },
              { playId: '18004-012', name: '12' },
              { playId: '18004-013', name: '13' },
              { playId: '18004-014', name: '14' },
              { playId: '18004-015', name: '15' },
              { playId: '18004-016', name: '16' },
              { playId: '18004-017', name: '17' },
              { playId: '18004-018', name: '18' },
              { playId: '18004-019', name: '19' },
              { playId: '18004-020', name: '20' },
              { playId: '18004-021', name: '21' },
              { playId: '18004-022', name: '22' },
              { playId: '18004-023', name: '23' },
              { playId: '18004-024', name: '24' },
              { playId: '18004-025', name: '25' },
              { playId: '18004-026', name: '26' },
              { playId: '18004-027', name: '27' },
              { playId: '18004-028', name: '28' },
              { playId: '18004-029', name: '29' },
              { playId: '18004-030', name: '30' },
              { playId: '18004-031', name: '31' },
              { playId: '18004-032', name: '32' },
              { playId: '18004-033', name: '33' },
              { playId: '18004-034', name: '34' },
              { playId: '18004-035', name: '35' },
              { playId: '18004-036', name: '36' },
              { playId: '18004-037', name: '37' },
              { playId: '18004-038', name: '38' },
              { playId: '18004-039', name: '39' },
              { playId: '18004-040', name: '40' },
              { playId: '18004-041', name: '41' },
              { playId: '18004-042', name: '42' },
              { playId: '18004-043', name: '43' },
              { playId: '18004-044', name: '44' },
              { playId: '18004-045', name: '45' },
              { playId: '18004-046', name: '46' },
              { playId: '18004-047', name: '47' },
              { playId: '18004-048', name: '48' },
              { playId: '18004-049', name: '49' },
            ],
          },
        ],
      },
    ],
  },
]
