// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// /api/send-verification.js  â  Next.js API route
//
// Sends a 6-digit SMS verification code via Twilio Verify.
// Part of the Bumper Fix temporary booking testing system.
//
// Required environment variables (.env.local):
//   TWILIO_ACCOUNT_SID         ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN          your_auth_token
//   TWILIO_VERIFY_SERVICE_SID  VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//
// current implementation: stateless â no database needed for this route.
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

import twilio from 'twilio';

// ââ Environment variable validation ââââââââââââââââââââââââââââââââââââââââââ
const ACCOUNT_SID        = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN         = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

function missingEnvVars() {
  const missing = [];
  if (!ACCOUNT_SID)        missing.push('TWILIO_ACCOUNT_SID');
  if (!AUTH_TOKEN)         missing.push('TWILIO_AUTH_TOKEN');
  if (!VERIFY_SERVICE_SID) missing.push('TWILIO_VERIFY_SERVICE_SID');
  return missing;
}

// ââ Phone normalizer â E.164 ââââââââââââââââââââââââââââââââââââââââââââââââââ
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (cleaned.startsWith('+')) return cleaned.replace(/\s/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 7)   return '+' + digits;   // best-effort international
  return null;                                      // too short to be valid
}

// ââ Route handler âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Fail fast if Twilio is not configured
  const missing = missingEnvVars();
  if (missing.length > 0) {
    console.error('[send-verification] Missing env vars:', missing.join(', '));
    return res.status(500).json({
      error: 'Booking service is not configured. Please contact us directly at (858) 988-0325.'
    });
  }

  const { phone, name, date, time } = req.body || {};

  // ââ Input validation âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }
  if (!date || !time) {
    return res.status(400).json({ error: 'Appointment date and time are required.' });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return res.status(400).json({
      error: 'Please enter a valid US phone number (10 digits).'
    });
  }

  // ââ Send verification via Twilio Verify ââââââââââââââââââââââââââââââââââââ
  const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

  try {
    await client.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verifications.create({
        to:      normalized,
        channel: 'sms'
      });

    console.log(`[send-verification] Code sent to ${normalized} for ${date} at ${time}`);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[send-verification] Twilio error:', err.message);

    // Surface clean messages for common Twilio errors
    const msg = err.message || '';
    if (msg.includes('unverified')) {
      return res.status(400).json({
        error: 'This number is not verified for testing. Add it to your Twilio trial account.'
      });
    }
    if (msg.includes('Invalid')) {
      return res.status(400).json({
        error: 'That phone number format is not accepted. Please try again.'
      });
    }

    return res.status(500).json({
      error: 'Could not send verification code. Please try again or call (858) 988-0325.'
    });
  }
}
