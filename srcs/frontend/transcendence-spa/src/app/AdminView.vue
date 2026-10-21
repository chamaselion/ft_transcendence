<script setup lang="ts">
import UserManaging from '@/admin/components/UserManagingList.vue'
</script>

<template>
  <div class="admin-view">
    <h1>{{ $t('admin.title') }}</h1>
    <UserManaging />
  </div>
</template>
