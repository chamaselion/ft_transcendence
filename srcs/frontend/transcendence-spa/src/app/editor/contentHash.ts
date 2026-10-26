import type { Block } from './types'

const canonical = (block: Pick<Block, 'id' | 'text' | 'decorator'>): unknown[] => [
  block.id,
  block.text ?? '',
  block.decorator ?? '',
]

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(digest)
}

export async function fingerprintBlock(
  block: Pick<Block, 'id' | 'text' | 'decorator'>,
): Promise<string> {
  return sha256Hex(JSON.stringify(canonical(block)))
}

export async function hashBlocks(blocks: Block[]): Promise<string> {
  const canonicalBlocks = blocks.map((block) => canonical(block))
  return sha256Hex(JSON.stringify(canonicalBlocks))
}
