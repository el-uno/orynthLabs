import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orynth ProductLab",
  description: "Alpha build scaffold for Orynth launch intelligence and execution workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
