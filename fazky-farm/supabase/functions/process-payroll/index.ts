// Deno Edge Function: process-payroll
// Location: supabase/functions/process-payroll/index.ts

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

    const { month } = await req.json() // e.g. "2026-08"

    if (!month) {
      throw new Error('Missing month parameter')
    }

    // 1. Fetch active workers (non-admin)
    const { data: workers, error: workersError } = await supabaseClient
      .from('workers')
      .select('*')
      .eq('status', 'active')
      .neq('role', 'admin')

    if (workersError) throw workersError

    const dateStr = `${month}-28`
    const monthLabel = new Date(month + "-02").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const results = []

    for (const worker of workers) {
      // 2. Fetch active loans for worker
      const { data: loans, error: loansError } = await supabaseClient
        .from('loans')
        .select('*')
        .eq('worker_id', worker.id)

      if (loansError) throw loansError

      for (const loan of (loans || [])) {
        // Calculate paid balance
        const { data: repayments, error: repError } = await supabaseClient
          .from('loan_repayments')
          .select('repayment_made')
          .eq('loan_id', loan.id)

        if (repError) throw repError

        const totalPaid = (repayments || []).reduce((sum, r) => sum + (Number(r.repayment_made) || 0), 0)
        const balance = Math.max(0, Number(loan.total_borrowed) - totalPaid)

        if (balance > 0) {
          const deduction = Math.min(balance, loan.monthly_amount)
          const newBalance = balance - deduction

          // 3. Record payroll installment repayment
          const { error: insertRepError } = await supabaseClient
            .from('loan_repayments')
            .insert({
              loan_id: loan.id,
              date: dateStr,
              amount_repayable: loan.monthly_amount,
              repayment_made: deduction,
              balance: newBalance,
              comments: `Payroll auto-deduction for ${monthLabel}`
            })

          if (insertRepError) throw insertRepError

          results.push({
            worker_id: worker.id,
            loan_id: loan.id,
            deduction,
            new_balance: newBalance
          })
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
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
