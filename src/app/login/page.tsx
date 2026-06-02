'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './login.module.css';

const DOMAIN = '@trufa.app';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar usuario guardado
  useEffect(() => {
    const saved = localStorage.getItem('trufa_usuario');
    if (saved) setUsuario(saved);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const input = usuario.trim();

    // Si el usuario ya contiene @ lo usamos tal cual (email real)
    // Si no, añadimos el dominio interno
    const email = input.includes('@') ? input : input.toLowerCase() + DOMAIN;

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    if (remember) {
      localStorage.setItem('trufa_usuario', usuario.trim());
    } else {
      localStorage.removeItem('trufa_usuario');
    }

    // Comprobar si es primer login (must_change_password en metadata)
    const mustChange = data.user.user_metadata?.must_change_password;
    if (mustChange) {
      router.replace('/cambiar-password');
      return;
    }

    // Redirigir según rol
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('id', data.user.id).single();

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
          <h1>Recolección de Trufa</h1>
          <p>Introduce tu usuario y contraseña</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder="nono"
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <label className={styles.rememberLabel}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Recordar usuario</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
