<script setup lang="ts">
import type { ProjectSummary } from '~/types/project'
import ProjectCard from '~/components/project/ProjectCard.vue'
import { useProjectFonts } from '~/composables/useProjectFonts'

useProjectFonts()

const PROJECTS: ProjectSummary[] = [
  {
    slug: 'happyfatyoyo-platform',
    no: '01',
    name: 'HAPPYFATYOYO WORLD',
    tagline: '本站本身：規格驅動開發的全端彩票 / 遊戲 / 後台自動化工程作品',
    year: '2026.04 – 至今',
    status: 'building',
    techStack: ['Nuxt 4', 'TypeScript', 'Nitro', 'Pinia']
  },
  {
    slug: 'happy-fish-3D',
    no: '02',
    name: '3D歡樂捕魚',
    tagline: '3D 場景捕魚機玩法，砲台瞄準射擊 + 連線多人房間',
    year: '2026',
    status: 'building',
    techStack: ['3D 遊戲', '捕魚機', 'WebGL']
  },
  {
    slug: 'qiang-tou-xiang',
    no: '03',
    name: '搶頭香（宮廟）',
    tagline: '宮廟文化主題的搶頭香互動活動企劃（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'hot-virtual-studio',
    no: '04',
    name: 'HOT虛擬攝影棚',
    tagline: '虛擬攝影棚直播製作系統（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'ace-goddess-casino',
    no: '05',
    name: 'ACE女神娛樂城',
    tagline: '品牌娛樂城前台與遊戲整合（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'extreme-showdown-casino',
    no: '06',
    name: '超激對決娛樂城',
    tagline: 'PVP 對戰型娛樂城玩法整合（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'party-game',
    no: '07',
    name: 'PARTY GAME',
    tagline: '多人派對遊戲合輯（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'lottery-white-label',
    no: '08',
    name: '彩票綜合包網',
    tagline: '彩票綜合包網整合平台（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'mt4-gac',
    no: '09',
    name: 'MT4 GAC',
    tagline: '行情資料串接與投資試算（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: 'mining-platform',
    no: '10',
    name: '礦機平台',
    tagline: '智能合約與代理分潤系統（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  },
  {
    slug: '2d-3d-art',
    no: '11',
    name: '2D/3D美術',
    tagline: '2D/3D美術作品集（內容待補）',
    year: '待補',
    status: 'building',
    techStack: ['待補']
  }
]
</script>

<template>
  <div class="project-scope min-h-screen bg-slate-50">
    <AppTopbar />
    <main class="mx-auto max-w-6xl px-5 py-10">
      <div>
        <span class="np-proj-eyebrow">PROJECTS</span>
        <p class="np-proj-role">Senior Frontend / Full Stack Engineer Portfolio</p>
        <h1 class="np-proj-title">專案</h1>
        <p class="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
          以多年前端開發經驗為核心，延伸至全端工程與互動產品實作，涵蓋遊戲、娛樂、彩票、金融資料與 Web3 等多元領域，結合 2D／3D 美術與遊戲開發經驗，展現從前端實作、系統整合到業務邏輯的完整工程能力。
        </p>
      </div>

      <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ProjectCard v-for="p in PROJECTS" :key="p.slug" :project="p" />
      </div>
    </main>
  </div>
</template>
