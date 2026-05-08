import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="spinner-wrapper"><div className="spinner" /></div>;

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'vendor') return <Navigate to="/vendor" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
