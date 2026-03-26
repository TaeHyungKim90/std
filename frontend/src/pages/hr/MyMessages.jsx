import React, { useState, useEffect } from 'react';
import { messageApi } from 'api/messageApi';
import MessageReadModal from 'components/common/MessageReadModal';
import { formatDate } from 'utils/commonUtils';

const MyMessages = () => {
    const [messages, setMessages] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 🌟 내 수신함 가져오기
    const fetchInbox = async () => {
        try {
            const response = await messageApi.getInbox();
            setMessages(response.data || response);
        } catch (error) {
            console.error("수신함 불러오기 실패:", error);
        }
    };

    useEffect(() => {
        fetchInbox();
    }, []);

    // 🌟 메시지 클릭 시: 모달 띄우기 & '안 읽음'이면 '읽음'으로 처리
    const handleReadMessage = async (msg) => {
        setSelectedMessage(msg);
        setIsModalOpen(true);

        // 안 읽은 개인 메시지인 경우 읽음 처리 (전체 공지는 로직에 따라 다를 수 있음)
        if (!msg.is_read) {
            try {
                await messageApi.markAsRead(msg.id);
                // 화면상에서도 즉시 '읽음'으로 상태 업데이트 (새로고침 없이)
                setMessages(prevMessages => 
                    prevMessages.map(m => m.id === msg.id ? { ...m, is_read: true } : m)
                );
            } catch (error) {
                console.error("읽음 처리 실패:", error);
            }
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
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
                                    도착한 메시지가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            messages.map(msg => (
                                <tr 
                                    key={msg.id} 
                                    onClick={() => handleReadMessage(msg)}
                                    style={{ cursor: 'pointer', background: msg.is_read ? 'transparent' : '#f0f8ff' }} // 안읽은 메시지는 살짝 푸른 배경
                                >
                                    <td>
                                        <span className={`role-badge ${msg.is_global ? 'admin' : 'user'}`}>
                                            {msg.is_global ? '📢 공지' : '✉️ 개인'}
                                        </span>
                                    </td>
                                    {/* 안 읽은 메시지는 굵게 표시 */}
                                    <td style={{ fontWeight: msg.is_read ? 'normal' : 'bold', color: 'var(--text-main)' }}>
                                        {msg.title} {msg.attachments?.length > 0 && '📎'}
                                    </td>
                                    <td>{msg.sender?.user_name || '알 수 없음'}</td>
                                    <td style={{ color: 'var(--text-dim)' }}>{formatDate(msg.created_at)}</td>
                                    <td>
                                        <span style={{ 
                                            color: msg.is_read ? 'var(--text-dim)' : 'var(--primary)', 
                                            fontWeight: 'bold',
                                            fontSize: '0.9rem'
                                        }}>
                                            {msg.is_read ? '읽음' : '새 메시지 🔴'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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