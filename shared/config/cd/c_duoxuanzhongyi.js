export default [
  {
    name: '中一',
    key: 'duoxuanzhongyi',
    // 中一：選 N 個號，當期 7 顆球（6 正碼 + 特別號）中「至少一個」命中即中獎。
    //
    // ⚠️ 與「全不中」（c_zixuanbuzhong）是嚴格互補 —— 同樣選 N 個號，
    //    中一的機率 = 1 - 全不中的機率，兩者相加恰為 100%。
    //    也因此賠率一低一高：五選中一 1.75 對五不中 2.17。
    //
    // ⚠️ 結構同 c_lianma：tabGroup 只是號碼選取池，一注由 settings.combo.pick 個號碼組成；
    //    所有號碼機率相同，賠率不隨所選號碼變動，故寫死在 tiers（單一檔次）。
    //
    // 機率 = 1 - C(49 - N, 7) / C(49, 7)，賠率取公平值 ×0.97，不設和局。
    list: [
      {
        tabId: 17000,
        tabName: '五選中一',
        // 選 5 個號，7 顆球「至少一個」命中即中獎
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
          { key: 'any', name: '五選中一', odds: 1.75, weight: 1 }, // P = 1 - C(44,7)/C(49,7) = 55.3896%（公平 1.8054）
        ],
        tabGroup: [
          {
            groupName: '五選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 5 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17000-001', name: '1' },
              { playId: '17000-002', name: '2' },
              { playId: '17000-003', name: '3' },
              { playId: '17000-004', name: '4' },
              { playId: '17000-005', name: '5' },
              { playId: '17000-006', name: '6' },
              { playId: '17000-007', name: '7' },
              { playId: '17000-008', name: '8' },
              { playId: '17000-009', name: '9' },
              { playId: '17000-010', name: '10' },
              { playId: '17000-011', name: '11' },
              { playId: '17000-012', name: '12' },
              { playId: '17000-013', name: '13' },
              { playId: '17000-014', name: '14' },
              { playId: '17000-015', name: '15' },
              { playId: '17000-016', name: '16' },
              { playId: '17000-017', name: '17' },
              { playId: '17000-018', name: '18' },
              { playId: '17000-019', name: '19' },
              { playId: '17000-020', name: '20' },
              { playId: '17000-021', name: '21' },
              { playId: '17000-022', name: '22' },
              { playId: '17000-023', name: '23' },
              { playId: '17000-024', name: '24' },
              { playId: '17000-025', name: '25' },
              { playId: '17000-026', name: '26' },
              { playId: '17000-027', name: '27' },
              { playId: '17000-028', name: '28' },
              { playId: '17000-029', name: '29' },
              { playId: '17000-030', name: '30' },
              { playId: '17000-031', name: '31' },
              { playId: '17000-032', name: '32' },
              { playId: '17000-033', name: '33' },
              { playId: '17000-034', name: '34' },
              { playId: '17000-035', name: '35' },
              { playId: '17000-036', name: '36' },
              { playId: '17000-037', name: '37' },
              { playId: '17000-038', name: '38' },
              { playId: '17000-039', name: '39' },
              { playId: '17000-040', name: '40' },
              { playId: '17000-041', name: '41' },
              { playId: '17000-042', name: '42' },
              { playId: '17000-043', name: '43' },
              { playId: '17000-044', name: '44' },
              { playId: '17000-045', name: '45' },
              { playId: '17000-046', name: '46' },
              { playId: '17000-047', name: '47' },
              { playId: '17000-048', name: '48' },
              { playId: '17000-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 17001,
        tabName: '六選中一',
        // 選 6 個號，7 顆球「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 6 個號，最多可選 8 個組複式（C(8,6) = 28 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 6,
            minPick: 6,
            maxPick: 8,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '六選中一', odds: 1.55, weight: 1 }, // P = 1 - C(43,7)/C(49,7) = 62.4867%（公平 1.6003）
        ],
        tabGroup: [
          {
            groupName: '六選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 6 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17001-001', name: '1' },
              { playId: '17001-002', name: '2' },
              { playId: '17001-003', name: '3' },
              { playId: '17001-004', name: '4' },
              { playId: '17001-005', name: '5' },
              { playId: '17001-006', name: '6' },
              { playId: '17001-007', name: '7' },
              { playId: '17001-008', name: '8' },
              { playId: '17001-009', name: '9' },
              { playId: '17001-010', name: '10' },
              { playId: '17001-011', name: '11' },
              { playId: '17001-012', name: '12' },
              { playId: '17001-013', name: '13' },
              { playId: '17001-014', name: '14' },
              { playId: '17001-015', name: '15' },
              { playId: '17001-016', name: '16' },
              { playId: '17001-017', name: '17' },
              { playId: '17001-018', name: '18' },
              { playId: '17001-019', name: '19' },
              { playId: '17001-020', name: '20' },
              { playId: '17001-021', name: '21' },
              { playId: '17001-022', name: '22' },
              { playId: '17001-023', name: '23' },
              { playId: '17001-024', name: '24' },
              { playId: '17001-025', name: '25' },
              { playId: '17001-026', name: '26' },
              { playId: '17001-027', name: '27' },
              { playId: '17001-028', name: '28' },
              { playId: '17001-029', name: '29' },
              { playId: '17001-030', name: '30' },
              { playId: '17001-031', name: '31' },
              { playId: '17001-032', name: '32' },
              { playId: '17001-033', name: '33' },
              { playId: '17001-034', name: '34' },
              { playId: '17001-035', name: '35' },
              { playId: '17001-036', name: '36' },
              { playId: '17001-037', name: '37' },
              { playId: '17001-038', name: '38' },
              { playId: '17001-039', name: '39' },
              { playId: '17001-040', name: '40' },
              { playId: '17001-041', name: '41' },
              { playId: '17001-042', name: '42' },
              { playId: '17001-043', name: '43' },
              { playId: '17001-044', name: '44' },
              { playId: '17001-045', name: '45' },
              { playId: '17001-046', name: '46' },
              { playId: '17001-047', name: '47' },
              { playId: '17001-048', name: '48' },
              { playId: '17001-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 17002,
        tabName: '七選中一',
        // 選 7 個號，7 顆球「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 7 個號，最多可選 9 個組複式（C(9,7) = 36 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 7,
            minPick: 7,
            maxPick: 9,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '七選中一', odds: 1.41, weight: 1 }, // P = 1 - C(42,7)/C(49,7) = 68.5935%（公平 1.4579）
        ],
        tabGroup: [
          {
            groupName: '七選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 7 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17002-001', name: '1' },
              { playId: '17002-002', name: '2' },
              { playId: '17002-003', name: '3' },
              { playId: '17002-004', name: '4' },
              { playId: '17002-005', name: '5' },
              { playId: '17002-006', name: '6' },
              { playId: '17002-007', name: '7' },
              { playId: '17002-008', name: '8' },
              { playId: '17002-009', name: '9' },
              { playId: '17002-010', name: '10' },
              { playId: '17002-011', name: '11' },
              { playId: '17002-012', name: '12' },
              { playId: '17002-013', name: '13' },
              { playId: '17002-014', name: '14' },
              { playId: '17002-015', name: '15' },
              { playId: '17002-016', name: '16' },
              { playId: '17002-017', name: '17' },
              { playId: '17002-018', name: '18' },
              { playId: '17002-019', name: '19' },
              { playId: '17002-020', name: '20' },
              { playId: '17002-021', name: '21' },
              { playId: '17002-022', name: '22' },
              { playId: '17002-023', name: '23' },
              { playId: '17002-024', name: '24' },
              { playId: '17002-025', name: '25' },
              { playId: '17002-026', name: '26' },
              { playId: '17002-027', name: '27' },
              { playId: '17002-028', name: '28' },
              { playId: '17002-029', name: '29' },
              { playId: '17002-030', name: '30' },
              { playId: '17002-031', name: '31' },
              { playId: '17002-032', name: '32' },
              { playId: '17002-033', name: '33' },
              { playId: '17002-034', name: '34' },
              { playId: '17002-035', name: '35' },
              { playId: '17002-036', name: '36' },
              { playId: '17002-037', name: '37' },
              { playId: '17002-038', name: '38' },
              { playId: '17002-039', name: '39' },
              { playId: '17002-040', name: '40' },
              { playId: '17002-041', name: '41' },
              { playId: '17002-042', name: '42' },
              { playId: '17002-043', name: '43' },
              { playId: '17002-044', name: '44' },
              { playId: '17002-045', name: '45' },
              { playId: '17002-046', name: '46' },
              { playId: '17002-047', name: '47' },
              { playId: '17002-048', name: '48' },
              { playId: '17002-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 17003,
        tabName: '八選中一',
        // 選 8 個號，7 顆球「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 8 個號，最多可選 10 個組複式（C(10,8) = 45 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 8,
            minPick: 8,
            maxPick: 10,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '八選中一', odds: 1.31, weight: 1 }, // P = 1 - C(41,7)/C(49,7) = 73.8280%（公平 1.3545）
        ],
        tabGroup: [
          {
            groupName: '八選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 8 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17003-001', name: '1' },
              { playId: '17003-002', name: '2' },
              { playId: '17003-003', name: '3' },
              { playId: '17003-004', name: '4' },
              { playId: '17003-005', name: '5' },
              { playId: '17003-006', name: '6' },
              { playId: '17003-007', name: '7' },
              { playId: '17003-008', name: '8' },
              { playId: '17003-009', name: '9' },
              { playId: '17003-010', name: '10' },
              { playId: '17003-011', name: '11' },
              { playId: '17003-012', name: '12' },
              { playId: '17003-013', name: '13' },
              { playId: '17003-014', name: '14' },
              { playId: '17003-015', name: '15' },
              { playId: '17003-016', name: '16' },
              { playId: '17003-017', name: '17' },
              { playId: '17003-018', name: '18' },
              { playId: '17003-019', name: '19' },
              { playId: '17003-020', name: '20' },
              { playId: '17003-021', name: '21' },
              { playId: '17003-022', name: '22' },
              { playId: '17003-023', name: '23' },
              { playId: '17003-024', name: '24' },
              { playId: '17003-025', name: '25' },
              { playId: '17003-026', name: '26' },
              { playId: '17003-027', name: '27' },
              { playId: '17003-028', name: '28' },
              { playId: '17003-029', name: '29' },
              { playId: '17003-030', name: '30' },
              { playId: '17003-031', name: '31' },
              { playId: '17003-032', name: '32' },
              { playId: '17003-033', name: '33' },
              { playId: '17003-034', name: '34' },
              { playId: '17003-035', name: '35' },
              { playId: '17003-036', name: '36' },
              { playId: '17003-037', name: '37' },
              { playId: '17003-038', name: '38' },
              { playId: '17003-039', name: '39' },
              { playId: '17003-040', name: '40' },
              { playId: '17003-041', name: '41' },
              { playId: '17003-042', name: '42' },
              { playId: '17003-043', name: '43' },
              { playId: '17003-044', name: '44' },
              { playId: '17003-045', name: '45' },
              { playId: '17003-046', name: '46' },
              { playId: '17003-047', name: '47' },
              { playId: '17003-048', name: '48' },
              { playId: '17003-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 17004,
        tabName: '九選中一',
        // 選 9 個號，7 顆球「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 9 個號，最多可選 11 個組複式（C(11,9) = 55 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 9,
            minPick: 9,
            maxPick: 11,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '九選中一', odds: 1.24, weight: 1 }, // P = 1 - C(40,7)/C(49,7) = 78.2964%（公平 1.2772）
        ],
        tabGroup: [
          {
            groupName: '九選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 9 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17004-001', name: '1' },
              { playId: '17004-002', name: '2' },
              { playId: '17004-003', name: '3' },
              { playId: '17004-004', name: '4' },
              { playId: '17004-005', name: '5' },
              { playId: '17004-006', name: '6' },
              { playId: '17004-007', name: '7' },
              { playId: '17004-008', name: '8' },
              { playId: '17004-009', name: '9' },
              { playId: '17004-010', name: '10' },
              { playId: '17004-011', name: '11' },
              { playId: '17004-012', name: '12' },
              { playId: '17004-013', name: '13' },
              { playId: '17004-014', name: '14' },
              { playId: '17004-015', name: '15' },
              { playId: '17004-016', name: '16' },
              { playId: '17004-017', name: '17' },
              { playId: '17004-018', name: '18' },
              { playId: '17004-019', name: '19' },
              { playId: '17004-020', name: '20' },
              { playId: '17004-021', name: '21' },
              { playId: '17004-022', name: '22' },
              { playId: '17004-023', name: '23' },
              { playId: '17004-024', name: '24' },
              { playId: '17004-025', name: '25' },
              { playId: '17004-026', name: '26' },
              { playId: '17004-027', name: '27' },
              { playId: '17004-028', name: '28' },
              { playId: '17004-029', name: '29' },
              { playId: '17004-030', name: '30' },
              { playId: '17004-031', name: '31' },
              { playId: '17004-032', name: '32' },
              { playId: '17004-033', name: '33' },
              { playId: '17004-034', name: '34' },
              { playId: '17004-035', name: '35' },
              { playId: '17004-036', name: '36' },
              { playId: '17004-037', name: '37' },
              { playId: '17004-038', name: '38' },
              { playId: '17004-039', name: '39' },
              { playId: '17004-040', name: '40' },
              { playId: '17004-041', name: '41' },
              { playId: '17004-042', name: '42' },
              { playId: '17004-043', name: '43' },
              { playId: '17004-044', name: '44' },
              { playId: '17004-045', name: '45' },
              { playId: '17004-046', name: '46' },
              { playId: '17004-047', name: '47' },
              { playId: '17004-048', name: '48' },
              { playId: '17004-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 17005,
        tabName: '十選中一',
        // 選 10 個號，7 顆球「至少一個」命中即中獎
        settings: {
          quota: {
            item: { // 單注投注額
              max: 1000,
            },
            issue: { // 單期投注額
              max: 1000000,
            },
          },
          // 選號規格：一注固定 10 個號，最多可選 12 個組複式（C(12,10) = 66 注）
          // 命中方向：hit = 所選號碼「至少一個」命中即中
          match: 'hit',
          combo: {
            pick: 10,
            minPick: 10,
            maxPick: 12,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'any', name: '十選中一', odds: 1.18, weight: 1 }, // P = 1 - C(39,7)/C(49,7) = 82.0945%（公平 1.2181）
        ],
        tabGroup: [
          {
            groupName: '十選中一',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 10 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '17005-001', name: '1' },
              { playId: '17005-002', name: '2' },
              { playId: '17005-003', name: '3' },
              { playId: '17005-004', name: '4' },
              { playId: '17005-005', name: '5' },
              { playId: '17005-006', name: '6' },
              { playId: '17005-007', name: '7' },
              { playId: '17005-008', name: '8' },
              { playId: '17005-009', name: '9' },
              { playId: '17005-010', name: '10' },
              { playId: '17005-011', name: '11' },
              { playId: '17005-012', name: '12' },
              { playId: '17005-013', name: '13' },
              { playId: '17005-014', name: '14' },
              { playId: '17005-015', name: '15' },
              { playId: '17005-016', name: '16' },
              { playId: '17005-017', name: '17' },
              { playId: '17005-018', name: '18' },
              { playId: '17005-019', name: '19' },
              { playId: '17005-020', name: '20' },
              { playId: '17005-021', name: '21' },
              { playId: '17005-022', name: '22' },
              { playId: '17005-023', name: '23' },
              { playId: '17005-024', name: '24' },
              { playId: '17005-025', name: '25' },
              { playId: '17005-026', name: '26' },
              { playId: '17005-027', name: '27' },
              { playId: '17005-028', name: '28' },
              { playId: '17005-029', name: '29' },
              { playId: '17005-030', name: '30' },
              { playId: '17005-031', name: '31' },
              { playId: '17005-032', name: '32' },
              { playId: '17005-033', name: '33' },
              { playId: '17005-034', name: '34' },
              { playId: '17005-035', name: '35' },
              { playId: '17005-036', name: '36' },
              { playId: '17005-037', name: '37' },
              { playId: '17005-038', name: '38' },
              { playId: '17005-039', name: '39' },
              { playId: '17005-040', name: '40' },
              { playId: '17005-041', name: '41' },
              { playId: '17005-042', name: '42' },
              { playId: '17005-043', name: '43' },
              { playId: '17005-044', name: '44' },
              { playId: '17005-045', name: '45' },
              { playId: '17005-046', name: '46' },
              { playId: '17005-047', name: '47' },
              { playId: '17005-048', name: '48' },
              { playId: '17005-049', name: '49' },
            ],
          },
        ],
      },
    ],
  },
]
