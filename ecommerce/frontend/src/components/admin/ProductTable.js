import React from 'react';

const ProductTable = ({ products, onDelete }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Vendor</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td>
              <div className="product-cell">
                <div className="product-cell-img">{product.image ? <img src={product.image} alt={product.name} /> : 'P'}</div>
                <div>
                  <span>{product.name}</span>
                  {product.stockAlert && (
                    <div className="table-muted">
                      {product.stockAlert.message}
                    </div>
                  )}
                  {product.inventoryInsight && ['warning', 'critical'].includes(product.inventoryInsight.level) && (
                    <div className="table-muted">
                      Suggested restock: {product.inventoryInsight.suggested_restock_units} units
                    </div>
                  )}
                </div>
              </div>
            </td>
            <td>{product.vendor?.name}</td>
            <td>Rs {parseFloat(product.price).toFixed(2)}</td>
            <td>
              <div>{product.stock}</div>
              {product.stockAlert && (
                <span className={`badge badge-${product.stockAlert.level}`}>
                  {product.stockAlert.label}
                </span>
              )}
              {product.inventoryInsight && product.inventoryInsight.days_until_stockout !== null && (
                <div className="table-muted">
                  ~{Math.ceil(product.inventoryInsight.days_until_stockout)} day stock cover
                </div>
              )}
            </td>
            <td><span className={`badge ${product.isActive ? 'badge-active' : 'badge-inactive'}`}>{product.isActive ? 'Active' : 'Removed'}</span></td>
            <td><button className="btn btn-danger btn-sm" onClick={() => onDelete(product.id)}>Delete</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ProductTable;
