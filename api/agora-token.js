// Vercel serverless function — generates an Agora RTC token for a channel.
// CRITICAL: AGORA_APP_CERTIFICATE must be set as a Vercel Environment Variable.
// It is NEVER exposed to the client. The client only knows the App ID + the token.
//
// Request:  POST /api/agora-token   body: { channel: "<string>", uid: <number> }
// Response: { token, appId, channel, uid, expiresAt }
//
// CORS is enabled for any origin so the CRA app at ring-in.vercel.app can fetch it.

const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID || 'a0d22a99058142b2af0d18e3e570b880';
const TOKEN_TTL_SECS = 3600; // 1 hour

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const certificate = process.env.AGORA_APP_CERTIFICATE;
  if (!certificate) {
    return res.status(500).json({
      error: 'AGORA_APP_CERTIFICATE not configured on this server. Add it as a Vercel Environment Variable and redeploy.',
    });
  }

  // Body — Vercel auto-parses JSON, but be defensive
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const channel = (body.channel || '').toString().trim();
  let uid = body.uid;
  if (typeof uid !== 'number') uid = parseInt(uid, 10);

  if (!channel) return res.status(400).json({ error: 'channel is required' });
  if (!Number.isFinite(uid) || uid < 0 || uid > 4294967295) {
    return res.status(400).json({ error: 'uid must be a finite uint32 number' });
  }

  const role = RtcRole.PUBLISHER;
  const now = Math.floor(Date.now() / 1000);
  const expireAt = now + TOKEN_TTL_SECS;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID, certificate, channel, uid, role, expireAt, expireAt
    );
    return res.status(200).json({
      token,
      appId: APP_ID,
      channel,
      uid,
      expiresAt: expireAt,
    });
  } catch (err) {
    console.error('agora-token: build failed', err);
    return res.status(500).json({ error: 'Token build failed: ' + (err && err.message) });
  }
};
