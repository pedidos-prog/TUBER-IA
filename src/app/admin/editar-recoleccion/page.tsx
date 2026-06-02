'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { format } from 'date-fns';
import styles from './editar.module.css';

interface Finca { id: number; nombre: string; }
interface Parcela { id: number; finca_id: number; nombre: string; }
interface Perro { id: number; nombre: string; }
interface Operario { id: string; nombre: string; }

function EditarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [fincas, setFincas] = useState<Finca[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [perros, setPerros] = useState<Perro[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);

  const [fincaId, setFincaId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [perroId, setPerroId] = useState('');
  const [operarioId, setOperarioId] = useState('');
  const [pesoGramos, setPesoGramos] = useState('');
  const [fechaHora, setFechaHora] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      if (!id) { router.replace('/admin'); return; }
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: roleData } = await supabase
        .from('user_roles').select('role').eq('id', session.user.id).single();
      if (!roleData || roleData.role !== 'admin') { router.replace('/operario'); return; }

      const [{ data: f }, { data: p }, { data: pe }, { data: ops }, { data: rec }] = await Promise.all([
        supabase.from('fincas').select('*').order('nombre'),
        supabase.from('parcelas').select('*').order('nombre'),
        supabase.from('perros').select('*').order('nombre'),
        supabase.from('user_roles').select('id, nombre').eq('role', 'operario').order('nombre'),
        supabase.from('recolecciones').select('*').eq('id', id).single(),
      ]);

      setFincas(f || []);
      setParcelas(p || []);
      setPerros(pe || []);
      setOperarios(ops || []);

      if (rec) {
        setFincaId(String(rec.finca_id));
        setParcelaId(String(rec.parcela_id));
        setPerroId(String(rec.perro_id || ''));
        setOperarioId(rec.operario_id || '');
        setPesoGramos(String(Math.round(rec.peso_kg * 1000)));
        setFechaHora(format(new Date(rec.fecha_hora), "yyyy-MM-dd'T'HH:mm"));
      }
      setLoading(false);
    }
    init();
  }, [id, router]);

  const parcelasFiltradas = parcelas.filter(p => p.finca_id === parseInt(fincaId));
  const operarioSeleccionado = operarios.find(o => o.id === operarioId);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fincaId || !parcelaId || pesoGramos === '' || !fechaHora) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('recolecciones')
      .update({
        finca_id: parseInt(fincaId),
        parcela_id: parseInt(parcelaId),
        operario_id: operarioId || null,
        operario_nombre: operarioSeleccionado?.nombre || '',
        perro_id: perroId ? parseInt(perroId) : null,
        perro_nombre: perros.find(p => p.id === parseInt(perroId))?.nombre || '',
        peso_kg: parseFloat(pesoGramos) / 1000,
        fecha_hora: new Date(fechaHora).toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      setError('Error al guardar: ' + updateError.message);
      setSaving(false);
    } else {
      router.push('/admin');
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('recolecciones').delete().eq('id', id);
    router.push('/admin');
  }

  if (loading) return <div className={styles.loading}>Cargando…</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/admin')}>← Dashboard</button>
        <span className={styles.title}>Editar Recolección #{id}</span>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.field}>
              <label>Operario</label>
              <select value={operarioId} onChange={e => setOperarioId(e.target.value)}>
                <option value="">Sin usuario vinculado</option>
                {operarios.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Finca</label>
                <select value={fincaId} onChange={e => { setFincaId(e.target.value); setParcelaId(''); }} required>
                  <option value="">Seleccionar…</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Parcela</label>
                <select value={parcelaId} onChange={e => setParcelaId(e.target.value)} required disabled={!fincaId}>
                  <option value="">Seleccionar…</option>
                  {parcelasFiltradas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Perro</label>
                <select value={perroId} onChange={e => setPerroId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {perros.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Peso (gramos)</label>
                <input type="number" value={pesoGramos}
                  onChange={e => setPesoGramos(e.target.value)}
                  placeholder="0" step="1" min="0" required />
              </div>
            </div>
            <div className={styles.field}>
              <label>Fecha y hora</label>
              <input type="datetime-local" value={fechaHora}
                onChange={e => setFechaHora(e.target.value)} required />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : '🗑 Eliminar'}
              </button>
              <button type="submit" className={styles.saveBtn} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function EditarRecoleccionPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>Cargando…</div>}>
      <EditarForm />
    </Suspense>
  );
}
