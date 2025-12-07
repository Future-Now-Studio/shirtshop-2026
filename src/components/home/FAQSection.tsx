import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqData = [
  {
    question: "Wie lange dauert die Bearbeitung meiner Bestellung?",
    answer: "Standard-Bestellungen werden in der Regel innerhalb von 3-5 Werktagen bearbeitet und versendet. Bei individuellen Drucken oder Stickereien kann die Bearbeitungszeit 5-10 Werktage betragen. Bei Großbestellungen besprechen wir die Lieferzeiten individuell mit Ihnen.",
  },
  {
    question: "Welche Zahlungsmethoden werden akzeptiert?",
    answer: "Wir akzeptieren verschiedene Zahlungsmethoden, darunter Kreditkarte, PayPal, Vorkasse und Rechnung (für Geschäftskunden). Alle Zahlungen werden sicher über verschlüsselte Verbindungen abgewickelt.",
  },
  {
    question: "Kann ich meine eigenen Designs hochladen?",
    answer: "Ja, absolut! Mit unserem Creator können Sie Ihre eigenen Designs hochladen und direkt auf den Produkten platzieren. Wir unterstützen verschiedene Dateiformate wie PNG, JPG, SVG und PDF. Für die beste Qualität empfehlen wir Vektordateien.",
  },
  {
    question: "Was ist der Mindestbestellwert?",
    answer: "Der Mindestbestellwert beträgt 25€. Bei Großbestellungen ab 50 Stück bieten wir attraktive Mengenrabatte. Kontaktieren Sie uns gerne für ein individuelles Angebot.",
  },
  {
    question: "Kann ich Bestellungen stornieren oder ändern?",
    answer: "Bestellungen können innerhalb von 24 Stunden nach Auftragserteilung kostenlos storniert werden. Änderungen sind möglich, solange die Produktion noch nicht begonnen hat. Bitte kontaktieren Sie uns schnellstmöglich per E-Mail oder Telefon.",
  },
  {
    question: "Welche Versandoptionen gibt es?",
    answer: "Wir versenden innerhalb Deutschlands mit DHL und DPD. Standardversand dauert 2-3 Werktage, Expressversand ist am nächsten Werktag möglich. Internationale Lieferungen sind auf Anfrage möglich. Die Versandkosten werden im Warenkorb angezeigt.",
  },
  {
    question: "Was ist, wenn das Produkt nicht passt?",
    answer: "Sie haben 14 Tage Zeit, um ungetragene und unveränderte Artikel zurückzugeben. Bitte beachten Sie, dass individualisierte Produkte (mit Druck oder Stickerei) nur bei Mängeln zurückgegeben werden können. Die Rücksendung erfolgt auf Ihre Kosten, außer bei fehlerhaften Lieferungen.",
  },
  {
    question: "Bieten Sie auch Großbestellungen für Unternehmen an?",
    answer: "Ja, wir sind spezialisiert auf Großbestellungen für Unternehmen, Vereine und Events. Wir bieten individuelle Beratung, Mengenrabatte und können auch Ihre Firmenlogos oder Designs umsetzen. Kontaktieren Sie uns für ein unverbindliches Angebot.",
  },
];

export const FAQSection = () => {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <h2 className="text-4xl lg:text-5xl font-bold">
              <span className="text-primary">häufig gestellte</span>
              <br />
              <span className="text-secondary italic">fragen.</span>
            </h2>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hier findest du Antworten auf die häufigsten Fragen zu unseren Produkten, Bestellungen und Services.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-border">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

