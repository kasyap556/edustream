import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter as a professional, clean font
import clsx from "clsx";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduStream | Academic Video Hub",
  description: "Premium academic video conferencing for modern education.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={clsx(inter.className, "antialiased bg-background text-foreground min-h-screen")}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
