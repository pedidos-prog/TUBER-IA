'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './operario.module.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Finca { id: number; nombre: string; }
interface Parcela { id: number; finca_id: number; nombre: string; }
interface Perro { id: number; nombre: string; }
interface Operario { id: string; nombre: string; }

export default function OperarioPage() {
  const router = useRouter();
  const [myName, setMyName] = useState('');
  const [myId, setMyId] = useState('');
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [perros, setPerros] = useState<Perro[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);

  const [fincaId, setFincaId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [pesoGramos, setPesoGramos] = useState('');
  const [perroId, setPerroId] = useState('');
  const [operarioId, setOperarioId] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const { data: roleData } = await supabase
        .from('user_roles').select('role, nombre').eq('id', session.user.id).single();
      if (!roleData) { router.replace('/sin-rol'); return; }
      if (roleData.role === 'admin') { router.replace('/admin'); return; }

      setMyName(roleData.nombre);
      setMyId(session.user.id);
      setOperarioId(session.user.id); // por defecto yo mismo

      const [{ data: f }, { data: p }, { data: pe }, { data: ops }] = await Promise.all([
        supabase.from('fincas').select('*').order('nombre'),
        supabase.from('parcelas').select('*').order('nombre'),
        supabase.from('perros').select('*').eq('activo', true).order('nombre'),
        supabase.from('user_roles').select('id, nombre').eq('role', 'operario').order('nombre'),
      ]);
      setFincas(f || []);
      setParcelas(p || []);
      setPerros(pe || []);
      setOperarios(ops || []);
    }
    init();
  }, [router]);

  const parcelasFiltradas = parcelas.filter(p => p.finca_id === parseInt(fincaId));
  const operarioSeleccionado = operarios.find(o => o.id === operarioId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fincaId || !parcelaId || pesoGramos === '' || !perroId || !operarioId) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('recolecciones').insert({
      finca_id: parseInt(fincaId),
      parcela_id: parseInt(parcelaId),
      operario_id: myId, // siempre el usuario logado como responsable
      operario_nombre: operarioSeleccionado?.nombre || myName,
      perro_id: parseInt(perroId),
      perro_nombre: perros.find(p => p.id === parseInt(perroId))?.nombre || '',
      peso_kg: parseFloat(pesoGramos) / 1000,
      fecha_hora: new Date().toISOString(),
    });

    if (insertError) {
      setError('Error al guardar. Inténtalo de nuevo.');
    } else {
      setSuccess(true);
      setFincaId('');
      setParcelaId('');
      setPesoGramos('');
      setPerroId('');
      setOperarioId(myId); // volver a mí mismo
      setTimeout(() => setSuccess(false), 4000);
    }
    setLoading(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.title}>Recolección</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userName}>{myName}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.dateBar}>
          <span className={styles.dateText}>
            {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </span>
          <span className={styles.timeText}>{format(now, 'HH:mm:ss')}</span>
        </div>

        <div className={styles.card}>
          <h2>Nueva Recolección</h2>
          <p className={styles.subtitle}>La fecha y hora se registran automáticamente</p>

          {success && (
            <div className={styles.successMsg}>
              ✓ Recolección registrada para {operarioSeleccionado?.nombre || myName}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>

            {/* Selector de operario — por defecto el propio usuario */}
            <div className={styles.field}>
              <label>Registrando para</label>
              <select value={operarioId} onChange={e => setOperarioId(e.target.value)} required>
                {operarios.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}{o.id === myId ? ' (yo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Finca</label>
                <select value={fincaId} onChange={e => { setFincaId(e.target.value); setParcelaId(''); }} required>
                  <option value="">Seleccionar finca…</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Parcela</label>
                <select value={parcelaId} onChange={e => setParcelaId(e.target.value)} required disabled={!fincaId}>
                  <option value="">Seleccionar parcela…</option>
                  {parcelasFiltradas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Perro</label>
                <select value={perroId} onChange={e => setPerroId(e.target.value)} required>
                  <option value="">Seleccionar perro…</option>
                  {perros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Peso (gramos)</label>
                <input
                  type="number"
                  value={pesoGramos}
                  onChange={e => setPesoGramos(e.target.value)}
                  placeholder="0"
                  step="1"
                  min="0"
                  required
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? 'Guardando…' : 'Registrar Recolección'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
