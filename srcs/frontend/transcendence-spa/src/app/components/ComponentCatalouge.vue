<script lang="ts" setup>
import Button from "@/app/components/Button.vue"

const variants = ['elevated', 'flat', 'outlined'] as const
const sizes = ['x-small', 'small', 'default', 'large', 'x-large'] as const
</script>

<template>
  <div class="catalogue">
    <h1 class="catalogue__title">Button Catalogue</h1>

    <table class="catalogue__table">
      <thead>
        <tr>
          <th class="catalogue__corner" scope="col"></th>
          <th v-for="size in sizes" :key="size" scope="col">{{ size }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="variant in variants" :key="variant">
          <th class="catalogue__row-heading" scope="row">{{ variant }}</th>
          <td
            v-for="size in sizes"
            :key="size"
            class="catalogue__cell"
          >
            <Button :variant="variant" :size="size">Button</Button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
</style>
