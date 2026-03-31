import { client } from './axiosInstance.js'; // api.js에서 만든 공통 client 임포트
import { API_ENDPOINTS } from 'constants/constants';
import { DEFAULT_PAGE_SIZE } from 'constants/apiConfig';

const ADMIN_PATH = API_ENDPOINTS.ADMIN_RECRUITMENT;
const PUBLIC_PATH = API_ENDPOINTS.PUBLIC_RECRUITMENT;

export const recruitmentApi = {
	// 1. 채용 공고 관리
	getJobPostings: (params = {}) =>
		client.get(`${ADMIN_PATH}/jobs`, {
			params: { ...params, skip: params.skip ?? 0, limit: params.limit ?? DEFAULT_PAGE_SIZE },
		}),
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
	getPublicJobs: (params = {}) =>
		client.get(`${PUBLIC_PATH}/jobs`, {
			params: { ...params, skip: params.skip ?? 0, limit: params.limit ?? DEFAULT_PAGE_SIZE },
		}),
	
	submitApplication: (payload) => client.post(`${PUBLIC_PATH}/apply/me`, payload),
	signupApplicant: (payload) => client.post(`${PUBLIC_PATH}/signup`, payload),
	loginApplicant: (payload) =>
		client.post(`${PUBLIC_PATH}/login`, payload, { skipGlobalErrorToast: true }),
	logoutApplicant: () => client.post(`${PUBLIC_PATH}/logout`),
	getApplicantMe: () => client.get(`${PUBLIC_PATH}/me`),
	updateApplicant: (applicantId, payload) => client.put(`${PUBLIC_PATH}/update/${applicantId}`, payload),
	getMyApplications: () => client.get(`${PUBLIC_PATH}/my-applications`),
	cancelApplication: (applicationId) => client.delete(`${PUBLIC_PATH}/my-applications/${applicationId}`),
};