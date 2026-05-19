import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PLATFORM_NAME, PLATFORM_SHORT_DESCRIPTION } from "@/lib/platform";
import { CookieConsent } from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — Home Services Contractor App`,
  description: PLATFORM_SHORT_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
