// src/api/messageApi.js
import { DEFAULT_PAGE_SIZE } from 'constants/apiConfig';
import { API_ENDPOINTS } from 'constants/constants';

import { client } from './axiosInstance.js'; 

const PATH = API_ENDPOINTS.MESSAGES;

export const messageApi = {
	// 메시지 발송 (급여명세서, 공지사항 등)
	sendMessage: (messageData) => 
		client.post(`${PATH}/`, messageData),

	// 내 수신함 조회 (페이징: skip, limit)
	getInbox: (params = {}) =>
		client.get(`${PATH}/inbox`, {
			params: { ...params, skip: params.skip ?? 0, limit: params.limit ?? DEFAULT_PAGE_SIZE },
		}),

	// 내 발신함 조회 (페이징)
	getOutbox: (params = {}) =>
		client.get(`${PATH}/outbox`, {
			params: { ...params, skip: params.skip ?? 0, limit: params.limit ?? DEFAULT_PAGE_SIZE },
		}),

	// 메시지 읽음 처리
	markAsRead: (messageId) => 
		client.put(`${PATH}/${messageId}/read`),
	
	// 메시지 삭제
	deleteMessage: (messageId) => 
		client.delete(`${PATH}/${messageId}`)
};