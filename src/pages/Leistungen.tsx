import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { CheckCircle, Printer, Palette, Package, Settings, Shirt } from "lucide-react";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";

const techniques = [
  {
    name: "Flex",
    description: "Unser liebstes Material zeichnet sich durch eine sehr hohe Robustheit aus. Wir haben eine Farbauswahl von mehr als 24 Farben.",
    specs: [
      { label: "Stückzahl", value: "ab einem Stück" },
      { label: "Farben", value: "Ein- bis mehrfarbige Drucke" },
      { label: "Textilart", value: "Fast alle Textilien" },
      { label: "Dateiformate", value: ".EPS, .AI, .PDF" },
    ],
  },
  {
    name: "Digital Flex",
    description: "Solvent Digital Transfer für fotorealistische Drucke mit brillanten Farben und höchster Detailtreue.",
    specs: [
      { label: "Stückzahl", value: "ab einem Stück" },
      { label: "Farben", value: "Vollfarbe (CMYK)" },
      { label: "Textilart", value: "Alle Textilien" },
      { label: "Dateiformate", value: ".JPG, .PNG, .PDF" },
    ],
  },
  {
    name: "Siebdruck",
    description: "Der Klassiker für größere Auflagen. Höchste Farbbrillanz und Haltbarkeit bei kosteneffizienter Produktion.",
    specs: [
      { label: "Stückzahl", value: "ab 25 Stück" },
      { label: "Farben", value: "Bis zu 8 Farben" },
      { label: "Textilart", value: "Baumwolle, Mischgewebe" },
      { label: "Dateiformate", value: ".EPS, .AI, .PDF" },
    ],
  },
  {
    name: "Stickerei",
    description: "Für ein besonders hochwertiges Finish. Langlebig, elegant und waschbeständig bis 60°C.",
    specs: [
      { label: "Stückzahl", value: "ab einem Stück" },
      { label: "Farben", value: "Über 500 Garnfarben" },
      { label: "Textilart", value: "Alle festen Textilien" },
      { label: "Dateiformate", value: ".DST, .EMB, .PES" },
    ],
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

      {/* Techniques */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-5xl font-bold text-primary mb-4">drucktechniken:</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Wir bieten verschiedene Veredelungstechniken für jeden Bedarf
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {techniques.map((technique, index) => (
              <motion.div
                key={technique.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-8"
              >
                <h3 className="text-2xl font-bold text-primary mb-4 lowercase">{technique.name}</h3>
                <p className="text-muted-foreground mb-6">{technique.description}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {technique.specs.map((spec) => (
                    <div key={spec.label} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-primary">{spec.label}</p>
                        <p className="text-sm text-muted-foreground">{spec.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Leistungen;
