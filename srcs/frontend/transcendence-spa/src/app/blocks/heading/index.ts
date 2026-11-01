import type { BlockDefinition } from '@/app/blocks/types'
import HeadingBlock from './Block.vue'

export default {
  type: 'h',
  name: 'Heading',
  description: 'Section heading with six levels.',
  nameKey: 'editor.blockType.h',
  descriptionKey: 'editor.blockType.hDescription',
  icon: 'H1',
  component: HeadingBlock,
  order: 10,
  translatable: true,
  showCanonicalPreview: true,
  createDecorator: () => ({ type: 'h', level: 2 }),
  props: ({ block, decorator, editable, locked, t }) => ({
    text: block.text,
    level: decorator.level ?? 2,
    editable,
    locked,
    placeholder: t('editor.placeholder.h'),
  }),
  pdf: {
    css: `
      .pdf-content .heading {
        font-family: Helvetica, Arial, sans-serif !important;
        color: #202833 !important;
        background: transparent !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        margin: 16pt 0 0 !important;
        border-radius: 0 !important;
        letter-spacing: normal !important;
        text-transform: none !important;
        break-after: avoid;
        page-break-after: avoid;
        overflow-wrap: anywhere;
      }
      .pdf-content .editor-block:first-child .heading { margin-top: 0 !important; }
      .pdf-content h1.heading {
        font-size: 24pt !important;
        color: #172b4d !important;
        padding-bottom: 10pt;
        border-bottom: 2pt solid #334e75;
      }
      .pdf-content h2.heading {
        font-size: 17pt !important;
        color: #243e63 !important;
        padding-bottom: 6pt;
        border-bottom: 0.5pt solid #cbd5e1;
      }
      .pdf-content h3.heading { font-size: 13pt !important; }
      .pdf-content h4.heading { font-size: 12pt !important; }
      .pdf-content h5.heading,
      .pdf-content h6.heading { font-size: 11pt !important; }
      .pdf-content h6.heading { font-style: italic; }
    `,
  },
} satisfies BlockDefinition
