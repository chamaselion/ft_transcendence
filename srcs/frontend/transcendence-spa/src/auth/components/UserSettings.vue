<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { httpClient } from '../auth.api';


  export interface Root {
    loggedIn: boolean
    user: User
  }

  export interface User {
    id: string
    login: string
    email: string
    role: string
  }

  const res = ref<Root>(null)
  const user = ref<User>(null)


  onMounted(async () => {
    try {
      const response = await httpClient.get<Root>('me');
      res.value = response;
      user.value = res.value.user;
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  });

</script>

<template>
  <div>
    <h1>User Settings</h1>
    <p>Here you can update your user settings.</p>
    <div class="user-status">
      <p v-if="res?.loggedIn">You are logged in as: {{ user?.login }}</p>
      <p v-else>You are not logged in.</p>
      <span
        class="status-icon"
        :class="res?.loggedIn ? 'logged-in' : 'logged-out'"
        role="img"
        :aria-label="res?.loggedIn ? 'Logged in' : 'Not logged in'"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path v-if="res?.loggedIn" d="m6 12 4 4 8-8" />
          <path v-else d="m6 6 12 12M6 18 18 6" />
        </svg>
      </span>
    </div>
  </div>

</template>

<style scoped>
.user-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
}

.logged-in {
  background-color: #15803d;
}

.logged-out {
  background-color: #dc2626;
}

.status-icon svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
