import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-8xl lg:text-9xl font-black text-primary mb-4">404</h1>
          <p className="text-2xl text-muted-foreground mb-8">
            Oops! Diese Seite wurde nicht gefunden.
          </p>
          <Link to="/">
            <Button size="lg" className="group">
              <Home className="w-5 h-5 mr-2" />
              Zurück zur Startseite
            </Button>
          </Link>
        </motion.div>
      </div>
    </Layout>
  );
};

export default NotFound;
