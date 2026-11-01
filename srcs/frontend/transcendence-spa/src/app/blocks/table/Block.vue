<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div ref="tableRoot" class="table-block flex flex-col gap-2" :class="{ 'opacity-70': locked }">
    <div
      v-if="isEditable"
      class="table-block__toolbar flex flex-wrap items-center gap-1.5 text-xs text-muted"
    >
      <button
        type="button"
        class="table-block__control"
        :aria-label="$t('editor.table.addRow')"
        :title="$t('editor.table.addRow')"
        @click="addRow"
      >
        {{ $t('editor.table.addRow') }}
      </button>
      <button
        type="button"
        class="table-block__control"
        :aria-label="$t('editor.table.addColumn')"
        :title="$t('editor.table.addColumn')"
        @click="addColumn"
      >
        {{ $t('editor.table.addColumn') }}
      </button>
      <button
        type="button"
        class="table-block__control"
        :disabled="rows.length <= 1"
        :aria-label="$t('editor.table.removeRow')"
        :title="$t('editor.table.removeRow')"
        @click="removeRow"
      >
        {{ $t('editor.table.removeRow') }}
      </button>
      <button
        type="button"
        class="table-block__control"
        :disabled="columnCount <= 1"
        :aria-label="$t('editor.table.removeColumn')"
        :title="$t('editor.table.removeColumn')"
        @click="removeColumn"
      >
        {{ $t('editor.table.removeColumn') }}
      </button>
      <label class="ml-auto inline-flex cursor-pointer items-center gap-1.5">
        <input v-model="headerRow" type="checkbox" @change="emitData" />
        {{ $t('editor.table.headerRow') }}
      </label>
    </div>

    <div class="table-block__scroll overflow-x-auto rounded-md border border-line-subtle">
      <table class="w-full min-w-[32rem] border-collapse text-left text-sm">
        <tbody>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
            class="border-b border-line-subtle last:border-b-0"
            :class="{ 'table-block__row--header': headerRow && rowIndex === 0 }"
          >
            <td
              v-for="(cell, columnIndex) in row"
              :key="columnIndex"
              class="min-w-[8rem] border-r border-line-subtle p-0 align-top last:border-r-0"
              :class="{ 'bg-subtle/60 font-semibold': headerRow && rowIndex === 0 }"
            >
              <input
                v-if="isEditable"
                :value="cell"
                class="table-block__cell w-full min-w-[7rem] bg-transparent px-2.5 py-1.5 text-inherit outline-none focus:bg-brand/5"
                :aria-label="cellLabel(rowIndex, columnIndex)"
                :placeholder="$t('editor.table.cellPlaceholder')"
                @input="onInput(rowIndex, columnIndex, $event)"
                @focus="onFocus"
                @blur="onBlur"
              />
              <span v-else class="block px-2.5 py-1.5 whitespace-pre-wrap">{{ cell }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    rows?: string[][]
    headerRow?: boolean
    editable?: boolean
    locked?: boolean
    exportMode?: boolean
  }>(),
  {
    rows: () => [
      ['', ''],
      ['', ''],
    ],
    headerRow: true,
    editable: false,
    locked: false,
    exportMode: false,
  },
)

const emit = defineEmits<{
  'update:data': [value: { rows: string[][]; headerRow: boolean }]
  focus: []
  blur: []
}>()

const { t } = useI18n()
const isEditable = computed(() => props.editable && !props.locked && !props.exportMode)

const normalizeRows = (value: string[][] | undefined): string[][] => {
  const source = Array.isArray(value) && value.length > 0 ? value : [['', '']]
  const width = Math.max(1, ...source.map((row) => (Array.isArray(row) ? row.length : 0)))
  return source.map((row) =>
    Array.from({ length: width }, (_, index) =>
      typeof row?.[index] === 'string' ? row[index] : '',
    ),
  )
}

const tableRoot = ref<HTMLElement | null>(null)
const rows = ref<string[][]>(normalizeRows(props.rows))
const headerRow = ref(props.headerRow !== false)
const columnCount = computed(() => rows.value[0]?.length ?? 0)
let focused = false
let emitTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.rows,
  (next) => {
    if (focused) return
    rows.value = normalizeRows(next)
  },
  { deep: true },
)

watch(
  () => props.headerRow,
  (next) => {
    if (!focused) headerRow.value = next !== false
  },
)

function cellLabel(rowIndex: number, columnIndex: number): string {
  return t('editor.table.cellLabel', { row: rowIndex + 1, column: columnIndex + 1 })
}

function emitData() {
  if (emitTimer) {
    clearTimeout(emitTimer)
    emitTimer = null
  }
  emit('update:data', { rows: normalizeRows(rows.value), headerRow: headerRow.value })
}

function scheduleEmit() {
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(emitData, 350)
}

function onInput(rowIndex: number, columnIndex: number, event: Event) {
  const target = event.target as HTMLInputElement
  const row = rows.value[rowIndex]
  if (!row) return
  row[columnIndex] = target.value
  scheduleEmit()
}

function onFocus() {
  focused = true
  emit('focus')
}

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && tableRoot.value?.contains(next)) {
    emitData()
    return
  }
  focused = false
  emitData()
  emit('blur')
}

function addRow() {
  const width = Math.max(1, columnCount.value)
  rows.value.push(Array.from({ length: width }, () => ''))
  emitData()
}

function removeRow() {
  if (rows.value.length <= 1) return
  rows.value.pop()
  emitData()
}

function addColumn() {
  for (const row of rows.value) row.push('')
  emitData()
}

function removeColumn() {
  if (columnCount.value <= 1) return
  for (const row of rows.value) row.pop()
  emitData()
}
</script>

<style scoped>
.table-block__control {
  border: 1px solid var(--color-line-subtle);
  border-radius: 0.375rem;
  padding: 0.15rem 0.45rem;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
}

.table-block__control:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.table-block__control:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.table-block__row--header td {
  background: var(--bg-header);
  font-weight: 700;
  color: var(--text-primary);
  border-bottom: 2px solid var(--color-primary);
}
</style>
