import type { BlockDefinition } from '@/app/blocks/types'
import ImageBlock from './Block.vue'

export default {
  type: 'img',
  name: 'Image',
  description: 'Upload an image from your device and place it in the document.',
  nameKey: 'editor.blockType.img',
  descriptionKey: 'editor.blockType.imgDescription',
  icon: 'Photo',
  component: ImageBlock,
  order: 55,
  translatable: false,
  showCanonicalPreview: false,
  createDecorator: () => ({ type: 'img', src: '', imageId: '', alt: '' }),
  props: ({ block, decorator, editable, locked, exportMode }) => ({
    src: decorator.src,
    imageId: decorator.imageId,
    alt: decorator.alt,
    caption: block.text,
    editable,
    locked,
    exportMode,
  }),
  pdf: {
    css: `
      .pdf-content .image-block {
        margin: 6pt 0 !important;
        color: #202833 !important;
        background: transparent !important;
      }
      .pdf-content .image-block__frame {
        border: 0 !important;
        background: transparent !important;
        overflow: visible !important;
      }
      .pdf-content .image-block img {
        display: block !important;
        max-width: 100% !important;
        max-height: 220mm !important;
        width: auto !important;
        height: auto !important;
        margin: 0 auto !important;
        object-fit: contain !important;
      }
      .pdf-content .image-block__caption {
        margin-top: 4pt !important;
        color: #526071 !important;
        font-family: Helvetica, Arial, sans-serif !important;
        font-size: 9pt !important;
        text-align: center !important;
      }
      .pdf-content .image-block button,
      .pdf-content .image-block input[type='file'] {
        display: none !important;
      }
    `,
  },
} satisfies BlockDefinition
