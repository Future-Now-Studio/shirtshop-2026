import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const ChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen for custom event to open chat from navbar
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
    };
    
    window.addEventListener('open-chat', handleOpenChat);
    return () => {
      window.removeEventListener('open-chat', handleOpenChat);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden der Nachricht');
      }

      toast.success("Ihre Nachricht wurde erfolgreich gesendet!");
      setFormData({ name: "", email: "", phone: "", message: "" });
      setIsOpen(false);
    } catch (error) {
      console.error('Error sending contact form:', error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        aria-label="Kontaktformular öffnen"
      >
        <MessageCircle className="w-7 h-7" />
      </motion.button>

      {/* Contact Form Dialog */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 right-6 left-4 sm:left-auto z-50 w-[calc(100%-2rem)] sm:w-full sm:max-w-md bg-background rounded-2xl shadow-2xl border border-border overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary text-primary-foreground p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Kontaktieren Sie uns</h2>
                  <p className="text-sm text-primary-foreground/80 mt-1">
                    Wir antworten schnell!
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div>
                  <Label htmlFor="chat-name">Name *</Label>
                  <Input
                    id="chat-name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Ihr Name"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="chat-email">E-Mail *</Label>
                  <Input
                    id="chat-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="ihre@email.de"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="chat-phone">Telefon</Label>
                  <Input
                    id="chat-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="040 123 456 789"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="chat-message">Nachricht *</Label>
                  <textarea
                    id="chat-message"
                    value={formData.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    placeholder="Wie können wir Ihnen helfen?"
                    required
                    rows={4}
                    className="w-full mt-1 p-3 rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Wird gesendet..." : "Nachricht senden"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Oder rufen Sie uns an:{" "}
                  <a
                    href="tel:040-18075863"
                    className="text-primary hover:underline"
                  >
                    040 - 180 75 863
                  </a>
                </p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

