<script setup lang="ts"></script>

<template>
  <div class="manage-user-modal">
    <h1>Manage Users here</h1>
  </div>
</template>

<style scoped>
.manage-user-modal {
  position: fixed;
  top: 10%;
  left: 10%;
  width: 80%;
  height: 80%;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  z-index: 1000;
}
</style>
