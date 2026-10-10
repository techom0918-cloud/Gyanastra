import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

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
  title: "Aagey AI — Campus Placement Decision Support",
  description:
    "Track offer reliability, get AI-powered backup career plans, and monitor your offer status with community-reported data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
          <p>
            Aagey AI — Community-reported data for informational purposes
            only. Not a guarantee of offer outcomes.
          </p>
          <p className="mt-1">
            Code2Career National AI Hackathon 2026 | Demo Application
          </p>
        </footer>
      </body>
    </html>
  );
}
