import React, { useState } from 'react';

const VendorTable = ({ vendors, onApprove, onBlock }) => {
  const [selectedVendors, setSelectedVendors] = useState([]);

  const handleSelectVendor = (id) => {
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((vid) => vid !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    selectedVendors.forEach((id) => onApprove(id));
    setSelectedVendors([]);
  };

  const unapprovedVendors = vendors.filter((v) => !v.isApproved);

  return (
    <div className="products-table-wrap">
      {unapprovedVendors.length > 0 && (
        <div className="admin-alert-banner">
          <strong>{unapprovedVendors.length} vendor {unapprovedVendors.length === 1 ? 'request is' : 'requests are'} waiting for approval.</strong>
          <span>Approve vendors here so their dashboard changes from pending approval to approved access.</span>
        </div>
      )}
      {unapprovedVendors.length > 0 && (
        <div className="bulk-actions" style={{ marginBottom: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={handleBulkApprove}
            disabled={selectedVendors.length === 0}
          >
            Approve Selected ({selectedVendors.length})
          </button>
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {unapprovedVendors.length > 0 && <th>Select</th>}
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Approval</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => (
            <tr key={vendor.id}>
              {unapprovedVendors.length > 0 && !vendor.isApproved && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={() => handleSelectVendor(vendor.id)}
                  />
                </td>
              )}
              {unapprovedVendors.length > 0 && vendor.isApproved && <td></td>}
              <td>{vendor.name}</td>
              <td>{vendor.email}</td>
              <td>{vendor.phone || '-'}</td>
              <td><span className={`badge ${vendor.isApproved ? 'badge-delivered' : 'badge-pending'}`}>{vendor.isApproved ? 'Approved' : 'Pending'}</span></td>
              <td><span className={`badge ${vendor.isActive ? 'badge-active' : 'badge-inactive'}`}>{vendor.isActive ? 'Active' : 'Blocked'}</span></td>
              <td>{new Date(vendor.createdAt).toLocaleDateString()}</td>
              <td>
                <div className="action-btns">
                  {!vendor.isApproved && (
                    <button className="btn btn-primary btn-sm" onClick={() => onApprove(vendor.id)}>Approve</button>
                  )}
                  <button className={`btn btn-sm ${vendor.isActive ? 'btn-danger' : 'btn-outline'}`} onClick={() => onBlock(vendor.id)}>
                    {vendor.isActive ? 'Block' : 'Unblock'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VendorTable;
