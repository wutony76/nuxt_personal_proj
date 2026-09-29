<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'

definePageMeta({ layout: 'portfolio' })

const { vReveal } = useScrollReveal()

const JOBS = [
  {
    period: '20XX — 至今',
    company: '公司名稱（待補）',
    role: 'Senior Frontend Engineer',
    desc: '工作內容與成果（待補）'
  },
  {
    period: '20XX — 20XX',
    company: '公司名稱（待補）',
    role: 'Frontend Engineer',
    desc: '工作內容與成果（待補）'
  },
  {
    period: '20XX — 20XX',
    company: '公司名稱（待補）',
    role: '2D / 3D 美術 · 遊戲開發',
    desc: '工作內容與成果（待補）'
  }
]
</script>

<template>
  <main class="pf-main">
    <!-- ── Hero ── -->
    <section class="pf-hero">
      <div class="pf-hero-meta">
        <span>Portfolio — 2026</span>
        <span class="pf-hero-meta-right">Senior Frontend / Full Stack Engineer</span>
      </div>
      <h1 class="pf-hero-title pf-hero-anim pf-hero-anim-title">
        Happy<br>Fat <span class="pf-hero-title-accent">YoYo</span>
      </h1>
      <div class="pf-hero-body pf-hero-anim pf-hero-anim-body">
        <div class="pf-hero-portrait">個人照片</div>
        <div>
          <p class="pf-hero-desc">
            以多年前端開發經驗為核心，延伸至全端工程與互動產品實作，涵蓋遊戲、娛樂、彩票、金融資料與 Web3
            等多元領域，結合 2D / 3D 美術與遊戲開發經驗，展現從前端實作、系統整合到業務邏輯的完整工程能力。
          </p>
          <div class="pf-hero-actions">
            <NuxtLink to="/project" class="pf-btn-primary">
              查看專案 <span class="pf-btn-arrow">→</span>
            </NuxtLink>
            <a href="#contact" class="pf-btn-secondary">聯絡我</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Experience ── -->
    <section class="pf-section">
      <div class="pf-section-head">
        <h2 v-reveal="{ variant: 'left' }" class="pf-section-title">經歷</h2>
        <span v-reveal="{ variant: 'right', delay: 40 }" class="pf-section-eyebrow">01 — Experience</span>
      </div>
      <div v-for="(job, i) in JOBS" :key="job.company" class="pf-job-row">
        <div v-reveal="{ delay: i * 90, variant: 'left' }" class="pf-job-period">{{ job.period }}</div>
        <div v-reveal="{ delay: i * 90 + 60 }">
          <div class="pf-job-company">{{ job.company }}</div>
          <div class="pf-job-role">{{ job.role }}</div>
        </div>
        <p v-reveal="{ delay: i * 90 + 120 }" class="pf-job-desc">{{ job.desc }}</p>
      </div>
    </section>

    <!-- ── Contact ── -->
    <section id="contact" class="pf-section-contact">
      <div v-reveal="{ variant: 'left' }" class="pf-contact-eyebrow">02 — Contact</div>
      <h2 v-reveal="{ delay: 60 }" class="pf-contact-title">
        Let's build<br><span style="color: var(--proj-accent)">something.</span>
      </h2>
      <div class="pf-contact-grid">
        <a v-reveal="{ delay: 120, variant: 'scale' }" href="#" class="pf-contact-link">
          <span class="pf-contact-label">Email</span>
          <span class="pf-contact-value">待補 ↗</span>
        </a>
        <a v-reveal="{ delay: 200, variant: 'scale' }" href="#" class="pf-contact-link">
          <span class="pf-contact-label">GitHub</span>
          <span class="pf-contact-value">待補 ↗</span>
        </a>
        <a v-reveal="{ delay: 280, variant: 'scale' }" href="#" class="pf-contact-link">
          <span class="pf-contact-label">LinkedIn</span>
          <span class="pf-contact-value">待補 ↗</span>
        </a>
      </div>
    </section>
  </main>
</template>
