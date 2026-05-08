import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import NotificationCenter from './NotificationCenter';
import './Navbar.css';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-6.716-4.35-9.192-8.01C1.24 10.71 2.028 7.5 5.2 6.38A5.21 5.21 0 0112 8.13a5.21 5.21 0 016.8-1.75c3.172 1.12 3.96 4.33 2.392 6.61C18.716 16.65 12 21 12 21z" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [hasShadow, setHasShadow] = useState(false);
  const isAdminArea = location.pathname.startsWith('/admin');
  const isVendorDashboard = location.pathname === '/vendor';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get('search') || '');
  }, [location.search]);

  useEffect(() => {
    const onScroll = () => setHasShadow(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    setDropdownOpen(false);
    setMenuOpen(false);
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'vendor') return '/vendor';
    return '/orders';
  };

  const navLinks = useMemo(() => {
    const links = [{ to: '/', label: 'Shop' }];
    if (user) links.push({ to: getDashboardPath(), label: 'Dashboard' });
    if (user?.role === 'customer') links.push({ to: '/wishlist', label: 'Wishlist' });
    return links;
  }, [user]);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchValue.trim();
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    navigate(`/${params.toString() ? `?${params.toString()}` : ''}`);
    setMenuOpen(false);
  };

  return (
    <nav className={`navbar ${hasShadow ? 'scrolled' : ''} ${isAdminArea ? 'admin-navbar' : ''} ${isVendorDashboard ? 'vendor-navbar' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <span className="logo-mark">S</span>
          <span className="logo-text">SHOPVAULT</span>
        </Link>

        <form className="navbar-search" onSubmit={submitSearch}>
          <span className="navbar-search-icon" aria-hidden="true"><SearchIcon /></span>
          <input
            type="search"
            className="navbar-search-input"
            placeholder="Search products, brands, or categories"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </form>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <form className="navbar-search navbar-search-mobile" onSubmit={submitSearch}>
            <span className="navbar-search-icon" aria-hidden="true"><SearchIcon /></span>
            <input
              type="search"
              className="navbar-search-input"
              placeholder="Search products"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </form>
        </div>

        <div className="navbar-actions">
          {isAdminArea && (
            <button type="button" className="admin-search-action" aria-label="Search admin console">
              <SearchIcon />
            </button>
          )}
          {user ? (
            <>
              <NotificationCenter />
              {user.role === 'customer' && (
                <>
                  <Link to="/wishlist" className="cart-btn" title="Wishlist">
                    <HeartIcon />
                    {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
                  </Link>
                  <Link to="/cart" className="cart-btn cart-btn-emphasis" title="Cart">
                    <CartIcon />
                    <span className="cart-label">Cart</span>
                    {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                  </Link>
                </>
              )}
              <div className="user-dropdown-wrapper">
                <button className="user-btn" onClick={() => setDropdownOpen((current) => !current)}>
                  <span className="user-avatar">{(user.name || 'U')[0].toUpperCase()}</span>
                  <span className="user-name">{user.name.split(' ')[0]}</span>
                  <svg width="12" height="12" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
                {dropdownOpen && (
                  <div className="user-dropdown" onMouseLeave={() => setDropdownOpen(false)}>
                    <div className="dropdown-header">
                      <span className="dropdown-name">{user.name}</span>
                      <span className={`badge badge-${user.role}`}>{user.role}</span>
                    </div>
                    <div className="dropdown-divider" />
                    <Link to={getDashboardPath()} className="dropdown-item" onClick={() => setDropdownOpen(false)}>Dashboard</Link>
                    {user.role === 'customer' && <Link to="/wishlist" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Wishlist</Link>}
                    <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Profile</Link>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item dropdown-logout" onClick={handleLogout}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="auth-btns">
              <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </div>
          )}
          <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
