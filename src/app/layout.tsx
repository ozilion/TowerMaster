
import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Import Inter font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // For potential future notifications

const inter = Inter({ // Initialize Inter font
  subsets: ['latin'],
  variable: '--font-inter', // CSS variable for Inter
});


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
    <html lang="tr">{/* Changed lang to tr for Turkish */}
      <body className={`${inter.variable} font-sans antialiased`}> {/* Use inter variable and a generic font-sans class */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
