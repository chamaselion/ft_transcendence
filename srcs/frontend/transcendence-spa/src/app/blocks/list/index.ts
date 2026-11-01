import type { BlockDefinition } from '@/app/blocks/types'
import ListBlock from './Block.vue'

export default {
  type: 'li',
  name: 'List',
  description: 'Bulleted, numbered or checklist list.',
  nameKey: 'editor.blockType.li',
  descriptionKey: 'editor.blockType.liDescription',
  icon: 'List',
  component: ListBlock,
  order: 20,
  translatable: true,
  showCanonicalPreview: true,
  createDecorator: () => ({ type: 'li', ordered: false, checklist: false, checked: [] }),
  props: ({ block, decorator, editable, locked, exportMode }) => ({
    text: block.text,
    ordered: Boolean(decorator.ordered),
    marker: decorator.marker,
    checklist: Boolean(decorator.checklist),
    checked: Array.isArray(decorator.checked) ? decorator.checked : [],
    editable,
    locked,
    exportMode,
  }),
  pdf: {
    css: `
      .pdf-content .list {
        font-family: Helvetica, Arial, sans-serif !important;
        font-size: 11pt !important;
        line-height: 1.45 !important;
        color: #202833 !important;
        background: transparent !important;
        margin: 0 !important;
        padding: 0 0 0 18pt !important;
        border-radius: 0 !important;
      }
      .pdf-content .list li {
        line-height: 1.45 !important;
        margin: 0 0 4pt !important;
        padding-left: 3pt;
        word-spacing: normal !important;
        white-space: pre-wrap !important;
        overflow-wrap: anywhere;
        orphans: 3;
        widows: 3;
      }
      .pdf-content .list li::marker {
        color: #334e75;
        font-weight: 700;
      }
      .pdf-content .list--export {
        list-style: none !important;
        padding: 0 0 0 18pt !important;
      }
      .pdf-content .list--export .list__item {
        padding-left: 0 !important;
        text-indent: -18pt !important;
      }
      .pdf-content .list--export .list__marker {
        display: inline-block !important;
        width: 18pt !important;
        padding-right: 4pt !important;
        text-indent: 0 !important;
        text-align: right !important;
        font-weight: 700;
        color: #334e75;
      }
      .pdf-content .list--export--checklist {
        padding-left: 26pt !important;
      }
      .pdf-content .list--export--checklist .list__item {
        text-indent: -26pt !important;
      }
      .pdf-content .list--export--checklist .list__marker {
        width: 26pt !important;
        font-family: Courier, 'Courier New', monospace !important;
        font-size: 9pt !important;
        text-align: left !important;
      }
      .pdf-content .list--export .list__item--checked {
        color: #526071 !important;
      }
      .pdf-content .list--export .list__item--checked .list__marker {
        color: #526071 !important;
      }
    `,
  },
} satisfies BlockDefinition
