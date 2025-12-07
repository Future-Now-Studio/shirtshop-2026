import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle, Package, Home, ShoppingBag, AlertTriangle } from "lucide-react";

const CheckoutSuccess = () => {
  const location = useLocation();
  const orderNumber = location.state?.orderNumber;
  const orderId = location.state?.orderId;
  const warning = location.state?.warning;
  const paymentIntentId = location.state?.paymentIntentId;

  return (
    <Layout>
      <div className="container-wide py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle className="w-12 h-12 text-primary" />
          </motion.div>

          <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
            Vielen Dank für Ihre Bestellung!
          </h1>
          
          {orderNumber && (
            <p className="text-xl font-semibold text-secondary mb-2">
              Bestellnummer: #{orderNumber}
            </p>
          )}
          
          {warning && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-yellow-500">Wichtiger Hinweis</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Ihre Zahlung war erfolgreich, aber die Bestellung konnte nicht automatisch erstellt werden. 
                Bitte kontaktieren Sie uns mit Ihrer Payment Intent ID: <strong>{paymentIntentId}</strong>
              </p>
            </div>
          )}
          
          <p className="text-lg text-muted-foreground mb-8">
            {orderNumber 
              ? "Ihre Bestellung wurde erfolgreich erstellt und wird in Kürze bearbeitet."
              : "Ihre Bestellung wurde erfolgreich erhalten und wird in Kürze bearbeitet."
            }
          </p>

          <div className="glass-card p-6 mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Nächste Schritte</h2>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Sie erhalten in Kürze eine Bestätigungs-E-Mail mit allen Details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Wir bearbeiten Ihre Bestellung innerhalb von 3-5 Werktagen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Sie erhalten eine Versandbestätigung, sobald Ihre Bestellung versendet wurde</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/produkte">
                <ShoppingBag className="w-5 h-5 mr-2" />
                Weiter einkaufen
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/">
                <Home className="w-5 h-5 mr-2" />
                Zur Startseite
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default CheckoutSuccess;

