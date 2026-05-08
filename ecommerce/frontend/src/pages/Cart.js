import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { campaignAPI, couponAPI, orderAPI, paymentAPI } from '../services/api';
import { createAddressEntry, getAddressBook, MAX_SAVED_ADDRESSES, saveAddressBook } from '../utils/addressBook';
import { extractIndianPincode, getProductEstimatedDelivery } from '../utils/deliveryEstimate';
import './Cart.css';

const toMoney = (value) => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));

  return Number.isFinite(parsed) ? parsed : 0;
};
const Cart = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [campaignPricing, setCampaignPricing] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState('razorpay');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressLabel, setAddressLabel] = useState('');
  const [deliveryPincodeInput, setDeliveryPincodeInput] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  const campaignDiscountAmount = campaignPricing?.discountAmount || 0;
  const couponDiscountAmount = appliedCoupon?.discountAmount || 0;
  const discountAmount = campaignDiscountAmount + couponDiscountAmount;
  const finalTotal = useMemo(() => Math.max(cartTotal - discountAmount, 0), [cartTotal, discountAmount]);
  const activeDeliveryPincode = deliveryPincode || extractIndianPincode(address);
  const checkoutEstimate = useMemo(() => {
    const hasOutOfStock = cart.some((item) => Number(item.stock || 0) <= 0);
    const hasVariants = cart.some((item) => item.variant_id);
    return getProductEstimatedDelivery({
      inStock: !hasOutOfStock,
      hasVariants,
      pincode: activeDeliveryPincode,
      subtotal: cartTotal,
    });
  }, [activeDeliveryPincode, cart, cartTotal]);
  const serviceabilityTone = !checkoutEstimate.serviceability.isValid && !checkoutEstimate.serviceability.pincode
    ? 'neutral'
    : checkoutEstimate.serviceability.isServiceable
      ? 'positive'
      : 'negative';

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cart.length, cartTotal]);

  useEffect(() => {
    let cancelled = false;

    if (!cart.length) {
      setCampaignPricing(null);
      return undefined;
    }

    campaignAPI.preview(cart)
      .then((response) => {
        if (!cancelled) {
          setCampaignPricing(response.data.pricing || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaignPricing(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cart]);

  useEffect(() => {
    if (!user?.id) {
      setSavedAddresses([]);
      return;
    }

    const addressBook = getAddressBook(user);
    setSavedAddresses(addressBook);

    if (!address.trim() && addressBook[0]?.value) {
      setAddress(addressBook[0].value);
    }
  }, [user?.id, user?.address]);

  useEffect(() => {
    if (!user?.id) return;
    saveAddressBook(user.id, savedAddresses);
  }, [savedAddresses, user?.id]);

  useEffect(() => {
    const savedPincode = window.localStorage.getItem('shopvault_delivery_pincode') || '';
    setDeliveryPincode(savedPincode);
    setDeliveryPincodeInput(savedPincode);
  }, []);

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Enter a coupon code');
      return;
    }

    setCouponLoading(true);
    try {
      const response = await couponAPI.validate(couponCode, cartTotal, cart);
      setAppliedCoupon({
        ...response.data.coupon,
        discountAmount: response.data.discountAmount,
        finalTotal: response.data.finalTotal,
        eligibleSubtotal: response.data.eligibleSubtotal,
        scopeLabel: response.data.scopeLabel,
      });
      if (response.data.campaignPricing) {
        setCampaignPricing(response.data.campaignPricing);
      }
      setCouponCode(response.data.coupon.code);
      addNotification({
        title: 'Coupon applied',
        message: `${response.data.coupon.code} saved you Rs ${Number(response.data.discountAmount || 0).toFixed(2)} on this cart.`,
        link: '/cart',
        tone: 'success',
      });
      toast.success(`Coupon ${response.data.coupon.code} applied`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply coupon');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    if (appliedCoupon?.code) {
      addNotification({
        title: 'Coupon removed',
        message: `${appliedCoupon.code} was removed from your cart.`,
        link: '/cart',
        tone: 'info',
      });
    }
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  const handleSaveAddress = () => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      toast.error('Enter an address before saving it');
      return;
    }

    if (savedAddresses.some((item) => item.value === trimmedAddress)) {
      toast.info('This address is already saved');
      return;
    }

    const nextCustomAddressCount = savedAddresses.filter((item) => item.source !== 'profile').length;
    if (nextCustomAddressCount >= MAX_SAVED_ADDRESSES) {
      toast.info(`You can keep up to ${MAX_SAVED_ADDRESSES} saved addresses`);
      return;
    }

    const newAddress = createAddressEntry({
      label: addressLabel,
      value: trimmedAddress,
      source: 'saved',
    }, nextCustomAddressCount);

    setSavedAddresses((current) => [newAddress, ...current]);
    setAddressLabel('');
    addNotification({
      title: 'Address saved',
      message: 'You can now reuse this shipping address at checkout.',
      link: '/cart',
      tone: 'success',
    });
    toast.success('Address saved');
  };

  const handleSelectAddress = (value) => {
    setAddress(value);
    const extractedPincode = extractIndianPincode(value);
    if (extractedPincode) {
      setDeliveryPincode(extractedPincode);
      setDeliveryPincodeInput(extractedPincode);
      window.localStorage.setItem('shopvault_delivery_pincode', extractedPincode);
    }
    addNotification({
      title: 'Address selected',
      message: 'A saved address was loaded into checkout.',
      link: '/cart',
      tone: 'info',
    });
  };

  const handleDeleteAddress = (addressId) => {
    setSavedAddresses((current) => current.filter((item) => item.id !== addressId));
    addNotification({
      title: 'Saved address removed',
      message: 'The address has been removed from your saved list.',
      link: '/cart',
      tone: 'warning',
    });
    toast.info('Saved address removed');
  };

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

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      toast.error('Please enter a shipping address');
      return;
    }

    setPlacing(true);
    try {
      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        variant_id: item.variant_id || undefined,
      }));
      const orderRes = await orderAPI.create({
        items,
        shipping_address: address,
        notes,
        coupon_code: appliedCoupon?.code,
      });
      const order = orderRes.data.order;
      addNotification({
        title: `Order #${order.id} placed`,
        message: 'Your order has been created and is waiting for payment confirmation.',
        link: '/orders',
        tone: 'info',
      });

      if (checkoutMethod === 'cod') {
        clearCart();
        setAppliedCoupon(null);
        setCouponCode('');
        addNotification({
          title: `Cash on Delivery selected for order #${order.id}`,
          message: 'Your order is confirmed for cash on delivery. Keep the amount ready at delivery time.',
          link: '/orders',
          tone: 'success',
        });
        toast.success('Order placed with Cash on Delivery');
        navigate('/orders');
        return;
      }

      if (checkoutMethod === 'demo') {
        await paymentAPI.completeDemoPayment(order.id);
        clearCart();
        setAppliedCoupon(null);
        setCouponCode('');
        addNotification({
          title: `Demo payment completed for order #${order.id}`,
          message: 'Your order was confirmed using the demo checkout flow.',
          link: '/orders',
          tone: 'success',
        });
        toast.success('Demo payment successful! Order confirmed');
        navigate('/orders');
        return;
      }

      const rpRes = await paymentAPI.createRazorpayOrder(order.id);
      const { razorpayOrder, key } = rpRes.data;

      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Payment SDK failed to load');
        return;
      }

      const options = {
        key,
        amount: razorpayOrder.amount,
        currency: 'INR',
        name: 'ShopVault',
        description: `Order #${order.id}`,
        order_id: razorpayOrder.id,
        handler: async (response) => {
          try {
            await paymentAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: order.id,
            });
            clearCart();
            setAppliedCoupon(null);
            setCouponCode('');
            addNotification({
              title: `Payment received for order #${order.id}`,
              message: 'Your payment went through successfully. We will keep you posted on the order status.',
              link: '/orders',
              tone: 'success',
            });
            toast.success('Payment successful! Order confirmed');
            navigate('/orders');
          } catch {
            toast.error('Payment verification failed');
          }
        },
        prefill: { name: user.name, email: user.email },
        theme: { color: '#0a0a0f' },
        modal: {
          ondismiss: () => {
            addNotification({
              title: `Payment pending for order #${order.id}`,
              message: 'Your order is saved as pending. You can complete payment later.',
              link: '/orders',
              tone: 'warning',
            });
            toast.info('Payment cancelled. Your order is saved as pending.');
            navigate('/orders');
          },
        },
      };

      clearCart();
      new window.Razorpay(options).open();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container page-content">
        <div className="empty-state">
          <div className="empty-state-icon">P</div>
          <h3>Your cart is empty</h3>
          <p>Add some products to get started</p>
          <Link to="/" className="btn btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <div className="checkout-page-head">
        <div>
          <span className="checkout-eyebrow">Secure checkout</span>
          <h1 className="page-title">Payment and Delivery</h1>
          <p className="checkout-page-subtitle">
            Review your order, choose a payment method, and confirm delivery details in one place.
          </p>
        </div>
        <div className="checkout-trust-strip">
          <span>256-bit secure payments</span>
          <span>Fast refund support</span>
          <span>Live delivery updates</span>
        </div>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          <div className="checkout-stage-card card">
            <div className="checkout-stage-top">
              <div>
                <span className="checkout-stage-step">Step 1</span>
                <h2>Bag review</h2>
              </div>
              <span className="checkout-stage-meta">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
            </div>
            <p>Double-check quantities and selected variants before you continue to payment.</p>
          </div>

          {cart.map((item) => (
            <div key={item.cartItemId} className="cart-item card">
              <div className="cart-item-image">
                {item.image ? <img src={item.image} alt={item.name} /> : <div className="cart-item-img-placeholder">P</div>}
              </div>
              <div className="cart-item-info">
                <Link to={`/products/${item.id}`} className="cart-item-name">{item.name}</Link>
                <p className="cart-item-vendor">by {item.vendor?.name || 'Vendor'}</p>
                {item.variant_label && <p className="cart-item-variant">{item.variant_label}</p>}
                <p className="cart-item-price">Rs {toMoney(item.price).toFixed(2)}</p>
              </div>
              <div className="cart-item-controls">
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}>-</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}>+</button>
                </div>
                <p className="cart-item-subtotal">Rs {(toMoney(item.price) * item.quantity).toFixed(2)}</p>
                <button className="btn btn-ghost btn-sm remove-btn" onClick={() => removeFromCart(item.cartItemId)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary card card-elevated">
          <div className="checkout-summary-hero">
            <div>
              <span className="checkout-stage-step">Step 2</span>
              <h2 className="summary-title">Complete payment</h2>
              <p>Everything you need for a confident checkout is shown below.</p>
            </div>
            <div className="checkout-total-pill">
              <small>Payable now</small>
              <strong>Rs {finalTotal.toFixed(2)}</strong>
            </div>
          </div>

          <div className="checkout-benefits-strip" aria-label="Checkout highlights">
            <div className="checkout-benefit-chip">
              <strong>Trusted checkout</strong>
              <span>Encrypted payments and seller-backed support</span>
            </div>
            <div className="checkout-benefit-chip">
              <strong>Fast dispatch</strong>
              <span>{checkoutEstimate.shipping.label}</span>
            </div>
            <div className="checkout-benefit-chip">
              <strong>Easy returns</strong>
              <span>Track, manage, and review orders from your account</span>
            </div>
          </div>

          <div className="checkout-overview-grid">
            <div className="checkout-overview-card">
              <span>Items total</span>
              <strong>Rs {cartTotal.toFixed(2)}</strong>
            </div>
            <div className="checkout-overview-card">
              <span>Shipping</span>
              <strong>{checkoutEstimate.shipping.shippingFee === 0 ? 'Free' : `Rs ${checkoutEstimate.shipping.shippingFee.toFixed(2)}`}</strong>
            </div>
            <div className="checkout-overview-card">
              <span>Discount</span>
              <strong>{discountAmount > 0 ? `- Rs ${discountAmount.toFixed(2)}` : 'No savings yet'}</strong>
            </div>
          </div>

          <div className="summary-section">
            <div className="summary-section-head">
              <h3>Order breakdown</h3>
              <span>{cart.length} line item{cart.length > 1 ? 's' : ''}</span>
            </div>
            <div className="summary-rows">
              {cart.map((item) => (
                <div key={item.cartItemId} className="summary-row">
                  <span>{item.name}{item.variant_label ? ` (${item.variant_label})` : ''} x {item.quantity}</span>
                  <span>Rs {(toMoney(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="coupon-box">
            <div className="summary-section-head">
              <h3>Offers and coupons</h3>
              <span>Apply savings before payment</span>
            </div>
            <div className="coupon-row">
              <input
                className="form-input"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="SAVE10"
              />
              <button className="btn btn-outline" onClick={handleApplyCoupon} disabled={couponLoading}>
                {couponLoading ? 'Applying...' : 'Apply'}
              </button>
            </div>
            {!appliedCoupon && (
              <div className="coupon-hint">
                Store campaigns are auto-applied. Add a coupon here for extra savings when available.
              </div>
            )}
            {campaignPricing?.appliedCampaigns?.length > 0 && (
              <div className="coupon-applied">
                <div>
                  <strong>Auto-applied campaign savings</strong>
                  <span>Saved Rs {campaignDiscountAmount.toFixed(2)} across {campaignPricing.appliedCampaigns.length} active campaign{campaignPricing.appliedCampaigns.length > 1 ? 's' : ''}.</span>
                  <span>{campaignPricing.appliedCampaigns.map((campaign) => campaign.name).join(' · ')}</span>
                </div>
              </div>
            )}
            {appliedCoupon && (
              <div className="coupon-applied">
                <div>
                  <strong>{appliedCoupon.code}</strong>
                  {appliedCoupon.description && <span>{appliedCoupon.description}</span>}
                  {appliedCoupon.scopeLabel && <span>{appliedCoupon.scopeLabel}</span>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleRemoveCoupon}>Remove</button>
              </div>
            )}
          </div>

          <div className="payment-panel">
            <div className="summary-section-head">
              <h3>Delivery promise</h3>
              <span>Based on your current cart and pincode</span>
            </div>
            <div className="checkout-estimate-card">
              <strong>{checkoutEstimate.label}</strong>
              <span>{checkoutEstimate.detail}</span>
              <div className="checkout-delivery-meta">
                <div className={`checkout-serviceability ${serviceabilityTone}`}>
                  <strong>{checkoutEstimate.serviceability.label}</strong>
                  <span>{checkoutEstimate.serviceability.detail}</span>
                </div>
                <div className="checkout-shipping-note">
                  <strong>{checkoutEstimate.shipping.label}</strong>
                  <span>{checkoutEstimate.shipping.detail}</span>
                </div>
                <div className="checkout-pincode-row">
                  <input
                    className="form-input"
                    value={deliveryPincodeInput}
                    onChange={(event) => setDeliveryPincodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Check pincode"
                    inputMode="numeric"
                  />
                  <button type="button" className="btn btn-outline" onClick={handleDeliveryCheck}>
                    Check
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="payment-panel">
            <div className="summary-section-head">
              <h3>Choose payment method</h3>
              <span>Secure and flexible options</span>
            </div>
            <div className="checkout-method-grid">
              <button
                type="button"
                className={`checkout-method-card ${checkoutMethod === 'razorpay' ? 'active' : ''}`}
                onClick={() => setCheckoutMethod('razorpay')}
              >
                <div className="checkout-method-top">
                  <span className="checkout-method-badge">Recommended</span>
                  <span className="checkout-method-check">{checkoutMethod === 'razorpay' ? 'Selected' : 'Select'}</span>
                </div>
                <div className="checkout-method-brand-row">
                  <span className="checkout-method-icon online">R</span>
                  <div className="checkout-method-brand-copy">
                    <strong>Razorpay</strong>
                    <small>Cards, UPI, wallets, and net banking</small>
                  </div>
                </div>
                <span>Pay instantly with cards, UPI, wallets, and net banking through a secure hosted checkout.</span>
                <div className="checkout-method-tags">
                  <span>UPI</span>
                  <span>Visa</span>
                  <span>Wallets</span>
                </div>
              </button>
              <button
                type="button"
                className={`checkout-method-card ${checkoutMethod === 'cod' ? 'active' : ''}`}
                onClick={() => setCheckoutMethod('cod')}
              >
                <div className="checkout-method-top">
                  <span className="checkout-method-badge neutral">Flexible</span>
                  <span className="checkout-method-check">{checkoutMethod === 'cod' ? 'Selected' : 'Select'}</span>
                </div>
                <div className="checkout-method-brand-row">
                  <span className="checkout-method-icon cod">C</span>
                  <div className="checkout-method-brand-copy">
                    <strong>Cash on Delivery</strong>
                    <small>Pay when the parcel arrives</small>
                  </div>
                </div>
                <span>Confirm your order now and pay when the shipment reaches your doorstep.</span>
                <div className="checkout-method-tags">
                  <span>Cash</span>
                  <span>Doorstep</span>
                  <span>Flexible</span>
                </div>
              </button>
              <button
                type="button"
                className={`checkout-method-card ${checkoutMethod === 'demo' ? 'active' : ''}`}
                onClick={() => setCheckoutMethod('demo')}
              >
                <div className="checkout-method-top">
                  <span className="checkout-method-badge muted">Testing</span>
                  <span className="checkout-method-check">{checkoutMethod === 'demo' ? 'Selected' : 'Select'}</span>
                </div>
                <div className="checkout-method-brand-row">
                  <span className="checkout-method-icon demo">D</span>
                  <div className="checkout-method-brand-copy">
                    <strong>Demo Payment</strong>
                    <small>Local development and QA flow</small>
                  </div>
                </div>
                <span>Use the local testing flow to confirm checkout without opening the Razorpay modal.</span>
                <div className="checkout-method-tags">
                  <span>Local</span>
                  <span>Instant</span>
                  <span>Testing</span>
                </div>
              </button>
            </div>
          </div>

          <div className="payment-panel">
            <div className="summary-section-head">
              <h3>Shipping address</h3>
              <span>This is where we will deliver your order</span>
            </div>
            <div className="summary-address">
              <div className="summary-address-header">
                <label className="form-label">Shipping Address *</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleSaveAddress}>
                  Save Address
                </button>
              </div>

              <input
                className="form-input"
                value={addressLabel}
                onChange={(event) => setAddressLabel(event.target.value)}
                placeholder="Label this address: Home, Office, Parents..."
              />

              {savedAddresses.length > 0 && (
                <div className="saved-addresses">
                  {savedAddresses.map((savedAddress) => (
                    <div key={savedAddress.id} className={`saved-address-card ${address.trim() === savedAddress.value ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="saved-address-main"
                        onClick={() => handleSelectAddress(savedAddress.value)}
                      >
                        <strong>{savedAddress.label}</strong>
                        <span>{savedAddress.value}</span>
                      </button>
                      {savedAddress.source !== 'profile' && (
                        <button
                          type="button"
                          className="saved-address-remove"
                          onClick={() => handleDeleteAddress(savedAddress.id)}
                          aria-label="Remove saved address"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <textarea
                className="form-input"
                rows="3"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Enter your full shipping address..."
              />
            </div>
          </div>

          <div className="payment-panel">
            <div className="summary-section-head">
              <h3>Order notes</h3>
              <span>Optional instructions for delivery</span>
            </div>
            <div className="summary-notes">
              <input className="form-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Special instructions..." />
            </div>
          </div>

          <div className="summary-divider" />
          <div className="summary-row summary-breakdown">
            <span>Subtotal</span>
            <span>Rs {cartTotal.toFixed(2)}</span>
          </div>
          <div className="summary-row summary-breakdown">
            <span>Estimated shipping</span>
            <span>{checkoutEstimate.shipping.shippingFee === 0 ? 'Free' : `Rs ${checkoutEstimate.shipping.shippingFee.toFixed(2)}`}</span>
          </div>
          {campaignDiscountAmount > 0 && (
            <div className="summary-row summary-discount">
              <span>Campaign savings</span>
              <span>- Rs {campaignDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {appliedCoupon && (
            <div className="summary-row summary-discount">
              <span>Discount ({appliedCoupon.code})</span>
              <span>- Rs {couponDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span className="summary-total-price">Rs {finalTotal.toFixed(2)}</span>
          </div>

          <div className="checkout-assurance-card">
            <div className="checkout-assurance-copy">
              <strong>
                {checkoutMethod === 'razorpay'
                  ? 'Preferred online checkout selected'
                  : checkoutMethod === 'cod'
                    ? 'Doorstep payment selected'
                    : 'Demo mode selected'}
              </strong>
              <span>
                {checkoutMethod === 'razorpay'
                  ? 'Use a secure hosted payment flow with multiple payment options and quick confirmation.'
                  : checkoutMethod === 'cod'
                    ? 'Your items will be reserved and payment will be collected when delivery is completed.'
                    : 'This flow is intended for local testing, previews, and QA without a real payment handoff.'}
              </span>
            </div>
            <div className="checkout-assurance-points">
              <span>No hidden fees</span>
              <span>Order tracking after confirmation</span>
            </div>
          </div>

          <div className="checkout-submit-shell">
            <div className="checkout-submit-copy">
              <strong>
                {checkoutMethod === 'razorpay'
                  ? 'Secure online payment'
                  : checkoutMethod === 'cod'
                    ? 'Pay at your doorstep'
                    : 'Testing checkout flow'}
              </strong>
              <span>
                {checkoutMethod === 'razorpay'
                  ? 'You will be redirected to Razorpay to complete payment securely.'
                  : checkoutMethod === 'cod'
                    ? 'Your order will be placed now and collected at delivery.'
                    : 'This confirms the order instantly for local development and demos.'}
              </span>
            </div>
            <button className="btn btn-accent btn-full btn-lg checkout-submit-btn" onClick={handlePlaceOrder} disabled={placing}>
              {placing
                ? 'Placing order...'
                : checkoutMethod === 'cod'
                  ? `Place COD Order - Rs ${finalTotal.toFixed(2)}`
                  : checkoutMethod === 'demo'
                    ? `Demo Pay Rs ${finalTotal.toFixed(2)}`
                    : `Pay Rs ${finalTotal.toFixed(2)}`}
            </button>
          </div>

          <div className="checkout-footer-notes">
            <p className="secure-note">
              {checkoutMethod === 'razorpay'
                ? 'Secure payment via Razorpay'
                : checkoutMethod === 'cod'
                  ? 'No online payment required for this order'
                  : 'Instant demo checkout for local testing'}
            </p>
            <p className="secure-note">
              Shipping is shown as an estimate for delivery planning. Final courier allocation may vary slightly after seller confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
