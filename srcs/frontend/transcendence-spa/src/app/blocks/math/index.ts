import type { BlockDefinition } from '@/app/blocks/types'
import MathBlock from './Block.vue'

export default {
  type: 'math',
  name: 'Formula',
  description: 'Mathematical formula written in LaTeX and rendered with KaTeX.',
  nameKey: 'editor.blockType.math',
  descriptionKey: 'editor.blockType.mathDescription',
  icon: 'Math',
  component: MathBlock,
  order: 50,
  translatable: false,
  showCanonicalPreview: false,
  createDecorator: () => ({ type: 'math', displayMode: 'block' }),
  props: ({ block, decorator, editable, locked, t }) => ({
    latex: block.text,
    displayMode: decorator.displayMode === 'inline' ? 'inline' : 'block',
    editable,
    locked,
    placeholder: t('editor.math.placeholder'),
  }),
  pdf: {
    css: `
      .pdf-content .math-block {
        margin: 6pt 0 !important;
        color: #202833 !important;
        background: transparent !important;
      }
      .pdf-content .math-block__input {
        display: none !important;
      }
      .pdf-content .math-block__preview {
        border: 0 !important;
        background: transparent !important;
        padding: 0 !important;
        overflow: visible !important;
        color: #202833 !important;
      }
      .pdf-content .math-block .katex {
        font-size: 13pt !important;
        color: #202833 !important;
      }
      .pdf-content .math-block .katex-display {
        margin: 0 !important;
      }
      .pdf-content .math-block .katex-display > .katex {
        white-space: normal !important;
      }
    `,
  },
} satisfies BlockDefinition
