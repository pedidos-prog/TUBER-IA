'use client';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SinRol() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:16, color:'var(--text-muted)' }}>
      <span style={{ fontSize:32 }}>⚠️</span>
      <p>Tu usuario no tiene un rol asignado en la base de datos.</p>
      <p style={{ fontSize:13 }}>Pide al administrador que ejecute en Supabase:</p>
      <code style={{ background:'var(--bg-card)', padding:'12px 20px', borderRadius:6, fontSize:13, color:'var(--accent)' }}>
        INSERT INTO user_roles (id, role, nombre) VALUES ('TU-UUID', 'operario', 'Tu Nombre');
      </code>
      <button onClick={logout} style={{ marginTop:8, background:'transparent', border:'1px solid var(--border)', color:'var(--text-muted)', padding:'8px 20px', borderRadius:6, cursor:'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  );
}
