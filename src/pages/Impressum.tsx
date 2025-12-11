import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";

const Impressum = () => {
  return (
    <Layout>
      <div className="container-wide py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-8">
            Impressum
          </h1>

          <div className="prose prose-lg max-w-none space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Private Shirt GmbH</h2>
              <div className="space-y-2 text-muted-foreground">
                <p>Ballindamm 40</p>
                <p>20095 Hamburg</p>
                <p>Tel.: 040 – 328 73 804</p>
                <p>
                  <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">
                    info@private-shirt.de
                  </a>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p><strong>Geschäftsführer:</strong> Erol Aydin</p>
              <p><strong>Registergericht:</strong> Amtsgericht Hamburg</p>
              <p><strong>HRB:</strong> 83191</p>
              <p><strong>USt-IdNr.:</strong> DE175961471</p>
            </div>

            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Haftungshinweis:</strong> Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Angaben gemäß §6 Anbieterkennzeichnung des TDG (Teledienstgesetz).
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Impressum;

