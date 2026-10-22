<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'

const router = useRouter()
</script>

<template>
  <main
    class="box-border flex min-h-[calc(100vh_-_61px)] w-full flex-col items-center justify-center px-6 py-10"
  >
    <section
      class="mx-auto flex max-w-[520px] flex-col items-center rounded-2xl border border-line-subtle bg-surface px-8 py-12 text-center shadow-card"
    >
      <div
        class="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/12 text-2xl font-bold text-danger"
        aria-hidden="true"
      >
        404
      </div>
      <h1 class="m-0 mb-2 text-[2rem] leading-tight font-bold text-ink">
        {{ $t('notFound.title') }}
      </h1>
      <p class="m-0 mb-6 text-base leading-relaxed text-ink-secondary">
        {{ $t('notFound.description') }}
      </p>
      <Button variant="elevated" color="primary" @click="router.push('/')">
        <template #prepend>
          <Icon name="Home" :size="18" />
        </template>
        {{ $t('notFound.backHome') }}
      </Button>
    </section>
  </main>
</template>

