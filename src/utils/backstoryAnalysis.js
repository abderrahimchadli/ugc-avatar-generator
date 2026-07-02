import { extractCodexText } from './charSheetPrompt.js'
import { resolvePromptAssistant } from './promptAssistant.js'

const SYSTEM = `You are a visual prompt assistant for an AI influencer image generator.
Given a character's backstory and physical description, extract two things:

1. styleSignal — a comma-separated list of 2–4 wardrobe style tags from this fixed set ONLY: minimalist, editorial, street, bohemian, glam, sport, y2k, dark, clean, cottagecore, old-money, coastal, preppy, casual, earthy, natural, functional, polished, structured, bold. Pick tags that reflect the person's authentic daily life, not their aspirations.

2. sceneNiche — one word from: fashion, beauty, lifestyle, fitness, travel, tech, gaming, entertainment. Pick the one that best matches where this person actually spends their time.

Respond with a JSON object only — no explanation, no markdown:
{"styleSignal":"tag1, tag2","sceneNiche":"lifestyle"}`

export async function analyzeBackstory(backstory, physicalDesc) {
  const assistant = resolvePromptAssistant()
  if (assistant.provider === 'none') { console.log('[Prompt assistant] no API key in localStorage - skipping backstory analysis'); return null }
  if (!backstory?.trim()) { console.log('[Prompt assistant] no backstory - skipping'); return null }

  console.log(`[${assistant.label}] analyzing backstory...`)
  const userMsg = `Backstory: ${backstory.trim()}\nPhysical description: ${physicalDesc?.trim() || 'not specified'}`

  try {
    const isCodex = assistant.provider === 'codex'
    const res = await fetch(isCodex ? '/api/codex' : '/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': assistant.apiKey,
      },
      body: JSON.stringify(isCodex ? {
        model: assistant.model || 'gpt-4.1',
        max_output_tokens: 150,
        instructions: SYSTEM,
        input: [{ role: 'user', content: [{ type: 'input_text', text: userMsg }] }],
      } : {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    if (!res.ok) {
      console.error(`[${assistant.label}] HTTP error`, res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    if (data.error) {
      console.error(`[${assistant.label}] API error:`, data.error)
      return null
    }

    const text = isCodex ? extractCodexText(data) : data.content?.[0]?.text?.trim()
    if (!text) { console.error(`[${assistant.label}] empty response`); return null }

    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed = JSON.parse(jsonText)
    if (!parsed.sceneNiche) { console.error(`[${assistant.label}] missing sceneNiche in response:`, parsed); return null }

    console.log(`[${assistant.label}] success:`, parsed)
    return {
      sceneNiche: parsed.sceneNiche,
      tags: (parsed.styleSignal || '').split(',').map(s => s.trim()).filter(Boolean),
    }
  } catch (e) {
    console.error(`[${assistant.label}] exception:`, e)
    return null
  }
}
