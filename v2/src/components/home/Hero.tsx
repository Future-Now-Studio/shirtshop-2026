import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Truck, Factory } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import heroVideo from "@/assets/browsing.mp4";

const TRUST = [
  { icon: CheckCircle, stat: "1 mio.+", label: "zufriedene bestellungen" },
  { icon: Factory, stat: "100 % lokal", label: "produziert in hamburg" },
  { icon: Truck, stat: "24–48 h", label: "blitzschnelle lieferung" },
];

export default function Hero() {
  return (
    // full-bleed breakout from the page container
    <section className="relative left-1/2 right-1/2 -mx-[50vw] -mt-10 mb-16 w-screen overflow-hidden">
      <div className="relative flex h-[88vh] min-h-[560px] flex-col">
        <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" poster={heroImage}>
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,.65) 0%, rgba(0,0,0,.45) 40%, rgba(0,0,0,.2) 60%, transparent 100%)" }}
        />

        <div className="container relative z-10 flex flex-1 items-center pb-28">
          <div className="max-w-xl py-8 text-center lg:text-left">
            <h1 className="mb-6 text-5xl font-black lowercase leading-[0.92] sm:text-6xl lg:text-7xl">
              <span className="text-primary">sei du selbst.</span>
              <br />
              <span className="text-secondary">sei einzigartig.</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-white/90 sm:text-xl">
              gestalte ganz frei deinen look. t-shirts, sweatshirts, hoodies und vieles mehr. probier's einfach!
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                to="/selbst-gestalten"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-foreground shadow-lg transition-all hover:shadow-xl"
              >
                selbst gestalten
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/produkte"
                className="inline-flex items-center justify-center rounded-full border-2 border-white/50 bg-white/20 px-8 py-4 font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/30"
              >
                produkte entdecken
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 border-t-2 border-primary/20 bg-background/90 backdrop-blur-xl">
          <div className="container grid grid-cols-1 divide-y divide-border/60 py-4 md:grid-cols-3 md:divide-x md:divide-y-0">
            {TRUST.map(({ icon: Icon, stat, label }) => (
              <div key={label} className="group flex items-center justify-center gap-4 py-3 md:py-2">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-bg text-primary-foreground shadow-soft transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="leading-tight">
                  <div className="text-xl font-black lowercase tracking-tight">{stat}</div>
                  <div className="text-sm lowercase text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
