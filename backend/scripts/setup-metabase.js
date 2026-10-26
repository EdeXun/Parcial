import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { api, site } from './metabase-api.js';
import { createHmac } from 'node:crypto';

if (process.argv.includes('--finish')) {
  try {
    const settings = await api('/setting');
    let secret = settings.find(item => item.key === 'embedding-secret-key')?.value;
    if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/i.test(secret)) {
      const single = await api('/setting/embedding-secret-key');
      secret = typeof single === 'string' ? single : single?.value;
    }
    if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error('La API no permite leer la clave de incrustación. Cópiala manualmente desde Metabase a METABASE_SECRET_KEY.');
    const state = JSON.parse(await readFile(new URL('../data/metabase-state.json', import.meta.url), 'utf8'));
    if (!state.dashboardId) throw new Error('Primero crea el dashboard.');
    if (!settings.find(item => item.key === 'enable-embedding-static')?.value) await api('/setting/enable-embedding-static', 'PUT', { value: true });
    const oldLimit = settings.find(item => item.key === 'unaggregated-query-row-limit')?.value;
    const aggregatedLimit = settings.find(item => item.key === 'aggregated-query-row-limit')?.value;
    if (!aggregatedLimit || Number(aggregatedLimit) < 15000) await api('/setting/aggregated-query-row-limit', 'PUT', { value: 15000 });
    if (!oldLimit || Number(oldLimit) < 15000) {
      await api('/setting/unaggregated-query-row-limit', 'PUT', { value: 15000 });
      console.log('Límite de consultas sin agrupar: 15,000 filas, suficiente para el dataset.');
    }
    await api(`/dashboard/${state.dashboardId}`, 'PUT', { enable_embedding: true, embedding_params: { internet: 'enabled' } });
    const envPath = new URL('../.env', import.meta.url);
    let content = await readFile(envPath, 'utf8');
    content = content.replace(/^METABASE_SECRET_KEY=.*$/m, () => `METABASE_SECRET_KEY=${secret}`);
    await writeFile(envPath, content);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ resource: { dashboard: state.dashboardId }, params: {}, exp: Math.floor(Date.now()/1000) + 600 })}`;
    const token = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
    const result = await fetch(`${site}/api/embed/dashboard/${token}`, { signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw new Error(`La comprobación del dashboard embebido devolvió HTTP ${result.status}.`);
    console.log('Dashboard publicado para incrustación. Clave guardada sin mostrarla. JWT aceptado por Metabase.');
    const cardId = Object.entries(state.questions).find(([name]) => name.startsWith('03'))?.[1];
    const scatter = await api(`/card/${cardId}/query`, 'POST', { ignore_cache: true, parameters: [] });
    console.log(`Dispersión comprobada: ${scatter.data?.rows?.length} filas; truncada: ${Boolean(scatter.data?.rows_truncated)}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (process.argv.includes('--inspect')) {

  const settings = await api('/setting');
  for (const setting of settings.filter(item => /embedding|query-row-limit/.test(item.key))) {
    console.log(setting.key, /secret|key/.test(setting.key) ? Boolean(setting.value) : setting.value);
  }
} else {

const collection = Number(process.env.METABASE_COLLECTION_ID || 8);
if (collection !== 8) throw new Error('Esta práctica está limitada a la colección Parcial2 (ID 8).');
const statePath = new URL('../data/metabase-state.json', import.meta.url);
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; state = { site, collection, questions: {} }; }
if (state.site !== site || state.collection !== collection) throw new Error('El estado guardado pertenece a otra instalación o colección.');
const save = () => writeFile(statePath, JSON.stringify(state, null, 2));
const setEnv = async (name, value) => {
  const path = new URL('../.env', import.meta.url);
  let text = await readFile(path, 'utf8');
  const line = `${name}=${value}`;
  text = new RegExp(`^${name}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${name}=.*$`, 'm'), () => line) : `${text}\n${line}\n`;
  await writeFile(path, text);
};
function sourceTable(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value['source-table'])) return value['source-table'];
  for (const child of Object.values(value)) { const found = sourceTable(child); if (found) return found; }
  return null;
}
try {
  const target = await api(`/collection/${collection}`);
  console.log(`Colección: ${target.name} (${collection})`);
  if (!state.modelId) {
    const existing = await api(`/collection/${collection}/items?models=dataset`);
    const items = existing.data || existing;
    const matches = Array.isArray(items) ? items.filter(item => /student.?grade.?ses.?dataset/i.test(item.name.replaceAll(' ', '_'))) : [];
    if (matches.length > 1) throw new Error('Hay varios modelos de estudiantes en Parcial2. Selecciona el ID correcto en data/metabase-state.json.');
    if (matches.length === 1) {
      state.modelId = matches[0].id;
      await save();
      console.log(`Reutilizando modelo existente: ${matches[0].name} (${state.modelId})`);
    }
  }
  if (!state.modelId) {
    console.log('Importando CSV como modelo. La instancia debe tener las cargas CSV habilitadas.');
    const csv = await readFile(new URL('../data/student_grade_ses_dataset.csv', import.meta.url));
    const form = new FormData();
    form.append('collection_id', String(collection));
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'student_grade_ses_dataset.csv');
    const uploaded = await api('/upload/csv', 'POST', form);
    state.modelId = uploaded.model_id || uploaded.card_id || uploaded.id || (Number.isInteger(uploaded) ? uploaded : null);
    if (!state.modelId) throw new Error('Metabase importó el CSV pero no devolvió el ID esperado. Revisa el modelo en Parcial2 antes de reintentar.');
    await save();
  }
  const model = await api(`/card/${state.modelId}`);
  const tableId = sourceTable(model.dataset_query);
  if (!tableId) throw new Error('No se pudo identificar la tabla del modelo importado.');
  const table = await api(`/table/${tableId}/query_metadata`);
  const db = table.db_id || table.database_id || model.database_id || model.dataset_query.database;
  if (!db) throw new Error('No se pudo identificar la base de datos del modelo.');
  const quote = value => `\`${String(value).replaceAll('`', '``')}\``;
  const tableName = table.schema ? `${quote(table.schema)}.${quote(table.name)}` : quote(table.name);
  // La conexión existente es MySQL 8.4. Se excluyen los valores ausentes en cada análisis.
  const from = tableName;
  const definitions = [
    { name: '01 · Distribución del rendimiento académico', display: 'bar', description: 'Conteo por categoría de calificación. Se omiten categorías ausentes.', sql: `SELECT grade_class AS Calificacion, COUNT(*) AS Estudiantes FROM ${from} WHERE grade_class IS NOT NULL AND grade_class <> '' GROUP BY grade_class ORDER BY grade_class`, settings: { 'graph.dimensions': ['Calificacion'], 'graph.metrics': ['Estudiantes'], 'graph.colors': ['#4C8062'], 'graph.x_axis.title_text': 'Categoría de calificación', 'graph.y_axis.title_text': 'Estudiantes' } },
    { name: '02 · Educación de los padres y calificaciones', display: 'bar', description: 'Promedio por escolaridad del padre y de la madre, separado por género. Dos observaciones familiares por estudiante; no son estudiantes distintos.', sql: `SELECT CONCAT(Parentesco, ': ', Escolaridad) AS Educacion_parental, Genero, ROUND(AVG(Nota),2) AS Promedio FROM (SELECT 'Padre' AS Parentesco, father_education_level AS Escolaridad, gender AS Genero, final_grade_pct AS Nota FROM ${from} UNION ALL SELECT 'Madre', mother_education_level, gender, final_grade_pct FROM ${from}) p WHERE Escolaridad IS NOT NULL AND Escolaridad <> '' AND Nota IS NOT NULL GROUP BY Parentesco, Escolaridad, Genero ORDER BY Parentesco, FIELD(Escolaridad,'No Formal Education','Primary','Secondary','Higher Secondary','Bachelor''s Degree','Master''s Degree','Doctorate'), Escolaridad, Genero`, settings: { 'graph.dimensions': ['Educacion_parental', 'Genero'], 'graph.metrics': ['Promedio'], 'stackable.stack_type': null, 'graph.colors': ['#4C8062', '#D1A464', '#6F8DA4'], 'graph.y_axis.title_text': 'Calificación promedio (%)' } },
    { name: '03 · Horas de estudio y calificación final', display: 'scatter', description: 'Cada punto representa un estudiante con horas y nota disponibles. Horas semanales en X; nota final porcentual en Y.', sql: `SELECT student_id AS Estudiante, study_hours_per_week AS Horas_estudio, final_grade_pct AS Calificacion_final FROM ${from} WHERE study_hours_per_week IS NOT NULL AND final_grade_pct IS NOT NULL ORDER BY student_id`, settings: { 'graph.dimensions': ['Horas_estudio'], 'graph.metrics': ['Calificacion_final'], 'scatter.bubble': null, 'graph.colors': ['#4C8062'], 'graph.x_axis.title_text': 'Horas de estudio por semana', 'graph.y_axis.title_text': 'Calificación final (%)' } },
    { name: '04 · Brecha digital y aprobación', display: 'pie', description: 'Criterio de la práctica: aprobado = nota final ≥ 60/100. Filtra acceso a internet para comparar ambas poblaciones. Ausencias de datos excluidas.', sql: `SELECT CASE WHEN final_grade_pct >= 60 THEN 'Aprobados' ELSE 'Reprobados' END AS Resultado, COUNT(*) AS Estudiantes FROM ${from} WHERE final_grade_pct IS NOT NULL AND has_internet_access IN (0,1) [[AND has_internet_access = {{internet}}]] GROUP BY Resultado ORDER BY Resultado`, tags: { internet: { id: 'internet-tag', name: 'internet', 'display-name': 'Internet (1=Sí, 0=No)', type: 'number', required: false } }, settings: { 'pie.dimension': 'Resultado', 'pie.metric': 'Estudiantes', 'pie.show_legend': true, 'pie.show_labels': true, 'pie.percent_visibility': 'inside', 'pie.colors': { Aprobados: '#4C8062', Reprobados: '#D1A464' } } },
    { name: '05 · Asistencia y rendimiento académico', display: 'line', description: 'Promedio por intervalos de asistencia de diez puntos porcentuales: [0,10), [10,20), …, [90,100]. Se excluyen asistencias fuera de 0–100 y valores ausentes.', sql: `SELECT LEAST(FLOOR(attendance_rate_pct / 10) * 10,90) AS Asistencia_desde, ROUND(AVG(final_grade_pct),2) AS Promedio FROM ${from} WHERE attendance_rate_pct BETWEEN 0 AND 100 AND final_grade_pct IS NOT NULL GROUP BY Asistencia_desde ORDER BY Asistencia_desde`, settings: { 'graph.dimensions': ['Asistencia_desde'], 'graph.metrics': ['Promedio'], 'graph.colors': ['#4C8062'], 'graph.x_axis.title_text': 'Inicio del intervalo de asistencia (%)', 'graph.y_axis.title_text': 'Calificación promedio (%)', 'graph.show_values': true } }
  ];
  definitions[1].sql = definitions[1].sql.replace("CONCAT(Parentesco, ': ', Escolaridad)", "CONCAT(Parentesco, ': ', CASE Escolaridad WHEN 'No Formal Education' THEN 'Sin estudios' WHEN 'Primary' THEN 'Primaria' WHEN 'Secondary' THEN 'Secundaria' WHEN 'Higher Secondary' THEN 'Bachillerato' WHEN 'Bachelor''s Degree' THEN 'Licenciatura' WHEN 'Master''s Degree' THEN 'Maestría' WHEN 'Doctorate' THEN 'Doctorado' ELSE Escolaridad END)");
  definitions[1].settings['graph.x_axis.title_text'] = 'Nivel educativo de la madre y del padre';
  definitions[3].description += ' Sin filtro: ambos grupos. Con internet: 1; sin internet: 0. Se excluyen 181 registros sin información de internet.';
  definitions[3].settings['pie.percent_visibility'] = 'both';
  definitions[3].settings.version = 2;
  await mkdir(new URL('../metabase/', import.meta.url), { recursive: true });
  for (const definition of definitions) {
    await writeFile(new URL(`../metabase/${definition.name.slice(0, 2)}.sql`, import.meta.url), definition.sql + ';\n');
    const body = { name: definition.name, description: definition.description, type: 'question', collection_id: collection, display: definition.display, visualization_settings: definition.settings, dataset_query: { database: db, type: 'native', constraints: { 'max-results': 20000, 'max-results-bare-rows': 20000 }, native: { query: definition.sql, 'template-tags': definition.tags || {} } } };
    const id = state.questions[definition.name];
    const card = await api(id ? `/card/${id}` : '/card', id ? 'PUT' : 'POST', body);
    state.questions[definition.name] = card.id; await save();
    const result = await api(`/card/${card.id}/query`, 'POST', { parameters: [], ignore_cache: true });
    if (result.error || result.status === 'failed') throw new Error(`Consulta ${card.id}: ${result.error || 'falló'}`);
    console.log(`Verificada: ${definition.name} (${result.data?.rows?.length ?? '?'} filas)`);
  }
  if (!state.dashboardId) {
    const dashboard = await api('/dashboard', 'POST', { name: 'Parcial2 · Rendimiento académico y factores socioeconómicos', collection_id: collection, description: 'Grade Prediction Based on Socioeconomic Factors. Aprobación: nota ≥ 60/100 (criterio explícito de esta práctica). Asociaciones descriptivas; no implican causalidad.' });
    state.dashboardId = dashboard.id; await save();
  }
  const parameterId = 'internet-access';
  const layout = [[0,0,24,6],[6,0,24,8],[14,0,12,8],[14,12,12,8],[22,0,24,6]];
  const currentDashboard = await api(`/dashboard/${state.dashboardId}`);
  const dashcards = definitions.map((definition, index) => {
    const cardId = state.questions[definition.name];
    const existing = currentDashboard.dashcards?.find(item => item.card_id === cardId);
    const [row, col, size_x, size_y] = layout[index];
    return { id: existing?.id || -(index + 1), card_id: cardId, row, col, size_x, size_y, series: [], visualization_settings: {}, parameter_mappings: index === 3 ? [{ parameter_id: parameterId, card_id: cardId, target: ['variable', ['template-tag', 'internet']] }] : [] };
  });
  await api(`/dashboard/${state.dashboardId}`, 'PUT', { dashcards, parameters: [{ id: parameterId, name: 'Acceso a internet (1=Sí, 0=No)', slug: 'internet', type: 'number/=' }] });
  await setEnv('METABASE_DASHBOARD_ID', state.dashboardId);
  console.log(`\nDashboard creado: ${site}/dashboard/${state.dashboardId}`);
  console.log('El ID quedó guardado en .env. Activa la incrustación firmada, publica este dashboard y copia la clave de incrustación a METABASE_SECRET_KEY.');
  console.log('Después: php artisan config:clear y php artisan serve en backend. En frontend: npm run dev. Para exportar desde backend: npm run export:pdf.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
}
