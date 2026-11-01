import type { BlockDefinition } from '@/app/blocks/types'
import CitationBlock from './Block.vue'

export default {
  type: 'cit',
  name: 'Citation',
  description: 'Quoted text with an optional source.',
  nameKey: 'editor.blockType.cit',
  descriptionKey: 'editor.blockType.citDescription',
  icon: 'Quote',
  component: CitationBlock,
  order: 30,
  translatable: false,
  showCanonicalPreview: false,
  createDecorator: () => ({ type: 'cit', source: '' }),
  props: ({ block, decorator, editable, locked, t }) => ({
    text: block.text,
    source: decorator.source,
    editable,
    locked,
    placeholder: t('editor.placeholder.cit'),
  }),
  pdf: {
    css: `
      .pdf-content .citation {
        display: block !important;
        margin: 4pt 0 !important;
        padding: 12pt 14pt !important;
        background: #fff !important;
        border-left: 3pt solid #64748b;
        border-radius: 0 !important;
        font-family: Times, 'Times New Roman', serif !important;
        font-size: 12pt !important;
        font-style: italic;
        color: #202833 !important;
      }
      .pdf-content .citation__stripe { display: none !important; }
      .pdf-content .citation__text {
        word-spacing: normal !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere;
      }
      .pdf-content .citation__source {
        margin-top: 6pt !important;
        font-size: 9pt !important;
        color: #526071 !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-style: normal;
      }
    `,
  },
} satisfies BlockDefinition
