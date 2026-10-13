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

export const PERSONA_CATEGORIES = [
  'Structural & Analytical Personas',
  'Tone & Voice Personas',
  'Action & Delivery Personas',
] as const

export const PERSONAS: PersonaDefinition[] = [
  {
    key: 'devils_advocate',
    name: 'The Devil’s Advocate (Red Teamer)',
    category: 'Structural & Analytical Personas',
    description:
      'Stress-tests the text. Rewrites arguments by proactively addressing counterarguments, spotting logical fallacies, highlighting hidden assumptions, and inserting caveat frameworks.',
  },
  {
    key: 'summarizer',
    name: 'TL;DR',
    category: 'Structural & Analytical Personas',
    description:
      'Condenses long-form content',
  },

  {
    key: 'storyteller',
    name: 'The Storyteller',
    category: 'Tone & Voice Personas',
    description:
      'Turns explanations or descriptions into an engaging narrative arc (hook, conflict/challenge, journey, resolution) using evocative metaphors and rhythm.',
  },
  {
    key: 'pragmatist',
    name: 'The Direct Pragmatist (No-Nonsense / Minimalist)',
    category: 'Tone & Voice Personas',
    description:
      'Cuts word count by 40–60%. ',
  },
  {
    key: 'diplomat',
    name: 'The Diplomat / Empathetic Resolver',
    category: 'Tone & Voice Personas',
    description:
      'Softens confrontational, ambiguous, or blunt statements.',
  },
  {
    key: 'marketer',
    name: 'The Marketer',
    category: 'Action & Delivery Personas',
    description:
      'Sharpens the text with conversion frameworks and clear value propositions.',
  },
  {
    key: 'auditor',
    name: 'The Auditor',
    category: 'Action & Delivery Personas',
    description:
      'Transforms high-level goals into step-by-step Standard Operating Procedures (SOPs), complete with prerequisites, edge cases, input/output validation, and checklists.',
  },
  {
    key: 'specifier',
    name: 'The Specifier',
    category: 'Action & Delivery Personas',
    description:
      'Translates conceptual business or user ideas into technical acceptance criteria, user stories, edge-case parameters and system requirements.',
  },
]

export interface ElaborateResponse {
  text: string
  persona: string
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
