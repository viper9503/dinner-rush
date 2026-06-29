import Link from "next/link";
import { ArrowRight, Search, Check, Sparkles, Star, Truck, ReceiptText, Users } from "lucide-react";
import {
  bundles,
  cuisines,
  dishMap,
  featuredRestaurants,
  howItWorks,
  stats,
  testimonials,
} from "@/lib/data";
import { Container, SectionHeading } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { RestaurantCard } from "@/components/restaurant-card";
import { BundleCard } from "@/components/bundle-card";
import { BundleStack } from "@/components/bundle-stack";
import { CoverageMeter } from "@/components/coverage-meter";
import { HeadcountStepper } from "@/components/headcount-stepper";

const heroDishes = ["fuego-1", "dragon-1", "saffron-1", "verde-1"].map((id) => dishMap[id]);

export default function HomePage() {
  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="bg-radial-warm relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-accent-alt/20 blur-3xl" />
        <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <Badge variant="glass" size="lg" className="mb-5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Catering, reinvented for groups
            </Badge>
            <h1 className="font-display text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.03em] text-foreground">
              Cater your team from{" "}
              <span className="text-gradient-sunset">every restaurant</span> they love.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Mix dishes from multiple local kitchens into one bundle — tacos here, sushi there, a
              salad bar to balance. One delivery, one invoice, zero arguments about lunch.
            </p>

            {/* search */}
            <Link
              href="/restaurants"
              className="group mt-8 flex items-center gap-3 rounded-full bg-white p-2 pl-5 shadow-[0_12px_30px_-12px_rgba(232,67,31,0.28)] ring-1 ring-border transition focus-within:ring-primary"
            >
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-[0.9375rem] text-muted-foreground">
                Search tacos, sushi, salads, BBQ…
              </span>
              <Button variant="hero" className="shrink-0">
                Explore <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5 rounded-full bg-white/70 px-3 py-2 ring-1 ring-border">
                <span className="text-sm font-semibold text-foreground">Feeding</span>
                <HeadcountStepper size="sm" />
              </div>
              <span className="text-sm text-muted-foreground">
                Pick a headcount — we size every dish for you.
              </span>
            </div>

            {/* stats */}
            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="tnum font-display text-2xl font-bold text-foreground">{s.value}</dt>
                  <dd className="text-xs leading-tight text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* hero visual cluster */}
          <div className="relative mx-auto hidden h-[460px] w-full max-w-md lg:block">
            <div className="animate-float-slow absolute left-0 top-2 h-52 w-44 overflow-hidden rounded-[1.5rem] shadow-lift ring-4 ring-white">
              <FoodImage src={heroDishes[0].image} alt={heroDishes[0].name} emoji="🌮" sizes="200px" priority />
            </div>
            <div className="animate-float-slower absolute right-2 top-0 h-44 w-40 overflow-hidden rounded-[1.5rem] shadow-lift ring-4 ring-white">
              <FoodImage src={heroDishes[1].image} alt={heroDishes[1].name} emoji="🍣" sizes="180px" priority />
            </div>
            <div className="animate-float-slower absolute bottom-6 left-6 h-44 w-40 overflow-hidden rounded-[1.5rem] shadow-lift ring-4 ring-white">
              <FoodImage src={heroDishes[2].image} alt={heroDishes[2].name} emoji="🍛" sizes="180px" />
            </div>
            <div className="animate-float-slow absolute bottom-0 right-0 h-52 w-44 overflow-hidden rounded-[1.5rem] shadow-lift ring-4 ring-white">
              <FoodImage src={heroDishes[3].image} alt={heroDishes[3].name} emoji="🥗" sizes="200px" />
            </div>

            {/* floating bundle card */}
            <div className="glass absolute left-1/2 top-1/2 z-10 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[1.25rem] p-4">
              <span className="absolute inset-x-6 -top-px h-0.5 rounded-full bg-sunset" />
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-foreground">Your bundle</span>
                <Badge variant="multi" size="sm">4 spots</Badge>
              </div>
              <BundleStack restaurantIds={["fuego", "dragon", "saffron", "verde"]} size="sm" showChip={false} className="mt-3" />
              <div className="mt-3">
                <CoverageMeter servings={52} headcount={40} size="sm" />
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-success">
                <Check className="h-3.5 w-3.5" /> Everyone&apos;s covered
              </div>
            </div>
          </div>
        </Container>

        {/* cuisine marquee */}
        <div className="border-y border-border bg-white/60 py-4">
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee flex w-max gap-3">
              {[...cuisines, ...cuisines].map((c, i) => (
                <span
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground"
                >
                  <span className="text-base">{c.emoji}</span> {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================= HOW IT WORKS ========================= */}
      <section id="how-it-works" className="py-20">
        <Container>
          <SectionHeading
            align="center"
            eyebrow="How it works"
            title="From hungry team to hero in four steps"
            subtitle="No spreadsheets, no eight separate orders. Build one bundle and we handle the rest."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="relative rounded-[1.25rem] border border-border bg-surface p-6 shadow-soft">
                <span className="bg-sunset absolute -top-4 left-6 grid h-9 w-9 place-items-center rounded-full font-display text-sm font-bold text-white shadow-sm">
                  {s.step}
                </span>
                <div className="mb-3 mt-2 text-4xl">{s.emoji}</div>
                <h3 className="font-display text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ========================== CUISINES ========================== */}
      <section className="py-8">
        <Container>
          <SectionHeading eyebrow="Browse by craving" title="Every cuisine, one cart" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {cuisines.map((c) => (
              <Link
                key={c.key}
                href={`/restaurants?cuisine=${c.key}`}
                className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.25rem] border border-border bg-surface text-center shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <span
                  className="grid h-14 w-14 place-items-center rounded-full text-3xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${c.color}1a` }}
                >
                  {c.emoji}
                </span>
                <span className="text-sm font-bold text-foreground">{c.label}</span>
                <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: c.color }} />
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ===================== FEATURED RESTAURANTS ===================== */}
      <section className="py-16">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Local favorites" title="Restaurants teams love" />
            <Link href="/restaurants" className="hidden shrink-0 sm:block">
              <Button variant="outline">
                See all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredRestaurants.slice(0, 6).map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        </Container>
      </section>

      {/* ======================= CURATED BUNDLES ======================= */}
      <section className="bg-radial-warm py-20">
        <Container>
          <SectionHeading
            eyebrow="Done-for-you"
            title={<>Curated <span className="text-gradient-sunset">multi-restaurant</span> bundles</>}
            subtitle="Can't decide? These crowd-pleasers mix dishes from several kitchens into one perfectly balanced spread — priced per person."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleCard key={b.id} bundle={b} />
            ))}
          </div>
        </Container>
      </section>

      {/* ======================== THE DIFFERENCE ======================== */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Why Dinner Rush"
                title="The only catering app built for a room full of opinions"
              />
              <ul className="mt-8 space-y-5">
                {[
                  { Icon: Users, title: "Headcount-smart ordering", body: "Set how many you're feeding and our live coverage meter makes sure nobody goes hungry — and you don't over-order.", color: "#c7341a" },
                  { Icon: Sparkles, title: "Mix unlimited restaurants", body: "Tacos, ramen and a salad bar in a single bundle. The whole office gets their pick.", color: "#6d28c9" },
                  { Icon: Truck, title: "One coordinated delivery", body: "Everything from every kitchen arrives together, labeled and set up — on time.", color: "#157a4e" },
                  { Icon: ReceiptText, title: "One simple invoice", body: "No chasing receipts from five vendors. One clean bill for finance, every time.", color: "#d6266e" },
                ].map((f) => (
                  <li key={f.title} className="flex gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: f.color }}>
                      <f.Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* coverage demo card */}
            <div className="relative rounded-[1.5rem] border border-border bg-surface p-7 shadow-lift">
              <span className="bg-sunset absolute inset-x-8 -top-px h-1 rounded-full" />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-foreground">Friday team lunch</h3>
                <Badge variant="multi" size="md">3 restaurants</Badge>
              </div>
              <BundleStack restaurantIds={["fuego", "sakura", "verde"]} className="mt-4" />
              <div className="mt-6 space-y-4">
                {[
                  { id: "fuego-1", emoji: "🌮" },
                  { id: "sakura-1", emoji: "🍜" },
                  { id: "verde-2", emoji: "🥗" },
                ].map(({ id, emoji }) => {
                  const d = dishMap[id];
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                        <FoodImage src={d.image} alt={d.name} emoji={emoji} sizes="48px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">Serves {d.serves[0]}–{d.serves[1]}</p>
                      </div>
                      <Badge variant="serves" size="sm">
                        <Users className="h-3 w-3" /> {d.serves[1]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-2xl bg-muted p-4">
                <CoverageMeter servings={33} headcount={40} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Add a little more to fully cover all 40 guests.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ======================== TESTIMONIALS ======================== */}
      <section className="bg-foreground py-20 text-white">
        <Container>
          <SectionHeading
            align="center"
            eyebrow="Loved by office heroes"
            title={<span className="text-white">Teams eat better with Dinner Rush</span>}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {testimonials.map((t) => (
              <figure key={t.id} className="flex flex-col gap-4 rounded-[1.25rem] bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-white/85">“{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full font-bold text-white" style={{ backgroundColor: t.avatarColor }}>
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t.name}</span>
                    <span className="block text-xs text-white/60">{t.role}, {t.company}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {/* =========================== CTA BAND =========================== */}
      <section className="py-20">
        <Container>
          <div className="bg-sunset relative overflow-hidden rounded-[2rem] px-8 py-16 text-center shadow-lift sm:px-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-6 h-56 w-56 rounded-full bg-secondary/30 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-5xl">
                Feed your whole team this week
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
                Build a bundle in minutes. Mix the restaurants they love, cover every seat, and look
                like the office hero you are.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/restaurants">
                  <Button variant="white" size="lg">
                    Start a bundle <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/bundles">
                  <Button size="lg" className="bg-foreground text-white hover:bg-foreground/90 hover:-translate-y-0.5">
                    Browse curated bundles
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
