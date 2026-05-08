import React from 'react';

const DemoLists = () => (
  <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
    <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>Advanced UL List Demos</h2>
    
    <h3>Glassmorphism List</h3>
    <ul className="list-advanced">
      <li><strong>Premium Electronics</strong> - Latest gadgets with warranty</li>
      <li><strong>Fashion Essentials</strong> - Curated seasonal collection</li>
      <li><strong>Home Decor</strong> - Artisan crafted pieces</li>
      <li className="active"><strong>Best Sellers</strong> - Top customer favorites</li>
    </ul>

    <h3>Compact List</h3>
    <ul className="list-compact">
      <li>Fast delivery available</li>
      <li>Easy returns</li>
      <li>Secure payments</li>
      <li>24/7 support</li>
    </ul>

    <h3>Grid List</h3>
    <ul className="list-grid">
      <li>Clothing</li>
      <li>Electronics</li>
      <li>Home</li>
      <li>Books</li>
      <li>Sports</li>
      <li>Beauty</li>
    </ul>

    <div style={{ marginTop: '3rem', padding: '1rem', background: var(--surface-2), borderRadius: 'var(--radius)', textAlign: 'center' }}>
      <p><strong>Usage:</strong> Add <code>className="list-advanced"</code> to any <ul> element</p>
      <p>Works with nested lists and responsive design out of the box!</p>
    </div>
  </div>
);

export default DemoLists;

