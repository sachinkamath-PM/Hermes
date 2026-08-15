import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "hermes.buildquick.co.in";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "Hermes — Your world, remembered",
    description: "An interactive travel log, tracker and world map from BuildQuick.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Hermes — Your world, remembered",
      description: "Mark the countries and cities you have explored on an interactive world atlas.",
      type: "website",
      images: [{ url: "/og.png", width: 1734, height: 907, alt: "Hermes interactive world atlas" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hermes — Your world, remembered",
      description: "Mark the countries and cities you have explored on an interactive world atlas.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
