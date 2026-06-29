import Link from "next/link";
import { Utensils, Camera, Send, Briefcase } from "lucide-react";
import { Container } from "../section";

const COLUMNS = [
  { title: "Order", links: [["Browse restaurants", "/restaurants"], ["Curated bundles", "/bundles"], ["How it works", "/#how-it-works"], ["Build a bundle", "/cart"]] },
  { title: "Company", links: [["About us", "/#"], ["For restaurants", "/#"], ["Careers", "/#"], ["Press", "/#"]] },
  { title: "Support", links: [["Help center", "/#"], ["Contact sales", "/#"], ["Delivery areas", "/#"], ["Dietary guide", "/#"]] },
];

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-foreground text-white">
      <div className="bg-sunset h-1.5 w-full" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-grape opacity-30 blur-3xl" />
      <Container className="relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sunset">
                <Utensils className="h-5 w-5 text-white" />
              </span>
              <span className="font-display text-xl font-extrabold tracking-[-0.02em]">Dinner Rush</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Group catering from the city&apos;s best restaurants — mixed into one bundle, one delivery, one invoice.
            </p>
            <div className="mt-6 flex gap-3">
              {[Camera, Send, Briefcase].map((Icon, i) => (
                <a key={i} href="#" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-accent">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-white/70 transition hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/50 sm:flex-row">
          <p>© 2026 Dinner Rush. A mock showcase build.</p>
          <p className="flex items-center gap-4">
            <Link href="#" className="transition hover:text-white">Privacy</Link>
            <Link href="#" className="transition hover:text-white">Terms</Link>
            <Link href="#" className="transition hover:text-white">Cookies</Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
