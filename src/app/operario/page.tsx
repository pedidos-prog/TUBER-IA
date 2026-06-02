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

export default function OperarioPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [perros, setPerros] = useState<Perro[]>([]);

  const [fincaId, setFincaId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [pesoGramos, setPesoGramos] = useState('');
  const [perroId, setPerroId] = useState('');

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

      // Verificar rol
      const { data: roleData } = await supabase
        .from('user_roles').select('role, nombre').eq('id', session.user.id).single();
      if (!roleData) { router.replace('/sin-rol'); return; }
      if (roleData.role === 'admin') { router.replace('/admin'); return; }

      setUserName(roleData.nombre);
      setUserId(session.user.id);

      const [{ data: f }, { data: p }, { data: pe }] = await Promise.all([
        supabase.from('fincas').select('*').order('nombre'),
        supabase.from('parcelas').select('*').order('nombre'),
        supabase.from('perros').select('*').eq('activo', true).order('nombre'),
      ]);
      setFincas(f || []);
      setParcelas(p || []);
      setPerros(pe || []);
    }
    init();
  }, [router]);

  const parcelasFiltradas = parcelas.filter(p => p.finca_id === parseInt(fincaId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fincaId || !parcelaId || pesoGramos === '' || !perroId) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('recolecciones').insert({
      finca_id: parseInt(fincaId),
      parcela_id: parseInt(parcelaId),
      operario_id: userId,
      operario_nombre: userName,
      perro_id: parseInt(perroId),
      peso_kg: parseFloat(pesoGramos) / 1000,  // operario introduce gramos
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
          <span className={styles.userName}>{userName}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.dateBar}>
          <span className={styles.dateText}>
            {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </span>
          <span className={styles.timeText}>
            {format(now, 'HH:mm:ss')}
          </span>
        </div>

        <div className={styles.card}>
          <h2>Nueva Recolección</h2>
          <p className={styles.subtitle}>La fecha y hora se registran automáticamente</p>

          {success && (
            <div className={styles.successMsg}>
              ✓ Recolección registrada correctamente
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
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
                  max="50"
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
