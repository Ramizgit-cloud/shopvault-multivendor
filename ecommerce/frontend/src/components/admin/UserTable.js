import React from 'react';

const getApprovalMeta = (user) => {
  if (user.role !== 'vendor') {
    return { label: 'Not required', className: 'badge-inactive' };
  }

  return user.isApproved
    ? { label: 'Approved', className: 'badge-delivered' }
    : { label: 'Pending approval', className: 'badge-pending' };
};

const UserTable = ({ users, onDelete, onBlock, onApprove }) => (
  <div className="products-table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Approval</th>
          <th>Account</th>
          <th>Risk</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => {
          const approval = getApprovalMeta(user);

          return (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td><span className={`badge badge-${user.role}`}>{user.role}</span></td>
              <td><span className={`badge ${approval.className}`}>{approval.label}</span></td>
              <td><span className={`badge ${user.isActive ? 'badge-active' : 'badge-inactive'}`}>{user.isActive ? 'Active' : 'Blocked'}</span></td>
              <td>
                <div className="table-risk-stack">
                  {!user.isActive && <span className="badge badge-critical">Blocked</span>}
                  {user.riskSignals?.map((signal) => (
                    <span key={signal.code} className={`badge badge-${signal.severity || 'warning'}`}>{signal.label}</span>
                  ))}
                  <div className="table-muted">
                    {user.orderStats?.totalOrders || 0} orders
                    {(user.orderStats?.cancelledOrders || user.orderStats?.refundedOrders)
                      ? ` · ${user.orderStats?.cancelledOrders || 0} cancelled · ${user.orderStats?.refundedOrders || 0} refunded`
                      : ''}
                  </div>
                </div>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td>
                <div className="action-btns">
                  {user.role === 'vendor' && !user.isApproved && (
                    <button className="btn btn-primary btn-sm" onClick={() => onApprove(user.id)}>
                      Approve
                    </button>
                  )}
                  <button className={`btn btn-sm ${user.isActive ? 'btn-danger' : 'btn-outline'}`} onClick={() => onBlock(user.id)}>
                    {user.isActive ? 'Block' : 'Unblock'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => onDelete(user.id)}>Delete</button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default UserTable;
