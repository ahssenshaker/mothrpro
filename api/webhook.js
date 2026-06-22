import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvafqzhowebbmahbonfm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.LS_WEBHOOK_SECRET || '007240';

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify signature
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-signature'];
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  
  if (hmac !== signature) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(rawBody.toString());
  const eventName = payload.meta?.event_name;

  // Only handle successful orders
  if (eventName !== 'order_created') return res.status(200).json({ ok: true });

  const order = payload.data?.attributes;
  const variantId = payload.data?.relationships?.order_items?.data?.[0]?.id;
  
  // Get customer email
  const customerEmail = order?.user_email;
  if (!customerEmail) return res.status(200).json({ ok: true });

  // Check variant matches our product
  const status = order?.status;
  if (status !== 'paid') return res.status(200).json({ ok: true });

  try {
    // Find user by email in Supabase auth
    const { data: users, error: userError } = await supa.auth.admin.listUsers();
    if (userError) throw userError;

    const user = users.users.find(u => u.email === customerEmail);

    if (user) {
      // User exists — activate pro
      await supa.from('subscribers').upsert({
        id: user.id,
        email: customerEmail,
        plan: 'pro',
        activated_at: new Date().toISOString(),
        expires_at: null // one-time payment = no expiry
      });
      console.log(`✅ Activated pro for ${customerEmail}`);
    } else {
      // User doesn't have account yet — save pending activation
      await supa.from('subscribers').upsert({
        id: crypto.randomUUID(),
        email: customerEmail,
        plan: 'pending',
        activated_at: new Date().toISOString(),
        expires_at: null
      });
      console.log(`⏳ Pending activation for ${customerEmail} (no account yet)`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Helper to get raw body
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const config = { api: { bodyParser: false } };
