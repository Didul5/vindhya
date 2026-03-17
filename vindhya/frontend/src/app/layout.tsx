import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vindhya — AI Tutoring Platform",
  description: "Voice-enabled Intelligent Network for Dynamic Holistic Youth Advancement",
};

// Injected before page renders — prevents flash of wrong theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('vindhya_theme') || 'light';
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              fontSize: "14px",
              boxShadow: "var(--shadow)",
            },
          }}
        />
      </body>
    </html>
  );
}
