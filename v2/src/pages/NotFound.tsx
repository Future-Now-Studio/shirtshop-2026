import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-7xl font-black text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold lowercase">seite nicht gefunden</h1>
      <p className="mt-2 text-muted-foreground">die seite gibt's leider nicht (mehr).</p>
      <Link to="/" className="mt-6">
        <Button size="lg">zur startseite</Button>
      </Link>
    </div>
  );
}
