import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { RecentlyViewedProvider } from './context/RecentlyViewedContext';
import { WishlistProvider } from './context/WishlistContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProductDetail from './pages/ProductDetail';
import VendorStorefront from './pages/VendorStorefront';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';

const AppShell = () => {
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/admin');
  const isVendorDashboard = location.pathname === '/vendor';
  const isDashboardArea = isAdminArea || isVendorDashboard;

  return (
    <div className={`page-wrapper ${isDashboardArea ? 'dashboard-page-wrapper' : ''} ${isAdminArea ? 'admin-page-wrapper' : ''}`}>
      <Navbar />
      <main className={`app-main ${isAdminArea ? 'admin-app-main' : ''} ${isVendorDashboard ? 'vendor-app-main' : ''}`}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/vendors/:id" element={<VendorStorefront />} />

          {/* Customer */}
          <Route path="/cart" element={
            <ProtectedRoute roles={['customer']}>
              <Cart />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute roles={['customer']}>
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/wishlist" element={
            <ProtectedRoute roles={['customer']}>
              <Wishlist />
            </ProtectedRoute>
          } />

          {/* Shared */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          {/* Vendor */}
          <Route path="/vendor" element={
            <ProtectedRoute roles={['vendor']}>
              <VendorDashboard />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isDashboardArea && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <RecentlyViewedProvider>
            <WishlistProvider>
              <CartProvider>
                <AppShell />
                <ToastContainer
                  position="top-right"
                  autoClose={3200}
                  hideProgressBar
                  newestOnTop
                  closeOnClick
                  pauseOnHover
                  theme="light"
                  toastClassName="app-toast"
                />
              </CartProvider>
            </WishlistProvider>
          </RecentlyViewedProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
