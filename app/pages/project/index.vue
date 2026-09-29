<script setup lang="ts">
import type { ProjectSummary } from '~/types/project'
import ProjectCard from '~/components/project/ProjectCard.vue'
import { useProjectFonts } from '~/composables/useProjectFonts'

useProjectFonts()

const PROJECTS: ProjectSummary[] = [
  {
    slug: 'happy-fish-3D',
    no: '01',
    name: '3D歡樂捕魚',
    tagline: '3D 場景捕魚機玩法，砲台瞄準射擊 + 連線多人房間',
    year: '2026',
    status: 'building',
    techStack: ['3D 遊戲', '捕魚機', 'WebGL']
  },
  {
    slug: 'happyfatyoyo-platform',
    no: '02',
    name: 'HAPPYFATYOYO WORLD',
    tagline: '本站本身：規格驅動開發的全端彩票 / 遊戲 / 後台自動化工程作品',
    year: '2026.04 – 至今',
    status: 'building',
    techStack: ['Nuxt 4', 'TypeScript', 'Nitro', 'Pinia']
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
          全端工程作品集，展示具備完整產品架構與業務邏輯的實作成果。
        </p>
      </div>

      <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ProjectCard v-for="p in PROJECTS" :key="p.slug" :project="p" />
      </div>
    </main>
  </div>
</template>
