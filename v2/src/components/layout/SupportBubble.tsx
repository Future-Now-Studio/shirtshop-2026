import { useState } from "react";
import { MessageCircle, X, Mail, Phone } from "lucide-react";

export default function SupportBubble() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-64 animate-scale-in rounded-2xl border bg-card p-4 shadow-elevated">
          <p className="font-bold lowercase">wie können wir helfen?</p>
          <p className="mt-1 text-sm text-muted-foreground">schreib oder ruf uns an — wir sind da.</p>
          <div className="mt-3 space-y-2 text-sm">
            <a href="mailto:info@private-shirt.de" className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent">
              <Mail className="h-4 w-4 text-primary" /> info@private-shirt.de
            </a>
            <a href="tel:04032873804" className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent">
              <Phone className="h-4 w-4 text-primary" /> 040 – 328 73 804
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Support"
        className="flex h-14 w-14 items-center justify-center rounded-full gradient-bg text-primary-foreground shadow-glow transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
