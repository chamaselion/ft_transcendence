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

/**
 * Translates a batch of document blocks from sourceLang to targetLang.
 */
export async function translateBlocks(
  blocks: TranslationBlockPayload[],
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage,
): Promise<TranslationBlockPayload[]> {
  if (sourceLang === targetLang || blocks.length === 0) {
    return blocks
  }
  const response = await httpClient.post<BatchTranslationResponse>('/api/ai/translate', {
    blocks,
    sourceLang,
    targetLang,
  })

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
