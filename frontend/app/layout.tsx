import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventBook",
  description: "Browse events and book your seat.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main className="container">{children}</main>
          <footer>EventBook · a Leafclutch Technologies internship assessment project</footer>
        </AuthProvider>
      </body>
    </html>
  );
}
