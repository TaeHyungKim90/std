import React from 'react';
import { Route } from 'react-router-dom';
import Login from '../views/common/LoginView';
import SignupView from '../views/common/SignupView';
const authRoutes = (
  <>
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<SignupView />} />
  </>
);

export default authRoutes;