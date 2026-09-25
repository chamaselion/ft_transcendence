<template>
  <div class="user-icon" :class="`user-icon--${size}`">
    <img v-if="avatarUrl" class="user-icon__avatar" :src="avatarUrl" :alt="name" />
    <span v-else class="user-icon__fallback">{{ initials }}</span>
    <span v-if="showName" class="user-icon__name">{{ name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  avatarUrl?: string
  name?: string
  size?: 'small' | 'default' | 'large'
  showName?: boolean
}>(), {
  name: '',
  size: 'default',
  showName: false,
})

const initials = computed(() =>
  props.name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
)
</script>

<style lang="css" scoped>
.user-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.user-icon__avatar,
.user-icon__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-icon__avatar {
  object-fit: cover;
}

.user-icon__fallback {
  background-color: var(--color-primary);
  color: var(--color-primary-contrast);
  font-size: 14px;
  font-weight: 600;
}

.user-icon__name {
  color: var(--text-primary);
  font-size: 14px;
}

.user-icon--small .user-icon__avatar,
.user-icon--small .user-icon__fallback {
  width: 28px;
  height: 28px;
  font-size: 11px;
}

.user-icon--large .user-icon__avatar,
.user-icon--large .user-icon__fallback {
  width: 56px;
  height: 56px;
  font-size: 20px;
}
</style>
