import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

// Poppins matches the BloodGrid deck. It is not a variable font, so weights are listed.
const brandFont = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BloodGrid Operations Map",
  description: "Rural EMS prehospital-blood logistics demonstration dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
