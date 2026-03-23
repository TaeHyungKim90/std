import React from 'react';
import { Route } from 'react-router-dom';
import JobListView from '../pages/public/JobListView';
import JobDetailView from '../pages/public/JobDetailView';
import JobApplyView from '../pages/public/JobApplyView';
const authRoutes = (
  <>
  <Route path="/careers" element={<JobListView />} />
        <Route path="/careers/:jobId" element={<JobDetailView />} />
        <Route path="/careers/:jobId/apply" element={<JobApplyView />} />
  </>
);

export default authRoutes;