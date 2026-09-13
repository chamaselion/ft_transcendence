<script lang="ts" setup>
import { ref } from 'vue'
import Button from '@/app/components/Button.vue'
import Card from '@/app/components/Card.vue'
import Input from '@/app/components/Input.vue'
import UserIcon from '@/app/components/UserIcon.vue'
import Modal from '@/app/components/Modal.vue'
import Toast from '@/app/components/Toast.vue'
import Tooltip from '@/app/components/Tooltip.vue'
import EditorCitation from '@/app/components/EditorCitation.vue'
import EditorCode from '@/app/components/EditorCode.vue'
import EditorHeading from '@/app/components/EditorHeading.vue'
import EditorList from '@/app/components/EditorList.vue'
import EditorHyperlink from '@/app/components/EditorHyperlink.vue'

const variants = ['elevated', 'flat', 'outlined'] as const
const sizes = ['x-small', 'small', 'default', 'large', 'x-large'] as const
const colors = ['primary', '', 'alert', 'warn', 'good'] as const
const headings = [1, 2, 3, 4, 5, 6] as const
const toastTypes = ['info', 'good', 'warn', 'alert'] as const

const inputValue = ref('')
const modalOpen = ref(false)
const toastOpen = ref(false)
const toastType = ref<(typeof toastTypes)[number]>('good')
</script>

