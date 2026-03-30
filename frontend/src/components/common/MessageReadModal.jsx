import React from 'react';
import { formatDate } from 'utils/commonUtils';
import parse from 'html-react-parser';
import { sanitizeEditorHtml } from 'utils/sanitizeHtml';
import 'suneditor/dist/css/suneditor.min.css';

const MessageReadModal = ({ isOpen, onClose, message }) => {
    if (!isOpen || !message) return null;

    const parseContent = (htmlString) => {
        if (!htmlString) return null;

        const safe = sanitizeEditorHtml(htmlString);
        if (!safe.trim()) return null;

        const options = {
            replace: (domNode) => {
                if (domNode.name === 'img' && domNode.attribs) {
                    const styleObj = {};
                    if (domNode.attribs.style) {
                        domNode.attribs.style.split(';').forEach(styleDef => {
                            const [key, value] = styleDef.split(':');
                            if (key && value) {
                                const camelKey = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                                styleObj[camelKey] = value.trim();
                            }
                        });
                    }
                    const { style, ...otherAttribs } = domNode.attribs;
                    return (
                        <img 
                            {...otherAttribs} 
                            style={{ 
                                ...styleObj, 
                                maxWidth: '100%', 
                                height: styleObj.height || 'auto' 
                            }} 
                            alt={domNode.attribs.alt || '본문 이미지'}
                        />
                    );
                }
            }
        };
        return parse(safe, options);
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div 
                className="modal-content" 
                onClick={e => e.stopPropagation()}
                // 🌟 핵심 수정 1: 모달 전체가 화면을 뚫고 나가지 않게 최대 높이 지정 및 전체 레이아웃 설정
                style={{ 
                    maxWidth: '800px', // 가로 폭을 살짝 더 넓게 (선택 사항)
                    width: '90%',
                    maxHeight: '90vh', // 🌟 브라우저 화면 높이의 90%까지만 커짐
                    display: 'flex', 
                    flexDirection: 'column', // 위에서 아래로 차곡차곡 쌓이게
                    padding: '25px'
                }} 
            >
                {/* 🌟 헤더 부분: 스크롤되지 않고 상단에 고정 */}
                <div style={{ borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <span className={`role-badge ${message.is_global ? 'admin' : 'user'}`}>
                            {message.is_global ? '📢 전체공지' : '✉️ 개인메시지'}
                        </span>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>
                            {message.title}
                        </h2>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                        <span>보낸사람: {message.sender?.user_name || '인사팀(관리자)'}</span>
                        <span>받은날짜: {formatDate(message.created_at)}</span>
                    </div>
                </div>

                {/* 🌟 핵심 수정 2: 본문 영역에 스크롤바 추가! */}
                <div 
                    className="sun-editor-editable message-body" 
                    style={{ 
                        flex: 1, // 🌟 남은 공간을 모두 차지함
                        overflowY: 'auto', // 🌟 내용이 넘치면 세로 스크롤바 자동 생성!
                        padding: '10px 5px', // 스크롤바와 내용이 너무 붙지 않게 여백 추가
                        border: 'none', 
                        backgroundColor: 'transparent', 
                        margin: 0
                    }}
                >
                    {parseContent(message.content)}
                </div>

                {/* 🌟 첨부파일 부분: 스크롤되지 않고 하단에 고정 (선택 사항) */}
                {message.attachments && message.attachments.length > 0 && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', flexShrink: 0 }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>📎 첨부파일 ({message.attachments.length}개)</h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                            {message.attachments.map(file => (
                                <li key={file.id}>
                                    <a href={`/api/common/download/${file.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                                        {file.file_info?.original_name || file.file_name || '첨부파일 다운로드'}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 🌟 하단 버튼 부분: 스크롤되지 않고 맨 아래 고정 */}
                <div className="modal-actions" style={{ marginTop: '25px', flexShrink: 0 }}>
                    <button type="button" className="btn-primary" onClick={onClose}>
                        확인 (닫기)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageReadModal;