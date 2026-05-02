import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--next-font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--next-font-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--next-font-display",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://strategyforge.vercel.app"),
  title: "StrategyForge — Every Inference, Attested.",
  description: "Self-improving DeFi agent that generates, executes, and evolves KeeperHub workflows with verifiable inference. Every LLM reasoning step is attested. Every strategy version is anchored on 0G Chain.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
  },
  openGraph: {
    title: "StrategyForge — Every Inference, Attested.",
    description: "Self-improving DeFi agent with verifiable on-chain strategy attestations. Built on 0G Chain + KeeperHub.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "StrategyForge — self-improving DeFi agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StrategyForge — Every Inference, Attested.",
    description: "Self-improving DeFi agent with verifiable on-chain strategy attestations.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}>
      <body className="min-h-full flex flex-col relative" data-theme="dark" style={{
        backgroundImage: `
          radial-gradient(circle at 14% 4%, rgba(var(--accent-glow), 0.16) 0%, transparent 28%),
          radial-gradient(circle at 88% 88%, rgba(227,169,74,0.12) 0%, transparent 24%),
          linear-gradient(180deg, var(--landing-page-bg) 0%, color-mix(in srgb, var(--landing-page-bg) 80%, var(--bg-0) 20%) 100%)
        `
      }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, var(--landing-grid) 1px, transparent 1px),
              linear-gradient(to bottom, var(--landing-grid) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            opacity: 0.26,
            pointerEvents: 'none',
          }}
        />
        <Toaster theme="dark" position="top-right" />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
