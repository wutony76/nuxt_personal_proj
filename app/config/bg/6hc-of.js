export const PLAYLIST = Array.from(new Array(50), (val, index) => index + 1).map((i) => ({
  id: i,
  num: i,
  countIssue: -1, //'-', // 號碼攪出相隔期數
  countShow: -1, // 號碼攪出次數
  odds: -1,
  label: String(i).padStart(2, '0'),
  show: true,
  colorY: false,
  selected: false,
}))