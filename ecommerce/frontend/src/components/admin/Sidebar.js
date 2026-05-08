import React from 'react';

const Sidebar = ({ items, activeKey, onSelect }) => (
  <aside className="admin-sidebar card">
    <div className="admin-sidebar-brand">
      <span className="admin-sidebar-eyebrow"><span />Admin Console</span>
      <h2>ShopVault</h2>
      <p>Monitor your marketplace operations from one control room.</p>
    </div>

    <nav className="admin-sidebar-nav">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`admin-sidebar-link ${activeKey === item.key ? 'active' : ''}`}
          onClick={() => onSelect(item.key)}
        >
          <span className="admin-sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  </aside>
);

export default Sidebar;
