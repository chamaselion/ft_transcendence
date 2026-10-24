import { httpClient } from '@/auth/auth.api'

export type SupportedLanguage = 'en' | 'de' | 'hu'

export interface TranslationBlockPayload {
  id: string
  text: string
}

export interface BatchTranslationResponse {
  blocks: TranslationBlockPayload[]
  sourceLang: SupportedLanguage
  targetLang: SupportedLanguage
}

export interface SingleTranslationResponse {
  text: string
  sourceLang: SupportedLanguage
  targetLang: SupportedLanguage
}

export interface TranslateOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ChunkBlocksOptions {
  maxBlocks?: number
  maxChars?: number
}

export const DEFAULT_TRANSLATE_TIMEOUT_MS = 35000
export const DEFAULT_TRANSLATE_CHUNK_BLOCKS = 5
export const DEFAULT_TRANSLATE_CHUNK_CHARS = 2000

/**
 * Splits blocks into small batches so a large document is translated through
 * several bounded requests instead of one long-running one.
 */
export function chunkBlocks(
  blocks: TranslationBlockPayload[],
  {
    maxBlocks = DEFAULT_TRANSLATE_CHUNK_BLOCKS,
    maxChars = DEFAULT_TRANSLATE_CHUNK_CHARS,
  }: ChunkBlocksOptions = {},
): TranslationBlockPayload[][] {
  const chunks: TranslationBlockPayload[][] = []
  let current: TranslationBlockPayload[] = []
  let currentChars = 0

  for (const block of blocks) {
    if (!block.text.trim()) continue

    const exceedsChars = currentChars + block.text.length > maxChars
    const exceedsBlocks = current.length >= maxBlocks
    if (current.length > 0 && (exceedsChars || exceedsBlocks)) {
      chunks.push(current)
      current = []
      currentChars = 0
    }

    current.push(block)
    currentChars += block.text.length
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}

/**
 * Translates a batch of document blocks from sourceLang to targetLang.
 */
export async function translateBlocks(
  blocks: TranslationBlockPayload[],
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage,
  options: TranslateOptions = {},
): Promise<TranslationBlockPayload[]> {
  if (sourceLang === targetLang || blocks.length === 0) {
    return blocks
  }
  const response = await httpClient.post<BatchTranslationResponse>(
    '/api/ai/translate',
    {
      blocks,
      sourceLang,
      targetLang,
    },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_TRANSLATE_TIMEOUT_MS,
    },
  )

  return response.blocks || []
}

/**
 * Back-translates a single block's text into English (or another target language),
 * optionally providing surrounding document text as context.
 */
export async function backTranslateBlock(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage = 'en',
  context?: string,
): Promise<string> {
  if (sourceLang === targetLang || !text.trim()) {
    return text
  }

  const response = await httpClient.post<SingleTranslationResponse>('/api/ai/translate', {
    text,
    sourceLang,
    targetLang,
    context: context || undefined,
  })

  return response.text ?? ''
}
