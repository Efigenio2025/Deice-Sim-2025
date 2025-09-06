import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // server-only
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Admin must send this in header

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { q = '', limit = '200' } = req.query;

  try {
    let query = supabase
      .from('training_logs')
      .select('*')
      .order('ts', { ascending: false })
      .limit(+limit || 200);

    if (q) {
      // filter by emp_id OR scenario_label substring (case-insensitive)
      query = query.or(`emp_id.ilike.%${q}%,scenario_label.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ rows: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
