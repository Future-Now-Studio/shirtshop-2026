import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";

const categories = [
  {
    title: "shop, shop, hooray.",
    description: "Entdecke unsere neuesten Kollektionen",
    link: "/produkte",
    linkText: "jetzt shoppen",
    image: lifestyleImage,
    span: "lg:col-span-2 lg:row-span-2",
  },
  {
    title: "du brauchst masse?",
    description: "Großbestellungen mit Mengenrabatt",
    link: "/grossbestellung",
    linkText: "jetzt mehr",
    gradient: "from-secondary/20 to-secondary/5",
    span: "lg:col-span-1",
  },
  {
    title: "das können wir.",
    description: "Unsere professionellen Leistungen",
    link: "/leistungen",
    linkText: "jetzt wissen",
    gradient: "from-primary/10 to-primary/5",
    span: "lg:col-span-1",
  },
];

export const ShopSection = () => {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {categories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`group relative overflow-hidden rounded-3xl ${category.span || ""}`}
            >
              <Link to={category.link} className="block h-full">
                <div
                  className={`relative h-full min-h-[300px] ${
                    category.image ? "" : `bg-gradient-to-br ${category.gradient} border border-border/50`
                  } p-8 flex flex-col justify-end`}
                >
                  {category.image && (
                    <>
                      <img
                        src={category.image}
                        alt={category.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                    </>
                  )}
                  
                  <div className="relative z-10">
                    <h2
                      className={`text-3xl lg:text-4xl font-bold mb-2 ${
                        category.image ? "text-background" : "text-primary"
                      }`}
                    >
                      {category.title}
                    </h2>
                    <p
                      className={`mb-4 ${
                        category.image ? "text-background/80" : "text-muted-foreground"
                      }`}
                    >
                      {category.description}
                    </p>
                    <Button
                      variant={category.image ? "glass" : "outline"}
                      size="default"
                      className="group/btn"
                    >
                      {category.linkText}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
