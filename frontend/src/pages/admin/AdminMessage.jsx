import React, { useState, useEffect, useCallback } from 'react';
import * as Notify from 'utils/toastUtils';
import { useLoading } from 'context/LoadingContext';
import { messageApi } from 'api/messageApi';
import MessageSendModal from 'components/admin/MessageSendModal';
import { formatDate } from 'utils/commonUtils';
import MessageReadModal from 'components/common/MessageReadModal';
import PaginationBar from 'components/common/PaginationBar';
import { usePaginationSearchParams } from 'hooks/usePaginationSearchParams';
const PAGE_SIZE = 10;

const AdminMessage = () => {
    const { showLoading, hideLoading } = useLoading();
    const [messages, setMessages] = useState([]);
    const [total, setTotal] = useState(null);
    const [page, setPage] = usePaginationSearchParams({ pageSize: PAGE_SIZE, total });
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isReadModalOpen, setIsReadModalOpen] = useState(false);

    const fetchOutbox = useCallback(async () => {
        const skip = (page - 1) * PAGE_SIZE;
        const response = await messageApi.getOutbox({ skip, limit: PAGE_SIZE });
        const d = response.data;
        setMessages(Array.isArray(d?.items) ? d.items : []);
        setTotal(typeof d?.total === 'number' ? d.total : 0);
    }, [page]);

    const refreshOutbox = () =>
        fetchOutbox().catch((error) => {
            console.error("발신함 불러오기 실패:", error);
            Notify.toastError("발신함을 불러오지 못했습니다.");
        });

    useEffect(() => {
        showLoading("발신함을 불러오는 중입니다... ⏳");
        fetchOutbox()
            .catch((error) => {
                console.error("발신함 불러오기 실패:", error);
                Notify.toastError(error.message || "발신함을 불러오지 못했습니다.");
            })
            .finally(() => hideLoading());
    }, [fetchOutbox, showLoading, hideLoading]);

    const handleReadMessage = (msg) => {
        setSelectedMessage(msg);
        setIsReadModalOpen(true);
    };
    
    return (
        <div className="bq-admin-view">
            <div className="admin-header">
                <div>
                    <h2>메시지 <span>관리</span></h2>
                    <p>직원들에게 보낸 알림톡과 전체 공지사항 발신함을 관리합니다.</p>
                </div>
                <button  className="btn-primary" onClick={() => setIsModalOpen(true)}>+ 새 메시지 발송</button>
            </div>
            <div className="admin-filter-section">
                <div className="admin-search-group">
                    <span>메시지 검색</span>
                    <input type="text" className="admin-search-input" placeholder="제목 또는 수신자로 검색" />
                </div>
            </div>
            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>유형</th>
                            <th>수신자</th>
                            <th>제목</th>
                            <th>발송일</th>
                            <th>상태</th>
                            <th>첨부파일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {messages.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>보낸 메시지가 없습니다.</td>
                            </tr>
                        ) : (
                            messages.map(msg => (
                                <tr key={msg.id}
                                    onClick={() => handleReadMessage(msg)} // 🌟 4. 클릭 이벤트 연결!
                                    style={{ cursor: 'pointer' }} // 🌟 5. 마우스 올리면 손가락 모양으로!
                                >
                                    <td>
                                        <span className={`role-badge ${msg.is_global ? 'admin' : 'user'}`}>
                                            {msg.is_global ? '📢 전체공지' : '👤 개별'}
                                        </span>
                                    </td>
                                    <td>{msg.is_global ? '전체' : msg.receiver?.user_name || '알 수 없음'}</td>
                                    <td>{msg.title}</td>
                                    <td>{formatDate(msg.created_at)}</td>
                                    <td>
                                        {msg.is_global ? '-' : (
                                            <span style={{ color: msg.is_read ? 'var(--primary)' : 'var(--accent)', fontWeight: 'bold' }}>
                                                {msg.is_read ? '읽음' : '안 읽음'}
                                            </span>
                                        )}
                                    </td>
                                    <td>{msg.attachments?.length > 0 ? '📎 있음' : '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationBar page={page} pageSize={PAGE_SIZE} total={total ?? 0} onPageChange={setPage} />

            <MessageSendModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={refreshOutbox} 
            />
            <MessageReadModal 
                isOpen={isReadModalOpen} 
                onClose={() => setIsReadModalOpen(false)} 
                message={selectedMessage} 
            />
        </div>
    );
};

export default AdminMessage;