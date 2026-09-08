import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js';

const PATH = API_ENDPOINTS.EMPLOYEES;

export const directoryApi = {
	/** GET /api/hr/directory */
	list: (params = {}) => client.get(PATH, { params }),

	/** GET /api/hr/directory/org */
	org: () => client.get(`${PATH}/org`),

	/** GET /api/hr/directory/departments */
	departments: () => client.get(`${PATH}/departments`),
};
