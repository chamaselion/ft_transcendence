import type { BlockDefinition } from '@/app/blocks/types'
import ParagraphBlock from './Block.vue'

export default {
  type: 'p',
  name: 'Paragraph',
  description: 'Plain text with optional alignment.',
  nameKey: 'editor.blockType.p',
  descriptionKey: 'editor.blockType.pDescription',
  icon: 'Paragraph',
  component: ParagraphBlock,
  order: 0,
  translatable: true,
  elaboratable: true,
  showCanonicalPreview: true,
  createDecorator: () => ({ type: 'p', align: 'left' }),
  props: ({ block, decorator, editable, locked, t }) => ({
    text: block.text,
    align: decorator.align || 'left',
    editable,
    locked,
    placeholder: t('editor.placeholder.p'),
  }),
  pdf: {
    css: `
      .pdf-content .paragraph {
        font-family: Helvetica, Arial, sans-serif !important;
        font-size: 11pt !important;
        line-height: 1.45 !important;
        color: #202833 !important;
        background: transparent !important;
        margin: 0 !important;
        border-radius: 0 !important;
        word-spacing: normal !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere;
        orphans: 3;
        widows: 3;
      }
    `,
  },
} satisfies BlockDefinition
