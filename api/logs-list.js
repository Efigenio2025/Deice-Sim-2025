import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // secret for admin.html fetches

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

export default async function handler(req, res) {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const { q = '', limit = '200' } = req.query;
  try {
    let query = supabase.from('training_logs').select('*').order('ts', { ascending: false }).limit(+limit || 200);
    // optional filter: emp_id or scenario substring
    if (q) query = query.ilike('emp_id', `%${q}%`).or(`scenario_label.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ rows: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
