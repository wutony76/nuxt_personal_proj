export default [
  {
    name: '全不中',
    key: 'zixuanbuzhong',
    // 全不中：選 N 個號，當期 7 顆球（6 正碼 + 特別號）「一個都沒有」命中才中獎。
    //
    // ⚠️ 結構與 c_lianma / c_lianxiao 同類：注項是玩家組出來的（C(49,N) 種），不可列舉，
    //    所以 tabGroup 只是「號碼選取池」，實際一注由 settings.combo.pick 個號碼組成。
    //    但與連肖不同 —— 所有號碼的機率完全相同，賠率不隨所選號碼變動，
    //    故賠率可寫死在 tiers（單一檔次）而不需要 rtp 逐注推算。
    //
    // 機率 = C(49 - N, 7) / C(49, 7)（把 N 個號排除後仍能開出 7 顆的組合數比例）
    // ⚠️ 「全不中」與「中一」（c_duoxuanzhongyi）是嚴格互補：
    //    同樣選 N 個號，一個都沒中 vs 至少一個中，兩者機率相加恰為 100%。
    // 賠率取公平值 ×0.97，不設和局。
    list: [
      {
        tabId: 16000,
        tabName: '五不中',
        // 選 5 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 5,
            minPick: 5,
            maxPick: 7,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '五不中', odds: 2.17, weight: 1 }, // P = C(44,7)/C(49,7) = 44.6104%（公平 2.2416）
        ],
        tabGroup: [
          {
            groupName: '五不中',
            weight: 1,
            // 號碼池：注項由玩家自己組（選 5 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16000-001', name: '01' },
              { playId: '16000-002', name: '02' },
              { playId: '16000-003', name: '03' },
              { playId: '16000-004', name: '04' },
              { playId: '16000-005', name: '05' },
              { playId: '16000-006', name: '06' },
              { playId: '16000-007', name: '07' },
              { playId: '16000-008', name: '08' },
              { playId: '16000-009', name: '09' },
              { playId: '16000-010', name: '10' },
              { playId: '16000-011', name: '11' },
              { playId: '16000-012', name: '12' },
              { playId: '16000-013', name: '13' },
              { playId: '16000-014', name: '14' },
              { playId: '16000-015', name: '15' },
              { playId: '16000-016', name: '16' },
              { playId: '16000-017', name: '17' },
              { playId: '16000-018', name: '18' },
              { playId: '16000-019', name: '19' },
              { playId: '16000-020', name: '20' },
              { playId: '16000-021', name: '21' },
              { playId: '16000-022', name: '22' },
              { playId: '16000-023', name: '23' },
              { playId: '16000-024', name: '24' },
              { playId: '16000-025', name: '25' },
              { playId: '16000-026', name: '26' },
              { playId: '16000-027', name: '27' },
              { playId: '16000-028', name: '28' },
              { playId: '16000-029', name: '29' },
              { playId: '16000-030', name: '30' },
              { playId: '16000-031', name: '31' },
              { playId: '16000-032', name: '32' },
              { playId: '16000-033', name: '33' },
              { playId: '16000-034', name: '34' },
              { playId: '16000-035', name: '35' },
              { playId: '16000-036', name: '36' },
              { playId: '16000-037', name: '37' },
              { playId: '16000-038', name: '38' },
              { playId: '16000-039', name: '39' },
              { playId: '16000-040', name: '40' },
              { playId: '16000-041', name: '41' },
              { playId: '16000-042', name: '42' },
              { playId: '16000-043', name: '43' },
              { playId: '16000-044', name: '44' },
              { playId: '16000-045', name: '45' },
              { playId: '16000-046', name: '46' },
              { playId: '16000-047', name: '47' },
              { playId: '16000-048', name: '48' },
              { playId: '16000-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 16001,
        tabName: '六不中',
        // 選 6 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 6,
            minPick: 6,
            maxPick: 8,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '六不中', odds: 2.59, weight: 2 }, // P = C(43,7)/C(49,7) = 37.5133%（公平 2.6657）
        ],
        tabGroup: [
          {
            groupName: '六不中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 6 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16001-001', name: '01' },
              { playId: '16001-002', name: '02' },
              { playId: '16001-003', name: '03' },
              { playId: '16001-004', name: '04' },
              { playId: '16001-005', name: '05' },
              { playId: '16001-006', name: '06' },
              { playId: '16001-007', name: '07' },
              { playId: '16001-008', name: '08' },
              { playId: '16001-009', name: '09' },
              { playId: '16001-010', name: '10' },
              { playId: '16001-011', name: '11' },
              { playId: '16001-012', name: '12' },
              { playId: '16001-013', name: '13' },
              { playId: '16001-014', name: '14' },
              { playId: '16001-015', name: '15' },
              { playId: '16001-016', name: '16' },
              { playId: '16001-017', name: '17' },
              { playId: '16001-018', name: '18' },
              { playId: '16001-019', name: '19' },
              { playId: '16001-020', name: '20' },
              { playId: '16001-021', name: '21' },
              { playId: '16001-022', name: '22' },
              { playId: '16001-023', name: '23' },
              { playId: '16001-024', name: '24' },
              { playId: '16001-025', name: '25' },
              { playId: '16001-026', name: '26' },
              { playId: '16001-027', name: '27' },
              { playId: '16001-028', name: '28' },
              { playId: '16001-029', name: '29' },
              { playId: '16001-030', name: '30' },
              { playId: '16001-031', name: '31' },
              { playId: '16001-032', name: '32' },
              { playId: '16001-033', name: '33' },
              { playId: '16001-034', name: '34' },
              { playId: '16001-035', name: '35' },
              { playId: '16001-036', name: '36' },
              { playId: '16001-037', name: '37' },
              { playId: '16001-038', name: '38' },
              { playId: '16001-039', name: '39' },
              { playId: '16001-040', name: '40' },
              { playId: '16001-041', name: '41' },
              { playId: '16001-042', name: '42' },
              { playId: '16001-043', name: '43' },
              { playId: '16001-044', name: '44' },
              { playId: '16001-045', name: '45' },
              { playId: '16001-046', name: '46' },
              { playId: '16001-047', name: '47' },
              { playId: '16001-048', name: '48' },
              { playId: '16001-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 16002,
        tabName: '七不中',
        // 選 7 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 7,
            minPick: 7,
            maxPick: 9,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '七不中', odds: 3.09, weight: 2 }, // P = C(42,7)/C(49,7) = 31.4065%（公平 3.1841）
        ],
        tabGroup: [
          {
            groupName: '七不中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 7 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16002-001', name: '01' },
              { playId: '16002-002', name: '02' },
              { playId: '16002-003', name: '03' },
              { playId: '16002-004', name: '04' },
              { playId: '16002-005', name: '05' },
              { playId: '16002-006', name: '06' },
              { playId: '16002-007', name: '07' },
              { playId: '16002-008', name: '08' },
              { playId: '16002-009', name: '09' },
              { playId: '16002-010', name: '10' },
              { playId: '16002-011', name: '11' },
              { playId: '16002-012', name: '12' },
              { playId: '16002-013', name: '13' },
              { playId: '16002-014', name: '14' },
              { playId: '16002-015', name: '15' },
              { playId: '16002-016', name: '16' },
              { playId: '16002-017', name: '17' },
              { playId: '16002-018', name: '18' },
              { playId: '16002-019', name: '19' },
              { playId: '16002-020', name: '20' },
              { playId: '16002-021', name: '21' },
              { playId: '16002-022', name: '22' },
              { playId: '16002-023', name: '23' },
              { playId: '16002-024', name: '24' },
              { playId: '16002-025', name: '25' },
              { playId: '16002-026', name: '26' },
              { playId: '16002-027', name: '27' },
              { playId: '16002-028', name: '28' },
              { playId: '16002-029', name: '29' },
              { playId: '16002-030', name: '30' },
              { playId: '16002-031', name: '31' },
              { playId: '16002-032', name: '32' },
              { playId: '16002-033', name: '33' },
              { playId: '16002-034', name: '34' },
              { playId: '16002-035', name: '35' },
              { playId: '16002-036', name: '36' },
              { playId: '16002-037', name: '37' },
              { playId: '16002-038', name: '38' },
              { playId: '16002-039', name: '39' },
              { playId: '16002-040', name: '40' },
              { playId: '16002-041', name: '41' },
              { playId: '16002-042', name: '42' },
              { playId: '16002-043', name: '43' },
              { playId: '16002-044', name: '44' },
              { playId: '16002-045', name: '45' },
              { playId: '16002-046', name: '46' },
              { playId: '16002-047', name: '47' },
              { playId: '16002-048', name: '48' },
              { playId: '16002-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 16003,
        tabName: '八不中',
        // 選 8 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 8,
            minPick: 8,
            maxPick: 10,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '八不中', odds: 3.71, weight: 2 }, // P = C(41,7)/C(49,7) = 26.1720%（公平 3.8209）
        ],
        tabGroup: [
          {
            groupName: '八不中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 8 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16003-001', name: '01' },
              { playId: '16003-002', name: '02' },
              { playId: '16003-003', name: '03' },
              { playId: '16003-004', name: '04' },
              { playId: '16003-005', name: '05' },
              { playId: '16003-006', name: '06' },
              { playId: '16003-007', name: '07' },
              { playId: '16003-008', name: '08' },
              { playId: '16003-009', name: '09' },
              { playId: '16003-010', name: '10' },
              { playId: '16003-011', name: '11' },
              { playId: '16003-012', name: '12' },
              { playId: '16003-013', name: '13' },
              { playId: '16003-014', name: '14' },
              { playId: '16003-015', name: '15' },
              { playId: '16003-016', name: '16' },
              { playId: '16003-017', name: '17' },
              { playId: '16003-018', name: '18' },
              { playId: '16003-019', name: '19' },
              { playId: '16003-020', name: '20' },
              { playId: '16003-021', name: '21' },
              { playId: '16003-022', name: '22' },
              { playId: '16003-023', name: '23' },
              { playId: '16003-024', name: '24' },
              { playId: '16003-025', name: '25' },
              { playId: '16003-026', name: '26' },
              { playId: '16003-027', name: '27' },
              { playId: '16003-028', name: '28' },
              { playId: '16003-029', name: '29' },
              { playId: '16003-030', name: '30' },
              { playId: '16003-031', name: '31' },
              { playId: '16003-032', name: '32' },
              { playId: '16003-033', name: '33' },
              { playId: '16003-034', name: '34' },
              { playId: '16003-035', name: '35' },
              { playId: '16003-036', name: '36' },
              { playId: '16003-037', name: '37' },
              { playId: '16003-038', name: '38' },
              { playId: '16003-039', name: '39' },
              { playId: '16003-040', name: '40' },
              { playId: '16003-041', name: '41' },
              { playId: '16003-042', name: '42' },
              { playId: '16003-043', name: '43' },
              { playId: '16003-044', name: '44' },
              { playId: '16003-045', name: '45' },
              { playId: '16003-046', name: '46' },
              { playId: '16003-047', name: '47' },
              { playId: '16003-048', name: '48' },
              { playId: '16003-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 16004,
        tabName: '九不中',
        // 選 9 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 9,
            minPick: 9,
            maxPick: 11,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '九不中', odds: 4.47, weight: 2 }, // P = C(40,7)/C(49,7) = 21.7036%（公平 4.6075）
        ],
        tabGroup: [
          {
            groupName: '九不中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 9 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16004-001', name: '01' },
              { playId: '16004-002', name: '02' },
              { playId: '16004-003', name: '03' },
              { playId: '16004-004', name: '04' },
              { playId: '16004-005', name: '05' },
              { playId: '16004-006', name: '06' },
              { playId: '16004-007', name: '07' },
              { playId: '16004-008', name: '08' },
              { playId: '16004-009', name: '09' },
              { playId: '16004-010', name: '10' },
              { playId: '16004-011', name: '11' },
              { playId: '16004-012', name: '12' },
              { playId: '16004-013', name: '13' },
              { playId: '16004-014', name: '14' },
              { playId: '16004-015', name: '15' },
              { playId: '16004-016', name: '16' },
              { playId: '16004-017', name: '17' },
              { playId: '16004-018', name: '18' },
              { playId: '16004-019', name: '19' },
              { playId: '16004-020', name: '20' },
              { playId: '16004-021', name: '21' },
              { playId: '16004-022', name: '22' },
              { playId: '16004-023', name: '23' },
              { playId: '16004-024', name: '24' },
              { playId: '16004-025', name: '25' },
              { playId: '16004-026', name: '26' },
              { playId: '16004-027', name: '27' },
              { playId: '16004-028', name: '28' },
              { playId: '16004-029', name: '29' },
              { playId: '16004-030', name: '30' },
              { playId: '16004-031', name: '31' },
              { playId: '16004-032', name: '32' },
              { playId: '16004-033', name: '33' },
              { playId: '16004-034', name: '34' },
              { playId: '16004-035', name: '35' },
              { playId: '16004-036', name: '36' },
              { playId: '16004-037', name: '37' },
              { playId: '16004-038', name: '38' },
              { playId: '16004-039', name: '39' },
              { playId: '16004-040', name: '40' },
              { playId: '16004-041', name: '41' },
              { playId: '16004-042', name: '42' },
              { playId: '16004-043', name: '43' },
              { playId: '16004-044', name: '44' },
              { playId: '16004-045', name: '45' },
              { playId: '16004-046', name: '46' },
              { playId: '16004-047', name: '47' },
              { playId: '16004-048', name: '48' },
              { playId: '16004-049', name: '49' },
            ],
          },
        ],
      },
      {
        tabId: 16005,
        tabName: '十不中',
        // 選 10 個號，7 顆球「一個都沒有」命中才中獎
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
          combo: {
            pick: 10,
            minPick: 10,
            maxPick: 12,
          },
        },
        // 賠率放在 tiers（同 c_lianma）：一注是「一組號碼」而非單一注項，
        // 但只有一種中法，故只有一檔。所有號碼機率相同，賠率不隨所選號碼變動，可寫死。
        tiers: [
          { key: 'none', name: '十不中', odds: 5.42, weight: 2 }, // P = C(39,7)/C(49,7) = 17.9055%（公平 5.5849）
        ],
        tabGroup: [
          {
            groupName: '十不中',
            weight: 2,
            // 號碼池：注項由玩家自己組（選 10 個），這裡只提供 01~49 供看板選取；
            // 單一號碼沒有賠率，賠率在上方 tiers
            groupList: [
              { playId: '16005-001', name: '01' },
              { playId: '16005-002', name: '02' },
              { playId: '16005-003', name: '03' },
              { playId: '16005-004', name: '04' },
              { playId: '16005-005', name: '05' },
              { playId: '16005-006', name: '06' },
              { playId: '16005-007', name: '07' },
              { playId: '16005-008', name: '08' },
              { playId: '16005-009', name: '09' },
              { playId: '16005-010', name: '10' },
              { playId: '16005-011', name: '11' },
              { playId: '16005-012', name: '12' },
              { playId: '16005-013', name: '13' },
              { playId: '16005-014', name: '14' },
              { playId: '16005-015', name: '15' },
              { playId: '16005-016', name: '16' },
              { playId: '16005-017', name: '17' },
              { playId: '16005-018', name: '18' },
              { playId: '16005-019', name: '19' },
              { playId: '16005-020', name: '20' },
              { playId: '16005-021', name: '21' },
              { playId: '16005-022', name: '22' },
              { playId: '16005-023', name: '23' },
              { playId: '16005-024', name: '24' },
              { playId: '16005-025', name: '25' },
              { playId: '16005-026', name: '26' },
              { playId: '16005-027', name: '27' },
              { playId: '16005-028', name: '28' },
              { playId: '16005-029', name: '29' },
              { playId: '16005-030', name: '30' },
              { playId: '16005-031', name: '31' },
              { playId: '16005-032', name: '32' },
              { playId: '16005-033', name: '33' },
              { playId: '16005-034', name: '34' },
              { playId: '16005-035', name: '35' },
              { playId: '16005-036', name: '36' },
              { playId: '16005-037', name: '37' },
              { playId: '16005-038', name: '38' },
              { playId: '16005-039', name: '39' },
              { playId: '16005-040', name: '40' },
              { playId: '16005-041', name: '41' },
              { playId: '16005-042', name: '42' },
              { playId: '16005-043', name: '43' },
              { playId: '16005-044', name: '44' },
              { playId: '16005-045', name: '45' },
              { playId: '16005-046', name: '46' },
              { playId: '16005-047', name: '47' },
              { playId: '16005-048', name: '48' },
              { playId: '16005-049', name: '49' },
            ],
          },
        ],
      },
    ],
  },
]
