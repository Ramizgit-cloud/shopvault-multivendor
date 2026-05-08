import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { orderAPI, reviewAPI, vendorAPI } from '../services/api';
import './VendorStorefront.css';

const createBannerStyle = (seed = 0) => {
  const hue = (Number(seed || 0) * 47) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 72% 52%) 0%, hsl(${(hue + 48) % 360} 78% 44%) 55%, hsl(${(hue + 115) % 360} 68% 18%) 100%)`,
  };
};

const formatJoinDate = (value) => new Date(value).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const StarRating = ({ rating, interactive = false, onRate = () => {} }) => (
  <div className="vendor-stars">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={`vendor-star-button ${interactive ? 'interactive' : ''}`}
        style={{ color: star <= rating ? '#f59e0b' : '#d1d5db' }}
        onClick={() => interactive && onRate(star)}
        disabled={!interactive}
        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
      >
        ★
      </button>
    ))}
  </div>
);

const emptyReview = { rating: 5, comment: '' };

const VendorStorefront = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [vendorReviews, setVendorReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [myOrders, setMyOrders] = useState([]);
  const [review, setReview] = useState(emptyReview);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchStorefront = async () => {
    const response = await vendorAPI.getStorefront(id);
    setVendor(response.data.vendor);
    setProducts(response.data.products);
    setStats(response.data.stats);
    setVendorReviews(response.data.vendorReviews || []);
  };

  useEffect(() => {
    setLoading(true);
    fetchStorefront()
      .catch(() => toast.error('Failed to load vendor storefront'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user?.role !== 'customer') {
      setMyOrders([]);
      return;
    }

    orderAPI.getMyOrders()
      .then((response) => setMyOrders(response.data.orders || []))
      .catch(() => {});
  }, [user?.id, user?.role]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = category ? product.category === category : true;
    return matchesSearch && matchesCategory;
  }), [products, search, category]);

  const myVendorReview = useMemo(
    () => vendorReviews.find((item) => item.user_id === user?.id),
    [vendorReviews, user?.id]
  );

  useEffect(() => {
    if (myVendorReview) {
      setReview({ rating: myVendorReview.rating, comment: myVendorReview.comment || '' });
      setEditingReviewId(myVendorReview.id);
    } else {
      setReview(emptyReview);
      setEditingReviewId(null);
    }
  }, [myVendorReview]);

  const deliveredVendorPurchases = useMemo(() => myOrders.filter((order) => (
    order.status === 'delivered' && order.items?.some((item) => Number(item.vendor_id) === Number(id))
  )), [id, myOrders]);

  const canReviewVendor = user?.role === 'customer' && deliveredVendorPurchases.length > 0;

  const handleVendorReviewSubmit = async (event) => {
    event.preventDefault();
    if (!canReviewVendor) {
      toast.info('You can review this seller after a delivered order from this storefront');
      return;
    }

    setReviewLoading(true);
    try {
      if (editingReviewId) {
        await reviewAPI.updateVendor(editingReviewId, review);
        toast.success('Seller review updated');
      } else {
        await reviewAPI.createVendor({ vendor_id: id, ...review });
        toast.success('Seller review submitted');
      }
      await fetchStorefront();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit seller review');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteVendorReview = async (reviewId) => {
    if (!window.confirm('Delete this seller review?')) return;
    try {
      await reviewAPI.deleteVendor(reviewId);
      toast.success('Seller review deleted');
      await fetchStorefront();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete seller review');
    }
  };

  if (loading) return <div className="spinner-wrapper"><div className="spinner" /></div>;
  if (!vendor) return null;

  return (
    <div className="vendor-storefront-page">
      <section className="vendor-hero" style={createBannerStyle(vendor.id)}>
        <div className="container vendor-hero-inner">
          <div className="vendor-identity">
            <div className="vendor-avatar-shell">
              {vendor.profileImage ? (
                <img src={vendor.profileImage} alt={vendor.name} className="vendor-avatar-image" />
              ) : (
                <div className="vendor-avatar-fallback">{vendor.name?.[0]?.toUpperCase()}</div>
              )}
            </div>
            <div className="vendor-identity-copy">
              <span className="vendor-eyebrow">Public Storefront</span>
              <h1>{vendor.name}</h1>
              <p>
                Discover curated picks from this vendor, browse their latest listings,
                and revisit products from one dedicated storefront.
              </p>
              <div className="vendor-meta-row">
                {vendor.address && <span>{vendor.address}</span>}
                {vendor.phone && <span>{vendor.phone}</span>}
                <span>Joined {formatJoinDate(vendor.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="vendor-hero-stats">
            <div className="vendor-stat-card">
              <strong>{stats?.totalProducts || 0}</strong>
              <span>Products</span>
            </div>
            <div className="vendor-stat-card">
              <strong>{stats?.sellerAverageRating || 0}</strong>
              <span>Seller Rating</span>
            </div>
            <div className="vendor-stat-card">
              <strong>{stats?.sellerReviewCount || 0}</strong>
              <span>Store Reviews</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container page-content">
        <section className="vendor-storefront-toolbar card">
          <div>
            <span className="toolbar-label">Browse Store</span>
            <h2>Everything from {vendor.name}</h2>
          </div>
          <div className="vendor-toolbar-actions">
            <input
              className="form-input vendor-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this vendor's products..."
            />
            <div className="vendor-category-row">
              <button
                type="button"
                className={`vendor-chip ${category === '' ? 'active' : ''}`}
                onClick={() => setCategory('')}
              >
                All
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`vendor-chip ${category === item ? 'active' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="vendor-story-grid">
          <div className="vendor-story-card card">
            <span className="toolbar-label">About This Seller</span>
            <p>
              {vendor.address
                ? `${vendor.name} is based in ${vendor.address} and currently offers ${stats?.totalProducts || 0} live products across ${stats?.totalCategories || 0} categories.`
                : `${vendor.name} currently offers ${stats?.totalProducts || 0} live products across ${stats?.totalCategories || 0} categories on ShopVault.`}
            </p>
            <Link to="/" className="btn btn-outline btn-sm">Continue Shopping</Link>
          </div>

          <div className="vendor-story-card card">
            <span className="toolbar-label">Store Snapshot</span>
            <ul className="vendor-facts">
              <li>{stats?.totalCategories || 0} categories represented</li>
              <li>{stats?.sellerReviewCount || 0} seller reviews collected</li>
              <li>{products.filter((product) => product.discount > 0).length} products currently on sale</li>
            </ul>
          </div>
        </section>

        <section className="vendor-reviews-section">
          <div className="products-header">
            <div>
              <h2 className="products-title">Seller Reviews</h2>
              <p className="products-subtitle">Feedback about this storefront, service quality, and delivery experience.</p>
            </div>
            <span className="products-count">{stats?.sellerReviewCount || 0} reviews</span>
          </div>

          <div className="vendor-review-summary card">
            <div className="vendor-review-score">
              <strong>{stats?.sellerAverageRating || 0}</strong>
              <StarRating rating={Math.round(Number(stats?.sellerAverageRating || 0))} />
              <span>Based on {stats?.sellerReviewCount || 0} seller review{Number(stats?.sellerReviewCount || 0) === 1 ? '' : 's'}</span>
            </div>
            <div className="vendor-review-highlights">
              <div><strong>{stats?.totalProducts || 0}</strong><span>Active products</span></div>
              <div><strong>{stats?.totalCategories || 0}</strong><span>Categories</span></div>
              <div><strong>{products.filter((product) => product.discount > 0).length}</strong><span>Products on sale</span></div>
            </div>
          </div>

          {user?.role === 'customer' && (
            <form onSubmit={handleVendorReviewSubmit} className="vendor-review-form card">
              <h3>{editingReviewId ? 'Edit Your Seller Review' : 'Rate This Seller'}</h3>
              {!canReviewVendor && (
                <div className="vendor-review-banner">
                  You can review this seller after one of your orders from this storefront is delivered.
                </div>
              )}
              {canReviewVendor && (
                <div className="vendor-review-banner success">
                  Verified buyer. Your seller review will represent a delivered order from this storefront.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Rating</label>
                <StarRating rating={review.rating} interactive onRate={(rating) => setReview({ ...review, rating })} />
              </div>
              <div className="form-group">
                <label className="form-label">Comment</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={review.comment}
                  onChange={(event) => setReview({ ...review, comment: event.target.value })}
                  placeholder="How was the seller experience, packaging, communication, and delivery?"
                />
              </div>
              <div className="action-btns">
                <button type="submit" className="btn btn-primary" disabled={reviewLoading || !canReviewVendor}>
                  {reviewLoading ? 'Saving...' : editingReviewId ? 'Update Seller Review' : 'Submit Seller Review'}
                </button>
                {editingReviewId && (
                  <button type="button" className="btn btn-outline" onClick={() => setReview({ rating: myVendorReview.rating, comment: myVendorReview.comment || '' })}>
                    Reset
                  </button>
                )}
              </div>
            </form>
          )}

          {vendorReviews.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">V</div>
              <h3>No seller reviews yet</h3>
              <p>Customers can rate this storefront after a delivered order.</p>
            </div>
          ) : (
            <div className="vendor-review-list">
              {vendorReviews.map((item) => {
                const isOwnReview = item.user_id === user?.id;
                return (
                  <div key={item.id} className="vendor-review-card card">
                    <div className="vendor-review-card-head">
                      <div>
                        <div className="reviewer-name-row">
                          <strong>{item.reviewer?.name}</strong>
                          {item.verifiedPurchase && <span className="verified-badge">Verified buyer</span>}
                        </div>
                        <StarRating rating={item.rating} />
                      </div>
                      <span className="review-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                    {item.comment && <p>{item.comment}</p>}
                    {isOwnReview && (
                      <div className="action-btns">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setReview({ rating: item.rating, comment: item.comment || '' });
                            setEditingReviewId(item.id);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteVendorReview(item.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="products-header">
          <div>
            <h2 className="products-title">Store Products</h2>
            <p className="products-subtitle">Explore the full catalog from this vendor.</p>
          </div>
          <span className="products-count">{filteredProducts.length} items</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">S</div>
            <h3>No products match this storefront filter</h3>
            <p>Try a different search term or category.</p>
          </div>
        ) : (
          <div className="grid-products">
            {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorStorefront;
