/**
 * 從 User-Agent 擷取簡短「平台 + 瀏覽器」標籤，例如 Mac Chrome。
 * @param userAgent 完整 User-Agent 字串
 * @returns 簡短標籤；無法解析時回傳空字串
 */
export function formatUserAgentShort(userAgent: string): string {
  const ua = userAgent.trim()
  if (!ua) return ''

  const platform = _parsePlatform(ua)
  const browser = _parseBrowser(ua)
  if (platform && browser) return `${platform} ${browser}`
  return platform || browser || ''
}

/**
 * @param ua User-Agent 字串
 * @returns 平台名稱
 */
function _parsePlatform(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return ''
}

/**
 * @param ua User-Agent 字串
 * @returns 瀏覽器名稱
 */
function _parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua)) return 'Safari'
  return ''
}
