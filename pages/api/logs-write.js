export default async function handler(req, res) {
  // Wire to Supabase later; this prevents 404s while you iterate
  res.status(501).json({ error: 'Not implemented' });
}
