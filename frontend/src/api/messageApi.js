// src/api/messageApi.js
import { client } from './axiosInstance.js'; 
import { API_ENDPOINTS } from 'constants/constants';

const PATH = API_ENDPOINTS.MESSAGES;

export const messageApi = {
	// 메시지 발송 (급여명세서, 공지사항 등)
	sendMessage: (messageData) => 
		client.post(`${PATH}`, messageData),

	// 내 수신함 조회
	getInbox: () => 
		client.get(`${PATH}/inbox`),

	// 내 발신함 조회 (관리자/HR용)
	getOutbox: () => 
		client.get(`${PATH}/outbox`),

	// 메시지 읽음 처리
	markAsRead: (messageId) => 
		client.put(`${PATH}/${messageId}/read`),
	
	// 메시지 삭제
	deleteMessage: (messageId) => 
		client.delete(`${PATH}/${messageId}`)
};