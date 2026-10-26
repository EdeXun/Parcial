import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const [config, setConfig] = useState({ collectionUrl: 'http://localhost:3000/collection/8-parcial2' });
  const [embed, setEmbed] = useState(null);
  const [status, setStatus] = useState('Conectando…');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [internet, setInternet] = useState('');
  const sequence = useRef(0);
  const timer = useRef();
  const slowTimer = useRef();
  const load = useCallback(async () => {
    const current = ++sequence.current;
    clearTimeout(timer.current); clearTimeout(slowTimer.current);
    setEmbed(null); setError(''); setLoaded(false); setSlow(false); setStatus('Conectando…');
    try {
      const response = await fetch('/api/dashboard', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (current !== sequence.current) return;
      if (!response.ok) throw new Error(data.error || 'No se pudo obtener el dashboard.');
      setEmbed(data);
      timer.current = setTimeout(load, Math.max(10000, data.expiresAt - Date.now() - 60000));
      slowTimer.current = setTimeout(() => setSlow(true), 15000);
    } catch (problem) {
      if (current !== sequence.current) return;
      setError(problem.message); setStatus('Pendiente de conexión');
    }
  }, []);
  useEffect(() => {
    fetch('/api/config', { headers: { Accept: 'application/json' } }).then(r => r.json()).then(setConfig).catch(() => {});
    load();
    return () => { sequence.current++; clearTimeout(timer.current); clearTimeout(slowTimer.current); };
  }, [load]);
  const external = { target: '_blank', rel: 'noreferrer' };
  let dashboardUrl = embed?.url;
  if (dashboardUrl) {
    const url = new URL(dashboardUrl);
    if (internet !== '') url.searchParams.set('internet', internet);
    else url.searchParams.delete('internet');
    const appearance = new URLSearchParams(url.hash.slice(1));
    appearance.set('hide_parameters', 'internet');
    url.hash = appearance.toString();
    dashboardUrl = url.toString();
  }
  return <>
    <header className="page-header"><h1>Metabase Parcial 2</h1></header>
    <main>
      <nav className="topics" aria-label="Contenido del dashboard">{['Rendimiento','Educación familiar','Horas de estudio','Brecha digital','Asistencia'].map((topic, i) => <span key={topic}><b>0{i + 1}</b>{topic}</span>)}</nav>
      <section className="dashboard-section" aria-labelledby="dashboard-title"><div className="section-heading"><div><p className="eyebrow">EXPLORA LOS DATOS</p><h2 id="dashboard-title">Panorama académico</h2></div><div className="actions"><span className={`status ${loaded ? 'ready' : ''}`} role="status">{status}</span><button onClick={load}>↻ Actualizar</button><a className="button primary" href={config.dashboardUrl || config.collectionUrl} {...external}>Exportar PDF ↗</a></div></div>
        <div className="internet-filter"><label htmlFor="internet-access">Acceso a internet</label><select id="internet-access" value={internet} onChange={event => { setInternet(event.target.value); setLoaded(false); setSlow(false); setStatus('Aplicando filtro…'); clearTimeout(slowTimer.current); }}><option value="">Todos</option><option value="1">Con internet</option><option value="0">Sin internet</option></select><span>Filtra únicamente la dona · Gráfica 4</span></div>
        <div className="dashboard-shell">
          {!error && !loaded && !slow && <div className="placeholder"><span className="loader" /><h3>Conectando con Metabase</h3><p>Preparando el dashboard de Parcial2.</p></div>}
          {error && <div className="placeholder"><span className="error-symbol">⌁</span><p className="eyebrow">CONFIGURACIÓN PENDIENTE</p><h3>Conecta tu dashboard</h3><p>{error}</p><ol><li>Añade la API key en <code>.env</code> y ejecuta <code>npm run setup:metabase</code>.</li><li>Activa la incrustación firmada y publica el dashboard en Metabase.</li><li>Completa la clave de incrustación en <code>.env</code> y ejecuta <code>php artisan config:clear</code>.</li></ol><button onClick={load}>Volver a intentar</button></div>}
          {embed && <iframe title="Dashboard de rendimiento académico de Metabase" src={dashboardUrl} referrerPolicy="no-referrer" allowFullScreen onLoad={() => { setLoaded(true); setStatus('Vista cargada'); clearTimeout(slowTimer.current); }} />}
          {slow && embed && <p className="slow">Si Metabase muestra un error, revisa que el dashboard esté publicado para incrustación y que la clave coincida con la de tu servidor.</p>}
        </div>
      </section>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
