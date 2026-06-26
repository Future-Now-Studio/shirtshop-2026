import { Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import AdminLayout from "@/pages/admin/AdminLayout";
import Overview from "@/pages/admin/Overview";
import Colors from "@/pages/admin/Colors";
import Sizes from "@/pages/admin/Sizes";
import Products from "@/pages/admin/Products";
import ProductEditor from "@/pages/admin/ProductEditor";

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
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="colors" element={<Colors />} />
            <Route path="sizes" element={<Sizes />} />
            <Route path="discounts" element={<div>Rabatte (kommt)</div>} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
