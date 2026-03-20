import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Survivor Pool 2026",
  description: "March Madness Survivor Pool Tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080c14] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
