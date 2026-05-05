/*
  Collatiq Notification Service
  ──────────────────────────────
  Supports two channels:
    1. MSG91  — transactional SMS (India, ~₹0.20/msg)
    2. Gupshup — WhatsApp Business API (~₹0.35/msg)

  Environment variables (set in .env.local):
    REACT_APP_MSG91_AUTH_KEY      — MSG91 auth key
    REACT_APP_MSG91_SENDER_ID     — 6-char sender ID (default: CLATIQ)
    REACT_APP_MSG91_TEMPLATE_ID   — DLT-registered template ID
    REACT_APP_GUPSHUP_API_KEY     — Gupshup app API key
    REACT_APP_GUPSHUP_SRC_NAME    — Gupshup source app name
    REACT_APP_NOTIFY_PROXY        — Optional backend proxy URL (recommended for prod)

  NOTE: In production, proxy these calls through a backend/edge function so
  API keys are never exposed in the browser bundle.
*/

const MSG91_BASE    = 'https://control.msg91.com/api/v5';
const GUPSHUP_BASE  = 'https://api.gupshup.io/sm/api/v1';
const PROXY_URL     = process.env.REACT_APP_NOTIFY_PROXY || null;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function normalisePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  throw new Error(`Invalid Indian phone number: ${raw}`);
}

function buildSMSText(results) {
  const fmt = (v) => {
    if (!v && v !== 0) return '—';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
  };

  return [
    `COLLATIQ REPORT`,
    `Property: ${(results.address || '').split(',').slice(0, 2).join(',')}`,
    `Value: ${fmt(results.mv_low)} to ${fmt(results.mv_high)}`,
    `Verdict: ${results.verdictLabel || results.verdict || '—'}`,
    `Health Score: ${results.collateralHealthScore ?? '—'}/850`,
    `RPI: ${results.rpi ?? '—'}/100`,
    `Visit Collatiq to view the full report.`,
  ].join('\n');
}

function buildWhatsAppText(results) {
  const fmt = (v) => {
    if (!v && v !== 0) return '—';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)} Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1)} L`;
    return `₹${v.toLocaleString('en-IN')}`;
  };

  const lines = [
    '*Collatiq Valuation Report*',
    '',
    `📍 ${results.address || 'Property'}`,
    '',
    `*Market Value:* ${fmt(results.mv_low)} – ${fmt(results.mv_high)}`,
    `*Distress Value:* ${fmt(results.dv_low)} – ${fmt(results.dv_high)}`,
    `*Resale Score (RPI):* ${results.rpi ?? '—'}/100`,
    `*Exit Time:* ${results.ttl_low ?? '—'}–${results.ttl_high ?? '—'} days`,
    `*Health Score:* ${results.collateralHealthScore ?? '—'}/850`,
    '',
    `*Verdict:* ${results.verdictLabel || results.verdict || '—'}`,
    '',
    '_Assessed by Collatiq — Collateral Intelligence for Indian NBFCs._',
  ];

  return lines.join('\n');
}

/* ── MSG91 SMS ────────────────────────────────────────────────────────────── */

export async function sendSMS(rawPhone, results) {
  const authKey    = process.env.REACT_APP_MSG91_AUTH_KEY;
  const senderId   = process.env.REACT_APP_MSG91_SENDER_ID  || 'CLATIQ';
  const templateId = process.env.REACT_APP_MSG91_TEMPLATE_ID;

  if (!authKey) {
    console.warn('[MSG91] No auth key set — using WhatsApp fallback');
    return { ok: false, fallback: true };
  }

  const phone   = normalisePhone(rawPhone);
  const message = buildSMSText(results);

  const body = {
    sender:   senderId,
    route:    '4',
    country:  '91',
    sms: [{ message, to: [phone] }],
  };

  if (templateId) body.sms[0].template_id = templateId;

  try {
    const url  = PROXY_URL ? `${PROXY_URL}/sms` : `${MSG91_BASE}/flow/`;
    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PROXY_URL ? {} : { authkey: authKey }),
      },
      body: JSON.stringify(PROXY_URL ? { phone, message, channel: 'sms' } : body),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.type !== 'error') {
      return { ok: true, channel: 'sms', requestId: data.request_id };
    }
    return { ok: false, error: data.message || 'MSG91 error' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ── Gupshup WhatsApp ─────────────────────────────────────────────────────── */

export async function sendWhatsApp(rawPhone, results) {
  const apiKey   = process.env.REACT_APP_GUPSHUP_API_KEY;
  const srcName  = process.env.REACT_APP_GUPSHUP_SRC_NAME;

  if (!apiKey || !srcName) {
    console.warn('[Gupshup] Not configured — using WhatsApp web fallback');
    return { ok: false, fallback: true };
  }

  const phone   = normalisePhone(rawPhone);
  const message = buildWhatsAppText(results);

  try {
    const url  = PROXY_URL ? `${PROXY_URL}/whatsapp` : `${GUPSHUP_BASE}/msg`;
    const body = PROXY_URL
      ? JSON.stringify({ phone, message, channel: 'whatsapp' })
      : new URLSearchParams({
          channel:      'whatsapp',
          source:       srcName,
          destination:  phone,
          message:      JSON.stringify({ type: 'text', text: message }),
          'src.name':   srcName,
        });

    const resp = await fetch(url, {
      method:  'POST',
      headers: PROXY_URL
        ? { 'Content-Type': 'application/json' }
        : { apikey: apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.status === 'submitted') {
      return { ok: true, channel: 'whatsapp', messageId: data.messageId };
    }
    return { ok: false, error: data.message || 'Gupshup error' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ── WhatsApp Web fallback (always works, opens wa.me) ────────────────────── */

export function openWhatsAppWeb(rawPhone, results) {
  let phone = '';
  try { phone = normalisePhone(rawPhone); } catch { phone = rawPhone.replace(/\D/g, ''); }
  const text = encodeURIComponent(buildWhatsAppText(results));
  const url  = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

/* ── Unified send (tries Gupshup → SMS → WhatsApp web) ───────────────────── */

export async function sendReport(rawPhone, results, channel = 'whatsapp') {
  if (channel === 'sms') {
    const res = await sendSMS(rawPhone, results);
    if (res.fallback) return { ok: false, fallback: true, channel: 'sms' };
    return res;
  }

  const res = await sendWhatsApp(rawPhone, results);
  if (res.fallback) {
    openWhatsAppWeb(rawPhone, results);
    return { ok: true, channel: 'whatsapp_web' };
  }
  return res;
}

export { buildSMSText, buildWhatsAppText };
