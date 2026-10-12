<script setup lang="ts">
import Button from '@/app/components/Button.vue'
import Icon from '@/app/components/Icon.vue'
import { startOAuth } from '@/auth/oauth'

function showExplainer(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const explainerId = target.classList.contains('github')
    ? 'gh-provider-explainer'
    : '42-provider-explainer'
  const explainer = document.getElementById(explainerId!)
  if (explainer) {
    explainer.style.display = 'flex'
    setTimeout(() => {
      explainer.style.display = 'none'
    }, 10000)
  }
}

function hideExplainer() {
  const explainers = document.querySelectorAll('.provider-explainer')
  explainers.forEach((explainer) => {
    explainer.setAttribute('style', 'display: none;')
  })
}
</script>

<template>
  <div class="oauth-container">
    <div class="oauth-provider">
      <Button
        @click="startOAuth('github')"
        @mouseenter="showExplainer"
        @mouseleave="hideExplainer"
        class="oauth-btn github"
      >
        Sign In with <Icon name="Github" />
      </Button>
      <div
        class="provider-explainer"
        id="gh-provider-explainer"
      >
        <p>
          By signing in with GitHub, you can use your existing GitHub account to access our
          services. This allows for a seamless login experience and eliminates the need to create a
          new account. Your GitHub credentials will not be shared with us, and we will only request
          the necessary permissions to authenticate your identity.
        </p>
      </div>
    </div>
    <div class="oauth-provider">
      <Button
        @click="startOAuth('42')"
        @mouseenter="showExplainer"
        @mouseleave="hideExplainer"
        class="oauth-btn"
      >
        Sign In with <Icon name="FortyTwo" />
      </Button>
      <div
        class="provider-explainer"
        id="42-provider-explainer"
      >
        <p>
          By signing in with 42, you can use your existing 42 account to access our services. This
          allows for a seamless login experience and eliminates the need to create a new account.
          Your 42 credentials will not be shared with us, and we will only request the necessary
          permissions to authenticate your identity.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="css">
.oauth-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.oauth-provider {
  position: relative;
  display: flex;
}

.provider-explainer {
  display: none;
  position: absolute;
  bottom: calc(100% + 0.75rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  box-sizing: border-box;
  width: 22rem;
  max-width: calc(100vw - 2rem);
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.125rem;
  background-color: var(--bg-subtle);
  color: var(--text-primary);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  text-align: left;
  pointer-events: none;
}

.provider-explainer p {
  margin: 0;
}

@media (max-width: 480px) {
  .oauth-provider {
    position: static;
  }
}

.oauth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
}

:root[data-theme='light'] {
  .oauth-btn {
    background-color: var(--bg-subtle);
    color: var(--text-primary);
  }
  .oauth-btn:hover {
    background-color: var(--color-primary-hover);
  }
}

:root[data-theme='dark'] {
  .oauth-btn {
    background-color: #24292e;
    color: var(--text-primary);
  }
  .oauth-btn:hover {
    background-color: var(--color-primary-hover);
  }
}
</style>
