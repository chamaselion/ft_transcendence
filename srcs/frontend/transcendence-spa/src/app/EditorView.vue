<script setup lang="ts">
import { ref } from 'vue'
import Editor from '@/app/components/Editor.vue'
import { createBlock, type Block } from '@/app/editor/types'

const currentUserId = 'local-user'

const blocks = ref<Block[]>([
  createBlock('h', 'Untitled document'),
  createBlock('p', 'Start writing. Focus a block and use the toolbar to add or remove blocks.'),
  createBlock('li', 'First point\nSecond point'),
  createBlock('cit', 'Editing is just structured text.'),
  createBlock('c', 'console.log("hello from the editor")'),
])
</script>

<template>
  <div class="page-container">
    <Editor v-model="blocks" :current-user-id="currentUserId" />
  </div>
</template>
