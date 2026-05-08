import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { wishlistAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { addNotification } = useNotifications();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshWishlist = async () => {
    if (user?.role !== 'customer') {
      setWishlistItems([]);
      return;
    }

    setLoading(true);
    try {
      const response = await wishlistAPI.getMyWishlist();
      setWishlistItems(response.data.products);
    } catch {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'customer') {
      refreshWishlist();
    } else {
      setWishlistItems([]);
    }
  }, [authLoading, user?.id, user?.role]);

  const addToWishlist = async (product) => {
    if (user?.role !== 'customer') {
      toast.info('Only customers can save wishlist items');
      return false;
    }

    try {
      const response = await wishlistAPI.add(product.id);
      setWishlistItems((current) => {
        if (current.some((item) => item.id === product.id)) return current;
        return [{ ...response.data.product, wishlistItemId: response.data.wishlistItemId }, ...current];
      });
      addNotification({
        title: 'Saved to wishlist',
        message: `${product.name} is waiting in your wishlist.`,
        link: '/wishlist',
        tone: 'success',
      });
      toast.success('Saved to wishlist');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save wishlist item');
      return false;
    }
  };

  const removeFromWishlist = async (productId, silent = false) => {
    if (user?.role !== 'customer') return false;

    try {
      await wishlistAPI.remove(productId);
      const removedItem = wishlistItems.find((item) => item.id === productId);
      setWishlistItems((current) => current.filter((item) => item.id !== productId));
      if (removedItem) {
        addNotification({
          title: 'Wishlist updated',
          message: `${removedItem.name} was removed from your wishlist.`,
          link: '/wishlist',
          tone: 'info',
        });
      }
      if (!silent) toast.success('Removed from wishlist');
      return true;
    } catch (error) {
      if (!silent) toast.error(error.response?.data?.message || 'Failed to remove wishlist item');
      return false;
    }
  };

  const toggleWishlist = async (product) => {
    if (wishlistItems.some((item) => item.id === product.id)) {
      return removeFromWishlist(product.id);
    }
    return addToWishlist(product);
  };

  const wishlistIds = useMemo(() => new Set(wishlistItems.map((item) => item.id)), [wishlistItems]);

  return (
    <WishlistContext.Provider value={{
      wishlistItems,
      wishlistCount: wishlistItems.length,
      wishlistLoading: loading,
      refreshWishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      isWishlisted: (productId) => wishlistIds.has(productId),
    }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
};
