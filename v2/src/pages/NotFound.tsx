import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LinkButton } from "@/components/LinkButton";
import { setPageMeta } from "@/lib/seo";

export default function NotFound() {
  const { pathname } = useLocation();
  // The SPA answers unknown URLs with HTTP 200, so tell crawlers not to index them.
  useEffect(() => {
    setPageMeta({ title: "Seite nicht gefunden | Private Shirt", path: pathname, noindex: true });
  }, [pathname]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-7xl font-black text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold lowercase">seite nicht gefunden</h1>
      <p className="mt-2 text-muted-foreground">die seite gibt's leider nicht (mehr).</p>
      <LinkButton to="/" size="lg" className="mt-6">zur startseite</LinkButton>
    </div>
  );
}
