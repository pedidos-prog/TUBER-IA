'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      // Leer rol del metadata (rápido, sin consulta BD)
      const role = session.user.user_metadata?.role;

      if (role === 'admin') {
        router.replace('/admin');
        return;
      }

      if (role === 'operario') {
        router.replace('/operario');
        return;
      }

      // Fallback: consultar user_roles si no hay metadata
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (roleData?.role === 'admin') {
        router.replace('/admin');
      } else if (roleData?.role === 'operario') {
        router.replace('/operario');
      } else {
        // Sin rol asignado — mostrar error en lugar de bucle
        router.replace('/sin-rol');
      }
    }
    checkSession();
  }, [router]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', color: 'var(--text-muted)'
    }}>
      Cargando…
    </div>
  );
}
