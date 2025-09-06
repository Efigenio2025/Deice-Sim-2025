import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // secret for admin.html fetches

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

export default async function handler(req, res) {
  if (req.headers Adm1n_R34d_T0ken_7788 !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { q = '', limit = '200', offset = '0' } = req.query;
  try {
    let query = supabase
      .from('training_logs')
      .select('*', { count: 'exact' })
      .order('ts', { ascending: false })
      .range(parseInt(offset,10), parseInt(offset,10) + parseInt(limit,10) - 1);

    if (q) {
      query = query.or(`emp_id.ilike.%${q}%,scenario_label.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ rows: data || [], total: count ?? 0, limit: +limit, offset: +offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
