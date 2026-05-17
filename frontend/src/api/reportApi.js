import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js';

const HR = API_ENDPOINTS.HR_REPORTS;
const ADMIN = API_ENDPOINTS.ADMIN;

export const reportApi = {
	getDailyRange: (dateFrom, dateTo) =>
		client.get(`${HR}/daily`, { params: { date_from: dateFrom, date_to: dateTo } }),

	putDaily: (payload) => client.put(`${HR}/daily`, payload),

	getWeekly: (weekStart) => client.get(`${HR}/weekly`, { params: { week_start: weekStart } }),

	putWeekly: (payload) => client.put(`${HR}/weekly`, payload),

	getMonthly: (monthStart) => client.get(`${HR}/monthly`, { params: { month_start: monthStart } }),

	putMonthly: (payload) => client.put(`${HR}/monthly`, payload),

	getAdminDailyStatus: (workDate) =>
		client.get(`${ADMIN}/reports/daily-status`, { params: { work_date: workDate } }),

	getAdminWeekStatus: (weekStart) =>
		client.get(`${ADMIN}/reports/status`, { params: { week_start: weekStart } }),

	getAdminMonthStatus: (monthStart) =>
		client.get(`${ADMIN}/reports/monthly-status`, { params: { month_start: monthStart } }),

	getAdminUserBundle: (userLoginId, weekStart) =>
		client.get(`${ADMIN}/reports/users/${encodeURIComponent(userLoginId)}/bundle`, {
			params: { week_start: weekStart },
		}),
};
