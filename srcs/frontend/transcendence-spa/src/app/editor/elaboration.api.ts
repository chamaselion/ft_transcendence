import { httpClient } from '@/auth/auth.api'

export type PersonaKey =
  | 'devils_advocate'
  | 'summarizer'
  | 'storyteller'
  | 'pragmatist'
  | 'diplomat'
  | 'marketer'
  | 'auditor'
  | 'specifier'

export interface PersonaDefinition {
  key: PersonaKey
  name: string
  category: string
  description: string
}

export interface PersonaResponse {
  personas: PersonaDefinition[]
}

export const PERSONA_CATEGORY_KEYS: Record<string, string> = {
  'Structural & Analytical Personas': 'structural',
  'Tone & Voice Personas': 'tone',
  'Action & Delivery Personas': 'action',
}

export interface ElaborateStreamOptions {
  signal?: AbortSignal
  onDelta?: (chunk: string) => void
}

interface ElaborateDeltaEvent {
  text?: string
}

interface ElaborateDoneEvent {
  text?: string
  persona?: string
}

interface ElaborateErrorEvent {
  error?: string
}

interface ParsedSseEvent {
  event: string
  data: string
}

function parseSseEvent(raw: string): ParsedSseEvent {
  let event = 'message'
  const data: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart())
    }
  }

  return { event, data: data.join('\n') }
}

/**
 * Loads the available AI personas and their metadata from the backend.
 */
export async function fetchPersonas(): Promise<PersonaDefinition[]> {
  const response = await httpClient.get<PersonaResponse>('/api/ai/personas')
  return response.personas ?? []
}

/**
 * Streams a paragraph's elaboration in English (the database canonical language).
 */
export async function elaborateBlock(
  text: string,
  persona: PersonaKey | string,
  context?: string,
  { signal, onDelta }: ElaborateStreamOptions = {},
): Promise<string> {
  if (!text.trim()) {
    return text
  }

  const response = await httpClient.stream('/api/ai/elaborate/stream', {
    body: {
      text,
      persona,
      context: context || undefined,
    },
    signal,
  })

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming is not supported by this browser')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let streamed = ''
  let finalText: string | null = null
  let streamError: string | null = null

  const handleRawEvent = (raw: string) => {
    if (!raw.trim()) return

    const { event, data } = parseSseEvent(raw)
    if (!data) return

    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }

    if (!payload || typeof payload !== 'object') return

    if (event === 'delta') {
      const chunk = (payload as ElaborateDeltaEvent).text
      if (typeof chunk === 'string' && chunk) {
        streamed += chunk
        onDelta?.(chunk)
      }
      return
    }

    if (event === 'done') {
      const doneText = (payload as ElaborateDoneEvent).text
      finalText = typeof doneText === 'string' ? doneText : streamed
      return
    }

    if (event === 'error') {
      streamError = (payload as ElaborateErrorEvent).error || 'AI elaboration failed'
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let separator = buffer.match(/\r?\n\r?\n/)
    while (separator && separator.index !== undefined) {
      handleRawEvent(buffer.slice(0, separator.index))
      buffer = buffer.slice(separator.index + separator[0].length)
      separator = buffer.match(/\r?\n\r?\n/)
    }
  }

  buffer += decoder.decode()
  handleRawEvent(buffer)

  if (streamError) {
    throw new Error(streamError)
  }
  if (finalText === null) {
    throw new Error('AI stream ended unexpectedly')
  }

  return finalText
}
