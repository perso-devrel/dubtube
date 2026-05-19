import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { SUPPORTED_LANGUAGE_COUNT } from "@/utils/languages";
import {
  DEFAULT_APP_LOCALE,
} from "@/lib/i18n/config";
import { message } from "@/lib/i18n/messages";
import { SEO_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/seo";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: message(DEFAULT_APP_LOCALE, "metadata.landing.description", { SUPPORTED_LANGUAGE_COUNT }),
  keywords: SEO_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const themeInitScript = `try{var raw=localStorage.getItem('sub2tube-theme');var state=null;var preference=null;var mode=null;if(raw){try{var parsed=JSON.parse(raw);state=parsed&&parsed.state||parsed;preference=state&&state.preference;mode=state&&state.mode||state}catch(_){mode=raw}}if(!preference&&(mode==='dark'||mode==='light'))preference=mode;var systemDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(preference==='dark'||((!preference||preference==='system')&&systemDark)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_APP_LOCALE}
      className={`${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="sub2tube-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
