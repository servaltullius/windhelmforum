import "./globals.css";

import { SiteHeader } from "./_components/site-header";
import { getLang } from "./_lib/server-lang";

const githubUrl = "https://github.com/servaltullius/windhelmforum";

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
  const disclaimer =
    lang === "ko"
      ? "본 사이트는 팬 프로젝트이며 Bethesda Softworks와 제휴/승인 관계가 아닙니다. Bethesda Softworks는 본 사이트의 콘텐츠에 대해 책임지지 않습니다."
      : "Fan project. Not affiliated with Bethesda Softworks. Bethesda Softworks does not endorse and is not responsible for site content.";
  return (
    <html lang={lang} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteHeader lang={lang} />
        <div className="container page">{children}</div>
        <footer className="container" style={{ paddingBottom: 30, color: "var(--muted)", fontSize: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span>© {new Date().getFullYear()} Windhelm Forum</span>
            <span style={{ opacity: 0.6 }}>·</span>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
          <div style={{ marginTop: 8, maxWidth: 900 }}>{disclaimer}</div>
        </footer>
      </body>
    </html>
  );
}
