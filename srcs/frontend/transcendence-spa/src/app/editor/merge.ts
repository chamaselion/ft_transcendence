import type { Block, SyncOperation } from './types'
import { fingerprintBlock } from './contentHash'

export interface BaseBlock {
  id: string
  fingerprint: string
}

export interface BaseSnapshot {
  contentHash: string
  title: string
  blocks: BaseBlock[]
}

export interface ConflictVersion {
  text: string
  decorator: string
}

export type BlockConflictKind = 'diff' | 'remote-deleted' | 'local-deleted'

export interface BlockConflict {
  blockId: string
  kind: BlockConflictKind
  local: ConflictVersion | null
  remote: ConflictVersion | null
  remoteFingerprint: string | null
}

export interface TitleConflict {
  local: string
  remote: string
}

export interface MergeResult {
  blocks: Block[]
  title: string
  ops: SyncOperation[]
  conflicts: Record<string, BlockConflict>
  titleConflict: TitleConflict | null
  baseBlocks: Block[]
  baseTitle: string
}

const cloneBlock = (block: Block): Block => ({ ...block })

const cloneVersion = (block: Block): ConflictVersion => ({
  text: block.text,
  decorator: block.decorator,
})

const fingerprintMap = async (blocks: Block[]): Promise<Map<string, string>> => {
  const entries = await Promise.all(
    blocks.map(async (block) => [block.id, await fingerprintBlock(block)] as const),
  )
  return new Map(entries)
}

export function applyOpsToBlocks(blocks: Block[], ops: SyncOperation[]): Block[] {
  const next = blocks.map(cloneBlock)
  for (const op of ops) {
    if (op.kind === 'title') continue
    if (op.kind === 'set') {
      const index = next.findIndex((block) => block.id === op.blockId)
      const target = next[index]
      if (index === -1 || !target) continue
      if (op.text !== undefined) target.text = op.text
      if (op.decorator !== undefined) target.decorator = op.decorator
      continue
    }
    if (op.kind === 'delete') {
      const index = next.findIndex((block) => block.id === op.blockId)
      if (index !== -1) next.splice(index, 1)
      continue
    }
    if (op.kind === 'create') {
      if (next.some((block) => block.id === op.block.id)) continue
      const afterId = op.afterBlockId
      const index = afterId ? next.findIndex((block) => block.id === afterId) : -1
      if (index !== -1) next.splice(index + 1, 0, cloneBlock(op.block))
      else next.push(cloneBlock(op.block))
    }
  }
  return next
}

export async function createBaseSnapshot(
  blocks: Block[],
  title: string,
  contentHash: string,
): Promise<BaseSnapshot> {
  const fingerprints = await fingerprintMap(blocks)
  return {
    contentHash,
    title,
    blocks: blocks.map((block) => ({
      id: block.id,
      fingerprint: fingerprints.get(block.id) ?? '',
    })),
  }
}

export async function buildLocalOnlyOps(
  localBlocks: Block[],
  localTitle: string,
  base: BaseSnapshot,
  { excludedBlockIds = new Set<string>(), includeTitle = true } = {},
): Promise<{ ops: SyncOperation[]; blocks: Block[]; title: string }> {
  const baseById = new Map(base.blocks.map((block) => [block.id, block.fingerprint]))
  const localFingerprints = await fingerprintMap(localBlocks)
  const ops: SyncOperation[] = []
  let previousId: string | null = null

  for (const block of localBlocks) {
    const localFingerprint = localFingerprints.get(block.id) ?? ''
    const baseFingerprint = baseById.get(block.id)
    if (!excludedBlockIds.has(block.id)) {
      if (!baseFingerprint) {
        ops.push({
          kind: 'create',
          block: cloneBlock(block),
          afterBlockId: previousId,
          expected: null,
        })
      } else if (baseFingerprint !== localFingerprint) {
        ops.push({
          kind: 'set',
          blockId: block.id,
          text: block.text,
          decorator: block.decorator,
          expected: baseFingerprint,
        })
      }
    }
    previousId = block.id
  }

  const localIds = new Set(localBlocks.map((block) => block.id))
  for (const baseBlock of base.blocks) {
    if (!localIds.has(baseBlock.id) && !excludedBlockIds.has(baseBlock.id)) {
      ops.push({ kind: 'delete', blockId: baseBlock.id, expected: baseBlock.fingerprint })
    }
  }

  if (includeTitle && localTitle !== base.title) {
    ops.push({ kind: 'title', title: localTitle, expectedTitle: base.title })
  }

  return { ops, blocks: localBlocks.map(cloneBlock), title: localTitle }
}

