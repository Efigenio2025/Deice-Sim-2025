import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // server-only
const WRITE_TOKEN = process.env.WRITE_TOKEN; // Trainer must send this in header

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WRITE_TOKEN || req.headers['x-write-token'] !== WRITE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const rec = {
      emp_id: String(body.emp_id || '').slice(0, 64),
      scenario_id: String(body.scenario_id || '').slice(0, 64),
      scenario_label: String(body.scenario_label || '').slice(0, 200),
      outcome: String(body.outcome || 'completed').slice(0, 32),
      score: body.score != null ? String(body.score).slice(0, 64) : null,
      duration_sec: Number.isFinite(+body.duration_sec) ? +body.duration_sec : null,
      user_agent: (req.headers['user-agent'] || '').slice(0, 200),
      ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0]
    };

    if (!rec.emp_id) return res.status(400).json({ error: 'emp_id required' });

    const { data, error } = await supabase
      .from('training_logs')
      .insert(rec)
      .select('id, ts')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, id: data.id, ts: data.ts });
  } catch (e) {
    return res.status(500).json({ error: 'Bad payload: ' + e.message });
  }
}
