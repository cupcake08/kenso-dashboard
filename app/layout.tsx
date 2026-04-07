import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kenso Dashboard",
  description: "Kenso Enterprise Audio Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
