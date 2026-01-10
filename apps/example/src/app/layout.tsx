import type { Metadata } from "next";
import { AuthProvider } from "@oppulence/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comp Example App",
  description: "Example application using @oppulence/design-system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
