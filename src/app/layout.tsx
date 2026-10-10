import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Aagey — From Uncertainty to Your Next Opportunity",
    template: "%s · Aagey",
  },
  description:
    "Community-reported campus placement offer outcomes with transparent reliability indicators, offer tracking, and backup career planning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Needed for env(safe-area-inset-*) on notched phones (used by the /mobile app shell).
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
