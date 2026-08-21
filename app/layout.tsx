import type { Metadata, Viewport } from 'next';
import { Barlow } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  weight: ['400', '600', '700', '800', '900'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-barlow',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Portal de Funcionários | Synova',
  description: 'Gestão de funcionários, competências e pagamentos da Synova.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
