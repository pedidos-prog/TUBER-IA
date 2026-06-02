'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './nueva.module.css';

interface Finca { id: number; nombre: string; }
interface Parcela { id: number; finca_id: number; nombre: string; }
interface Perro { id: number; nombre: string; }
interface Operario { id: string; nombre: string; }

export default function NuevaRecoleccionPage() {
  const router = useRouter();
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [perros, setPerros] = useState<Perro[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);

  const [fincaId, setFincaId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [perroId, setPerroId] = useState('');
  const [operarioId, setOperarioId] = useState('');
  const [pesoGramos, setPesoGramos] = useState('');
  const [fechaHora, setFechaHora] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: roleData } = await supabase
        .from('user_roles').select('role').eq('id', session.user.id).single();
      if (!roleData || roleData.role !== 'admin') { router.replace('/operario'); return; }

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
    if (!fincaId || !parcelaId || !perroId || !operarioId || pesoGramos === '' || !fechaHora) {
      setError('Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('recolecciones').insert({
      finca_id: parseInt(fincaId),
      parcela_id: parseInt(parcelaId),
      operario_id: operarioId,
      operario_nombre: operarioSeleccionado?.nombre || '',
      perro_id: parseInt(perroId),
      perro_nombre: perros.find(p => p.id === parseInt(perroId))?.nombre || '',
      peso_kg: parseFloat(pesoGramos) / 1000,
      fecha_hora: new Date(fechaHora).toISOString(),
    });

    if (insertError) {
      setError('Error al guardar: ' + insertError.message);
    } else {
      setSuccess(true);
      setFincaId('');
      setParcelaId('');
      setPerroId('');
      setPesoGramos('');
      setFechaHora(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setTimeout(() => setSuccess(false), 4000);
    }
    setLoading(false);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/admin')}>← Dashboard</button>
        <span className={styles.title}>Nueva Recolección Manual</span>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <p className={styles.subtitle}>
            Registro manual de recolección por parte del administrador.
          </p>

          {success && <div className={styles.successMsg}>✓ Recolección registrada correctamente</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Operario */}
            <div className={styles.field}>
              <label>Operario</label>
              <select value={operarioId} onChange={e => setOperarioId(e.target.value)} required>
                <option value="">Seleccionar operario…</option>
                {operarios.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
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

            <div className={styles.field}>
              <label>Fecha y hora</label>
              <input
                type="datetime-local"
                value={fechaHora}
                onChange={e => setFechaHora(e.target.value)}
                required
              />
              <span className={styles.hint}>Puedes cambiar la fecha si el registro es de otro día</span>
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
