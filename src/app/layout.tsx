import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrynthLabs",
  description: "Founder OS: discover what to build, assess readiness, launch through Orynth, and grow."
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
