import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useRecentlyViewed } from '../context/RecentlyViewedContext';
import { useWishlist } from '../context/WishlistContext';
import { orderAPI, productAPI, reviewAPI } from '../services/api';
import { getProductEstimatedDelivery } from '../utils/deliveryEstimate';
import './ProductDetail.css';

const StarRating = ({ rating, interactive = false, onRate = () => {}, size = '18px' }) => (
  <div className="stars-interactive">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={`star-button ${interactive ? 'interactive' : ''}`}
        style={{ color: star <= rating ? '#f59e0b' : '#d1d5db', fontSize: size }}
        onClick={() => interactive && onRate(star)}
        disabled={!interactive}
        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
      >
        ?
      </button>
    ))}
  </div>
);

const emptyReview = { rating: 5, comment: '' };

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { trackProductView } = useRecentlyViewed();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [review, setReview] = useState(emptyReview);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [deliveryPincodeInput, setDeliveryPincodeInput] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  const fetchProduct = async () => {
    try {
      const response = await productAPI.getById(id);
      setProduct(response.data.product);
    } catch {
      toast.error('Product not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product) trackProductView(product);
  }, [product, trackProductView]);

  useEffect(() => {
    if (product?.variants?.length) {
      const firstAvailable = product.variants.find((variant) => variant.stock > 0) || product.variants[0];
      setSelectedVariantId(firstAvailable?.id || '');
      setQty(1);
    } else {
      setSelectedVariantId('');
    }
  }, [product]);

  useEffect(() => {
    if (user?.role !== 'customer') {
      setMyOrders([]);
      return;
    }

    orderAPI.getMyOrders()
      .then((response) => setMyOrders(response.data.orders || []))
      .catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    const savedPincode = window.localStorage.getItem('shopvault_delivery_pincode') || '';
    setDeliveryPincode(savedPincode);
    setDeliveryPincodeInput(savedPincode);
  }, []);

  const myReview = useMemo(
    () => product?.reviews?.find((item) => item.user_id === user?.id),
    [product?.reviews, user?.id]
  );

  useEffect(() => {
    if (myReview) {
      setReview({ rating: myReview.rating, comment: myReview.comment || '' });
      setEditingReviewId(myReview.id);
    } else {
      setReview(emptyReview);
      setEditingReviewId(null);
    }
  }, [myReview]);

  const deliveredPurchases = useMemo(() => myOrders.filter(
    (order) => order.status === 'delivered' && order.items?.some((item) => Number(item.product_id) === Number(id))
  ), [id, myOrders]);

  const canReviewProduct = user?.role === 'customer' && deliveredPurchases.length > 0;
  const reviewBreakdown = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (product?.reviews || []).forEach((item) => {
      counts[item.rating] = (counts[item.rating] || 0) + 1;
    });
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star] || 0,
      percent: product?.reviewCount ? ((counts[star] || 0) / product.reviewCount) * 100 : 0,
    }));
  }, [product?.reviewCount, product?.reviews]);

  const handleAddToCart = () => {
    if (!user) {
      toast.info('Please log in');
      return;
    }
    if (user.role !== 'customer') {
      toast.info('Only customers can shop');
      return;
    }
    if (product.variants?.length > 0 && !selectedVariant) {
      toast.info('Choose a variant first');
      return;
    }
    addToCart(product, qty, selectedVariant);
    toast.success(`${qty} x ${product.name}${selectedVariant ? ` (${selectedVariant.label})` : ''} added to cart!`);
  };

  const handleBuyNow = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    handleAddToCart();
    navigate('/cart');
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      toast.info('Please log in to review');
      return;
    }
    if (!canReviewProduct) {
      toast.info('You can review this product after a delivered order');
      return;
    }

    setReviewLoading(true);
    try {
      if (editingReviewId) {
        await reviewAPI.update(editingReviewId, review);
        toast.success('Review updated');
      } else {
        await reviewAPI.create({ product_id: id, ...review });
        toast.success('Review submitted');
      }
      await fetchProduct();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;

    try {
      await reviewAPI.delete(reviewId);
      toast.success('Review deleted');
      await fetchProduct();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete review');
    }
  };

  if (loading) return <div className="spinner-wrapper"><div className="spinner" /></div>;
  if (!product) return null;

  const selectedVariant = product.variants?.find((variant) => variant.id === selectedVariantId) || null;
  const displayImage = selectedVariant?.image || product.image;
  const basePrice = parseFloat(product.price) + parseFloat(selectedVariant?.priceAdjustment || 0);
  const discountedPrice = product.discount > 0
    ? (basePrice * (1 - product.discount / 100)).toFixed(2)
    : null;
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
  const wishlisted = isWishlisted(product.id);
  const lineSubtotal = Number((Number(discountedPrice || basePrice) * qty).toFixed(2));
  const deliveryEstimate = getProductEstimatedDelivery({
    inStock: availableStock > 0,
    hasVariants: Boolean(product.variants?.length),
    pincode: deliveryPincode,
    subtotal: lineSubtotal,
  });
  const serviceabilityTone = !deliveryEstimate.serviceability.isValid && !deliveryEstimate.serviceability.pincode
    ? 'neutral'
    : deliveryEstimate.serviceability.isServiceable
      ? 'positive'
      : 'negative';

  const handleDeliveryCheck = () => {
    const normalizedPincode = deliveryPincodeInput.replace(/\D/g, '').slice(0, 6);
    setDeliveryPincode(normalizedPincode);
    window.localStorage.setItem('shopvault_delivery_pincode', normalizedPincode);
    if (normalizedPincode.length === 6) {
      toast.success(`Delivery updated for ${normalizedPincode}`);
    } else {
      toast.info('Enter a valid 6-digit pincode to check delivery');
    }
  };

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate(-1)}>? Back</button>

      <div className="product-detail-grid">
        <div className="product-detail-image card">
          {displayImage ? (
            <img src={displayImage} alt={selectedVariant ? `${product.name} - ${selectedVariant.label}` : product.name} />
          ) : (
            <div className="product-detail-placeholder">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9l4-4 4 4 4-4 4 4M3 15l4 4 4-4 4 4 4-4" /></svg>
            </div>
          )}
          {product.discount > 0 && <span className="pd-discount-badge">-{product.discount}% OFF</span>}
        </div>

        <div className="product-detail-info">
          {product.category && <span className="pd-category">{product.category}</span>}
          <h1 className="pd-title">{product.name}</h1>

          <div className="pd-rating-row">
            <StarRating rating={Math.round(parseFloat(product.avgRating || 0))} />
            <span className="pd-rating-text">{product.avgRating} ({product.reviewCount} reviews)</span>
          </div>

          <div className="pd-price-block">
            <span className="pd-price">Rs {discountedPrice || basePrice.toFixed(2)}</span>
            {discountedPrice && <span className="pd-price-orig">Rs {basePrice.toFixed(2)}</span>}
          </div>

          <p className="pd-description">{product.description || 'No description provided.'}</p>

          <div className="pd-meta">
            <div className="pd-meta-item"><span className="pd-meta-label">Vendor</span><span>{product.vendor?.name}</span></div>
            {product.brand && (
              <div className="pd-meta-item"><span className="pd-meta-label">Brand</span><span>{product.brand}</span></div>
            )}
            <div className="pd-meta-item">
              <span className="pd-meta-label">Store</span>
              <Link to={`/vendors/${product.vendor?.id}`} className="pd-store-link">
                Visit storefront
              </Link>
            </div>
            <div className="pd-meta-item">
              <span className="pd-meta-label">Stock</span>
              <span className={availableStock > 0 ? 'in-stock' : 'out-stock'}>
                {availableStock > 0 ? `${availableStock} available` : 'Out of stock'}
              </span>
            </div>
          </div>

          <div className="delivery-estimate-card">
            <div className="delivery-estimate-header">
              <div>
                <strong>{deliveryEstimate.label}</strong>
                <span>{deliveryEstimate.detail}</span>
              </div>
              <div className="delivery-estimate-price">
                <small>Shipping</small>
                <strong>{deliveryEstimate.shipping.shippingFee === 0 ? 'Free' : `Rs ${deliveryEstimate.shipping.shippingFee}`}</strong>
              </div>
            </div>
            <div className="delivery-pincode-row">
              <input
                className="form-input"
                value={deliveryPincodeInput}
                onChange={(event) => setDeliveryPincodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter pincode"
                inputMode="numeric"
              />
              <button type="button" className="btn btn-outline" onClick={handleDeliveryCheck}>
                Check
              </button>
            </div>
            <div className={`delivery-serviceability ${serviceabilityTone}`}>
              <strong>{deliveryEstimate.serviceability.label}</strong>
              <span>{deliveryEstimate.serviceability.detail}</span>
            </div>
            <div className="delivery-threshold-note">
              <strong>{deliveryEstimate.shipping.label}</strong>
              <span>{deliveryEstimate.shipping.detail}</span>
            </div>
          </div>

          {product.variants?.length > 0 && (
            <div className="pd-variants">
              <label className="pd-meta-label">Choose Variant</label>
              <div className="variant-grid">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={`variant-card ${selectedVariantId === variant.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setQty(1);
                    }}
                    disabled={variant.stock === 0}
                  >
                    {variant.image ? (
                      <div className="variant-card-image">
                        <img src={variant.image} alt={variant.label} />
                      </div>
                    ) : null}
                    <strong>{variant.label}</strong>
                    <span>Rs {(parseFloat(product.price) + parseFloat(variant.priceAdjustment || 0)).toFixed(2)}</span>
                    <small>{variant.stock > 0 ? `${variant.stock} in stock` : 'Out of stock'}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableStock > 0 && (
            <div className="pd-qty-row">
              <label className="pd-meta-label">Quantity</label>
              <div className="qty-control">
                <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
                <span className="qty-value">{qty}</span>
                <button className="qty-btn" onClick={() => setQty(Math.min(availableStock, qty + 1))}>+</button>
              </div>
            </div>
          )}

          {user?.role === 'customer' && (
            <div className="pd-actions">
              <button className={`btn btn-outline btn-lg ${wishlisted ? 'pd-wishlist-active' : ''}`} onClick={() => toggleWishlist(product)}>
                {wishlisted ? 'Saved' : 'Save'}
              </button>
              <button className="btn btn-outline btn-lg" onClick={handleAddToCart} disabled={availableStock === 0}>Add to Cart</button>
              <button className="btn btn-accent btn-lg" onClick={handleBuyNow} disabled={availableStock === 0}>Buy Now</button>
            </div>
          )}
          {!user && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Login to Purchase</button>
          )}
        </div>
      </div>

      <div className="reviews-section">
        <div className="reviews-header">
          <h2 className="reviews-title">Customer Reviews</h2>
          <span className="reviews-chip">{product.reviewCount} ratings</span>
        </div>

        <div className="reviews-summary card">
          <div className="reviews-summary-score">
            <strong>{product.avgRating}</strong>
            <StarRating rating={Math.round(parseFloat(product.avgRating || 0))} />
            <span>Based on {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}</span>
          </div>
          <div className="reviews-breakdown">
            {reviewBreakdown.map((item) => (
              <div key={item.star} className="breakdown-row">
                <span>{item.star} star</span>
                <div className="breakdown-bar">
                  <div className="breakdown-fill" style={{ width: `${item.percent}%` }} />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        {user?.role === 'customer' && (
          <form onSubmit={handleReviewSubmit} className="review-form card">
            <h3>{editingReviewId ? 'Edit Your Review' : 'Write a Review'}</h3>
            {!canReviewProduct && (
              <div className="review-eligibility-banner">
                You can rate this product after one of your orders for it is delivered.
              </div>
            )}
            {canReviewProduct && (
              <div className="review-eligibility-banner success">
                Verified buyer. Your review will be marked as a verified purchase.
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Rating</label>
              <StarRating rating={review.rating} interactive onRate={(rating) => setReview({ ...review, rating })} size="28px" />
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea
                className="form-input"
                rows="3"
                value={review.comment}
                onChange={(event) => setReview({ ...review, comment: event.target.value })}
                placeholder="Share your experience with this product..."
              />
            </div>
            <div className="review-form-actions">
              <button type="submit" className="btn btn-primary" disabled={reviewLoading || !canReviewProduct}>
                {reviewLoading ? 'Saving...' : editingReviewId ? 'Update Review' : 'Submit Review'}
              </button>
              {editingReviewId && (
                <button type="button" className="btn btn-outline" onClick={() => setReview({ rating: myReview.rating, comment: myReview.comment || '' })}>
                  Reset
                </button>
              )}
            </div>
          </form>
        )}

        {product.reviews?.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">R</div><h3>No reviews yet</h3><p>Be the first customer to review this product after delivery.</p></div>
        ) : (
          <div className="reviews-list">
            {product.reviews?.map((item) => {
              const isOwnReview = item.user_id === user?.id;

              return (
                <div key={item.id} className="review-card card">
                  <div className="review-header">
                    <div className="reviewer-avatar">{item.reviewer?.name?.[0]?.toUpperCase()}</div>
                    <div className="review-header-main">
                      <div className="reviewer-name-row">
                        <div className="reviewer-name">{item.reviewer?.name}</div>
                        {item.verifiedPurchase && <span className="verified-badge">Verified purchase</span>}
                      </div>
                      <StarRating rating={item.rating} />
                    </div>
                    <span className="review-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  {item.comment && <p className="review-comment">{item.comment}</p>}
                  {isOwnReview && (
                    <div className="review-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setReview({ rating: item.rating, comment: item.comment || '' });
                          setEditingReviewId(item.id);
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteReview(item.id)}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
