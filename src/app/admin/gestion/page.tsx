'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './gestion.module.css';

interface Finca { id: number; nombre: string; }
interface Parcela { id: number; finca_id: number; nombre: string; finca_nombre?: string; }
interface Perro { id: number; nombre: string; activo: boolean; }
interface Operario { id: string; nombre: string; role: string; email?: string; }

type Tab = 'parcelas' | 'perros' | 'operarios';

export default function GestionPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('parcelas');

  // Data
  const [fincas, setFincas] = useState<Finca[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [perros, setPerros] = useState<Perro[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);

  // Forms
  const [newParcelaFinca, setNewParcelaFinca] = useState('');
  const [newParcelaNombre, setNewParcelaNombre] = useState('');
  const [newPerroNombre, setNewPerroNombre] = useState('');
  const [newOperarioNombre, setNewOperarioNombre] = useState('');
  const [newOperarioPassword, setNewOperarioPassword] = useState('');
  const [newOperarioRole, setNewOperarioRole] = useState<'operario' | 'admin'>('operario');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: f }, { data: p }, { data: pe }, { data: op }] = await Promise.all([
      supabase.from('fincas').select('*').order('nombre'),
      supabase.from('parcelas').select('*, fincas(nombre)').order('nombre'),
      supabase.from('perros').select('*').order('nombre'),
      supabase.from('user_roles').select('*').order('nombre'),
    ]);
    setFincas(f || []);
    setParcelas((p || []).map((x: any) => ({ ...x, finca_nombre: x.fincas?.nombre })));
    setPerros(pe || []);
    setOperarios(op || []);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: roleData } = await supabase
        .from('user_roles').select('role').eq('id', session.user.id).single();
      if (!roleData || roleData.role !== 'admin') { router.replace('/operario'); return; }
      load();
    }
    init();
  }, [router, load]);

  // --- PARCELAS ---
  async function addParcela(e: React.FormEvent) {
    e.preventDefault();
    if (!newParcelaFinca || !newParcelaNombre.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('parcelas').insert({
      finca_id: parseInt(newParcelaFinca),
      nombre: newParcelaNombre.trim().toUpperCase(),
    });
    if (error) flash('err', 'Error al añadir parcela: ' + error.message);
    else { flash('ok', 'Parcela añadida'); setNewParcelaNombre(''); setNewParcelaFinca(''); load(); }
    setLoading(false);
  }

  async function deleteParcela(id: number) {
    if (!confirm('¿Eliminar esta parcela? Se perderán los registros asociados.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('parcelas').delete().eq('id', id);
    if (error) flash('err', 'No se puede eliminar: tiene recolecciones asociadas');
    else { flash('ok', 'Parcela eliminada'); load(); }
  }

  // --- PERROS ---
  async function addPerro(e: React.FormEvent) {
    e.preventDefault();
    if (!newPerroNombre.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('perros').insert({
      nombre: newPerroNombre.trim().toUpperCase(),
    });
    if (error) flash('err', 'Error al añadir perro');
    else { flash('ok', 'Perro añadido'); setNewPerroNombre(''); load(); }
    setLoading(false);
  }

  async function togglePerro(id: number, activo: boolean) {
    const supabase = createClient();
    await supabase.from('perros').update({ activo: !activo }).eq('id', id);
    load();
  }

  // --- OPERARIOS ---
  async function addOperario(e: React.FormEvent) {
    e.preventDefault();
    if (!newOperarioNombre.trim() || !newOperarioPassword) return;
    setLoading(true);

    const supabase = createClient();
    const nombre = newOperarioNombre.trim().toUpperCase();
    // Email interno: nombre en minúsculas sin espacios + @trufa.local
    const email = nombre.toLowerCase().replace(/\s+/g, '') + '@trufa.local';

    const { data, error } = await supabase.auth.signUp({
      email,
      password: newOperarioPassword,
      options: {
        data: {
          nombre,
          must_change_password: true, // fuerza cambio en primer login
        }
      }
    });

    if (error || !data.user) {
      flash('err', 'Error al crear usuario: ' + (error?.message || 'desconocido'));
      setLoading(false);
      return;
    }

    const { error: roleError } = await supabase.from('user_roles').insert({
      id: data.user.id,
      role: newOperarioRole,
      nombre,
    });

    if (roleError) flash('err', 'Usuario creado pero error asignando rol: ' + roleError.message);
    else {
      flash('ok', `${newOperarioRole === 'admin' ? 'Admin' : 'Operario'} "${nombre}" creado · usuario: ${email.split('@')[0]}`);
      setNewOperarioNombre('');
      setNewOperarioPassword('');
      load();
    }
    setLoading(false);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push('/admin')}>← Dashboard</button>
          <span className={styles.title}>Gestión</span>
        </div>
      </header>

      {msg && (
        <div className={`${styles.flash} ${msg.type === 'ok' ? styles.flashOk : styles.flashErr}`}>
          {msg.text}
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.tabs}>
          {(['parcelas', 'perros', 'operarios'] as Tab[]).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'parcelas' ? '🌱 Parcelas' : t === 'perros' ? '🐕 Perros' : '👤 Operarios'}
              <span className={styles.tabCount}>
                {t === 'parcelas' ? parcelas.length : t === 'perros' ? perros.length : operarios.length}
              </span>
            </button>
          ))}
        </div>

        {/* PARCELAS */}
        {tab === 'parcelas' && (
          <div className={styles.section}>
            <form onSubmit={addParcela} className={styles.addForm}>
              <h3>Nueva Parcela</h3>
              <div className={styles.formRow}>
                <select value={newParcelaFinca} onChange={e => setNewParcelaFinca(e.target.value)} required>
                  <option value="">Seleccionar finca…</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Nombre de la parcela"
                  value={newParcelaNombre}
                  onChange={e => setNewParcelaNombre(e.target.value)}
                  required
                />
                <button type="submit" className={styles.addBtn} disabled={loading}>Añadir</button>
              </div>
            </form>

            <div className={styles.list}>
              {fincas.map(finca => {
                const fps = parcelas.filter(p => p.finca_id === finca.id);
                return (
                  <div key={finca.id} className={styles.group}>
                    <h4 className={styles.groupTitle}>{finca.nombre} <span>({fps.length})</span></h4>
                    {fps.length === 0 ? (
                      <p className={styles.empty}>Sin parcelas</p>
                    ) : (
                      fps.map(p => (
                        <div key={p.id} className={styles.item}>
                          <span>{p.nombre}</span>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => deleteParcela(p.id)}
                            title="Eliminar"
                          >✕</button>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PERROS */}
        {tab === 'perros' && (
          <div className={styles.section}>
            <form onSubmit={addPerro} className={styles.addForm}>
              <h3>Nuevo Perro</h3>
              <div className={styles.formRow}>
                <input
                  type="text"
                  placeholder="Nombre del perro"
                  value={newPerroNombre}
                  onChange={e => setNewPerroNombre(e.target.value)}
                  required
                />
                <button type="submit" className={styles.addBtn} disabled={loading}>Añadir</button>
              </div>
            </form>

            <div className={styles.list}>
              <div className={styles.group}>
                <h4 className={styles.groupTitle}>Activos <span>({perros.filter(p => p.activo).length})</span></h4>
                {perros.filter(p => p.activo).map(p => (
                  <div key={p.id} className={styles.item}>
                    <span>{p.nombre}</span>
                    <button
                      className={styles.toggleBtn}
                      onClick={() => togglePerro(p.id, p.activo)}
                      title="Desactivar"
                    >Desactivar</button>
                  </div>
                ))}
              </div>
              {perros.some(p => !p.activo) && (
                <div className={styles.group}>
                  <h4 className={styles.groupTitle} style={{ opacity: 0.5 }}>Inactivos <span>({perros.filter(p => !p.activo).length})</span></h4>
                  {perros.filter(p => !p.activo).map(p => (
                    <div key={p.id} className={`${styles.item} ${styles.itemInactive}`}>
                      <span>{p.nombre}</span>
                      <button
                        className={styles.toggleBtn}
                        onClick={() => togglePerro(p.id, p.activo)}
                        title="Activar"
                      >Activar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* OPERARIOS */}
        {tab === 'operarios' && (
          <div className={styles.section}>
            <form onSubmit={addOperario} className={styles.addForm}>
              <h3>Nuevo Usuario</h3>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                El usuario entrará con su nombre en minúsculas. Se le pedirá cambiar la contraseña en el primer acceso.
              </p>
              <div className={styles.formGrid}>
                <input
                  type="text"
                  placeholder="Nombre (ej: NONO)"
                  value={newOperarioNombre}
                  onChange={e => setNewOperarioNombre(e.target.value)}
                  required
                />
                <select value={newOperarioRole} onChange={e => setNewOperarioRole(e.target.value as any)}>
                  <option value="operario">Operario</option>
                  <option value="admin">Administrador</option>
                </select>
                <input
                  type="password"
                  placeholder="Contraseña provisional (mín. 6 caracteres)"
                  value={newOperarioPassword}
                  onChange={e => setNewOperarioPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ gridColumn: '1 / -1' }}
                />
              </div>
              <button type="submit" className={styles.addBtn} disabled={loading} style={{ marginTop: 12 }}>
                {loading ? 'Creando…' : 'Crear usuario'}
              </button>
            </form>

            <div className={styles.list}>
              <div className={styles.group}>
                {operarios.map(op => (
                  <div key={op.id} className={styles.item}>
                    <div>
                      <span className={styles.opName}>{op.nombre}</span>
                      <span className={`${styles.roleBadge} ${op.role === 'admin' ? styles.roleAdmin : styles.roleOp}`}>
                        {op.role}
                      </span>
                    </div>
                    <span className={styles.opId} title={op.id}>{op.id.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
