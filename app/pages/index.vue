<script setup lang="ts">
const skills = [
  'Nuxt 4',
  'Vue 3',
  'TypeScript',
  'Node.js',
  'SQL / SQLite',
  'REST API Design',
  'Testing',
  'CI/CD'
]

const projects = [
  {
    name: 'Portfolio Platform',
    description:
      'A high-performance personal platform with modern UI, SEO optimization, and content-driven architecture.',
    stack: ['Nuxt', 'TypeScript', 'Pinia']
  },
  {
    name: 'Business Dashboard',
    description:
      'Data-focused dashboard for operational metrics, visual reporting, and workflow automation.',
    stack: ['Vue', 'Node.js', 'SQL']
  },
  {
    name: 'Internal Tooling Suite',
    description:
      'A secure internal web suite that improved team productivity with reusable components and clear UX.',
    stack: ['Nuxt', 'API Integration', 'Auth']
  }
]
</script>

<template>
  <main class="mx-auto max-w-5xl px-5 pb-20 pt-10 text-slate-900">
    <section class="py-8">
      <p class="mb-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
        Available for collaboration
      </p>
      <h1 class="m-0 text-4xl font-bold tracking-tight sm:text-5xl">Tony Wu</h1>
      <p class="mt-4 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg">
        Full-Stack Developer focused on building reliable, maintainable products
        with clean architecture and practical user experience.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="#projects"
          class="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          View Projects
        </a>
        <a href="#contact"
          class="rounded-lg border border-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
          Contact Me
        </a>
      </div>
    </section>

    <section id="about" class="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 class="mb-3 text-xl font-semibold">About</h2>
      <p class="leading-7 text-slate-700">
        I build modern web applications from idea to production, with emphasis
        on performance, code quality, and long-term maintainability. I enjoy
        turning complex requirements into clear, scalable solutions.
      </p>
    </section>

    <section id="skills" class="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 class="mb-3 text-xl font-semibold">Core Skills</h2>
      <ul class="flex flex-wrap gap-2.5">
        <li v-for="skill in skills" :key="skill" class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
          {{ skill }}
        </li>
      </ul>
    </section>

    <section id="projects" class="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-xl font-semibold">Selected Projects</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="project in projects" :key="project.name"
          class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 class="mb-2 text-base font-semibold">{{ project.name }}</h3>
          <p class="text-sm leading-6 text-slate-700">{{ project.description }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="item in project.stack" :key="`${project.name}-${item}`"
              class="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
              {{ item }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section id="contact" class="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 class="mb-3 text-xl font-semibold">Contact</h2>
      <p class="text-slate-700">
        Looking for a developer for your next product or feature?
        <a href="mailto:hello@example.com" class="ml-1 font-semibold text-blue-600">
          hello@example.com
        </a>
      </p>
    </section>
  </main>
</template>
