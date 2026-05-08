import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import './Wishlist.css';

const Wishlist = () => {
  const { addToCart } = useCart();
  const { wishlistItems, wishlistLoading, removeFromWishlist } = useWishlist();
  const [movingId, setMovingId] = useState(null);

  const handleMoveToCart = async (product) => {
    if (product.stock === 0) {
      toast.error('This product is out of stock');
      return;
    }

    if (product.hasVariants || product.variants?.length) {
      toast.info('Open the product to choose a variant before moving it to cart');
      return;
    }

    setMovingId(product.id);
    try {
      addToCart(product);
      await removeFromWishlist(product.id, true);
      toast.success(`${product.name} moved to cart`);
    } finally {
      setMovingId(null);
    }
  };

  if (wishlistLoading) {
    return <div className="spinner-wrapper"><div className="spinner" /></div>;
  }

  return (
    <div className="container page-content">
      <div className="wishlist-header">
        <div>
          <h1 className="page-title">My Wishlist</h1>
          <p className="wishlist-subtitle">Keep track of products you want to come back to.</p>
        </div>
        <span className="wishlist-count">{wishlistItems.length} saved</span>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">♡</div>
          <h3>No wishlist items yet</h3>
          <p>Save products you love and they will show up here.</p>
          <Link to="/" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div className="grid-products">
          {wishlistItems.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              wishlistAction={{
                label: movingId === product.id ? 'Moving...' : 'Move to cart',
                onClick: handleMoveToCart,
                disabled: movingId === product.id || product.stock === 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
