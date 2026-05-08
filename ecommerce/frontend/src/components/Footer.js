import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Footer.css';

const socialLinks = [
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'Twitter',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M22 5.9c-.7.3-1.4.5-2.2.6a3.8 3.8 0 0 0 1.7-2.1 7.7 7.7 0 0 1-2.4.9 3.8 3.8 0 0 0-6.6 2.6c0 .3 0 .6.1.9A10.8 10.8 0 0 1 3 4.9a3.8 3.8 0 0 0 1.2 5.1c-.6 0-1.2-.2-1.7-.5 0 1.8 1.2 3.4 3 3.8-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.5 1.9 2.7 3.6 2.7A7.7 7.7 0 0 1 2 18.6a10.8 10.8 0 0 0 5.8 1.7c7 0 10.8-5.8 10.8-10.8v-.5c.8-.5 1.5-1.2 2-2" />
      </svg>
    ),
  },
  {
    label: 'Dribbble',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M7 4.8c3 3.6 5.3 7.9 6.7 13" />
        <path d="M4 11.6c4.2-.1 8.3-1 12-2.8 1.4-.7 2.8-1.5 4-2.5" />
        <path d="M9.5 20.5c1.5-3.5 4.5-6 8.5-6.9" />
      </svg>
    ),
  },
];

const Footer = () => (
  <footer className="footer">
    <div className="container footer-inner">
      <div className="footer-brand-block">
        <div className="footer-brand">
          <span className="logo-mark">S</span>
          <span className="logo-text">SHOPVAULT</span>
        </div>
        <p className="footer-lead">
          A multi-vendor marketplace for bold products, trusted sellers, and fast-moving storefronts.
        </p>
        <div className="footer-socials">
          {socialLinks.map((item) => (
            <a key={item.label} href={item.href} aria-label={item.label} className="footer-social-link">
              {item.icon}
            </a>
          ))}
        </div>
      </div>

      <div className="footer-column">
        <h4>Quick Links</h4>
        <Link to="/">Shop</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/wishlist">Wishlist</Link>
        <Link to="/cart">Cart</Link>
      </div>

      <div className="footer-column">
        <h4>Vendor Info</h4>
        <Link to="/register">Become a Seller</Link>
        <Link to="/vendor">Vendor Dashboard</Link>
        <Link to="/profile">Seller Profile</Link>
        <Link to="/register">Start Selling</Link>
      </div>

      <div className="footer-column footer-newsletter">
        <h4>Newsletter</h4>
        <p>Fresh vendor drops and featured sale picks.</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          toast.success('Thanks for subscribing to ShopVault updates.');
          event.currentTarget.reset();
        }}>
          <input type="email" placeholder="Email address" required />
          <button type="submit">Join</button>
        </form>
      </div>
    </div>

    <div className="footer-bottom">
      <div className="container">© {new Date().getFullYear()} ShopVault. All rights reserved.</div>
    </div>
  </footer>
);

export default Footer;
