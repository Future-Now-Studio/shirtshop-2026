import { Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Designer from "@/pages/Designer";
import Cart from "@/pages/Cart";
import { useCart } from "@/stores/cart";
import AdminLayout from "@/pages/admin/AdminLayout";
import Overview from "@/pages/admin/Overview";
import Colors from "@/pages/admin/Colors";
import Sizes from "@/pages/admin/Sizes";
import Products from "@/pages/admin/Products";
import ProductEditor from "@/pages/admin/ProductEditor";

function CartLink() {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  return (
    <Link to="/warenkorb" className="hover:text-foreground">
      Warenkorb{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-semibold">ShirtShop v2</Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <CartLink />
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          </nav>
        </div>
      </header>
      <main className="container py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produkt/:slug" element={<ProductDetail />} />
          <Route path="/gestalten/:slug" element={<Designer />} />
          <Route path="/warenkorb" element={<Cart />} />
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
