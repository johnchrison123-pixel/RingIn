// Supabase Edge Function — send-push-notification
// Triggered when a new message is inserted into the messages table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()
    if (!record) return new Response('No record', { status: 400 })

    const receiverId = record.receiver_id
    const senderId = record.sender_id
    const content = record.text || record.content || ''
    const conversationId = record.conversation_id

    if (!receiverId || !senderId) return new Response('Missing IDs', { status: 400 })

    // Init Supabase with service role
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get receiver FCM token
    const { data: receiver } = await sb
      .from('profiles')
      .select('fcm_token, full_name')
      .eq('id', receiverId)
      .single()

    if (!receiver?.fcm_token) return new Response('No FCM token', { status: 200 })

    // Get sender name
    const { data: sender } = await sb
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single()

    const senderName = sender?.full_name || 'Someone'
    const messagePreview = content.startsWith('[img]') ? '📷 Photo' : content.slice(0, 80)

    // Get Firebase service account
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}')

    // Create JWT for Firebase Auth
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    }

    // Import private key
    const privateKeyPem = serviceAccount.private_key
    const pemContents = privateKeyPem.replace(/-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Create JWT
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const body = btoa(JSON.stringify(payload))
    const signingInput = `${header}.${body}`
    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(signingInput))
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

    // Get OAuth token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    const { access_token } = await tokenRes.json()

    // Send FCM notification
    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: receiver.fcm_token,
          notification: {
            title: senderName,
            body: messagePreview,
          },
          data: {
            conversation_id: conversationId || '',
            sender_id: senderId,
          },
          webpush: {
            notification: {
              icon: 'https://ring-in.vercel.app/logo192.png',
              badge: 'https://ring-in.vercel.app/logo192.png',
              click_action: 'https://ring-in.vercel.app',
            },
          },
        },
      }),
    })

    const fcmResult = await fcmRes.json()
    return new Response(JSON.stringify(fcmResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('Push error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
