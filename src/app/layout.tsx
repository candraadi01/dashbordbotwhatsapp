import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CANDRA Admin Dashboard",
  description: "Dashboard Bot Whatsapp & Customer CRM Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
