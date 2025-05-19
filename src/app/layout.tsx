
import type {Metadata} from 'next';
// import { Inter } from 'next/font/google'; // Commented out for diagnostics
import './globals.css';
// import { Toaster } from "@/components/ui/toaster"; // Commented out for diagnostics

// const inter = Inter({ // Commented out for diagnostics
//   subsets: ['latin'],
//   variable: '--font-inter',
// });

export const metadata: Metadata = {
  title: 'Kule Savunma Ustası',
  description: 'Stratejik kule savunma oyunu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      {/* <body className={`${inter.variable} font-sans antialiased`}> */}
      <body> {/* Simplified body tag */}
        {children}
        {/* <Toaster /> */} {/* Commented out for diagnostics */}
      </body>
    </html>
  );
}
