import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";
import { Toaster } from "@/app/components/ui/toaster";
import localFont from "next/font/local";

const myFont = localFont({
  src: "../public/fonts/Hellix-Medium.ttf", // adjust path based on your folder
  variable: "--font-hellix-medium",         // optional CSS variable
});

export const metadata: Metadata = {
  title: "CIMAGE ERP · Geofence Attendance",
  description: "Modern, simple student portal to mark geofenced attendance and manage profile.",
  applicationName: "CIMAGE ERP",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${myFont.variable} antialiased`}>
        <div className="app-shell">
          <Header />
          <main className="container py-10 sm:py-12 lg:py-16">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
