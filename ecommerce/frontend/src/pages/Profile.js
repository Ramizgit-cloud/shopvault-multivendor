import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';
import { createAddressEntry, getAddressBook, MAX_SAVED_ADDRESSES, saveAddressBook } from '../utils/addressBook';
import ProfilePurchaseHistory from '../components/ProfilePurchaseHistory';
import './Profile.css';

const Profile = () => {
  const { user, login } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    billingName: user?.billingName || '',
    gstin: user?.gstin || '',
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressDraft, setAddressDraft] = useState({ label: '', value: '' });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    setSavedAddresses(getAddressBook(user));
  }, [user?.id, user?.address]);

  useEffect(() => {
    if (!user?.id) return;
    saveAddressBook(user.id, savedAddresses);
  }, [savedAddresses, user?.id]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(form);
      login(localStorage.getItem('token'), res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const handleSaveAddress = () => {
    const trimmedAddress = addressDraft.value.trim();
    if (!trimmedAddress) {
      toast.error('Enter an address before saving it');
      return;
    }

    if (savedAddresses.some((item) => item.value === trimmedAddress)) {
      toast.info('This address is already saved');
      return;
    }

    const customCount = savedAddresses.filter((item) => item.source !== 'profile').length;
    if (customCount >= MAX_SAVED_ADDRESSES) {
      toast.info(`You can keep up to ${MAX_SAVED_ADDRESSES} saved addresses`);
      return;
    }

    setSavedAddresses((current) => [createAddressEntry({
      label: addressDraft.label,
      value: trimmedAddress,
      source: 'saved',
    }, customCount), ...current]);
    setAddressDraft({ label: '', value: '' });
    toast.success('Address saved');
  };

  const handleUseAsPrimary = (entry) => {
    setForm((current) => ({ ...current, address: entry.value }));
    toast.info('Address copied to your primary address field');
  };

  const handleDeleteAddress = (addressId) => {
    setSavedAddresses((current) => current.filter((item) => item.id !== addressId));
    toast.info('Saved address removed');
  };

  return (
    <div className="container page-content">
      <h1 className="page-title">Profile</h1>
      <div className="profile-grid">
        <div className="profile-section card">
          <div className="profile-avatar-block">
            <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="profile-name">{user?.name}</div>
              <span className={`badge badge-${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <hr className="divider" style={{ margin: '20px 0' }} />
          <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={user?.email} disabled /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Primary Address</label><textarea className="form-input" rows="3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="profile-billing-grid">
              <div className="form-group">
                <label className="form-label">Billing Name</label>
                <input className="form-input" value={form.billingName} onChange={(e) => setForm({ ...form, billingName: e.target.value })} placeholder="Legal or company billing name" />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="Optional GST number for invoices" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>

        <div className="profile-section card">
          <div className="address-book-header">
            <div>
              <h2>Address Book</h2>
              <p>Save home, office, and other delivery addresses for faster checkout.</p>
            </div>
            <span className="address-book-count">{savedAddresses.length} saved</span>
          </div>

          <div className="address-book-draft">
            <div className="form-group">
              <label className="form-label">Label</label>
              <input
                className="form-input"
                value={addressDraft.label}
                onChange={(e) => setAddressDraft({ ...addressDraft, label: e.target.value })}
                placeholder="Home, Office, Parents..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-input"
                rows="3"
                value={addressDraft.value}
                onChange={(e) => setAddressDraft({ ...addressDraft, value: e.target.value })}
                placeholder="Enter a full delivery address"
              />
            </div>
            <button type="button" className="btn btn-outline" onClick={handleSaveAddress}>Save Address</button>
          </div>

          <div className="address-book-list">
            {savedAddresses.length === 0 ? (
              <div className="address-book-empty">No saved addresses yet.</div>
            ) : savedAddresses.map((entry) => (
              <div key={entry.id} className={`address-book-card ${form.address.trim() === entry.value ? 'active' : ''}`}>
                <div className="address-book-card-main">
                  <div className="address-book-card-top">
                    <strong>{entry.label}</strong>
                    {entry.source === 'profile' && <span className="address-book-badge">Primary</span>}
                  </div>
                  <p>{entry.value}</p>
                </div>
                <div className="address-book-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleUseAsPrimary(entry)}>
                    Use As Primary
                  </button>
                  {entry.source !== 'profile' && (
                    <button type="button" className="btn btn-ghost btn-sm address-remove-btn" onClick={() => handleDeleteAddress(entry.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-section card">
          <h2 style={{ marginBottom: 20 }}>Change Password</h2>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group"><label className="form-label">Current Password</label><input type="password" className="form-input" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-input" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" className="form-input" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required /></div>
            <button type="submit" className="btn btn-primary" disabled={changingPw}>{changingPw ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>

        {user?.role === 'customer' && <ProfilePurchaseHistory user={user} />}
      </div>
    </div>
  );
};

export default Profile;
