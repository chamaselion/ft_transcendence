import type { Component } from 'vue'
import type { IconName } from '@/app/components/Icon.vue'
import type { Block, BlockDecorator } from '@/app/editor/types'

export interface BlockRenderContext {
  block: Block
  decorator: BlockDecorator
  editable: boolean
  locked: boolean
  exportMode: boolean
  t: (key: string, params?: Record<string, unknown>) => string
}

/**
 * A block add-in. Every folder under `src/app/blocks/` must contain an
 * `index.ts` that default-exports a definition with this shape.
 *
 * `name` and `description` are shown in the editor interface. The optional
 * i18n keys are used first, so add-ins can ship translated labels.
 */
export interface BlockDefinition {
  type: string
  name: string
  description: string
  nameKey?: string
  descriptionKey?: string
  icon: IconName
  component: Component
  order?: number
  createDecorator: () => BlockDecorator
  normalizeDecorator?: (decorator: BlockDecorator) => BlockDecorator
  props: (context: BlockRenderContext) => Record<string, unknown>
  /** Content is sent to the translation API when true (default true). */
  translatable?: boolean
  /** The AI elaboration menu is available for this block. */
  elaboratable?: boolean
  /** Show the canonical English text under the block in translated views. */
  showCanonicalPreview?: boolean
  /**
   * PDF representation owned by the add-in. `css` is required and appended to
   * the PDF stylesheet; `component` can replace the normal renderer for export,
   * and `props` can provide export-specific props.
   */
  pdf: {
    css: string
    component?: Component
    props?: (context: BlockRenderContext) => Record<string, unknown>
  }
}

export const isBlockDefinition = (value: unknown): value is BlockDefinition => {
  if (!value || typeof value !== 'object') return false
  const definition = value as Partial<BlockDefinition>
  return (
    typeof definition.type === 'string' &&
    typeof definition.name === 'string' &&
    typeof definition.description === 'string' &&
    (typeof definition.component === 'object' || typeof definition.component === 'function') &&
    typeof definition.pdf === 'object' &&
    typeof definition.pdf?.css === 'string' &&
    typeof definition.createDecorator === 'function' &&
    typeof definition.props === 'function'
  )
}
