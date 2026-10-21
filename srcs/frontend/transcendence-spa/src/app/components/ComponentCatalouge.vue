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
import Icon, { type IconName } from '@/app/components/Icon.vue'
import { validateLogin } from '@/utils/validation'

const iconList: { name: IconName; description: string }[] = [
  { name: 'H1', description: 'Heading 1 — Primary section heading' },
  { name: 'Sparkles', description: 'Sparkles — AI actions and highlights' },
  { name: 'Pencil', description: 'Pencil — Edit and modify content' },
  { name: 'PencilPlus', description: 'Pencil Plus — Create or draft new item' },
  { name: 'Trash', description: 'Trash — Delete and remove item' },
  { name: 'LetterCase', description: 'Letter Case — Typography and formatting' },
  { name: 'AdjustmentsHorizontal', description: 'Adjustments — Filters and controls' },
  { name: 'Eye', description: 'Eye — View and preview visibility' },
]

const variants = ['elevated', 'flat', 'outlined'] as const
const sizes = ['x-small', 'small', 'default', 'large', 'x-large'] as const
const colors = ['primary', '', 'alert', 'warn', 'good'] as const
const headings = [1, 2, 3, 4, 5, 6] as const
const toastTypes = ['info', 'good', 'warn', 'alert'] as const

const inputValue = ref('')
const inputError = ref('')

const validateCatalogueInput = () => {
  inputError.value = validateLogin(inputValue.value).error ?? ''
}
const modalOpen = ref(false)
const toastOpen = ref(false)
const toastType = ref<(typeof toastTypes)[number]>('good')
</script>

<template>
  <div class="box-border w-full px-12 py-8 pb-16 text-ink">
    <h1 class="m-0 mb-6 text-[2rem]">Component Catalogue</h1>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">
        Button &mdash; variants &times; sizes
      </h2>
      <table class="border-collapse">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left" scope="col"></th>
            <th v-for="size in sizes" :key="size" class="px-3 py-2 text-left" scope="col">
              {{ size }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in variants" :key="variant">
            <th class="px-3 py-2 text-left" scope="row">{{ variant }}</th>
            <td v-for="size in sizes" :key="size" class="px-3 py-2 text-left align-middle">
              <Button :variant="variant" :size="size">Button</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Button &mdash; colors</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Button v-for="color in colors" :key="color" :color="color">
          {{ color !== '' ? color : 'default' }}
        </Button>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Button v-for="color in colors" :key="color" :color="color" variant="outlined">
          {{ color !== '' ? color : 'default' }}
        </Button>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Button variant="flat">Flat</Button>
        <Button variant="elevated">Elevated</Button>
        <Button variant="outlined">Outlined</Button>
        <Button disabled>Disabled</Button>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Card</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-4">
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

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Input</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-4">
        <Input
          v-model="inputValue"
          label="Username"
          placeholder="Enter your username"
          hint="This is a hint"
          :error="inputError"
          @blur="validateCatalogueInput"
        />
        <Input model-value="you@example.com" label="Email" type="email" />
        <Input
          model-value="bad input"
          label="Password"
          type="password"
          error="Password is too short"
        />
        <Input model-value="Disabled" label="Disabled" disabled />
      </div>
      <p class="text-sm text-muted">v-model value: {{ inputValue || '(empty)' }}</p>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">UserIcon</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
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

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Icon</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Tooltip v-for="item in iconList" :key="item.name" :text="item.description" placement="top">
          <div
            class="flex min-w-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-surface px-4 py-3 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-[var(--shadow-md)]"
          >
            <Icon :name="item.name" :size="28" />
            <span class="text-xs text-ink-secondary">{{ item.name }}</span>
          </div>
        </Tooltip>
      </div>

      <div class="mb-3 mt-4 flex flex-wrap items-center gap-2.5">
        <Button variant="elevated">
          <template #icon>
            <Icon name="Pencil" :size="18" />
          </template>
          Edit with Icon
        </Button>
        <Button variant="outlined" color="alert">
          <template #icon>
            <Icon name="Trash" :size="18" />
          </template>
          Delete
        </Button>
        <Button variant="flat" size="small" title="Settings">
          <template #icon>
            <Icon name="AdjustmentsHorizontal" />
          </template>
        </Button>
        <Button variant="elevated" size="default" title="AI Actions">
          <template #icon>
            <Icon name="Sparkles" />
          </template>
        </Button>
        <Button variant="outlined" size="large" title="Preview">
          <template #icon>
            <Icon name="Eye" />
          </template>
        </Button>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Modal</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Button @click="modalOpen = true">Open modal</Button>
      </div>
      <Modal v-model="modalOpen" title="Example modal">
        <p>This is the modal body. Press Escape or click the overlay to close.</p>
        <template #footer>
          <Button variant="outlined" @click="modalOpen = false">Cancel</Button>
          <Button @click="modalOpen = false">Confirm</Button>
        </template>
      </Modal>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Toast</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
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
      <div class="mb-4 flex flex-col items-start gap-2.5">
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

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">Tooltip</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
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

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">EditorHeading</h2>
      <EditorHeading
        v-for="level in headings"
        :key="level"
        :level="level"
        :text="`Heading level ${level}`"
      />
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">EditorList</h2>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-4">
        <EditorList :items="['First item', 'Second item', 'Third item']" />
        <EditorList :items="['First item', 'Second item', 'Third item']" ordered />
        <EditorList :items="['Alpha', 'Beta', 'Gamma']" marker="lower-alpha" />
        <EditorList :items="['Dashed', 'Custom', 'Marker']" marker="square" />
      </div>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">EditorCitation</h2>
      <EditorCitation
        source="Ada Lovelace"
        text="That brain of mine is something more than merely mortal, as time will show."
      />
      <EditorCitation
        accent="var(--color-good)"
        bg-color="var(--bg-subtle)"
        text="A citation with a custom accent stripe."
      />
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">EditorCode</h2>
      <EditorCode language="typescript" code="const answer: number = 42" />
      <EditorCode language="python" size="1rem">
        def greet(name): print(f"Hello, {name}")
      </EditorCode>
    </section>

    <section class="mb-12">
      <h2 class="m-0 mb-4 border-b border-line-subtle pb-2 text-xl">EditorHyperlink</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <EditorHyperlink url="https://vuejs.org">Default link</EditorHyperlink>
        <EditorHyperlink url="https://vuejs.org" color="var(--color-good)"
          >Green link</EditorHyperlink
        >
        <EditorHyperlink url="https://vuejs.org" size="1.25rem">Larger link</EditorHyperlink>
        <EditorHyperlink url="https://vuejs.org" :underline="false">No underline</EditorHyperlink>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <EditorHyperlink url="javascript:alert(1)">Rejected javascript: URL</EditorHyperlink>
        <EditorHyperlink url="/relative/path">Rejected relative URL</EditorHyperlink>
      </div>
    </section>
  </div>
</template>
