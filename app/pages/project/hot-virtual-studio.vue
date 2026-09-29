<script setup lang="ts">
import { useProjectFonts } from '~/composables/useProjectFonts'
import ProjectBackLink from '~/components/project/ProjectBackLink.vue'
import ProjectStatusBadge from '~/components/project/ProjectStatusBadge.vue'
import ProjectTagList from '~/components/project/ProjectTagList.vue'

useProjectFonts()
</script>

<template>
  <div class="project-scope min-h-screen bg-slate-50">
    <AppTopbar />
    <main class="mx-auto max-w-3xl px-5 py-10">
      <ProjectBackLink />

      <div class="np-proj-detail-head">
        <ProjectStatusBadge status="building" />
        <span class="np-proj-year">待補</span>
      </div>
      <h1 class="np-proj-title">HOT虛擬攝影棚</h1>
      <ProjectTagList :tags="['待補']" />

      <section class="np-proj-simple-section">
        <h2 class="np-proj-num-title">簡介</h2>
        <p class="np-proj-section-body" style="margin-top: 10px">（專案簡介待補）</p>
      </section>

      <section class="np-proj-simple-section">
        <h2 class="np-proj-num-title">項目重點</h2>
        <p class="np-proj-section-body" style="margin-top: 10px">（待補）</p>
      </section>

      <section class="np-proj-simple-section">
        <h2 class="np-proj-num-title">技術棧</h2>
        <p class="np-proj-section-body" style="margin-top: 10px">（技術棧待補）</p>
      </section>
    </main>
  </div>
</template>
