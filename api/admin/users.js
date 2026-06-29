import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json({ error: 'Supabase admin env vars are not configured.' }, 500)

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing bearer token.' }, 401)

  const admin = createClient(url, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'Invalid session.' }, 401)

  const { data: profile } = await admin
    .from('profiles')
    .select('role,status')
    .eq('id', userData.user.id)
    .single()
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
  const emailIsAdmin = adminEmails.includes((userData.user.email || '').toLowerCase())
  if (profile?.role !== 'super_user' && !emailIsAdmin) return json({ error: 'Super user only.' }, 403)

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('profiles')
      .select('id,email,role,status,created_at')
      .order('created_at', { ascending: false })
    if (error) return json({ error: error.message }, 500)
    return json({ users: data || [] })
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (!body.id || !body.status) return json({ error: 'Missing id or status.' }, 400)
    const { error } = await admin
      .from('profiles')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed.' }, 405)
}
