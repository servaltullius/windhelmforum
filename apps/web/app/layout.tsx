import "./globals.css";

import { SiteHeader } from "./_components/site-header";
import { getLang } from "./_lib/server-lang";

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("wf_theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
      return;
    }
  } catch {}
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.dataset.theme = prefersLight ? "light" : "dark";
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteHeader lang={lang} />
        <div className="container page">{children}</div>
        <footer className="container" style={{ paddingBottom: 30, color: "var(--muted)", fontSize: 12 }}>
          © {new Date().getFullYear()} Windhelm Forum
        </footer>
      </body>
    </html>
  );
}
