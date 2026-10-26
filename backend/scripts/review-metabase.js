import { readFile, writeFile } from 'node:fs/promises';
import { api } from './metabase-api.js';
import { createHmac } from 'node:crypto';

const state = JSON.parse(await readFile(new URL('../data/metabase-state.json', import.meta.url), 'utf8'));
const report = [];
if (process.argv.includes('--embed-filter')) {
  const dashboard = await api(`/dashboard/${state.dashboardId}`);
  console.log('Configuración:', JSON.stringify({ auto_apply_filters: dashboard.auto_apply_filters, embedding: dashboard.enable_embedding, embedding_params: dashboard.embedding_params, parameters: dashboard.parameters }));
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ resource: { dashboard: state.dashboardId }, params: {}, exp: Math.floor(Date.now()/1000)+600 })}`;
  const token = `${body}.${createHmac('sha256', process.env.METABASE_SECRET_KEY).update(body).digest('base64url')}`;
  const card = dashboard.dashcards.find(c => c.card_id === 93);
  for (const value of [0,1]) {
    const url = `${process.env.METABASE_SITE_URL}/api/embed/dashboard/${token}/dashcard/${card.id}/card/93?internet=${value}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log('Filtro embebido', value, response.status, JSON.stringify(data.data?.rows || { error: data.error || data.message }));
  }
} else if (process.argv.includes('--restore-attendance')) {
  const saved = await api('/card/94');
  const table = saved.dataset_query.stages[0].native.match(/LEFT JOIN (.+?) t ON/)[1];
  const sql = `SELECT LEAST(FLOOR(attendance_rate_pct / 10) * 10,90) AS Asistencia_desde, ROUND(AVG(final_grade_pct),2) AS Promedio FROM ${table} WHERE attendance_rate_pct BETWEEN 0 AND 100 AND final_grade_pct IS NOT NULL GROUP BY Asistencia_desde ORDER BY Asistencia_desde`;
  await api('/card/94', 'PUT', {
    dataset_query: { database: 2, type: 'native', native: { query: sql, 'template-tags': {} } },
    description: 'Promedio por intervalos de asistencia de diez puntos porcentuales: [0,10), [10,20), …, [90,100]. Se muestran únicamente los intervalos con datos y su límite inferior en el eje X.',
    visualization_settings: { 'graph.dimensions': ['Asistencia_desde'], 'graph.metrics': ['Promedio'], 'graph.colors': ['#4C8062'], 'graph.x_axis.title_text': 'Inicio del intervalo de asistencia (%)', 'graph.y_axis.title_text': 'Calificación promedio (%)', 'graph.show_values': true },
  });
  await writeFile(new URL('../metabase/05.sql', import.meta.url), sql + ';\n');
  const result = await api('/card/94/query', 'POST', { parameters: [], ignore_cache: true });
  console.log('Gráfica 5 restaurada:', JSON.stringify(result.data.rows));
} else {
for (const [name, id] of Object.entries(state.questions)) {
  const card = await api(`/card/${id}`);
  const result = await api(`/card/${id}/query`, 'POST', { parameters: [], ignore_cache: true });
  const item = { name, id, display: card.display, settings: card.visualization_settings, query: card.dataset_query, columns: result.data?.cols?.map(c => c.name), rowCount: result.data?.rows?.length, truncated: result.data?.rows_truncated || false, rows: id === 92 ? result.data?.rows?.slice(0, 2) : result.data?.rows };
  if (id === 93) {
    item.internet = {};
    for (const value of [0, 1]) {
      const filtered = await api(`/card/${id}/query`, 'POST', { parameters: [{ id: 'internet-tag', type: 'number/=', target: ['variable', ['template-tag', 'internet']], value }], ignore_cache: true });
      item.internet[value] = filtered.data?.rows;
    }
  }
  report.push(item);
  console.log(JSON.stringify(item));
}
const dashboard = await api(`/dashboard/${state.dashboardId}`);
console.log('Dashboard', JSON.stringify({ id: dashboard.id, parameters: dashboard.parameters, cards: dashboard.dashcards.map(c => ({ id: c.id, card_id: c.card_id, row: c.row, col: c.col, size_x: c.size_x, size_y: c.size_y, mappings: c.parameter_mappings })) }));
await writeFile(new URL('../data/revision-metabase.json', import.meta.url), JSON.stringify(report, null, 2));
}
