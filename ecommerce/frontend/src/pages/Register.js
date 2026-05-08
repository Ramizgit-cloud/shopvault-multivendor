import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';
import './Auth.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', phone: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!emailRegex.test(email)) { toast.error('Enter a valid email address'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await authAPI.register({ ...form, email });
      toast.success(res.data.message);
      navigate('/login', { state: { registeredEmail: email } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card card-elevated">
        <div className="auth-header">
          <span className="auth-logo">?</span>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Join ShopVault today</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" required />
          </div>
          <div className="form-group">
            <label className="form-label">I want to</label>
            <div className="role-selector">
              {[{ value: 'customer', label: 'Shop', desc: 'Buy products' }, { value: 'vendor', label: 'Sell', desc: 'List products' }].map((r) => (
                <label key={r.value} className={`role-option ${form.role === r.value ? 'selected' : ''}`}>
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handleChange} hidden />
                  <span className="role-label">{r.label}</span>
                  <span className="role-desc">{r.desc}</span>
                </label>
              ))}
            </div>
          </div>
          {form.role === 'vendor' && (
            <p className="vendor-note">Vendor accounts require admin approval before you can list products.</p>
          )}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
      </div>
    </div>
  );
};

export default Register;
