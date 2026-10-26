export const site = (process.env.METABASE_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export async function api(path, method = 'GET', body) {
  const key = process.env.METABASE_API_KEY;
  if (!key) throw new Error('Añade METABASE_API_KEY a .env antes de ejecutar este comando.');
  const multipart = body instanceof FormData;
  const response = await fetch(`${site}/api${path}`, {
    method, headers: { 'X-API-Key': key, ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? multipart ? body : JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) {
    const error = (await response.text()).slice(0, 700);
    throw new Error(`Metabase ${response.status} en ${path}: ${error.replaceAll(key, '[oculta]')}`);
  }
  return response.status === 204 ? null : response.json();
}
