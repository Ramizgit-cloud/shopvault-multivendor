import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'recentlyViewedProducts';
const MAX_ITEMS = 8;

const RecentlyViewedContext = createContext(null);

export const RecentlyViewedProvider = ({ children }) => {
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  const trackProductView = (product) => {
    if (!product?.id) return;

    const snapshot = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      vendor: product.vendor,
      avgRating: product.avgRating,
      reviewCount: product.reviewCount,
      discount: product.discount,
      stock: product.stock,
    };

    setRecentlyViewed((current) => {
      const next = [snapshot, ...current.filter((item) => item.id !== snapshot.id)];
      return next.slice(0, MAX_ITEMS);
    });
  };

  const clearRecentlyViewed = () => setRecentlyViewed([]);

  return (
    <RecentlyViewedContext.Provider value={{ recentlyViewed, trackProductView, clearRecentlyViewed }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
};

export const useRecentlyViewed = () => {
  const context = useContext(RecentlyViewedContext);
  if (!context) throw new Error('useRecentlyViewed must be used within RecentlyViewedProvider');
  return context;
};
