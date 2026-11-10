import type { Metadata, Viewport } from "next";
import { Bai_Jamjuree, Poppins } from "next/font/google";
import { Suspense } from "react";
import { StoreProvider } from "@/lib/store";
import ModeSwitch from "@/components/ModeSwitch";
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
  title: "Straut Brain",
  description: "Controle de conteúdos e clientes da Straut Marketing",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${bai.variable} ${poppins.variable} antialiased`}>
        <StoreProvider>
          {children}
          <Suspense>
            <ModeSwitch />
          </Suspense>
        </StoreProvider>
      </body>
    </html>
  );
}
