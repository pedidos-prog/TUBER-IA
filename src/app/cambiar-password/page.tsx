'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './cambiar.module.css';

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      // Si no tiene must_change_password, no debería estar aquí
      const mustChange = session.user.user_metadata?.must_change_password;
      if (!mustChange) { router.replace('/'); return; }
      const { data: roleData } = await supabase
        .from('user_roles').select('nombre').eq('id', session.user.id).single();
      setNombre(roleData?.nombre || '');
    }
    check();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Cambiar contraseña y quitar el flag must_change_password
    const { error: updateError } = await supabase.auth.updateUser({
      password: nueva,
      data: { must_change_password: false },
    });

    if (updateError) {
      setError('Error al cambiar la contraseña: ' + updateError.message);
      setLoading(false);
      return;
    }

    // Redirigir según rol
    const { data: { session } } = await supabase.auth.getSession();
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('id', session!.user.id).single();

    if (roleData?.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/operario');
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <h1>Bienvenido{nombre ? `, ${nombre}` : ''}</h1>
          <p>Es tu primer acceso. Por seguridad, elige una contraseña nueva.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoFocus
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label>Repetir contraseña</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              placeholder="Repite la contraseña"
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar contraseña y entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
