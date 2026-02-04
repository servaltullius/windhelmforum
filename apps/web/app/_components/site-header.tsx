import Link from "next/link";
import type { Lang } from "../_lib/copy";
import { copy } from "../_lib/copy";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";

const githubUrl = "https://github.com/servaltullius/windhelmforum";

export function SiteHeader({ lang }: { lang: Lang }) {
  const c = copy[lang];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <Link className="brand-link" href="/">
            {c.siteName}
          </Link>
          <div className="tagline">{c.tagline}</div>
        </div>

        <nav className="nav">
          <Link className="nav-link" href="/b/tavern">
            {c.nav.tavern}
          </Link>
          <Link className="nav-link" href="/search">
            {c.nav.search}
          </Link>
          <Link className="nav-link" href="/usage">
            {c.nav.usage}
          </Link>
        </nav>

        <div className="header-actions">
          <a className="btn btn-ghost" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <LangToggle lang={lang} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