<template>
  <div class="catalogue">
    <h1 class="catalogue__title">Component Catalogue</h1>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Button &mdash; variants &times; sizes</h2>
      <table class="catalogue__table">
        <thead>
          <tr>
            <th scope="col"></th>
            <th v-for="size in sizes" :key="size" scope="col">{{ size }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in variants" :key="variant">
            <th scope="row">{{ variant }}</th>
            <td v-for="size in sizes" :key="size" class="catalogue__cell">
              <Button :variant="variant" :size="size">Button</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Button &mdash; colors</h2>
      <div class="catalogue__row">
        <Button v-for="color in colors" :key="color" :color="color">
          {{ color !== '' ? color : 'default' }}
        </Button>
      </div>
      <div class="catalogue__row">
        <Button v-for="color in colors" :key="color" :color="color" variant="outlined">
          {{ color !== '' ? color : 'default' }}
        </Button>
      </div>
      <div class="catalogue__row">
        <Button variant="flat">Flat</Button>
        <Button variant="elevated">Elevated</Button>
        <Button variant="outlined">Outlined</Button>
        <Button disabled>Disabled</Button>
      </div>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Card</h2>
      <div class="catalogue__grid">
        <Card title="Elevated card">
          <p>A default elevated card with a title.</p>
          <template #footer>
            <Button size="small" variant="outlined">Cancel</Button>
            <Button size="small">Confirm</Button>
          </template>
        </Card>
        <Card title="Outlined card" :elevated="false" outlined>
          <p>An outlined card without a shadow.</p>
        </Card>
      </div>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Input</h2>
      <div class="catalogue__grid">
        <Input v-model="inputValue" label="Username" placeholder="Enter your username" hint="This is a hint" />
        <Input model-value="you@example.com" label="Email" type="email" />
        <Input model-value="bad input" label="Password" type="password" error="Password is too short" />
        <Input model-value="Disabled" label="Disabled" disabled />
      </div>
      <p class="catalogue__note">v-model value: {{ inputValue || '(empty)' }}</p>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">UserIcon</h2>
      <div class="catalogue__row catalogue__row--center">
        <UserIcon
          avatar-url="https://thispersondoesnotexist.com/random-person.jpeg"
          name="John Doe"
          show-name
        />
        <UserIcon name="Jane Roe" show-name size="large" />
        <UserIcon name="Sam Smith" size="small" show-name />
        <UserIcon name="No Avatar" show-name />
      </div>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Modal</h2>
      <div class="catalogue__row">
        <Button @click="modalOpen = true">Open modal</Button>
      </div>
      <Modal v-model="modalOpen" title="Example modal">
        <p>
          This is the modal body. Press Escape or click the overlay to close.
        </p>
        <template #footer>
          <Button variant="outlined" @click="modalOpen = false">Cancel</Button>
          <Button @click="modalOpen = false">Confirm</Button>
        </template>
      </Modal>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Toast</h2>
      <div class="catalogue__row">
        <Button
          v-for="type in toastTypes"
          :key="type"
          :color="type === 'info' ? 'primary' : type"
          variant="outlined"
          @click="((toastType = type), (toastOpen = true))"
        >
          {{ type }}
        </Button>
      </div>
      <div class="catalogue__stack">
        <Toast
          v-for="type in toastTypes"
          :key="type"
          :model-value="true"
          :type="type"
          :message="`A ${type} toast message`"
          :duration="0"
        />
      </div>
      <Toast v-model="toastOpen" :type="toastType" :message="`A ${toastType} toast message`" />
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">Tooltip</h2>
      <div class="catalogue__row">
        <Tooltip text="Tooltip on top">
          <Button variant="outlined">Top</Button>
        </Tooltip>
        <Tooltip text="Tooltip on bottom" placement="bottom">
          <Button variant="outlined">Bottom</Button>
        </Tooltip>
        <Tooltip text="Tooltip on left" placement="left">
          <Button variant="outlined">Left</Button>
        </Tooltip>
        <Tooltip text="Tooltip on right" placement="right">
          <Button variant="outlined">Right</Button>
        </Tooltip>
      </div>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">EditorHeading</h2>
      <EditorHeading v-for="level in headings" :key="level" :level="level">
        Heading level {{ level }}
      </EditorHeading>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">EditorList</h2>
      <div class="catalogue__grid">
        <EditorList :items="['First item', 'Second item', 'Third item']" />
        <EditorList
          :items="['First item', 'Second item', 'Third item']"
          ordered
        />
        <EditorList
          :items="['Alpha', 'Beta', 'Gamma']"
          marker="lower-alpha"
        />
        <EditorList
          :items="['Dashed', 'Custom', 'Marker']"
          marker="square"
        />
      </div>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">EditorCitation</h2>
      <EditorCitation source="Ada Lovelace">
        That brain of mine is something more than merely mortal, as time will show.
      </EditorCitation>
      <EditorCitation accent="var(--color-good)" bg-color="var(--bg-subtle)">
        A citation with a custom accent stripe.
      </EditorCitation>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">EditorCode</h2>
      <EditorCode language="typescript" code="const answer: number = 42" />
      <EditorCode language="python" size="1rem">
def greet(name):
    print(f"Hello, {name}")
      </EditorCode>
    </section>

    <section class="catalogue__section">
      <h2 class="catalogue__heading">EditorHyperlink</h2>
      <div class="catalogue__row">
        <EditorHyperlink url="https://vuejs.org">Default link</EditorHyperlink>
        <EditorHyperlink url="https://vuejs.org" color="var(--color-good)">Green link</EditorHyperlink>
        <EditorHyperlink url="https://vuejs.org" size="1.25rem">Larger link</EditorHyperlink>
        <EditorHyperlink url="https://vuejs.org" :underline="false">No underline</EditorHyperlink>
      </div>
      <div class="catalogue__row">
        <EditorHyperlink url="javascript:alert(1)">Rejected javascript: URL</EditorHyperlink>
        <EditorHyperlink url="/relative/path">Rejected relative URL</EditorHyperlink>
      </div>
    </section>
  </div>
  
</template>

<style scoped>
.catalogue {
  box-sizing: border-box;
  width: 100%;
  padding: 2rem 3rem 4rem;
  color: var(--text-primary);
}

.catalogue__title {
  margin: 0 0 1.5rem;
  font-size: 2rem;
}

.catalogue__section {
  margin-bottom: 3rem;
}

.catalogue__heading {
  margin: 0 0 1rem;
  padding-bottom: .5rem;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 1.25rem;
}

.catalogue__table {
  border-collapse: collapse;
}

.catalogue__table th,
.catalogue__table td {
  padding: 8px 12px;
  text-align: left;
}

.catalogue__cell {
  vertical-align: middle;
}

.catalogue__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.catalogue__row--center {
  align-items: center;
}

.catalogue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}

.catalogue__stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.catalogue__note {
  color: var(--text-muted);
  font-size: 14px;
}
</style>
