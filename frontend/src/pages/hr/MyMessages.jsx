import React, { useState, useEffect, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { messageApi } from 'api/messageApi';
import MessageReadModal from 'components/common/MessageReadModal';
import PaginationBar from 'components/common/PaginationBar';
import { formatDate } from 'utils/commonUtils';
import { usePaginationSearchParams } from 'hooks/usePaginationSearchParams';

import { DEFAULT_PAGE_SIZE } from 'constants/apiConfig';
const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const MyMessages = () => {
    const { showLoading, hideLoading } = useLoading();
    const [messages, setMessages] = useState([]);
    const [total, setTotal] = useState(null);
    const [page, setPage] = usePaginationSearchParams({ pageSize: PAGE_SIZE, total });
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchInbox = useCallback(async () => {
        const skip = (page - 1) * PAGE_SIZE;
        const response = await messageApi.getInbox({ skip, limit: PAGE_SIZE });
        const d = response.data;
        setMessages(Array.isArray(d?.items) ? d.items : []);
        setTotal(typeof d?.total === 'number' ? d.total : 0);
    }, [page]);

    useEffect(() => {
        showLoading("수신함을 불러오는 중입니다... ⏳");
        fetchInbox()
            .catch((error) => {
                console.error("수신함 불러오기 실패:", error);
                Notify.toastError(error.message || "수신함을 불러오지 못했습니다.");
            })
            .finally(() => hideLoading());
    }, [fetchInbox, showLoading, hideLoading]);

    // 🌟 메시지 클릭 시: 모달 띄우기 & '안 읽음'이면 '읽음'으로 처리
    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        setIsModalOpen(true);

        // 안 읽은 개인 메시지인 경우 읽음 처리 (전체 공지는 로직에 따라 다를 수 있음)
        if (!msg.is_read) {
            Notify.toastPromise(messageApi.markAsRead(msg.id), {
                loading: '읽음 상태를 반영하는 중입니다...',
                success: '읽음 상태가 반영되었습니다.',
                error: '읽음 처리에 실패했습니다.'
            }).then(() => {
                // 화면상에서도 즉시 '읽음'으로 상태 업데이트 (새로고침 없이)
                setMessages(prevMessages => 
                    prevMessages.map(m => m.id === msg.id ? { ...m, is_read: true } : m)
                );
            }).catch((error) => {
                console.error("읽음 처리 실패:", error);
            });
        }
    };

    return (
        <div className="bq-admin-view"> {/* 기존 예쁜 컨테이너 재활용 */}
            <div className="admin-header">
                <div>
                    <h2>내 수신함 <span>(메시지)</span></h2>
                    <p>회사에서 나에게 보낸 중요 메시지와 명세서를 확인하세요.</p>
                </div>
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>유형</th>
                            <th>제목</th>
                            <th>보낸사람</th>
                            <th>받은날짜</th>
                            <th>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        {messages.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="my-messages__empty-cell">
                                    도착한 메시지가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            messages.map((msg, index) => (
                                <tr 
                                    key={msg.id} 
                                    className={`stagger-item my-messages__row ${msg.is_read ? 'my-messages__row--read' : 'my-messages__row--unread'}`}
                                    onClick={() => handleReadMessage(msg)}
                                    style={{ animationDelay: `${index * 0.04}s` }}
                                >
                                    <td>
                                        <span className={`role-badge ${msg.is_global ? 'admin' : 'user'}`}>
                                            {msg.is_global ? '📢 공지' : '✉️ 개인'}
                                        </span>
                                    </td>
                                    {/* 안 읽은 메시지는 굵게 표시 */}
                                    <td className={msg.is_read ? 'my-messages__title--read' : 'my-messages__title--unread'}>
                                        {msg.title} {msg.attachments?.length > 0 && '📎'}
                                    </td>
                                    <td>{msg.sender?.user_name || '알 수 없음'}</td>
                                    <td className="my-messages__date">{formatDate(msg.created_at)}</td>
                                    <td>
                                        <span className={`my-messages__status ${msg.is_read ? 'my-messages__status--read' : 'my-messages__status--unread'}`}>
                                            {msg.is_read ? '읽음' : '새 메시지 🔴'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationBar page={page} pageSize={PAGE_SIZE} total={total ?? 0} onPageChange={setPage} />

            {/* 메시지 읽기 팝업 모달 */}
            <MessageReadModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                message={selectedMessage} 
            />
        </div>
    );
};

export default MyMessages;