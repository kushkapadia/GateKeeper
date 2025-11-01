"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { useAuthStore } from "@/lib/store";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage);
  
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

