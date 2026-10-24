import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import ShelfPage from './pages/ShelfPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import AddressesPage from './pages/AddressesPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import DemoPaymentPage from './pages/DemoPaymentPage.jsx';
import OrderPage from './pages/OrderPage.jsx';
import SellerDashboardPage from './pages/SellerDashboardPage.jsx';
import SellerStartPage from './pages/SellerStartPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPage from './pages/ForgotPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="trending" element={<ShelfPage slug="trending" />} />
        <Route path="best-sellers" element={<ShelfPage slug="best-sellers" />} />
        <Route path="new-releases" element={<ShelfPage slug="new-releases" />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="checkout/pay/:id" element={<DemoPaymentPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderPage />} />
        <Route path="sell" element={<SellerDashboardPage />} />
        <Route path="sell/start" element={<SellerStartPage />} />
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot" element={<ForgotPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="account/addresses" element={<AddressesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
