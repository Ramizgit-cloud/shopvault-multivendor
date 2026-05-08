import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, success: false, message: 'Verifying your email...' });

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setState({ loading: false, success: false, message: 'Verification token is missing.' });
      return;
    }

    authAPI.verifyEmail(token)
      .then((res) => {
        setState({ loading: false, success: true, message: res.data.message });
      })
      .catch((err) => {
        setState({
          loading: false,
          success: false,
          message: err.response?.data?.message || 'Email verification failed.',
        });
      });
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-card card card-elevated">
        <div className="auth-header">
          <h1 className="auth-title">Verify email</h1>
          <p className="auth-subtitle">{state.message}</p>
        </div>

        {!state.loading && (
          <div className="auth-form">
            <Link to="/login" className="btn btn-primary btn-full btn-lg">
              {state.success ? 'Go to login' : 'Back to login'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
