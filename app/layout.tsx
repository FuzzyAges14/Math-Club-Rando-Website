import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NHRHS Math Club | A community that adds up",
  description: "The Northern Highlands Math Club hub. Find free math tutoring for grades 6–8, explore club events, and take on your next challenge.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
