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

    const payload = await req.json()
    const { action = 'create', name, email, role, base_salary, password, worker_id, auth_user_id } = payload

    // ACTION 1: DELETE WORKER
    if (action === 'delete') {
      if (!worker_id && !auth_user_id) {
        throw new Error('worker_id or auth_user_id is required for deletion')
      }

      // Delete from workers table
      if (worker_id) {
        await supabaseClient.from('workers').delete().eq('id', worker_id)
      }

      // Delete from auth.users if auth_user_id exists
      if (auth_user_id) {
        await supabaseClient.auth.admin.deleteUser(auth_user_id)
      }

      return new Response(JSON.stringify({ success: true, message: 'Worker deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // ACTION 2: CREATE OR INVITE WORKER
    if (!name || !email || !role || base_salary === undefined) {
      throw new Error('Missing required fields: name, email, role, base_salary')
    }

    let authUserId = null
    let workerStatus = 'invited'

    // Option A: If password is provided, create direct user in Supabase Auth
    if (password && password.trim().length >= 6) {
      const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
        email,
        password: password.trim(),
        email_confirm: true,
        user_metadata: { name, role }
      })

      if (userError) {
        // If user already exists in auth, find them
        if (userError.message.includes('already') || userError.status === 422) {
          const { data: { users } } = await supabaseClient.auth.admin.listUsers()
          const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
          if (existingUser) {
            authUserId = existingUser.id
            workerStatus = 'active'
          } else {
            throw userError
          }
        } else {
          throw userError
        }
      } else if (userData?.user) {
        authUserId = userData.user.id
        workerStatus = 'active'
      }
    } else {
      // Option B: Invite worker via email magic invite
      const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
        redirectTo: payload.redirectTo || undefined
      })
      if (inviteError) {
        throw inviteError
      }
      if (inviteData?.user) {
        authUserId = inviteData.user.id
      }
    }

    // 2. Upsert profile record in public.workers table
    const { data: workerData, error: workerError } = await supabaseClient
      .from('workers')
      .upsert({
        auth_user_id: authUserId,
        name,
        email: email.toLowerCase(),
        role,
        base_salary: Number(base_salary) || 0,
        status: workerStatus
      }, { onConflict: 'email' })
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
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
