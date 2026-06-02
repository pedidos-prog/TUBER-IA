'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getSeasonWeeks, getCurrentSeason, getCurrentWeekKey, SEASONS, type SeasonWeek } from '@/lib/season';
import { format, differenceInCalendarDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './admin.module.css';

interface Recoleccion {
  id: number; peso_kg: number; fecha_hora: string;
  fincas: { nombre: string }; parcelas: { nombre: string };
  perros: { nombre: string } | null;
  operario_nombre: string; perro_nombre: string | null;
}

interface WeekSummary {
  week: SeasonWeek; total: number;
  byParcela: Record<string, number>;
  byOperario: Record<string, number>;
  byPerro: Record<string, number>;
  byDay: Record<string, number>;
  records: Recoleccion[];
}

type MainTab = 'semanas' | 'operarios' | 'asistencia' | 'parcelas' | 'comparativa';

function buildSummaries(weeks: SeasonWeek[], records: Recoleccion[]): WeekSummary[] {
  return weeks.map(week => {
    const weekRecords = records.filter(r => {
      const d = new Date(r.fecha_hora);
      return d >= week.monday && d < week.nextMonday;
    });
    const byParcela: Record<string, number> = {};
    const byOperario: Record<string, number> = {};
    const byPerro: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let total = 0;
    for (const r of weekRecords) {
      total += r.peso_kg;
      const parc = `${r.fincas?.nombre} › ${r.parcelas?.nombre}`;
      byParcela[parc] = (byParcela[parc] || 0) + r.peso_kg;
      byOperario[r.operario_nombre || 'Desconocido'] = (byOperario[r.operario_nombre || 'Desconocido'] || 0) + r.peso_kg;
      const perro = r.perros?.nombre || r.perro_nombre || '—';
      byPerro[perro] = (byPerro[perro] || 0) + r.peso_kg;
      byDay[r.fecha_hora.slice(0, 10)] = (byDay[r.fecha_hora.slice(0, 10)] || 0) + r.peso_kg;
    }
    return { week, total, byParcela, byOperario, byPerro, byDay, records: weekRecords };
  });
}

async function fetchSeason(supabase: ReturnType<typeof createClient>, seasonLabel: string): Promise<Recoleccion[]> {
  const season = SEASONS.find(s => s.label === seasonLabel);
  if (!season) return [];
  const { data } = await supabase
    .from('recolecciones')
    .select('id,peso_kg,fecha_hora,operario_nombre,perro_nombre,fincas(nombre),parcelas(nombre),perros(nombre)')
    .gte('fecha_hora', season.start.toISOString())
    .lt('fecha_hora', season.end.toISOString())
    .order('fecha_hora', { ascending: true });
  return (data as unknown as Recoleccion[]) || [];
}

// Días totales en un rango incluyendo sáb y dom
function totalDaysInRange(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
}

export default function AdminPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('semanas');
  const [cache, setCache] = useState<Record<string, Recoleccion[]>>({});

  // Semanas
  const [selectedSeason, setSelectedSeason] = useState(getCurrentSeason());
  const [weekSummaries, setWeekSummaries] = useState<WeekSummary[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

  // Operario/Perro
  const [chartSeason, setChartSeason] = useState(getCurrentSeason());
  const [selectedOp, setSelectedOp] = useState<string | null>(null);

  // Asistencia
  const [attendanceSeason, setAttendanceSeason] = useState(getCurrentSeason());

  // Parcelas
  const [parcelasSeason, setParcelasSeason] = useState(getCurrentSeason());

  // Comparativa
  const [compSeason, setCompSeason] = useState(getCurrentSeason());
  const [compRefSeason, setCompRefSeason] = useState('2024/25');
  // Inicializar con la fecha de hoy si está en la temporada, si no con el fin de la temporada
  const initCompDate = () => {
    const now = new Date();
    const s = SEASONS.find(s => s.label === getCurrentSeason());
    if (s && now >= s.start && now <= s.end) return format(now, 'yyyy-MM-dd');
    const current = SEASONS.find(s => s.label === getCurrentSeason());
    return current ? format(new Date(current.end.getTime() - 86400000), 'yyyy-MM-dd') : format(now, 'yyyy-MM-dd');
  };
  const [compDate, setCompDate] = useState(initCompDate);

  const supabase = createClient();

  const loadSeason = useCallback(async (label: string) => {
    if (cache[label]) return cache[label];
    setLoadingSeason(true);
    const records = await fetchSeason(supabase, label);
    setCache(prev => ({ ...prev, [label]: records }));
    setLoadingSeason(false);
    return records;
  }, [cache]);

  useEffect(() => {
    async function update() {
      const records = await loadSeason(selectedSeason);
      const weeks = getSeasonWeeks(selectedSeason);
      const summaries = buildSummaries(weeks, records);
      setWeekSummaries(summaries);
      const currentKey = getCurrentWeekKey();
      if (selectedSeason === getCurrentSeason() && summaries.find(s => s.week.key === currentKey)) {
        setSelectedWeekKey(currentKey);
      } else {
        const last = [...summaries].reverse().find(s => s.records.length > 0);
        setSelectedWeekKey(last?.week.key ?? weeks[weeks.length - 1]?.key ?? null);
      }
    }
    update();
  }, [selectedSeason, cache]);

  useEffect(() => { loadSeason(chartSeason); }, [chartSeason]);
  useEffect(() => { loadSeason(attendanceSeason); }, [attendanceSeason]);
  useEffect(() => { loadSeason(parcelasSeason); }, [parcelasSeason]);
  useEffect(() => {
    loadSeason(compSeason);
    loadSeason(compRefSeason);
    // Ajustar fecha de corte al rango de la temporada seleccionada
    const seasonDef = SEASONS.find(s => s.label === compSeason);
    if (seasonDef) {
      const current = new Date(compDate);
      const now = new Date();
      const maxDate = seasonDef.end < now ? seasonDef.end : now;
      if (current < seasonDef.start || current > maxDate) {
        // Si la fecha cae fuera, usar el último día disponible de esa temporada
        const lastDay = new Date(Math.min(maxDate.getTime(), seasonDef.end.getTime() - 86400000));
        setCompDate(format(lastDay, 'yyyy-MM-dd'));
      }
    }
  }, [compSeason, compRefSeason]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: roleData } = await supabase
        .from('user_roles').select('role, nombre').eq('id', session.user.id).single();
      if (!roleData || roleData.role !== 'admin') { router.replace('/operario'); return; }
      setAdminName(roleData.nombre);
      const current = getCurrentSeason();
      const records = await fetchSeason(supabase, current);
      setCache({ [current]: records });
      setLoading(false);
    }
    init();
  }, [router]);

  function getRecords(label: string): Recoleccion[] { return cache[label] || []; }

  // ── Asistencia ──────────────────────────────────────────────
  function getAttendanceData(seasonLabel: string) {
    const season = SEASONS.find(s => s.label === seasonLabel);
    const recs = getRecords(seasonLabel);
    const ops = Array.from(new Set(recs.map(r => r.operario_nombre).filter(Boolean))).sort();
    const data: Record<string, { diasTrabajados: number; diasTotales: number; pct: number; kg: number }> = {};
    for (const op of ops) {
      const opR = recs.filter(r => r.operario_nombre === op);
      const diasTrabajados = new Set(opR.map(r => r.fecha_hora.slice(0, 10))).size;
      // Período fijo de la temporada: 15 Nov → 01 Abr
      // Usamos el año del inicio de la temporada para calcular las fechas fijas
      const seasonYear = season ? season.start.getFullYear() : new Date().getFullYear();
      const periodoInicio = new Date(`${seasonYear}-11-15T12:00:00`);
      const periodoFin = new Date(`${seasonYear + 1}-04-01T12:00:00`);
      const diasTotales = totalDaysInRange(periodoInicio, periodoFin);
      data[op] = {
        diasTrabajados,
        diasTotales,
        pct: diasTotales > 0 ? (diasTrabajados / diasTotales) * 100 : 0,
        kg: opR.reduce((s, r) => s + r.peso_kg, 0),
      };
    }
    return { operarios: ops, data };
  }

  // ── Operario/Perro ──────────────────────────────────────────
  function getChartData() {
    const recs = getRecords(chartSeason);
    const operarios = Array.from(new Set(recs.map(r => r.operario_nombre).filter(Boolean))).sort();
    const dogData: Record<string, { kg: number; dias: number }> = {};
    if (selectedOp) {
      const opRecs = recs.filter(r => r.operario_nombre === selectedOp);
      for (const r of opRecs) {
        const perro = r.perros?.nombre || r.perro_nombre || 'Sin perro';
        if (!dogData[perro]) dogData[perro] = { kg: 0, dias: 0 };
        dogData[perro].kg += r.peso_kg;
      }
      for (const perro of Object.keys(dogData)) {
        const pr = opRecs.filter(r => (r.perros?.nombre || r.perro_nombre || 'Sin perro') === perro);
        dogData[perro].dias = new Set(pr.map(r => r.fecha_hora.slice(0, 10))).size;
      }
    }
    return { operarios, dogData };
  }

  // ── Parcelas ────────────────────────────────────────────────
  function getParcelasData(seasonLabel: string) {
    const recs = getRecords(seasonLabel);
    const byParcela: Record<string, number> = {};
    for (const r of recs) {
      const key = `${r.fincas?.nombre} › ${r.parcelas?.nombre}`;
      byParcela[key] = (byParcela[key] || 0) + r.peso_kg;
    }
    const total = Object.values(byParcela).reduce((s, v) => s + v, 0);
    return { byParcela, total };
  }

  // ── Comparativa ─────────────────────────────────────────────
  // Lógica:
  //   - Temporada actual (compSeason): kg desde su inicio hasta compDate
  //   - Temporada referencia (compRefSeason): kg desde su inicio hasta la misma
  //     fecha de calendario pero en el año de esa temporada (mismo mes/día)
  //   - % se calcula sobre el TOTAL COMPLETO de la campaña de referencia
  function getComparativaData() {
    const cutoff = new Date(compDate + 'T23:59:59');
    const seasonDef = SEASONS.find(s => s.label === compSeason);
    const refDef = SEASONS.find(s => s.label === compRefSeason);
    if (!seasonDef || !refDef) return { rows: [], cutoffRef: null, totalActual: 0, totalRefFull: 0 };

    // Fecha equivalente en la campaña de referencia:
    // mismo mes y día que compDate pero en el año correspondiente de la campaña de referencia.
    // Ej: si compDate=31/12/2024 y ref=23/24 → cutoffRef=31/12/2023
    const cutoffDate = new Date(compDate + 'T23:59:59');
    const yearOffset = refDef.start.getFullYear() - seasonDef.start.getFullYear();
    const cutoffRef = new Date(cutoffDate);
    cutoffRef.setFullYear(cutoffRef.getFullYear() + yearOffset);

    // Registros de la temporada actual hasta compDate
    const recsActual = getRecords(compSeason).filter(r => new Date(r.fecha_hora) <= cutoff);
    // Registros de la referencia hasta la fecha equivalente
    const recsRef = getRecords(compRefSeason).filter(r => new Date(r.fecha_hora) <= cutoffRef);
    // Total completo de la campaña de referencia
    const recsRefTotal = getRecords(compRefSeason);

    const byParcelaActual: Record<string, number> = {};
    for (const r of recsActual) {
      const k = `${r.fincas?.nombre} › ${r.parcelas?.nombre}`;
      byParcelaActual[k] = (byParcelaActual[k] || 0) + r.peso_kg;
    }
    // Referencia hasta fecha equivalente
    const byParcelaRef: Record<string, number> = {};
    for (const r of recsRef) {
      const k = `${r.fincas?.nombre} › ${r.parcelas?.nombre}`;
      byParcelaRef[k] = (byParcelaRef[k] || 0) + r.peso_kg;
    }
    // Referencia total campaña completa
    const byParcelaRefTotal: Record<string, number> = {};
    for (const r of recsRefTotal) {
      const k = `${r.fincas?.nombre} › ${r.parcelas?.nombre}`;
      byParcelaRefTotal[k] = (byParcelaRefTotal[k] || 0) + r.peso_kg;
    }

    const totalActual = Object.values(byParcelaActual).reduce((s, v) => s + v, 0);
    const totalRef = Object.values(byParcelaRef).reduce((s, v) => s + v, 0);
    const totalRefFull = Object.values(byParcelaRefTotal).reduce((s, v) => s + v, 0);

    const allParcelas = Array.from(new Set([
      ...Object.keys(byParcelaActual),
      ...Object.keys(byParcelaRefTotal),
    ])).sort();

    const rows = allParcelas.map(p => ({
      parcela: p,
      kgActual: byParcelaActual[p] || 0,
      kgRef: byParcelaRef[p] || 0,
      kgRefTotal: byParcelaRefTotal[p] || 0,
      diff: (byParcelaActual[p] || 0) - (byParcelaRef[p] || 0),
      pct: byParcelaRefTotal[p] > 0
        ? ((byParcelaActual[p] || 0) / byParcelaRefTotal[p]) * 100
        : null,
    })).sort((a, b) => b.diff - a.diff);

    return { rows, cutoffRef, totalActual, totalRef, totalRefFull };
  }

  async function handleLogout() { await supabase.auth.signOut(); router.replace('/login'); }

  const currentRecords = getRecords(selectedSeason);
  const seasonDef = SEASONS.find(s => s.label === selectedSeason)!;
  const totalSeason = currentRecords.reduce((s, r) => s + r.peso_kg, 0);
  const weeksWithData = weekSummaries.filter(s => s.records.length > 0).length;
  const activeSummary = weekSummaries.find(s => s.week.key === selectedWeekKey);
  const { operarios: chartOps, dogData } = getChartData();
  const { operarios: attOps, data: attData } = getAttendanceData(attendanceSeason);
  const { byParcela: parcelasData, total: parcelasTotal } = getParcelasData(parcelasSeason);
  const maxDogKg = Math.max(...Object.values(dogData).map(d => d.kg), 0.001);
  const totalDogKg = Object.values(dogData).reduce((s, d) => s + d.kg, 0);
  const opTotalDias = selectedOp
    ? new Set(getRecords(chartSeason).filter(r => r.operario_nombre === selectedOp).map(r => r.fecha_hora.slice(0, 10))).size
    : 0;
  const compData = getComparativaData();

  if (loading) return (
    <div className={styles.loading}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>◈</div>
        <div>Cargando…</div>
      </div>
    </div>
  );

  const TAB_LABELS: Record<MainTab, string> = {
    semanas: '📅 Semanal',
    operarios: '🐕 Op./Perro',
    asistencia: '👥 Asistencia',
    parcelas: '🌱 Parcelas',
    comparativa: '📊 Comparativa',
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logoIcon}>◈</span>
          <div>
            <span className={styles.title}>Panel de Administración</span>
            <span className={styles.season}>Recolección de Trufa</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.adminName}>{adminName}</span>
          <button className={styles.nuevaBtn} onClick={() => router.push('/admin/nueva-recoleccion')}>+ Registrar</button>
          <button className={styles.gestionBtn} onClick={() => router.push('/admin/gestion')}>⚙</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total {selectedSeason}</span>
            <span className={styles.statValue}>{totalSeason.toFixed(3)} kg</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Recolecciones</span>
            <span className={styles.statValue}>{currentRecords.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Semanas con datos</span>
            <span className={styles.statValue}>{weeksWithData}</span>
          </div>
        </div>

        <div className={styles.mainTabs}>
          {(Object.keys(TAB_LABELS) as MainTab[]).map(t => (
            <button key={t} className={`${styles.mainTab} ${mainTab === t ? styles.mainTabActive : ''}`} onClick={() => setMainTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── SEMANAS ── */}
        {mainTab === 'semanas' && (
          <div className={styles.content}>
            <select className={styles.seasonDropdown} value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}>
              {SEASONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
            <select className={styles.seasonDropdown} value={selectedWeekKey || ''} onChange={e => setSelectedWeekKey(e.target.value)}>
              {weekSummaries.map(s => (
                <option key={s.week.key} value={s.week.key}>
                  S{s.week.weekNumber} · {s.week.dateRange}{s.records.length > 0 ? ` · ${s.total.toFixed(2)} kg` : ''}
                </option>
              ))}
            </select>

            <aside className={styles.sidebar}>
              <div className={styles.seasonSelectorSidebar}>
                {SEASONS.map(s => (
                  <button key={s.label} className={`${styles.seasonBtnSidebar} ${selectedSeason === s.label ? styles.seasonBtnSidebarActive : ''}`} onClick={() => setSelectedSeason(s.label)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <h3>Semanas</h3>
              <div className={styles.weekList}>
                {weekSummaries.map(s => (
                  <button key={s.week.key}
                    className={`${styles.weekItem} ${selectedWeekKey === s.week.key ? styles.weekActive : ''} ${s.records.length > 0 ? styles.weekHasData : ''}`}
                    onClick={() => setSelectedWeekKey(s.week.key)}>
                    <span className={styles.weekNum}>S{s.week.weekNumber}</span>
                    <span className={styles.weekRange}>{s.week.dateRange}</span>
                    {s.records.length > 0 && <span className={styles.weekKg}>{s.total.toFixed(2)}</span>}
                  </button>
                ))}
              </div>
            </aside>

            <section className={styles.detail}>
              {loadingSeason ? <div className={styles.empty}>Cargando {selectedSeason}…</div>
                : activeSummary ? (
                  <>
                    <div className={styles.weekHeader}>
                      <div>
                        <h2>Semana {activeSummary.week.weekNumber} · {activeSummary.week.isoYear}</h2>
                        <p className={styles.weekDates} style={{ textTransform: 'capitalize' }}>
                          {format(activeSummary.week.monday, "EEEE d 'de' MMMM", { locale: es })} — {format(activeSummary.week.nextMonday, "EEEE d 'de' MMMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className={styles.weekTotal}>
                        <span className={styles.weekTotalLabel}>Total semana</span>
                        <span className={styles.weekTotalValue}>{activeSummary.total.toFixed(3)} kg</span>
                      </div>
                    </div>

                    {activeSummary.records.length === 0 ? <div className={styles.empty}>Sin recolecciones esta semana</div> : (
                      <div className={styles.tables}>
                        {/* Por día — primero */}
                        <div className={styles.tableSection}>
                          <h3>Total por día</h3>
                          <table className={styles.table}>
                            <thead><tr><th>Día</th><th>Recol.</th><th>Kg</th></tr></thead>
                            <tbody>
                              {Object.entries(activeSummary.byDay).sort().map(([day, kg]) => {
                                const n = activeSummary.records.filter(r => r.fecha_hora.slice(0, 10) === day).length;
                                return (
                                  <tr key={day}>
                                    <td style={{ textTransform: 'capitalize' }}>{format(new Date(day + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}</td>
                                    <td className={styles.numCell}>{n}</td>
                                    <td className={styles.numCell}>{kg.toFixed(3)}</td>
                                  </tr>
                                );
                              })}
                              <tr className={styles.totalRow}>
                                <td>TOTAL</td>
                                <td className={styles.numCell}>{activeSummary.records.length}</td>
                                <td className={styles.numCell}>{activeSummary.total.toFixed(3)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {[
                          { title: 'Por Parcela', data: activeSummary.byParcela },
                          { title: 'Por Operario', data: activeSummary.byOperario },
                          { title: 'Por Perro', data: activeSummary.byPerro },
                        ].map(({ title, data }) => (
                          <div key={title} className={styles.tableSection}>
                            <h3>{title}</h3>
                            <table className={styles.table}>
                              <thead><tr><th>{title.replace('Por ', '')}</th><th>Kg</th><th>%</th></tr></thead>
                              <tbody>
                                {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([name, kg]) => (
                                  <tr key={name}>
                                    <td>{name}</td>
                                    <td className={styles.numCell}>{kg.toFixed(3)}</td>
                                    <td className={styles.numCell}>
                                      <div className={styles.barWrap}>
                                        <div className={styles.bar} style={{ width: `${activeSummary.total > 0 ? kg / activeSummary.total * 100 : 0}%` }} />
                                        <span>{activeSummary.total > 0 ? (kg / activeSummary.total * 100).toFixed(1) : '0'}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                <tr className={styles.totalRow}>
                                  <td>TOTAL</td><td className={styles.numCell}>{activeSummary.total.toFixed(3)}</td><td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ))}

                        <div className={styles.tableSection}>
                          <h3>Detalle de recolecciones</h3>
                          <table className={styles.table}>
                            <thead><tr><th>Fecha</th><th>Finca › Parcela</th><th>Operario</th><th>Perro</th><th>Kg</th></tr></thead>
                            <tbody>
                              {activeSummary.records.map(r => (
                                <tr key={r.id}>
                                  <td className={styles.dateCell}>{format(new Date(r.fecha_hora), "dd/MM HH:mm")}</td>
                                  <td>{r.fincas?.nombre} › {r.parcelas?.nombre}</td>
                                  <td>{r.operario_nombre}</td>
                                  <td>{r.perros?.nombre || r.perro_nombre || '—'}</td>
                                  <td className={styles.numCell}>{Number(r.peso_kg).toFixed(3)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : <div className={styles.empty}>Selecciona una semana</div>}
            </section>
          </div>
        )}

        {/* ── OPERARIO / PERRO ── */}
        {mainTab === 'operarios' && (
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <h2>Recolección por operario y perro</h2>
              <div className={styles.chartSeasonSelector}>
                {SEASONS.map(s => (
                  <button key={s.label} className={`${styles.seasonBtn} ${chartSeason === s.label ? styles.seasonBtnActive : ''}`}
                    onClick={() => { setChartSeason(s.label); setSelectedOp(null); }}>{s.label}</button>
                ))}
              </div>
            </div>

            {loadingSeason && !cache[chartSeason] ? <div className={styles.empty}>Cargando {chartSeason}…</div> : (
              <>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Selecciona un operario:</p>
                  <div className={styles.opSelector}>
                    {chartOps.map(op => (
                      <button key={op} className={`${styles.opBtn} ${selectedOp === op ? styles.opBtnActive : ''}`}
                        onClick={() => setSelectedOp(op === selectedOp ? null : op)}>{op}</button>
                    ))}
                  </div>
                </div>

                {selectedOp && Object.keys(dogData).length > 0 && (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                      <strong>{selectedOp}</strong> — {chartSeason} — {opTotalDias} días · {totalDogKg.toFixed(2)} kg
                    </p>
                    <div className={styles.dogBars}>
                      {Object.entries(dogData).sort((a, b) => b[1].kg - a[1].kg).map(([perro, d]) => {
                        const pct = totalDogKg > 0 ? d.kg / totalDogKg * 100 : 0;
                        const barPct = d.kg / maxDogKg * 100;
                        return (
                          <div key={perro} className={styles.dogRow}>
                            <span className={styles.dogName}>{perro}</span>
                            <div className={styles.dogBarTrack}>
                              <div className={styles.dogBar} style={{ width: `${barPct}%`, minWidth: barPct > 0 ? 36 : 0 }}>
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                            <span className={styles.dogKg}>{d.kg.toFixed(2)} kg</span>
                            <span className={styles.dogDays}>{d.dias} días</span>
                          </div>
                        );
                      })}
                      <div className={`${styles.dogRow} ${styles.dogTotal}`}>
                        <span className={styles.dogName} style={{ fontWeight: 700 }}>TOTAL</span>
                        <div />
                        <span className={styles.dogKg}>{totalDogKg.toFixed(2)} kg</span>
                        <span className={styles.dogDays}>{opTotalDias} días</span>
                      </div>
                    </div>
                  </div>
                )}
                {!selectedOp && <div className={styles.empty}>Selecciona un operario para ver el desglose por perro</div>}
                {selectedOp && Object.keys(dogData).length === 0 && <div className={styles.empty}>Sin datos para {selectedOp} en {chartSeason}</div>}
              </>
            )}
          </div>
        )}

        {/* ── ASISTENCIA ── */}
        {mainTab === 'asistencia' && (
          <div className={styles.attendanceContainer}>
            <div className={styles.attendanceHeader}>
              <h2>Días trabajados por operario</h2>
              <div className={styles.seasonSelector}>
                {SEASONS.map(s => (
                  <button key={s.label} className={`${styles.seasonBtn} ${attendanceSeason === s.label ? styles.seasonBtnActive : ''}`}
                    onClick={() => setAttendanceSeason(s.label)}>{s.label}</button>
                ))}
              </div>
            </div>

            {loadingSeason && !cache[attendanceSeason] ? <div className={styles.empty}>Cargando {attendanceSeason}…</div>
              : attOps.length === 0 ? <div className={styles.empty}>Sin datos para esta temporada</div> : (
                <div className={styles.attendanceTableWrap}>
                  <h3>Temporada {attendanceSeason}</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Operario</th>
                        <th>Días trab.</th>
                        <th>Días totales*</th>
                        <th>% asistencia</th>
                        <th>Kg total</th>
                        <th>Kg/día</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = attOps
                          .map(op => ({ op, ...attData[op] }))
                          .sort((a, b) => b.diasTrabajados - a.diasTrabajados);
                        const maxPct = Math.max(...rows.map(r => r.pct), 1);
                        return rows.map(({ op, diasTrabajados, diasTotales, pct, kg }) => (
                          <tr key={op}>
                            <td className={styles.opNameCell}>{op}</td>
                            <td className={styles.numCell}>{diasTrabajados}</td>
                            <td className={styles.numCell}>{diasTotales}</td>
                            <td className={styles.numCell}>
                              <div className={styles.barWrap}>
                                <div className={styles.bar} style={{ width: `${(pct / maxPct) * 100}%` }} />
                                <span style={{ fontWeight: 700, color: pct > 50 ? 'var(--accent-dark)' : 'var(--text)' }}>
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className={styles.numCell}>{kg.toFixed(2)}</td>
                            <td className={styles.numCell}>{diasTrabajados > 0 ? (kg / diasTrabajados).toFixed(2) : '—'}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                    * Días totales = período fijo de temporada: 15 Nov → 1 Abr (138 días, incluyendo sábados y domingos)
                  </p>
                </div>
              )}
          </div>
        )}

        {/* ── PARCELAS ── */}
        {mainTab === 'parcelas' && (
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <h2>Resumen por parcelas</h2>
              <div className={styles.chartSeasonSelector}>
                {SEASONS.map(s => (
                  <button key={s.label} className={`${styles.seasonBtn} ${parcelasSeason === s.label ? styles.seasonBtnActive : ''}`}
                    onClick={() => setParcelasSeason(s.label)}>{s.label}</button>
                ))}
              </div>
            </div>

            {loadingSeason && !cache[parcelasSeason] ? <div className={styles.empty}>Cargando {parcelasSeason}…</div> : (
              <div className={styles.tableSection}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Finca › Parcela</th><th>Kg</th><th>% del total</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(parcelasData)
                      .sort((a, b) => b[1] - a[1])
                      .map(([parcela, kg]) => (
                        <tr key={parcela}>
                          <td>{parcela}</td>
                          <td className={styles.numCell}>{kg.toFixed(3)}</td>
                          <td className={styles.numCell}>
                            <div className={styles.barWrap}>
                              <div className={styles.bar} style={{ width: `${parcelasTotal > 0 ? kg / parcelasTotal * 100 : 0}%` }} />
                              <span>{parcelasTotal > 0 ? (kg / parcelasTotal * 100).toFixed(1) : '0'}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    <tr className={styles.totalRow}>
                      <td>TOTAL</td>
                      <td className={styles.numCell}>{parcelasTotal.toFixed(3)}</td>
                      <td className={styles.numCell}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── COMPARATIVA ── */}
        {mainTab === 'comparativa' && (
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <h2>Comparativa de parcelas</h2>
            </div>

            <div className={styles.compControls}>
              <div className={styles.compControl}>
                <label>Temporada actual</label>
                <select value={compSeason} onChange={e => setCompSeason(e.target.value)}>
                  {SEASONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
              </div>
              <div className={styles.compControl}>
                <label>Hasta la fecha</label>
                <input type="date" value={compDate} onChange={e => setCompDate(e.target.value)} />
              </div>
              <div className={styles.compControl}>
                <label>Comparar con</label>
                <select value={compRefSeason} onChange={e => setCompRefSeason(e.target.value)}>
                  {SEASONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {(loadingSeason && (!cache[compSeason] || !cache[compRefSeason])) ? (
              <div className={styles.empty}>Cargando datos…</div>
            ) : (
              <>
                <div className={styles.compLegend}>
                  <span><strong>{compSeason}</strong> — kg acumulados hasta el {format(new Date(compDate + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}</span>
                  <span style={{ color: 'var(--text-dim)' }}>vs</span>
                  <span>Total campaña completa <strong>{compRefSeason}</strong></span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
                  El % indica cuánto representa lo recolectado en {compSeason} hasta esa fecha respecto al total de toda la campaña {compRefSeason}.
                  {compData.cutoffRef ? ` (Fecha equivalente en ${compRefSeason}: ${format(compData.cutoffRef, "d 'de' MMMM yyyy", { locale: es })})` : ''}
                </p>

                <div className={styles.tableSection}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Finca › Parcela</th>
                        <th>{compSeason} hasta {format(new Date(compDate + 'T12:00:00'), 'dd/MM/yyyy')}</th>
                        <th>{compRefSeason} hasta {compData.cutoffRef ? format(compData.cutoffRef, 'dd/MM/yyyy') : '—'}</th>
                        <th>Diferencia</th>
                        <th>Total campaña {compRefSeason}</th>
                        <th>% sobre total {compRefSeason}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compData.rows?.map(row => (
                        <tr key={row.parcela}>
                          <td>{row.parcela}</td>
                          <td className={styles.numCell}>{row.kgActual.toFixed(3)}</td>
                          <td className={styles.numCell}>{row.kgRef.toFixed(3)}</td>
                          <td className={styles.numCell}>
                            <span style={{ fontWeight: 700, color: row.diff >= 0 ? 'var(--success)' : 'var(--error)' }}>
                              {row.diff >= 0 ? '+' : ''}{row.diff.toFixed(3)}
                            </span>
                          </td>
                          <td className={styles.numCell}>{row.kgRefTotal.toFixed(3)}</td>
                          <td className={styles.numCell}>
                            {row.pct !== null ? (
                              <div className={styles.barWrap}>
                                <div className={styles.bar} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                                <span style={{
                                  color: row.pct >= 100 ? 'var(--success)' : row.pct >= 75 ? 'var(--accent)' : 'var(--error)',
                                  fontWeight: 700
                                }}>
                                  {row.pct.toFixed(1)}%
                                </span>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>TOTAL</td>
                        <td className={styles.numCell}>{(compData.totalActual ?? 0).toFixed(3)}</td>
                        <td className={styles.numCell}>{(compData.totalRef ?? 0).toFixed(3)}</td>
                        <td className={styles.numCell}>
                          <span style={{ fontWeight: 700, color: (compData.totalActual ?? 0) >= (compData.totalRef ?? 0) ? 'var(--success)' : 'var(--error)' }}>
                            {((compData.totalActual ?? 0) - (compData.totalRef ?? 0)) >= 0 ? '+' : ''}{((compData.totalActual ?? 0) - (compData.totalRef ?? 0)).toFixed(3)}
                          </span>
                        </td>
                        <td className={styles.numCell}>{(compData.totalRefFull ?? 0).toFixed(3)}</td>
                        <td className={styles.numCell}>
                          {(compData.totalRefFull ?? 0) > 0 ? (
                            <span style={{ fontWeight: 700 }}>
                              {((compData.totalActual ?? 0) / (compData.totalRefFull ?? 1) * 100).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                    Colores: <span style={{ color: 'var(--success)' }}>≥100%</span> · <span style={{ color: 'var(--accent)' }}>75–99%</span> · <span style={{ color: 'var(--error)' }}>&lt;75%</span> del total de la campaña de referencia
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
