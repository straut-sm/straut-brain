import type { Metadata, Viewport } from "next";
import { Bai_Jamjuree, Poppins } from "next/font/google";
import "./globals.css";

const bai = Bai_Jamjuree({
  variable: "--font-bai",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Straut",
  description: "Conteúdos e aprovações — Straut Marketing",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${bai.variable} ${poppins.variable} antialiased`}>{children}</body>
    </html>
  );
}
