import 'assets/css/messageReadModal.css';

import parse from 'html-react-parser';
import React from 'react';
import { formatDate } from 'utils/commonUtils';
import { openAuthenticatedDownloadByFileId } from 'utils/fileUtils';
import { sanitizeEditorHtml } from 'utils/sanitizeHtml';
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
                    const { style: _style, ...otherAttribs } = domNode.attribs;
                    return (
                        <img 
                            {...otherAttribs} 
                            className="message-read-modal__parsed-img"
                            style={{ 
                                ...styleObj, 
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
        <div className="modal-overlay message-read-modal__overlay" onClick={onClose}>
            <div 
                className="modal-content dynamic-enter message-read-modal__content" 
                onClick={e => e.stopPropagation()}
            >
                <div className="message-read-modal__header">
                    <div className="message-read-modal__header-top">
                        <span className={`role-badge ${message.is_global ? 'admin' : 'user'}`}>
                            {message.is_global ? '📢 전체공지' : '✉️ 개인메시지'}
                        </span>
                        <h2 className="message-read-modal__title">
                            {message.title}
                        </h2>
                    </div>
                    <div className="message-read-modal__meta">
                        <span>보낸사람: {message.sender?.user_name || '인사팀(관리자)'}</span>
                        <span>받은날짜: {formatDate(message.created_at)}</span>
                    </div>
                </div>

                <div 
                    className="sun-editor-editable message-body message-read-modal__body" 
                >
                    {parseContent(message.content)}
                </div>

                {message.attachments && message.attachments.length > 0 && (
                    <div className="message-read-modal__attachments">
                        <h4 className="message-read-modal__attachments-title">📎 첨부파일 ({message.attachments.length}개)</h4>
                        <ul className="message-read-modal__attachments-list">
                            {message.attachments.map(file => (
                                <li key={file.id}>
                                    <button
                                        type="button"
                                        className="message-read-modal__file-link"
                                        onClick={() =>
                                            openAuthenticatedDownloadByFileId(
                                                file.file_id,
                                                file.file_info?.original_name || file.file_name
                                            )
                                        }
                                    >
                                        {file.file_info?.original_name || file.file_name || '첨부파일 다운로드'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="modal-actions message-read-modal__actions">
                    <button type="button" className="btn-primary" onClick={onClose}>
                        확인 (닫기)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageReadModal;
