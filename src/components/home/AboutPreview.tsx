import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import hamburgImage from "@/assets/julia-solonina-4fLxfNI3ohE-unsplash.jpg";

export const AboutPreview = () => {
  return (
    <section className="section-padding bg-muted/30 overflow-hidden">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl aspect-square lg:aspect-[4/5]">
              <img
                src={hamburgImage}
                alt="Hamburg Skyline"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-transparent" />
            </div>
            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="absolute -bottom-6 -right-6 lg:right-auto lg:-left-6 glass-card p-6 max-w-xs"
            >
              <p className="text-primary font-bold text-lg mb-1">seit 2010</p>
              <p className="text-muted-foreground text-sm">
                professionelle textilveredelung aus hamburg
              </p>
            </motion.div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              <span className="text-primary">wir sind private shirt:</span>
              <br />
              <span className="text-secondary italic">geboren in hamburg.</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              guter stoff für ihre ideen. private shirt – professionelle textilveredelung. 
              sie überzeugen ihre kunden täglich mit kreativen ideen und individuellen 
              dienstleistungen? dann legen sie bei der außendarstellung sicher auch hohen 
              wert auf qualität.
            </p>
            <Link to="/unternehmen">
              <Button size="lg" className="group">
                jetzt kennenlernen
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
