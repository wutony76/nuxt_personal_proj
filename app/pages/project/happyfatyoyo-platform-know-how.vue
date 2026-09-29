<script setup lang="ts">
import { useProjectFonts } from '~/composables/useProjectFonts'
import { happyfatyoyoPlatform as detail } from '~/config/projects/happyfatyoyoPlatform'
import ProjectBackLink from '~/components/project/ProjectBackLink.vue'
import KnowHowFull from '~/components/project/section/KnowHowFull.vue'

useProjectFonts()
</script>

<template>
  <div class="project-scope min-h-screen bg-slate-50">
    <AppTopbar />
    <main class="mx-auto max-w-3xl px-5 py-10">
      <ProjectBackLink to="/project/happyfatyoyo-platform" label="← 返回 HappyFatYoYo 彩票遊戲平台" />

      <span class="np-proj-eyebrow">ENGINEERING NOTES</span>
      <h1 class="np-proj-title">Know-how</h1>
      <p class="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
        HappyFatYoYo 彩票遊戲平台完整的技術研究、架構思考與決策紀錄。
      </p>

      <div style="margin-top: 32px">
        <KnowHowFull :groups="detail.knowHow" />
      </div>
    </main>
  </div>
</template>
