import { AtomRegistryProvider } from "@/components/providers/atom-registry-provider";
import { OrganicTracker } from "@/components/providers/organic-tracker";
import { ToastListener } from "@/components/ui/toast-listener";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type React from "react";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const LINE_TAG_ID = process.env.NEXT_PUBLIC_LINE_TAG_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Fabric — Premium T-Shirts Thailand",
    template: "%s — Fabric",
  },
  description:
    "ช้อปเสื้อ premium quality ออนไลน์ที่ Fabric — ผ้าดี ทรงสวย ส่งทั่วไทย รองรับ PromptPay, บัตรเครดิต และ Crypto",
  keywords: ["เสื้อ", "t-shirt", "premium", "thailand", "fabric", "online shop", "ช้อปปิ้งออนไลน์"],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    siteName: "Fabric",
    locale: "th_TH",
    type: "website",
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const orgSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${APP_URL}/#organization`,
        name: "Fabric",
        url: APP_URL,
        logo: { "@type": "ImageObject", url: `${APP_URL}/favicon.ico` },
        sameAs: [
          "https://www.facebook.com/fabric.cool",
          "https://www.instagram.com/fabric.cool",
          "https://www.tiktok.com/@fabric.cool",
          "https://line.me/R/ti/p/@fabric",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${APP_URL}/#website`,
        url: APP_URL,
        name: "Fabric",
        publisher: { "@id": `${APP_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${APP_URL}/products?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="th">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD, no user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="gtm"
            />
          </noscript>
        )}
        <NuqsAdapter>
          <AtomRegistryProvider>
            <OrganicTracker />
            {children}
            {modal}
            <Suspense>
              <ToastListener />
            </Suspense>
          </AtomRegistryProvider>
        </NuqsAdapter>
        <Toaster richColors position="top-right" theme="dark" closeButton />
        {/* Google Tag Manager */}
        {GTM_ID && (
          <Script id="gtm" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');
          `}</Script>
        )}

        {/* GA4 direct (only when no GTM) */}
        {!GTM_ID && GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer=window.dataLayer||[];
              function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());gtag('config','${GA4_ID}');
            `}</Script>
          </>
        )}

        {/* Meta Pixel */}
        {META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
            n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${META_PIXEL_ID}');fbq('track','PageView');
          `}</Script>
        )}

        {/* Line Tag */}
        {LINE_TAG_ID && (
          <Script id="line-tag" strategy="afterInteractive">{`
            (function(g,d,o){_lt=function(){_lt.c(arguments)};var h=g.head;
            var e=d.createElement('script');_lt.i=+new Date;_lt.c=function(a){_lt.q.push(a)};_lt.q=[];
            e.async=!0;e.src='https://d.line-scdn.net/n/line_tag/public/release/v1/lt.min.js';
            var f=d.getElementsByTagName('script')[0];f?f.parentNode.insertBefore(e,f):h.appendChild(e);
            _lt('init',{customerType:'lap',tagId:'${LINE_TAG_ID}'});
            _lt('send','pv',['${LINE_TAG_ID}']);})(window,document);
          `}</Script>
        )}

        {/* TikTok Pixel */}
        {TIKTOK_PIXEL_ID && (
          <Script id="tiktok-pixel" strategy="afterInteractive">{`
            !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once",
            "ready","alias","group","enableCookie","disableCookie"];
            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},
            ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
            n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e;
            e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
            ttq.load('${TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');
          `}</Script>
        )}
      </body>
    </html>
  );
}
