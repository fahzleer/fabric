import { AtomRegistryProvider } from "@/components/providers/atom-registry-provider";
import { ToastListener } from "@/components/ui/toast-listener";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type React from "react";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fabric",
  description: "Fabric — your modern online shop",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NuqsAdapter>
          <AtomRegistryProvider>
            {children}
            {modal}
            <Suspense>
              <ToastListener />
            </Suspense>
          </AtomRegistryProvider>
        </NuqsAdapter>
        <Toaster richColors position="top-right" theme="dark" closeButton />
      </body>
    </html>
  );
}
