import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';
import './Auth.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({ email: location.state?.registeredEmail || '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setLoading(true);

    try {
      const res = await authAPI.login({ ...form, email });
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      const role = res.data.user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'vendor') navigate('/vendor');
      else navigate(from);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card card-elevated">
        <div className="auth-header">
          <span className="auth-logo">?</span>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your ShopVault account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-demo">
          <p className="demo-label">Demo accounts</p>
          <div className="demo-accounts">
            <button className="demo-btn" onClick={() => setForm({ email: 'ramizahamed959@gmail.com', password: 'Admin@123' })}>Admin</button>
            <button className="demo-btn" onClick={() => setForm({ email: 'vendor@shop.com', password: 'Vendor@123' })}>Vendor</button>
            <button className="demo-btn" onClick={() => setForm({ email: 'customer@shop.com', password: 'Customer@123' })}>Customer</button>
          </div>
        </div>

        <p className="auth-switch"><Link to="/forgot-password" className="auth-link">Forgot your password?</Link></p>
        <p className="auth-switch">Don't have an account? <Link to="/register" className="auth-link">Sign up</Link></p>
      </div>
    </div>
  );
};

export default Login;
