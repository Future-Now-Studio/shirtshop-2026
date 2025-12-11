import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Check } from "lucide-react";
import hamburgImage from "@/assets/julia-solonina-4fLxfNI3ohE-unsplash.jpg";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";

const values = [
  "Eine umfangreiche Produktpalette mit Markentextilien",
  "Erstklassige Produktionsverfahren, die Sie nicht überall finden",
  "Kostengünstige Lösungen bei kleinen und großen Auflagen",
  "Eine freundliche Fachberatung, auf die Sie sich jederzeit verlassen können",
];

const Unternehmen = () => {
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
                <span className="text-primary">wir sind private shirt:</span>
                <br />
                <span className="text-secondary italic">geboren in hamburg.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Guter Stoff für Ihre Ideen. Private Shirt – professionelle Textilveredelung. 
                Sie überzeugen Ihre Kunden täglich mit kreativen Ideen und individuellen 
                Dienstleistungen? Dann legen Sie bei der Außendarstellung sicher auch hohen 
                Wert auf Qualität.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="w-80 h-80 lg:w-96 lg:h-96 mx-auto rounded-full overflow-hidden border-4 border-primary">
                <img
                  src={hamburgImage}
                  alt="Hamburg"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img
                src={lifestyleImage}
                alt="Team"
                className="rounded-3xl w-full aspect-[4/3] object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-lg text-foreground leading-relaxed mb-6">
                Für einen professionellen Auftritt im Segment Corporate Fashion-Lösungen 
                gibt es Private Shirt. Wir sind die Spezialisten für individuelle 
                Textilveredelung, die durch Qualität begeistert!
              </p>
              <p className="text-lg text-foreground leading-relaxed mb-6">
                Vom trendigen Marken-Shirt über den fröhlich-bunten Kaffeebecher bis zum 
                kuscheligen Bademantel mit Ihrem gestickten oder gedrucktem Firmenlogo: 
                Wer einen gelungenen Aufhänger für seine Ideen sucht, findet im 
                Produktsortiment von Private Shirt Corporate Fashion-Lösungen und 
                Geschenkideen, die besonders anziehend sind – und länger im Gedächtnis bleiben.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-8 text-center">
              Unser Name steht für Textilveredelung, die seit zehn Jahren mit Qualität und Service überzeugt:
            </h2>

            <div className="space-y-4">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-4 glass-card p-5"
                >
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <p className="text-lg">{value}</p>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xl text-center mt-12 text-primary font-semibold"
            >
              Entdecken auch Sie unsere individuelle Beratung, die professionelle Ausführung 
              und den erstklassigen Service. Wir freuen uns auf Sie!
            </motion.p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Unternehmen;
