import type { BlockDefinition } from '@/app/blocks/types'
import CodeBlock from './Block.vue'

export default {
  type: 'c',
  name: 'Code',
  description: 'Monospace code block with syntax language label.',
  nameKey: 'editor.blockType.c',
  descriptionKey: 'editor.blockType.cDescription',
  icon: 'Code',
  component: CodeBlock,
  order: 40,
  translatable: false,
  showCanonicalPreview: false,
  createDecorator: () => ({ type: 'c', language: 'plaintext' }),
  props: ({ block, decorator, editable, locked, t }) => ({
    code: block.text,
    language: decorator.language,
    editable,
    locked,
    placeholder: t('editor.placeholder.c'),
  }),
  pdf: {
    css: `
      .pdf-content .code {
        margin: 4pt 0 !important;
        padding: 10pt 12pt !important;
        background: #fff !important;
        color: #202833 !important;
        border: 0.5pt solid #cbd5e1 !important;
        border-radius: 0 !important;
        overflow: visible !important;
      }
      .pdf-content .code__header {
        display: block !important;
        margin: 0 0 8pt !important;
        padding: 0 0 6pt !important;
        background: transparent !important;
        border: 0 !important;
        border-bottom: 0.5pt solid #cbd5e1 !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-size: 8pt !important;
        font-weight: 700;
        line-height: 1.2 !important;
        color: #526071 !important;
        text-transform: uppercase;
        letter-spacing: 0.5pt;
      }
      .pdf-content .code__export-language,
      .pdf-content .code__language {
        display: inline !important;
        color: #526071 !important;
      }
      .pdf-content .code__pre,
      .pdf-content .code__content {
        font-family: Courier, 'Courier New', monospace !important;
        font-size: 9pt !important;
        line-height: 1.4 !important;
        color: #202833 !important;
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        overflow: visible !important;
        tab-size: 4;
      }
    `,
  },
} satisfies BlockDefinition
