import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pilates OS - Boutique Studio Experience",
  description: "Book your perfect Pilates class experience",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read nonce from header set by middleware for CSP support
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || undefined;

  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-outfit">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
