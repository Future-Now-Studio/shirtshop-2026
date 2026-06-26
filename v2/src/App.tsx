import { Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-semibold">ShirtShop v2</Link>
          <nav className="text-sm text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          </nav>
        </div>
      </header>
      <main className="container py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<div>Admin (Phase 2 — kommt)</div>} />
        </Routes>
      </main>
    </div>
  );
}
