import type { Block } from './types'
import type { BaseSnapshot, BlockConflict, TitleConflict } from './merge'
import type { SupportedLanguage } from './translation.api'

export interface EditorDraft {
  version: 1
  documentId: string
  userId: string
  savedAt: number
  base: BaseSnapshot | null
  blocks: Block[]
  title: string
  activeLanguage: SupportedLanguage
  canonicalEnglish: Record<string, string>
  dirtyBlockIds: string[]
  conflicts: Record<string, BlockConflict>
  titleConflict: TitleConflict | null
}

const DRAFT_PREFIX = 'transedit:draft:'
const DRAFT_VERSION = 1

export const draftStorageKey = (userId: string, documentId: string): string =>
  `${DRAFT_PREFIX}${userId}:${documentId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function loadDraft(userId: string, documentId: string): EditorDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(userId, documentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EditorDraft>
    if (
      parsed.version !== DRAFT_VERSION ||
      parsed.documentId !== documentId ||
      parsed.userId !== userId ||
      !Array.isArray(parsed.blocks) ||
      !isRecord(parsed.conflicts)
    ) {
      return null
    }
    const base =
      parsed.base &&
      typeof parsed.base === 'object' &&
      Array.isArray(parsed.base.blocks) &&
      typeof parsed.base.contentHash === 'string' &&
      typeof parsed.base.title === 'string'
        ? parsed.base
        : null

    return {
      version: DRAFT_VERSION,
      documentId,
      userId,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      base,
      blocks: parsed.blocks
        .filter(
          (block): block is Block =>
            Boolean(block) &&
            typeof block === 'object' &&
            typeof (block as Block).id === 'string' &&
            typeof (block as Block).text === 'string' &&
            typeof (block as Block).decorator === 'string',
        )
        .map((block) => ({ ...block, lockedBy: block.lockedBy ?? null })),
      title: typeof parsed.title === 'string' ? parsed.title : '',
      activeLanguage:
        parsed.activeLanguage === 'de' || parsed.activeLanguage === 'hu'
          ? parsed.activeLanguage
          : 'en',
      canonicalEnglish: isRecord(parsed.canonicalEnglish)
        ? (parsed.canonicalEnglish as Record<string, string>)
        : {},
      dirtyBlockIds: Array.isArray(parsed.dirtyBlockIds)
        ? parsed.dirtyBlockIds.filter((id): id is string => typeof id === 'string')
        : [],
      conflicts: parsed.conflicts as Record<string, BlockConflict>,
      titleConflict: parsed.titleConflict ?? null,
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: EditorDraft): boolean {
  try {
    localStorage.setItem(draftStorageKey(draft.userId, draft.documentId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearDraft(userId: string, documentId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(userId, documentId))
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function clearAllDrafts(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}
