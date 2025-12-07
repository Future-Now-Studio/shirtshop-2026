import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { CheckCircle, Printer, Palette, Package, Settings, Shirt, Sparkles } from "lucide-react";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";

const drucktechniken = [
  {
    name: "Flex",
    description: "Unser liebstes Material zeichnet sich durch eine sehr hohe Robustheit aus. Wir haben eine Farbauswahl von mehr als 24 Farben, darunter auch Neontöne und Glitzereffekte. Produktion ab ein Stück, Robust und waschbar bis 40 Grad.",
    specs: [
      { label: "Stückzahl", value: "ab einem Stück" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke, Farbauswahl nach Farbkarte" },
      { label: "Textilart", value: "Geeignet für fast alle Textilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "Druckmotive müssen mindestens eine Strichstärke von 1 mm haben. Farbverläufe leider nicht möglich.",
  },
  {
    name: "Digital Flex (SOLVENT DIGITAL TRANSFER)",
    description: "Digital-Transfer ist ein weißes Trägermaterial für deine mehrfarbigen Motive. Zuerst wird das Trägermaterial gedruckt und dann nach individueller Cut-Kontur geschnitten. Produktion ab einem Stück möglich, waschbar bis 30 Grad.",
    specs: [
      { label: "Stückzahl", value: "Ab einem Stück möglich, Mindermengenaufschlag!" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke. Nahezu jeder Farbton druckbar." },
      { label: "Textilart", value: "Geeignet für fast alle Textilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "Fotorealistische Drucke möglich. Kleinste Details und Farbverläufe umsetzbar. Falls Trägermaterial zugeschnitten werden muss ist eine Strichstärke von mind. 2 mm nötig.",
  },
  {
    name: "Flock",
    description: "Flock ist nicht mehr so gefragt aber wir haben trotzdem die Standardfarben auf Lager. Sollest du also ein Liebhaber von Flock sein bieten wir auch dieses Druckverfahren gerne an. Produktion ab einem Stück, samtige Oberfläche leicht erhaben, waschbar bis 40 Grad.",
    specs: [
      { label: "Stückzahl", value: "Ab einem Stück" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke, Farbauswahl nach Farbkarte" },
      { label: "Textilart", value: "Geeignet für fast alle Textilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "Druckmotive müssen mindestens eine Strichstärke von 2 mm haben. Farbverläufe leider nicht möglich.",
  },
  {
    name: "Direktdruck (DTG)",
    description: "Alles ist möglich. Im Digitaldirektdruck oder DTG Verfahren genannt sind komplexe Druckmotive und auch Fotorealistische Drucke möglich. Produktion ab ein Stück, Druck auf weiß nicht spürbar, waschbar bis 30 Grad.",
    specs: [
      { label: "Stückzahl", value: "Ab einem Stück" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke. Nahezu jeder Farbton druckbar." },
      { label: "Textilart", value: "Nicht für alle Textilien geeignet. Textil sollte mind. 80 % Baumwollanteil haben." },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "Fotorealistische Drucke möglich. Kleinste Details und Farbverläufe umsetzbar.",
  },
  {
    name: "Siebdruck auf HELL & DUNKEL",
    description: "Siebdruck, die traditionellste aller Druckarten… leider nicht die spontanste. Für den Siebdruck benötigen wir ein Auftragsvolumen ab 20 Teilen und eine Produktionszeit von mindestens 7 Werktagen. Vorteile: Bei hohen Stückzahlen kostengünstige Produktion, Farben auf Wasserbasis ohne Lösungsmittel, detaillierte Motive möglich und waschbar bis 60 Grad.",
    specs: [
      { label: "Stückzahl", value: "Mittlere bis große Auflagen (nach Rücksprache auch Kleinauflagen ab 20 Stück)" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke nach der Pantone-Farbskala" },
      { label: "Textilart", value: "Geeignet für fast alle Textilien (außer Fleece, Frottee usw.)" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "Es fallen Film- und Siebkosten zur Anfertigung des Druckmotives an. Größere Auflagen sind darum empfehlenswert.",
  },
  {
    name: "Sublimation",
    description: "Sublimation – komplizierteres, aber machbares Druckverfahren… Ab einer Auflage von 10 weißen Polyestershirts können wir All Over drucken. Unsere 100x150cm große Transferpresse macht es möglich. Attribute: bis 40 Grad waschbar, nicht fühlbarer und bis zu 4-farbiger Druck.",
    specs: [
      { label: "Stückzahl", value: "Ab 10 weißen Polyestershirts (All Over Druck möglich)" },
      { label: "Farben", value: "Bis zu 4-farbiger Druck" },
      { label: "Textilart", value: "Weiße Polyestertextilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF)" },
    ],
    besonderheiten: "All Over Druck möglich mit unserer 100x150cm Transferpresse. Nicht fühlbarer Druck.",
  },
];

const sticktechniken = [
  {
    name: "Direktstick",
    description: "Eines der schicksten Veredlungsmethoden, ob einfarbig oder mehrfarbig, das macht meist keinen großen Preisunterschied. Wichtig ist die Stickkarte, und die wird einmalig berechnet. Sind diese Einrichtungskosten einmal bezahlt, ist der Stick direkt auf das Textil oder die Snapback keine allzu kostspielige Angelegenheit. Jetzt neu auch 3D Stick (ab 20 Teilen).",
    specs: [
      { label: "Stückzahl", value: "Ab einem Stück" },
      { label: "Garnfarben", value: "Nahezu unbegrenzte Farbauswahl" },
      { label: "Textilart", value: "Geeignet für fast alle Textilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF) sind für die Erstellung der Stickkarte nötig. Stickkarte hat bei uns die Formate (DST, TAB)" },
    ],
    besonderheiten: "Falls Kosten zur Anfertigung des Stickmotives anfallen, sind größere Auflagen empfehlenswert.",
  },
  {
    name: "3D Stick",
    description: "Bei der 3D-Stickerei wird zusätzlich ein Füllmaterial (Schaumstoff) auf die Textilie gelegt und fixiert. Dieses so genannte Puffy wird bei der Direkteinstickung \"mitgestickt\". So wirkt die Bestickung erhaben und hebt sich stark von der Textilie ab. Dies lässt sich bei großen Buchstaben oder auch bei flächigen Stücken hervorragend realisieren.",
    specs: [
      { label: "Stückzahl", value: "Ab 20 Stück" },
      { label: "Garnfarben", value: "Nahezu unbegrenzte Farbauswahl" },
      { label: "Textilart", value: "Hauptsächlich auf Caps" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF) sind für die Erstellung der Stickkarte nötig. Stickkarte hat bei uns die Formate (DST, TAB)" },
    ],
    besonderheiten: "Nicht jedes Motiv lässt sich als 3D Motiv sticken",
  },
  {
    name: "Patches/Aufnäher",
    description: "Gestickte Aufnäher nach eurem Motiv und in beliebigen Formen ob mit Klettverschluss oder mit Schmelzkleber liefern wir Ihnen bereits ab einer Mindestmenge von 30 Stück.",
    specs: [
      { label: "Stückzahl", value: "Ab 30 Stück" },
      { label: "Garnfarben", value: "Nahezu unbegrenzte Farbauswahl" },
      { label: "Textilart", value: "Geeignet für fast alle Textilien" },
      { label: "Dateiformate", value: "Vektorisierte Grafiken (.EPS, .AI, .PDF) sind für die Erstellung der Stickkarte nötig. Stickkarte hat bei uns die Formate (DST, TAB)" },
    ],
    besonderheiten: "Der Aufnäher kann auch auf fast auf jeden Untergrund selbst aufgebracht werden.",
  },
];

const features = [
  { icon: Printer, title: "Hochwertige Druckmaschinen", description: "Modernste Technologie für perfekte Ergebnisse" },
  { icon: Settings, title: "Modernste Stickmaschinen", description: "Präzise Stickerei mit bis zu 12 Nadeln" },
  { icon: Shirt, title: "Qualitätstextilien", description: "Nur die besten Markenprodukte" },
  { icon: Package, title: "Schnelle Lieferung", description: "Express-Produktion auf Anfrage" },
];

const Leistungen = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                <span className="text-primary">aufdruck für</span>
                <br />
                <span className="text-secondary italic">eindruck.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Ob online oder in unseren Shops, wir sind überall für Sie da. 
                Wir garantieren Ihnen qualitativ hochwertige Produkte und top 
                Kundenservice für Ihre individuellen Ideen.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="w-80 h-80 lg:w-96 lg:h-96 mx-auto rounded-full overflow-hidden border-4 border-secondary">
                <img
                  src={lifestyleImage}
                  alt="Lifestyle"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container-wide">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 text-center"
              >
                <div className="w-14 h-14 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Drucktechniken */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Printer className="w-8 h-8 text-primary" />
              <h2 className="text-3xl lg:text-5xl font-bold text-primary">drucktechniken:</h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Wir bieten verschiedene Druckverfahren für jeden Bedarf und jede Stückzahl
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {drucktechniken.map((technique, index) => (
              <motion.div
                key={technique.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 lg:p-8"
              >
                <h3 className="text-xl lg:text-2xl font-bold text-primary mb-3 lowercase">{technique.name}</h3>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{technique.description}</p>
                
                <div className="space-y-3 mb-4">
                  {technique.specs.map((spec) => (
                    <div key={spec.label} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{spec.label}</p>
                        <p className="text-sm text-muted-foreground">{spec.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {technique.besonderheiten && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Besonderheiten</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{technique.besonderheiten}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sticktechniken */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-secondary" />
              <h2 className="text-3xl lg:text-5xl font-bold text-secondary">lass' sticken:</h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Hochwertige Stickerei für ein elegantes und langlebiges Finish
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sticktechniken.map((technique, index) => (
              <motion.div
                key={technique.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 lg:p-8"
              >
                <h3 className="text-xl lg:text-2xl font-bold text-secondary mb-3 lowercase">{technique.name}</h3>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{technique.description}</p>
                
                <div className="space-y-3 mb-4">
                  {technique.specs.map((spec) => (
                    <div key={spec.label} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{spec.label}</p>
                        <p className="text-sm text-muted-foreground">{spec.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {technique.besonderheiten && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Besonderheiten</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{technique.besonderheiten}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Leistungen;
