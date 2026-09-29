/**
 * /project/* 及首頁共用的 Google Fonts 掛載。
 * Industry 設計：Barlow Condensed（大字標題）+ Barlow（內文）+ JetBrains Mono（等寬標籤）+ Noto Sans TC（中文）
 */
export function useProjectFonts(): void {
  useHead({
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap'
      }
    ]
  })
}
