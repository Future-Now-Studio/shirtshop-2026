import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { MapPin, Phone, Mail, Printer } from "lucide-react";
import europaPassage from "@/assets/Altona-Store.webp";
import altona from "@/assets/Altona-Store.webp";

const locations = [
  {
    name: "Europa Passage",
    address: "Ballindamm 40",
    city: "20095 Hamburg",
    phone: "040 328 738 04",
    fax: "040 328 738 15",
    email: "europa-passage@private-shirt.de",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2369.5!2d10.001!3d53.551!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDMzJzAzLjYiTiAxMMKwMDAnMDMuNiJF!5e0!3m2!1sde!2sde!4v1234567890&q=Ballindamm+40,+20095+Hamburg",
    image: europaPassage,
  },
  {
    name: "Mercado Altona",
    address: "Ottenser Hauptstraße 10",
    city: "22765 Hamburg",
    phone: "040 399 077 78",
    fax: "040 399 081 16",
    email: "altona@private-shirt.de",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2369.5!2d9.935!3d53.550!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTPCsDMzJzAwLjAiTiA5wrA1NicyMC4wIkU!5e0!3m2!1sde!2sde!4v1234567890&q=Ottenser+Hauptstraße+10,+22765+Hamburg",
    image: altona,
  },
];

const Filialen = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-16 bg-background">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center mb-6"
            >
              <MapPin className="w-16 h-16 text-secondary" fill="currentColor" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl lg:text-5xl font-bold text-foreground mb-6"
            >
              Zuhause, wo du es bist
              <span className="block w-24 h-1 bg-primary mx-auto mt-4"></span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-muted-foreground max-w-3xl mx-auto"
            >
              Wir sind für dich da – online und in unseren Shops. Qualität und Service stehen bei uns an erster Stelle.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Locations */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {locations.map((location, index) => (
              <motion.div
                key={location.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Shop Image */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={location.image}
                    alt={location.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Location Details */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-primary mb-6">{location.name}</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-foreground mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-foreground">{location.address}</p>
                        <p className="text-foreground">{location.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-foreground flex-shrink-0" />
                      <a 
                        href={`tel:${location.phone.replace(/\s/g, '')}`} 
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {location.phone}
                      </a>
                    </div>

                    <div className="flex items-center gap-3">
                      <Printer className="w-5 h-5 text-foreground flex-shrink-0" />
                      <span className="text-foreground">{location.fax}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-foreground flex-shrink-0" />
                      <a 
                        href={`mailto:${location.email}`} 
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {location.email}
                      </a>
                    </div>
                  </div>

                  {/* Google Map */}
                  <div className="mt-6 rounded-lg overflow-hidden">
                    <iframe
                      src={location.mapEmbedUrl}
                      width="100%"
                      height="300"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="w-full"
                    ></iframe>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Filialen;
