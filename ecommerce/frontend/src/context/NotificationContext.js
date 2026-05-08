import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);
const MAX_NOTIFICATIONS = 40;

const createNotificationId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getNotificationsKey = (userId) => `shopvault:notifications:${userId}`;
const getOrderStatusKey = (userId) => `shopvault:order-statuses:${userId}`;
const getVendorSnapshotKey = (userId) => `shopvault:vendor-snapshot:${userId}`;
const getVendorProductSnapshotKey = (userId) => `shopvault:vendor-product-snapshot:${userId}`;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const orderSnapshotRef = useRef({});
  const vendorProductSnapshotRef = useRef({});

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      orderSnapshotRef.current = {};
      return;
    }

    try {
      const storedNotifications = JSON.parse(localStorage.getItem(getNotificationsKey(user.id)) || '[]');
      const storedOrderSnapshots = JSON.parse(localStorage.getItem(getOrderStatusKey(user.id)) || '{}');
      const storedVendorProductSnapshots = JSON.parse(localStorage.getItem(getVendorProductSnapshotKey(user.id)) || '{}');
      setNotifications(Array.isArray(storedNotifications) ? storedNotifications : []);
      orderSnapshotRef.current = storedOrderSnapshots && typeof storedOrderSnapshots === 'object' ? storedOrderSnapshots : {};
      vendorProductSnapshotRef.current = storedVendorProductSnapshots && typeof storedVendorProductSnapshots === 'object'
        ? storedVendorProductSnapshots
        : {};
    } catch {
      setNotifications([]);
      orderSnapshotRef.current = {};
      vendorProductSnapshotRef.current = {};
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(getNotificationsKey(user.id), JSON.stringify(notifications));
  }, [notifications, user?.id]);

  useEffect(() => {
    if (!user?.id || user.role !== 'vendor') return;

    const snapshotKey = getVendorSnapshotKey(user.id);

    try {
      const previous = JSON.parse(localStorage.getItem(snapshotKey) || 'null');
      if (previous && !previous.isApproved && user.isApproved) {
        setNotifications((current) => {
          const exists = current.some((item) => item.kind === 'vendor_approved');
          if (exists) return current;
          return [{
            id: createNotificationId(),
            kind: 'vendor_approved',
            title: 'Vendor account approved',
            message: 'Your shop is now approved and ready to sell.',
            link: '/vendor',
            tone: 'success',
            read: false,
            createdAt: new Date().toISOString(),
          }, ...current].slice(0, MAX_NOTIFICATIONS);
        });
      }

      localStorage.setItem(snapshotKey, JSON.stringify({
        isApproved: !!user.isApproved,
        isActive: !!user.isActive,
      }));
    } catch {
      localStorage.setItem(snapshotKey, JSON.stringify({
        isApproved: !!user.isApproved,
        isActive: !!user.isActive,
      }));
    }
  }, [user]);

  const addNotification = useCallback(({ title, message, link = null, tone = 'info', kind = null }) => {
    if (!user?.id) return;

    setNotifications((current) => [{
      id: createNotificationId(),
      title,
      message,
      link,
      tone,
      kind,
      read: false,
      createdAt: new Date().toISOString(),
    }, ...current].slice(0, MAX_NOTIFICATIONS));
  }, [user?.id]);

  const markAsRead = (id) => {
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, read: true } : item
    )));
  };

  const markAllAsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const removeNotification = (id) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const syncOrderNotifications = useCallback((orders) => {
    if (!user?.id || user.role !== 'customer' || !Array.isArray(orders)) return;

    const nextSnapshot = {};

    setNotifications((current) => {
      let updated = current;

      orders.forEach((order) => {
        nextSnapshot[order.id] = order.status;
        const previousStatus = orderSnapshotRef.current?.[order.id];

        if (previousStatus && previousStatus !== order.status) {
          updated = [{
            id: createNotificationId(),
            kind: `order_status_${order.id}_${order.status}`,
            title: `Order #${order.id} updated`,
            message: `Your order is now ${order.status}.`,
            link: '/orders',
            tone: order.status === 'delivered' ? 'success' : 'info',
            read: false,
            createdAt: new Date().toISOString(),
          }, ...updated].slice(0, MAX_NOTIFICATIONS);
        }
      });

      return updated;
    });

    orderSnapshotRef.current = nextSnapshot;
    localStorage.setItem(getOrderStatusKey(user.id), JSON.stringify(nextSnapshot));
  }, [user?.id, user?.role]);

  const syncVendorNotifications = useCallback((products, lowStockThreshold = 10, reminders = []) => {
    if (!user?.id || user.role !== 'vendor' || !Array.isArray(products)) return;

    const nextSnapshot = {};

    setNotifications((current) => {
      let updated = current;
      const hasKind = (kind) => updated.some((item) => item.kind === kind);

      products.forEach((product) => {
        const stock = Number(product.stock || 0);
        nextSnapshot[product.id] = stock;
        const previousStock = Number(vendorProductSnapshotRef.current?.[product.id]);
        const hadPrevious = Number.isFinite(previousStock);

        if (!hadPrevious) return;

        const becameOutOfStock = previousStock > 0 && stock === 0;
        const crossedIntoLowStock = previousStock > lowStockThreshold && stock > 0 && stock <= lowStockThreshold;

        if (becameOutOfStock) {
          const kind = `inventory_out_${product.id}_${stock}`;
          if (hasKind(kind)) return;
          updated = [{
            id: createNotificationId(),
            kind,
            title: `${product.name} is out of stock`,
            message: 'This product can no longer be purchased until you restock it.',
            link: '/vendor',
            tone: 'warning',
            read: false,
            createdAt: new Date().toISOString(),
          }, ...updated].slice(0, MAX_NOTIFICATIONS);
          return;
        }

        if (crossedIntoLowStock) {
          const kind = `inventory_low_${product.id}_${stock}`;
          if (hasKind(kind)) return;
          updated = [{
            id: createNotificationId(),
            kind,
            title: `${product.name} is running low`,
            message: `Only ${stock} unit${stock === 1 ? '' : 's'} left in stock.`,
            link: '/vendor',
            tone: 'warning',
            read: false,
            createdAt: new Date().toISOString(),
          }, ...updated].slice(0, MAX_NOTIFICATIONS);
        }
      });

      reminders.forEach((reminder) => {
        const stock = Number(reminder.stock || 0);
        const suggestedUnits = Number(reminder.suggested_restock_units || 0);
        const kind = `inventory_restock_${reminder.product_id}_${stock}_${suggestedUnits}`;
        if (hasKind(kind)) return;

        updated = [{
          id: createNotificationId(),
          kind,
          title: reminder.reminder_title || `${reminder.product_name} needs attention`,
          message: reminder.reminder_message || `Suggested restock: ${suggestedUnits} units.`,
          link: '/vendor',
          tone: reminder.level === 'critical' ? 'warning' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        }, ...updated].slice(0, MAX_NOTIFICATIONS);
      });

      return updated;
    });

    vendorProductSnapshotRef.current = nextSnapshot;
    localStorage.setItem(getVendorProductSnapshotKey(user.id), JSON.stringify(nextSnapshot));
  }, [user?.id, user?.role]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0),
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearNotifications,
        syncOrderNotifications,
        syncVendorNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
