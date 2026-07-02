import { rateLimit, clientIp } from '../lib/rateLimit.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const rl = rateLimit(clientIp(req.headers))
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: { message: 'Too many requests - slow down a moment and try again.' } })
  }

  const apiKey = req.headers['x-api-key']
  if (!apiKey) return res.status(400).json({ error: { message: 'Missing x-api-key header' } })

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } })
  }
}
