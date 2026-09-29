// Little Atlas — delete-account Edge Function
//
// Deleting an auth.users row requires the service_role key, which must
// NEVER ship to the browser. This function runs server-side on Supabase's
// infrastructure: it verifies the caller's own access token, then uses the
// service role (available only as a server-side secret, injected by
// Supabase automatically for every deployed Edge Function) to permanently
// delete that same user's auth account. Deleting the auth user cascades
// (via `on delete cascade` foreign keys, see migrations/0001_init.sql) to
// every row of theirs in profiles/nodes/edges/suggestion_state/
// brainstorm_entries/reflections. Nothing else is ever touched.
//
// Deploy: supabase functions deploy delete-account
// Required secrets (set automatically by Supabase for every project, no
// manual configuration needed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Step 1: verify the caller's JWT identifies a real, current session —
  // using the ANON client with their own token, never trusting a user_id
  // passed in the request body.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const {
    data: { user },
    error: authError
  } = await callerClient.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  // Step 2: use the service role — server-side only — to delete exactly
  // this verified user's auth account. This is the only place in the whole
  // system the service role key is used.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
})
