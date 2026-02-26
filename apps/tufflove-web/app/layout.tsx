import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tufflove.us"),
  title: "TUFF LOVE | Systems Beat Moods",
  description:
    "Stop managing chaos and start commanding results. TUFF LOVE is the operating system for business leaders who demand absolute accountability.",
  keywords: [
    "Business Systems",
    "Operating System",
    "Level 10 Meetings",
    "Momentum",
    "BeTeachable",
    "Executive Coaching",
    "SOP Automation",
  ],
  authors: [{ name: "BeTeachable" }],
  openGraph: {
    type: "website",
    url: "https://tufflove.us/",
    title: "TUFF LOVE | Systems Beat Moods",
    description:
      "Replace chaos with systems. The TUFF LOVE OS forces clarity and execution for visionary operators.",
    images: [
      {
        url: "https://beteachable.com/wp-content/uploads/2023/10/Command-Center-Preview-OG.jpg",
        width: 1200,
        height: 630,
        alt: "TUFF LOVE Command Center Preview",
      },
    ],
    siteName: "TUFF LOVE",
  },
  twitter: {
    card: "summary_large_image",
    site: "@BeTeachable",
    title: "TUFF LOVE | Systems Beat Moods",
    description:
      "Stop managing chaos. Initialize Command with the TUFF LOVE Operating System.",
    images: [
      "https://beteachable.com/wp-content/uploads/2023/10/Command-Center-Preview-OG.jpg",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
