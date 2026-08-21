/** Shared external-link footer for the app shell. */

export const FOOTER_LINKS = [
  { label: 'X Megastera', href: 'https://x.com/MegasteraGame' },
  { label: 'Megapot Docs', href: 'https://docs.megapot.io' },
  { label: 'Megapot site', href: 'https://megapot.io' },
  { label: 'Support', href: 'https://t.me/astralex163' },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white/50 px-4 py-4 text-[10px] leading-relaxed text-zinc-500/75 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-500/75 md:py-5 md:text-[11px]">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center" aria-label="Megastera and Megapot links">
        {FOOTER_LINKS.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-zinc-500/75 transition-colors hover:text-zinc-400 dark:text-zinc-500/75 dark:hover:text-zinc-300"
          >
            {label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
