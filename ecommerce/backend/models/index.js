const User = require('./User');
const UserSecurity = require('./UserSecurity');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const OrderTrackingEvent = require('./OrderTrackingEvent');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const Coupon = require('./Coupon');
const CouponRedemption = require('./CouponRedemption');
const VendorCampaign = require('./VendorCampaign');
const VendorReview = require('./VendorReview');
const VendorPayout = require('./VendorPayout');
const VendorPayoutOrder = require('./VendorPayoutOrder');

User.hasOne(UserSecurity, { foreignKey: 'user_id', as: 'security' });
UserSecurity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Product, { foreignKey: 'vendor_id', as: 'products' });
Product.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(OrderTrackingEvent, { foreignKey: 'order_id', as: 'trackingEvents' });
OrderTrackingEvent.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

User.hasMany(OrderItem, { foreignKey: 'vendor_id', as: 'vendorOrderItems' });
OrderItem.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendorUser' });

User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'reviewer' });

Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

User.hasMany(VendorReview, { foreignKey: 'user_id', as: 'vendorReviews' });
VendorReview.belongsTo(User, { foreignKey: 'user_id', as: 'reviewer' });

User.hasMany(VendorReview, { foreignKey: 'vendor_id', as: 'storefrontReviews' });
VendorReview.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Wishlist, { foreignKey: 'user_id', as: 'wishlistItems' });
Wishlist.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });

Product.hasMany(Wishlist, { foreignKey: 'product_id', as: 'wishlists' });
Wishlist.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Coupon.hasMany(CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' });
CouponRedemption.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });

User.hasMany(Coupon, { foreignKey: 'vendor_id', as: 'vendorCoupons' });
Coupon.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(CouponRedemption, { foreignKey: 'vendor_id', as: 'vendorCouponRedemptions' });
CouponRedemption.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

Order.hasOne(CouponRedemption, { foreignKey: 'order_id', as: 'couponRedemption' });
CouponRedemption.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

User.hasMany(CouponRedemption, { foreignKey: 'user_id', as: 'couponRedemptions' });
CouponRedemption.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });

User.hasMany(VendorCampaign, { foreignKey: 'vendor_id', as: 'campaigns' });
VendorCampaign.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

Product.hasMany(VendorCampaign, { foreignKey: 'target_product_id', as: 'campaignTargets' });
VendorCampaign.belongsTo(Product, { foreignKey: 'target_product_id', as: 'targetProduct' });

User.hasMany(VendorPayout, { foreignKey: 'vendor_id', as: 'payouts' });
VendorPayout.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendor' });

VendorPayout.hasMany(VendorPayoutOrder, { foreignKey: 'payout_id', as: 'payoutOrders' });
VendorPayoutOrder.belongsTo(VendorPayout, { foreignKey: 'payout_id', as: 'payout' });

Order.hasMany(VendorPayoutOrder, { foreignKey: 'order_id', as: 'payoutLinks' });
VendorPayoutOrder.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

User.hasMany(VendorPayoutOrder, { foreignKey: 'vendor_id', as: 'vendorPayoutOrders' });
VendorPayoutOrder.belongsTo(User, { foreignKey: 'vendor_id', as: 'vendorUser' });

module.exports = {
  User,
  UserSecurity,
  Product,
  Order,
  OrderItem,
  OrderTrackingEvent,
  Review,
  Wishlist,
  Coupon,
  CouponRedemption,
  VendorCampaign,
  VendorReview,
  VendorPayout,
  VendorPayoutOrder,
};
