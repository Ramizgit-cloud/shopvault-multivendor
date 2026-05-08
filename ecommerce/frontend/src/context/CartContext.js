import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from './NotificationContext';

const CartContext = createContext(null);
const toNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));

  return Number.isFinite(parsed) ? parsed : fallback;
};

const toQuantity = (value) => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);

  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
};

const toStock = (value) => {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeCartItem = (item) => ({
  ...item,
  cartItemId: item?.cartItemId || `${item?.id}:${item?.variant_id || 'default'}`,
  image: item?.image || item?.variant_image || '',
  price: toNumber(item?.price, 0),
  stock: toStock(item?.stock),
  quantity: Math.min(toQuantity(item?.quantity), Math.max(toStock(item?.stock), 1)),
  variant_id: item?.variant_id || null,
  variant_label: item?.variant_label || '',
  variant_image: item?.variant_image || '',
});

export const CartProvider = ({ children }) => {
  const { addNotification } = useNotifications();
  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem('cart');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeCartItem) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity = 1, variant = null) => {
    const normalizedProduct = normalizeCartItem({
      ...product,
      quantity,
      cartItemId: `${product.id}:${variant?.id || 'default'}`,
      price: variant ? toNumber(product.price) + toNumber(variant.priceAdjustment) : product.price,
      stock: variant ? variant.stock : product.stock,
      variant_id: variant?.id || null,
      variant_label: variant?.label || '',
      variant_image: variant?.image || '',
      image: variant?.image || product.image || '',
    });
    const existing = cart.find((item) => item.cartItemId === normalizedProduct.cartItemId);
    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.cartItemId === normalizedProduct.cartItemId
            ? { ...item, quantity: Math.min(toQuantity(item.quantity) + toQuantity(quantity), Math.max(toStock(normalizedProduct.stock ?? item.stock), 1)) }
            : item
        );
      }
      return [...prev, normalizedProduct];
    });
    addNotification({
      title: existing ? 'Cart quantity updated' : 'Added to cart',
      message: existing
        ? `${product.name}${variant?.label ? ` (${variant.label})` : ''} quantity was updated in your cart.`
        : `${product.name}${variant?.label ? ` (${variant.label})` : ''} is ready in your cart.`,
      link: '/cart',
      tone: 'info',
    });
  };

  const removeFromCart = (cartItemId) => {
    const removedItem = cart.find((item) => item.cartItemId === cartItemId);
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
    if (removedItem) {
      addNotification({
        title: 'Removed from cart',
        message: `${removedItem.name} was removed from your cart.`,
        link: '/cart',
        tone: 'warning',
      });
    }
  };

  const updateQuantity = (cartItemId, quantity) => {
    if (quantity <= 0) return removeFromCart(cartItemId);
    setCart((prev) => prev.map((item) => (
      item.cartItemId === cartItemId
        ? { ...item, quantity: Math.min(toQuantity(quantity), Math.max(toStock(item.stock), 1)) }
        : item
    )));
  };

  const clearCart = (notify = false) => {
    if (notify) {
      addNotification({
        title: 'Cart cleared',
        message: 'Your cart has been cleared.',
        link: '/cart',
        tone: 'warning',
      });
    }
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + toNumber(item.price) * toQuantity(item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + toQuantity(item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
