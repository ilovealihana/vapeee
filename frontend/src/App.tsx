import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useUserStore } from './store/user';
import { useCartStore } from './store/cart';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Cities from './pages/Cities';
import Locations from './pages/Locations';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import OrderSuccess from './pages/OrderSuccess';
import './index.css';

// Expand Telegram WebApp to full screen
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.expand();
  window.Telegram.WebApp.enableClosingConfirmation();
}

export default function App() {
  const { fetchUser } = useUserStore();
  const { fetchCart } = useCartStore();

  useEffect(() => {
    fetchUser();
    fetchCart();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cities" element={<Cities />} />
        <Route path="/cities/:cityId/locations" element={<Locations />} />
        <Route path="/locations/:locationId/products" element={<Products />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:productId" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  );
}
