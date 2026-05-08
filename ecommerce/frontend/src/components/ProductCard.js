import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { toast } from 'react-toastify';
import './ProductCard.css';

const StarRating = ({ rating, count }) => (
  <div className="stars-row">
    <span className="stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className="star-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? '#FF6B2B' : 'none'}
          stroke={s <= Math.round(rating) ? '#FF6B2B' : '#d1d5db'}
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m12 3.6 2.57 5.2 5.74.84-4.15 4.04.98 5.71L12 16.7l-5.14 2.69.98-5.71L3.69 9.64l5.74-.84L12 3.6Z" />
        </svg>
      ))}
    </span>
    <span className="stars-count">{count > 0 ? `${Number(rating || 0).toFixed(1)} (${count})` : 'No reviews'}</span>
  </div>
);

const ProductCard = ({ product, wishlistAction = null }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!user) { toast.info('Please log in to add to cart'); return; }
    if (user.role !== 'customer') { toast.info('Only customers can add to cart'); return; }
    if (product.stock === 0) { toast.error('Out of stock'); return; }
    if (product.hasVariants || product.variants?.length) { toast.info('Open the product to choose a variant'); return; }
    addToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  const discountedPrice = product.discount > 0
    ? (parseFloat(product.price) * (1 - product.discount / 100)).toFixed(2)
    : null;
  const wishlisted = isWishlisted(product.id);
  const showFromPrice = product.hasVariants || product.variants?.length;
  const displayPrice = showFromPrice
    ? parseFloat(product.minVariantPrice ?? product.price).toFixed(2)
    : (discountedPrice || parseFloat(product.price).toFixed(2));
  const stockState = product.stock === 0 ? 'Out of stock' : product.stock <= 5 ? `${product.stock} left` : 'Ready to ship';

  return (
    <Link to={`/products/${product.id}`} className="product-card card card-hover">
      <div className="product-card-image">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-card-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/><path d="M3 15l4 4 4-4 4 4 4-4"/></svg>
          </div>
        )}
        {product.discount > 0 && (
          <span className="product-discount-badge">{product.discount}% OFF</span>
        )}
        {product.stock === 0 && (
          <div className="product-out-of-stock">
            <strong>Out of Stock</strong>
            <span>Back soon</span>
          </div>
        )}
        <div className="product-image-scrim" />
        <button
          className={`wishlist-btn ${wishlisted ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-6.716-4.35-9.192-8.01C1.24 10.71 2.028 7.5 5.2 6.38A5.21 5.21 0 0112 8.13a5.21 5.21 0 016.8-1.75c3.172 1.12 3.96 4.33 2.392 6.61C18.716 16.65 12 21 12 21z" />
          </svg>
        </button>
      </div>

      <div className="product-card-body">
        {(product.category || product.brand) && (
          <span className="product-category">
            {[product.category, product.brand].filter(Boolean).join(' · ')}
          </span>
        )}
        <h3 className="product-name">{product.name}</h3>
        <StarRating rating={product.avgRating || 0} count={product.reviewCount || 0} />
        <div className="product-card-footer">
          <div className="product-price-block">
            <span className="product-price">
              {showFromPrice ? `From ₹${displayPrice}` : `₹${displayPrice}`}
            </span>
            {!showFromPrice && discountedPrice && (
              <span className="product-price-original">₹${parseFloat(product.price).toFixed(2)}</span>
            )}
          </div>
          <button
            className="add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            title="Add to cart"
            aria-label="Add to cart"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6h15l-1.5 9h-11z" /><path d="M6 6 5 3H2" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
          </button>
        </div>
        <p className="product-vendor">by {product.vendor?.name || 'Vendor'}</p>
        {wishlistAction && (
          <button
            type="button"
            className="btn btn-outline btn-sm product-secondary-action"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              wishlistAction.onClick(product);
            }}
            disabled={wishlistAction.disabled}
          >
            {wishlistAction.label}
          </button>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
