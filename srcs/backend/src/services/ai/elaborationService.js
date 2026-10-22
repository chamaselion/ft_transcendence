const { getAiConfig } = require('../../config');
const { resolveProvider } = require('./providers');
const { unescapeHtml } = require('../../controllers/documents/sanitize');

const PERSONA_CATEGORIES = Object.freeze({
  STRUCTURAL: 'Structural & Analytical Personas',
  TONE: 'Tone & Voice Personas',
  ACTION: 'Action & Delivery Personas',
});

const PERSONAS = Object.freeze({
  devils_advocate: {
    key: 'devils_advocate',
    name: 'The Devil’s Advocate (Red Teamer)',
    category: PERSONA_CATEGORIES.STRUCTURAL,
    description:
      'Stress-tests the text. Rewrites arguments by proactively addressing counterarguments, spotting logical fallacies, highlighting hidden assumptions, and inserting caveat frameworks.',
    systemPrompt:
      'You are The Devil’s Advocate (Red Teamer). Stress-test the provided text. Rewrite arguments by proactively addressing counterarguments, spotting logical fallacies, highlighting hidden assumptions, and inserting caveat frameworks.',
  },
  summarizer: {
    key: 'summarizer',
    name: 'TL;DR',
    category: PERSONA_CATEGORIES.STRUCTURAL,
    description:
      'Condenses long-form content',
    systemPrompt:
      'You are The Executive Summarizer / TL;DR Architect. Compress the text down to its absolute core. Restructure the draft into key findings, high-level impacts, and concise bullet points designed for skim-reading.',
  },
  storyteller: {
    key: 'storyteller',
    name: 'The Storyteller',
    category: PERSONA_CATEGORIES.TONE ,
    description:
      'Turns explanations or descriptions into an engaging narrative arc (hook, conflict/challenge, journey, resolution) using evocative metaphors and rhythm.',
    systemPrompt:
      'You are The Storyteller / Narrative Weaver. Turn dry explanations or static descriptions into an engaging narrative arc (hook, conflict/challenge, journey, resolution) using evocative metaphors and rhythm.',
  },
  pragmatist: {
    key: 'pragmatist',
    name: 'The Direct Pragmatist (No-Nonsense / Minimalist)',
    category: PERSONA_CATEGORIES.TONE ,
    description:
      'Cuts word count by 40–60%. ',
    systemPrompt:
      'You are The Direct Pragmatist (No-Nonsense / Minimalist). Cut word count by 40–60%. Eliminate hedges ("I think", "perhaps", "essentially"), passive voice, and throat-clearing sentences, leaving only punchy, active directives.',
  },
  diplomat: {
    key: 'diplomat',
    name: 'The Diplomat / Empathetic Resolver',
    category: PERSONA_CATEGORIES.TONE ,
    description:
      'Softens confrontational, ambiguous, or blunt statements.',
    systemPrompt:
      'You are The Diplomat / Empathetic Resolver. Soften confrontational, ambiguous, or blunt statements. Ideal for sensitive client communications, peer feedback, or conflict de-escalation by framing points collaboratively.',
  },
  marketer: {
    key: 'marketer',
    name: 'The Marketer',
    category: PERSONA_CATEGORIES.ACTION,
    description:
      'Sharpens the text with conversion frameworks and clear value propositions.',
    systemPrompt:
      'You are The Persuasive Marketer / Copywriter. Sharpen the text with conversion frameworks (like PAS: Problem-Agitate-Solve, or AIDA: Attention-Interest-Desire-Action), clear value propositions, and compelling calls-to-action (CTAs).',
  },
  auditor: {
    key: 'auditor',
    name: 'The Auditor',
    category: PERSONA_CATEGORIES.ACTION,
    description:
      'Transforms high-level goals into step-by-step Standard Operating Procedures (SOPs), complete with prerequisites, edge cases, input/output validation, and checklists.',
    systemPrompt:
      'You are The Systems Auditor / SOP Builder. Transform high-level goals into step-by-step Standard Operating Procedures (SOPs), complete with prerequisites, edge cases, input/output validation, and checklists.',
  },
  specifier: {
    key: 'specifier',
    name: 'The Specifier',
    category: PERSONA_CATEGORIES.ACTION,
    description:
      'Translates conceptual business or user ideas into technical acceptance criteria, user stories, edge-case parameters and system requirements.',
    systemPrompt:
      'You are The Technical Specifier. Translate conceptual business or user ideas into technical acceptance criteria, user stories (e.g., As a... I want to... So that...), edge-case parameters, and system requirements.',
  },
});

class ElaborationService {
  constructor(customConfig = null, customProvider = null) {
    this.config = customConfig || getAiConfig();
    this.provider = customProvider || resolveProvider(this.config);
  }

  isSupportedPersona(personaKey) {
    return Boolean(personaKey && PERSONAS[personaKey]);
  }

  getPersona(personaKey) {
    return PERSONAS[personaKey] || null;
  }

  getPersonas() {
    return Object.values(PERSONAS);
  }

  /**
   * Streams an elaborated / rewritten paragraph block using the selected persona.
   *
   * @param {Object} options
   * @param {string} options.text - Raw text to rewrite in English
   * @param {string} options.persona - Persona key
   * @param {string} [options.context] - Surrounding context if available
   * @param {AbortSignal} [options.signal] - Aborts the upstream AI request
   * @param {(chunk: string) => void} [options.onDelta] - Receives text chunks as they arrive
   * @returns {Promise<string>}
   */
  async elaborateStream({ text = '', persona, context = '', signal, onDelta }) {
    if (!this.isSupportedPersona(persona)) {
      throw new Error(`Unsupported persona: ${persona}`);
    }

    const rawText = String(text ?? '').trim();
    if (!rawText) {
      return '';
    }

    const personaObj = this.getPersona(persona);

    const systemPrompt = [
      personaObj.systemPrompt,
      'You are rewriting a block inside a collaborative document editor in English (the database canonical language).',
      'Output ONLY the rewritten text directly.',
      'Do not include any conversational preamble, intro phrases ("Here is the rewritten version:"), explanations, or markdown code fences.',
    ].join(' ');

    let userPrompt = '';
    if (context && String(context).trim()) {
      userPrompt = `Surrounding document context for reference:\n${context.trim()}\n\nText to rewrite:\n${rawText}`;
    } else {
      userPrompt = `Text to rewrite:\n${rawText}`;
    }

    let rawResponse = '';
    for await (const chunk of this.provider.stream({ systemPrompt, userPrompt, signal })) {
      rawResponse += chunk;
      if (onDelta) {
        onDelta(chunk);
      }
    }

    return this.cleanResponse(rawResponse);
  }

  cleanResponse(rawResponse) {
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return unescapeHtml(cleaned);
  }
}

const createElaborationService = (config, provider) =>
  new ElaborationService(config, provider);

module.exports = {
  PERSONA_CATEGORIES,
  PERSONAS,
  ElaborationService,
  createElaborationService,
};
