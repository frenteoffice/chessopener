const RATE_LIMIT_REQUESTS = 30
const RATE_LIMIT_WINDOW_MS = 60_000
const ipCounts = new Map()

function getClientIp(event) {
  const forwarded = event.headers?.['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return event.headers?.['x-nf-client-connection-ip'] ?? 'unknown'
}

function checkRateLimit(ip) {
  const now = Date.now()
  const record = ipCounts.get(ip)
  if (!record) {
    ipCounts.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record.count = 1
    record.windowStart = now
    return true
  }
  record.count++
  return record.count <= RATE_LIMIT_REQUESTS
}

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const ip = getClientIp(event)
  if (!checkRateLimit(ip)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Too many requests. Limit: 30 per minute.' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { prompt } = body
  if (!prompt || typeof prompt !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt' }) }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        text: 'Commentary service not configured. Set OPENAI_API_KEY in environment.',
      }),
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('OpenAI API error:', err)
      return {
        statusCode: 502,
        body: JSON.stringify({ text: 'Commentary generation failed.' }),
      }
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || 'No commentary generated.'
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  } catch (err) {
    console.error('Commentary error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ text: 'Commentary service error.' }),
    }
  }
}
