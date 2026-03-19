import { client } from '../utils/apiUtils';
import { API_ENDPOINTS } from '../utils/constants';

const PATH = API_ENDPOINTS.RECRUITMENT;

export const recruitmentService = {
  // 1. 채용 공고 관리
  getJobPostings: () => client.get(`${PATH}/jobs`),
  createJobPosting: (payload) => client.post(`${PATH}/jobs`, payload),
  updateJobPosting: (jobId, payload) => client.put(`${PATH}/jobs/${jobId}`, payload),
  deleteJobPosting: (jobId) => client.delete(`${PATH}/jobs/${jobId}`),
  // 2. 지원서 및 전형 관리
  getApplicationsByJob: (jobId) => 
    client.get(`${PATH}/jobs/${jobId}/applications`),

  updateApplicationStatus: (applicationId, status) => 
    client.put(`${PATH}/applications/${applicationId}/status`, { status }),

  // 3. 면접 평가 관리
  createInterview: (applicationId, payload) => 
    client.post(`${PATH}/applications/${applicationId}/interviews`, payload),
};