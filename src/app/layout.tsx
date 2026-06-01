import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trufas — Gestión de Recolección',
  description: 'Sistema de gestión de recolección de trufa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
