// Deno Edge Function: invite-worker
// Location: supabase/functions/invite-worker/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { name, email, role, base_salary } = await req.json()

    if (!name || !email || !role || base_salary === undefined) {
      throw new Error('Missing required fields: name, email, role, base_salary')
    }

    // 1. Invite worker via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email)
    
    if (inviteError) {
      throw inviteError
    }

    // 2. Insert profile record in public.workers table
    const { data: workerData, error: workerError } = await supabaseClient
      .from('workers')
      .insert({
        auth_user_id: inviteData.user.id,
        name,
        email,
        role,
        base_salary,
        status: 'invited'
      })
      .select()
      .single()

    if (workerError) {
      throw workerError
    }

    return new Response(JSON.stringify({ success: true, user: workerData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
