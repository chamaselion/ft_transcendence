<script setup lang="ts">

</script>

<template>
  <header>
    <div>
      <router-link to="/">Home</router-link>
    </div>
    <div>
      <router-link to="/login">Login</router-link>
    </div>
    <div>
      <p>More informaion placeholder or so</p>
    </div>
  </header>
</template>

<style scoped>
  header {
    display: flex;
    justify-content: space-between;
    background-color: var(--light-bg);
    padding: 10px 24px;
  }
</style>
