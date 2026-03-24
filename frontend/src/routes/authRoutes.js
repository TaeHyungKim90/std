import React from 'react';
import { Route } from 'react-router-dom';
import LoginPage from 'pages/auth/LoginPage';
import SignupPage from 'pages/auth/SignupPage';
import OAuthCallback from 'pages/auth/OAuthCallback';

const authRoutes = (
  <>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  <Route path="/oauth/callback" element={<OAuthCallback />} />
  </>
);

export default authRoutes;