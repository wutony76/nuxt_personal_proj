<script setup lang="ts">
import { useProjectFonts } from '~/composables/useProjectFonts'
import { happyfatyoyoPlatform as detail } from '~/config/projects/happyfatyoyoPlatform'
import ProjectBackLink from '~/components/project/ProjectBackLink.vue'
import ProjectStatusBadge from '~/components/project/ProjectStatusBadge.vue'
import ProjectTagList from '~/components/project/ProjectTagList.vue'
import SectionShell from '~/components/project/section/SectionShell.vue'
import FeatureCardGrid from '~/components/project/section/FeatureCardGrid.vue'
import ArchitectureDiagram from '~/components/project/section/ArchitectureDiagram.vue'
import EvidenceCardList from '~/components/project/section/EvidenceCardList.vue'
import KnowHowHighlights from '~/components/project/section/KnowHowHighlights.vue'
import MetricsCardGrid from '~/components/project/section/MetricsCardGrid.vue'

useProjectFonts()

const TECH_GROUPS = [
  { label: '前端', items: ['Nuxt 4', 'Vue 3', 'TypeScript', 'Pinia', 'vee-validate', 'Zod', 'Tailwind CSS v4', 'SCSS'] },
  { label: '後端', items: ['Nitro', 'Node.js 22'] },
  { label: '工具庫', items: ['lodash-es', 'dayjs', 'number-precision', 'crypto-js', 'bcryptjs'] }
]

const _handlers = {
  splitPrefix: (text: string): { prefix: string; rest: string } => {
    const idx = text.indexOf('：')
    return idx >= 0 ? { prefix: text.slice(0, idx + 1), rest: text.slice(idx + 1) } : { prefix: '', rest: text }
  }
}
</script>

<template>
  <div class="project-scope min-h-screen bg-slate-50">
    <AppTopbar />
    <main class="mx-auto max-w-3xl px-5 py-10">
      <ProjectBackLink />

      <div class="np-proj-detail-head">
        <ProjectStatusBadge status="building" />
        <span class="np-proj-year">2026.04 – 至今</span>
      </div>
      <h1 class="np-proj-title">HAPPYFATYOYO WORLD</h1>
      <ProjectTagList :tags="['Nuxt 4', 'TypeScript', 'Nitro', 'Pinia']" />

      <SectionShell no="01" title="Overview">
        <p class="np-proj-section-body">{{ detail.overview }}</p>
      </SectionShell>

      <SectionShell no="02" title="Problem">
        <p class="np-proj-section-body">{{ detail.problem }}</p>
      </SectionShell>

      <SectionShell no="03" title="Solution">
        <ul class="np-proj-list">
          <li v-for="line in detail.solution" :key="line">
            <strong>{{ _handlers.splitPrefix(line).prefix }}</strong>{{ _handlers.splitPrefix(line).rest }}
          </li>
        </ul>
      </SectionShell>

      <SectionShell no="04" title="Key Features">
        <FeatureCardGrid :features="detail.keyFeatures" />
      </SectionShell>

      <SectionShell no="05" title="Architecture">
        <ArchitectureDiagram :content="detail.architecture" />
      </SectionShell>

      <SectionShell no="06" title="Engineering Evidence">
        <EvidenceCardList :items="detail.engineeringEvidence" />
      </SectionShell>

      <SectionShell no="07" title="Know-how">
        <KnowHowHighlights :groups="detail.knowHow" :overflow-path="detail.knowHowOverflowPath!" />
      </SectionShell>

      <SectionShell no="08" title="Tech Stack">
        <div class="np-proj-tech-groups">
          <div v-for="g in TECH_GROUPS" :key="g.label" class="np-proj-tech-group">
            <span class="np-proj-tech-group-label">{{ g.label }}</span>
            <ProjectTagList :tags="g.items" />
          </div>
        </div>
      </SectionShell>

      <SectionShell no="09" title="Result">
        <MetricsCardGrid :metrics="detail.result.metrics" />
        <p class="np-proj-section-body" style="margin-top: 14px">{{ detail.result.summary }}</p>
      </SectionShell>
    </main>
  </div>
</template>

<style scoped lang="scss">
.np-proj-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.np-proj-tech-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.np-proj-tech-group-label {
  display: block;
  margin-bottom: 6px;
  font-family: var(--proj-font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--proj-muted-soft);
}
</style>
