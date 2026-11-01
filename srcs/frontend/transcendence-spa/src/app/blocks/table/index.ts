import type { BlockDefinition } from '@/app/blocks/types'
import TableBlock from './Block.vue'

const emptyTable = () => [
  ['', ''],
  ['', ''],
]

export default {
  type: 'table',
  name: 'Table',
  description: 'Editable table with an optional header row and horizontal scrolling.',
  nameKey: 'editor.blockType.table',
  descriptionKey: 'editor.blockType.tableDescription',
  icon: 'Table',
  component: TableBlock,
  order: 60,
  translatable: false,
  showCanonicalPreview: false,
  createDecorator: () => ({ type: 'table', rows: emptyTable(), headerRow: true }),
  normalizeDecorator: (decorator) => ({
    ...decorator,
    type: 'table',
    rows: Array.isArray(decorator.rows) ? decorator.rows : emptyTable(),
    headerRow: decorator.headerRow !== false,
  }),
  props: ({ decorator, editable, locked, exportMode }) => ({
    rows: Array.isArray(decorator.rows) ? decorator.rows : emptyTable(),
    headerRow: decorator.headerRow !== false,
    editable,
    locked,
    exportMode,
  }),
  pdf: {
    css: `
      .pdf-content .table-block {
        margin: 6pt 0 !important;
        color: #202833 !important;
        background: transparent !important;
      }
      .pdf-content .table-block__toolbar {
        display: none !important;
      }
      .pdf-content .table-block__scroll {
        overflow: visible !important;
        border: 0.5pt solid #94a3b8 !important;
        border-radius: 0 !important;
      }
      .pdf-content .table-block table {
        width: 100% !important;
        min-width: 0 !important;
        border-collapse: collapse !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-size: 9pt !important;
        line-height: 1.35 !important;
      }
      .pdf-content .table-block td {
        border: 0.5pt solid #94a3b8 !important;
        padding: 4pt 6pt !important;
        vertical-align: top !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        background: transparent !important;
      }
      .pdf-content .table-block__row--header td {
        background: #e2e8f0 !important;
        color: #172b4d !important;
        font-weight: 700 !important;
        border-bottom: 1pt solid #64748b !important;
      }
    `,
  },
} satisfies BlockDefinition
