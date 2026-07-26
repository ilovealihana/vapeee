import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from './store/user';
import { useCartStore } from './store/cart';
import { useCatalogSourceStore } from './store/catalogSource';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import CatalogSelector from './pages/CatalogSelector';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import OrderSuccess from './pages/OrderSuccess';
import AdminLayout from './pages/admin/AdminLayout';
import AdminCities from './pages/admin/AdminCities';
import AdminProducts from './pages/admin/AdminProducts';
import AdminStock from './pages/admin/AdminStock';
import AdminOrders from './pages/admin/AdminOrders';
import AdminStaff from './pages/admin/AdminStaff';
import AdminProductRequests from './pages/admin/AdminProductRequests';
import './index.css';

// Expand Telegram WebApp to full screen
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.expand();
  window.Telegram.WebApp.enableClosingConfirmation();
}

export default function App() {
  const { fetchUser } = useUserStore();
  const { fetchCart, cart } = useCartStore();
  const loadSources = useCatalogSourceStore((state) => state.loadSources);
  const hydrateFromCart = useCatalogSourceStore((state) => state.hydrateFromCart);
  const sources = useCatalogSourceStore((state) => state.sources);

  useEffect(() => {
    fetchUser();
    fetchCart();
    loadSources();
  }, []);

  useEffect(() => {
    if (sources) hydrateFromCart(cart);
  }, [cart, hydrateFromCart, sources]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* User routes */}
        <Route path="/" element={<Home />} />
        <Route path="/catalog-selector" element={<CatalogSelector />} />
        <Route path="/cities" element={<Navigate to="/catalog-selector" replace />} />
        <Route path="/cities/:cityId/locations" element={<Navigate to="/catalog-selector" replace />} />
        <Route path="/locations/:locationId/products" element={<Products />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:productId" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />

        {/* Admin routes — no BottomNav */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/product-requests" replace />} />
          <Route path="product-requests" element={<AdminProductRequests />} />
          <Route path="cities" element={<AdminCities />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="stock" element={<AdminStock />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="staff" element={<AdminStaff />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {/* Hide bottom nav on admin pages */}
      <BottomNavConditional />
    </BrowserRouter>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

function BottomNavConditional() {
  const { pathname } = useLocation();
  if (
    pathname === '/' ||
    pathname === '/catalog-selector' ||
    pathname === '/products' ||
    pathname === '/cart' ||
    pathname === '/profile' ||
    (pathname.startsWith('/locations/') && pathname.endsWith('/products')) ||
    pathname.startsWith('/admin')
  ) return null;
  return <BottomNav />;
}
