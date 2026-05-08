import React from 'react';

const DashboardCards = ({ stats }) => {
  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: 'U', color: '#2563eb' },
    { label: 'Total Vendors', value: stats.totalVendors, icon: 'V', color: '#15803d' },
    { label: 'Total Orders', value: stats.totalOrders, icon: 'O', color: '#FF6B2B' },
    { label: 'Total Revenue', value: `Rs ${parseFloat(stats.totalRevenue || 0).toFixed(2)}`, icon: 'R', color: '#dc2626' },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div key={card.label} className="stat-card card">
          <div className="stat-icon" style={{ background: `${card.color}18`, color: card.color }}>{card.icon}</div>
          <div>
            <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
            <div className="stat-label-sm">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardCards;
