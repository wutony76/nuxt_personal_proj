/** /project/* 頁面共用的 Google Fonts 掛載（Space Grotesk 標題 + JetBrains Mono 標籤/等寬） */
export function useProjectFonts(): void {
  useHead({
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap'
      }
    ]
  })
}
