import { client } from './axiosInstance.js';
import { API_ENDPOINTS } from '../constants/constants';

const COMMON_PATH = API_ENDPOINTS.COMMON;
const ADMIN_PATH = API_ENDPOINTS.ADMIN_RECRUITMENT;
const PUBLIC_PATH = API_ENDPOINTS.PUBLIC_RECRUITMENT;

export const recruitmentApi = {
  // 1. 채용 공고 관리
  getJobPostings: () => client.get(`${ADMIN_PATH}/jobs`),
  createJobPosting: (payload) => client.post(`${ADMIN_PATH}/jobs`, payload),
  updateJobPosting: (jobId, payload) => client.put(`${ADMIN_PATH}/jobs/${jobId}`, payload),
  deleteJobPosting: (jobId) => client.delete(`${ADMIN_PATH}/jobs/${jobId}`),
  // 2. 지원서 및 전형 관리
  getApplicationsByJob: (jobId) => 
    client.get(`${ADMIN_PATH}/jobs/${jobId}/applications`),

  updateApplicationStatus: (applicationId, status) => 
    client.put(`${ADMIN_PATH}/applications/${applicationId}/status`, { status }),

  // 3. 면접 평가 관리
  createInterview: (applicationId, payload) => 
    client.post(`${ADMIN_PATH}/applications/${applicationId}/interviews`, payload),
// ==========================================
// 🌟 [Public] 일반 지원자용 API
// ==========================================
  getPublicJobs: () => client.get(`${PUBLIC_PATH}/jobs`),
  uploadFiles: (formData) => 
    client.post(`${COMMON_PATH}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  submitApplication: (payload) => 
    client.post(`${PUBLIC_PATH}/apply`, payload)
};