interface Decision {
  final: Block | null
  setOp?: Extract<SyncOperation, { kind: 'set' }>
  deleteOp?: Extract<SyncOperation, { kind: 'delete' }>
  create?: boolean
  conflict?: BlockConflict
}

export async function mergeDocuments({
  base,
  localBlocks,
  localTitle,
  remoteBlocks,
  remoteTitle,
}: {
  base: BaseSnapshot
  localBlocks: Block[]
  localTitle: string
  remoteBlocks: Block[]
  remoteTitle: string
}): Promise<MergeResult> {
  const baseById = new Map(base.blocks.map((block) => [block.id, block.fingerprint]))
  const localById = new Map(localBlocks.map((block) => [block.id, block]))
  const remoteById = new Map(remoteBlocks.map((block) => [block.id, block]))
  const localFingerprints = await fingerprintMap(localBlocks)
  const remoteFingerprints = await fingerprintMap(remoteBlocks)
  const ids = new Set<string>([...baseById.keys(), ...localById.keys(), ...remoteById.keys()])
  const decisions = new Map<string, Decision>()

  for (const id of ids) {
    const baseFingerprint = baseById.get(id)
    const local = localById.get(id)
    const remote = remoteById.get(id)
    const localFingerprint = local ? (localFingerprints.get(id) ?? '') : null
    const remoteFingerprint = remote ? (remoteFingerprints.get(id) ?? '') : null
    const localChanged = baseFingerprint
      ? !local || localFingerprint !== baseFingerprint
      : Boolean(local)
    const remoteChanged = baseFingerprint
      ? !remote || remoteFingerprint !== baseFingerprint
      : Boolean(remote)

    if (!baseFingerprint) {
      if (local && !remote) {
        decisions.set(id, { final: cloneBlock(local), create: true })
        continue
      }
      if (remote && !local) {
        decisions.set(id, { final: cloneBlock(remote) })
        continue
      }
      if (local && remote) {
        if (localFingerprint === remoteFingerprint) {
          decisions.set(id, { final: cloneBlock(remote) })
        } else {
          decisions.set(id, {
            final: cloneBlock(local),
            conflict: {
              blockId: id,
              kind: 'diff',
              local: cloneVersion(local),
              remote: cloneVersion(remote),
              remoteFingerprint,
            },
          })
        }
      }
      continue
    }

    if (local && remote) {
      if (!localChanged && !remoteChanged) {
        decisions.set(id, { final: cloneBlock(remote) })
      } else if (localChanged && !remoteChanged) {
        decisions.set(id, {
          final: cloneBlock(local),
          setOp: {
            kind: 'set',
            blockId: id,
            text: local.text,
            decorator: local.decorator,
            expected: remoteFingerprint ?? baseFingerprint,
          },
        })
      } else if (!localChanged && remoteChanged) {
        decisions.set(id, { final: cloneBlock(remote) })
      } else if (localFingerprint === remoteFingerprint) {
        decisions.set(id, { final: cloneBlock(remote) })
      } else {
        decisions.set(id, {
          final: cloneBlock(local),
          conflict: {
            blockId: id,
            kind: 'diff',
            local: cloneVersion(local),
            remote: cloneVersion(remote),
            remoteFingerprint,
          },
        })
      }
      continue
    }

    if (local && !remote) {
      if (!localChanged) {
        decisions.set(id, { final: null })
      } else {
        decisions.set(id, {
          final: cloneBlock(local),
          conflict: {
            blockId: id,
            kind: 'remote-deleted',
            local: cloneVersion(local),
            remote: null,
            remoteFingerprint: null,
          },
        })
      }
      continue
    }

    if (!local && remote) {
      if (!remoteChanged) {
        decisions.set(id, {
          final: null,
          deleteOp: {
            kind: 'delete',
            blockId: id,
            expected: remoteFingerprint ?? baseFingerprint,
          },
        })
      } else {
        decisions.set(id, {
          final: cloneBlock(remote),
          conflict: {
            blockId: id,
            kind: 'local-deleted',
            local: null,
            remote: cloneVersion(remote),
            remoteFingerprint,
          },
        })
      }
      continue
    }

    decisions.set(id, { final: null })
  }

  const finalById = new Map<string, Block>()
  for (const [id, decision] of decisions) {
    if (decision.final) finalById.set(id, decision.final)
  }

  const ordered: Block[] = []
  const orderedIds = new Set<string>()
  for (const remote of remoteBlocks) {
    const final = finalById.get(remote.id)
    if (final && !orderedIds.has(final.id)) {
      ordered.push(final)
      orderedIds.add(final.id)
    }
  }

  for (let index = 0; index < localBlocks.length; index += 1) {
    const local = localBlocks[index]
    if (!local) continue
    const final = finalById.get(local.id)
    if (!final || orderedIds.has(final.id)) continue

    let predecessorId: string | null = null
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const candidate = localBlocks[previous]
      if (candidate && orderedIds.has(candidate.id)) {
        predecessorId = candidate.id
        break
      }
    }
    const insertAt = predecessorId
      ? ordered.findIndex((block) => block.id === predecessorId) + 1
      : index === 0
        ? 0
        : ordered.length
    ordered.splice(insertAt, 0, final)
    orderedIds.add(final.id)
  }

  for (const [id, decision] of decisions) {
    if (decision.final && !orderedIds.has(id)) {
      ordered.push(decision.final)
      orderedIds.add(id)
    }
  }

  const orderIndex = new Map(ordered.map((block, index) => [block.id, index]))
  const ops: SyncOperation[] = []
  const conflicts: Record<string, BlockConflict> = {}
  for (const [id, decision] of decisions) {
    if (decision.conflict) conflicts[id] = decision.conflict
  }

  for (const block of ordered) {
    const decision = decisions.get(block.id)
    if (!decision) continue
    if (decision.create) {
      const index = orderIndex.get(block.id) ?? 0
      const previous = ordered[index - 1]
      ops.push({
        kind: 'create',
        block: cloneBlock(block),
        afterBlockId: previous?.id ?? null,
        expected: null,
      })
    } else if (decision.setOp) {
      ops.push({
        ...decision.setOp,
        text: block.text,
        decorator: block.decorator,
      })
    }
  }
  for (const decision of decisions.values()) {
    if (decision.deleteOp) ops.push(decision.deleteOp)
  }

  let finalTitle = remoteTitle
  let titleConflict: TitleConflict | null = null
  const localTitleChanged = localTitle !== base.title
  const remoteTitleChanged = remoteTitle !== base.title
  if (localTitleChanged && remoteTitleChanged) {
    if (localTitle === remoteTitle) {
      finalTitle = remoteTitle
    } else {
      finalTitle = localTitle
      titleConflict = { local: localTitle, remote: remoteTitle }
    }
  } else if (localTitleChanged) {
    finalTitle = localTitle
    ops.push({ kind: 'title', title: localTitle, expectedTitle: remoteTitle })
  }

  const baseBlocks = applyOpsToBlocks(remoteBlocks, ops)
  const baseTitle = titleConflict
    ? remoteTitle
    : ops.some((op) => op.kind === 'title')
      ? finalTitle
      : remoteTitle

  return {
    blocks: ordered,
    title: finalTitle,
    ops,
    conflicts,
    titleConflict,
    baseBlocks,
    baseTitle,
  }
}
