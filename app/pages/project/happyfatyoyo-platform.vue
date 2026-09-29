<script setup lang="ts">
import { happyfatyoyoPlatform as detail } from '~/config/projects/happyfatyoyoPlatform'
import SectionShell from '~/components/project/section/SectionShell.vue'
import FeatureCardGrid from '~/components/project/section/FeatureCardGrid.vue'
import ArchitectureDiagram from '~/components/project/section/ArchitectureDiagram.vue'
import EvidenceCardList from '~/components/project/section/EvidenceCardList.vue'
import KnowHowHighlights from '~/components/project/section/KnowHowHighlights.vue'
import MetricsCardGrid from '~/components/project/section/MetricsCardGrid.vue'

definePageMeta({ layout: 'portfolio' })

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
  <main class="pf-main">
    <!-- ── Hero ── -->
    <section style="padding: clamp(40px,6vw,80px) 0 clamp(40px,5vw,64px)">
      <div class="pf-detail-breadcrumb">
        <NuxtLink to="/project" class="pf-detail-back">← 專案</NuxtLink>
        <span class="pf-detail-counter">Project 01 / 11</span>
      </div>
      <h1 class="pf-detail-title">
        HappyFatYoYo<br><span class="pf-detail-title-accent">World</span>
      </h1>
      <p class="pf-detail-tagline">本站本身：規格驅動開發的全端彩票 / 遊戲 / 後台自動化工程作品</p>
    </section>

    <!-- ── Metadata ── -->
    <dl class="pf-detail-meta">
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">狀態</dt>
        <dd class="pf-detail-meta-value">BUILDING</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">期間</dt>
        <dd class="pf-detail-meta-value is-text">2026.04 — 至今</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">類型</dt>
        <dd class="pf-detail-meta-value is-text">彩票 / 遊戲 / 後台</dd>
      </div>
      <div class="pf-detail-meta-item">
        <dt class="pf-detail-meta-label">技術</dt>
        <dd class="pf-detail-meta-tags">
          <span>Nuxt 4</span><span>TypeScript</span><span>Nitro</span><span>Pinia</span>
        </dd>
      </div>
    </dl>

    <!-- ── Hero 截圖 ── -->
    <div class="pf-detail-hero-img">主視覺截圖</div>

    <!-- ── 9 Sections ── -->
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
          <div class="np-proj-tags">
            <span v-for="t in g.items" :key="t" class="np-proj-tag">{{ t }}</span>
          </div>
        </div>
      </div>
    </SectionShell>

    <SectionShell no="09" title="Result">
      <MetricsCardGrid :metrics="detail.result.metrics" />
      <p class="np-proj-section-body" style="margin-top: 16px">{{ detail.result.summary }}</p>
    </SectionShell>

    <!-- ── Gallery ── -->
    <div class="pf-detail-gallery">
      <div class="pf-detail-gallery-img">畫面截圖</div>
      <div class="pf-detail-gallery-img">畫面截圖</div>
    </div>

    <!-- ── Next ── -->
    <NuxtLink to="/project/happy-fish-3D" class="pf-detail-next">
      <span class="pf-detail-next-label">Next — 02</span>
      <span class="pf-detail-next-title">3D歡樂捕魚 <span class="pf-detail-next-arrow">→</span></span>
    </NuxtLink>
  </main>
</template>

<style scoped lang="scss">
.np-proj-tech-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.np-proj-tech-group-label {
  display: block;
  margin-bottom: 8px;
  font-family: var(--proj-font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--proj-muted);
}
</style>
