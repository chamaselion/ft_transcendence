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

export interface ElaborateResponse {
  text: string
  persona: string
}

/**
 * Loads the available AI personas and their metadata from the backend.
 */
export async function fetchPersonas(): Promise<PersonaDefinition[]> {
  const response = await httpClient.get<PersonaResponse>('/api/ai/personas')
  return response.personas ?? []
}

/**
 * Sends a paragraph's text to the AI elaboration endpoint.
 * Always performed in English (the database canonical language).
 */
export async function elaborateBlock(
  text: string,
  persona: PersonaKey | string,
  context?: string,
): Promise<string> {
  if (!text.trim()) {
    return text
  }

  const response = await httpClient.post<ElaborateResponse>('/api/ai/elaborate', {
    text,
    persona,
    context: context || undefined,
  })

  return response.text ?? ''
}
