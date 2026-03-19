import React from 'react';
import { todoService } from '../../services/todoService';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

// 👈 Toast UI Viewer 및 CSS 임포트
import { Viewer } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor-viewer.css'; // 뷰어 전용 CSS

const TodoDetailModal = ({ isOpen, onClose, event, fetchTodos, onEditClick, mode = 'user', categories = [] }) => {
  const { userId: currentUserId } = useAuth();
  
  if (!isOpen || !event) return null;

  const isAdminMode = mode === 'admin';
  const isAuthor = String(currentUserId) === String(event.user_id); 
  
  const canDelete = isAdminMode || isAuthor;
  const canEdit = !isAdminMode && isAuthor;

  const handleDelete = async () => {
    const confirmMsg = isAdminMode 
      ? "관리자 권한으로 이 일정을 삭제하시겠습니까?" 
      : "정말 삭제하시겠습니까?";

    if (window.confirm(confirmMsg)) {
      try {
        if (isAdminMode) {
          await adminService.deleteTodoByAdmin(event.id);
        } else {
          await todoService.deleteTodo(event.id);
        }
        alert("삭제되었습니다.");
        await fetchTodos();
        onClose();
      } catch (e) {
        alert("삭제 실패하였습니다.");
      }
    }
  };

  const startDate = event.start ? event.start.split('T')[0] : "";
  const endDate = event.end ? event.end.split('T')[0] : startDate;

  const targetCategory = categories.find(c => c.category_key === event.category);
  const displayIcon = targetCategory ? targetCategory.icon : '📌';
  const displayName = targetCategory ? targetCategory.category_name : (event.category_name || event.category);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <button className="close-x" onClick={onClose}>&times;</button>
        
        <div className="modal-header" style={{ borderBottom: `4px solid ${event.color}` }}>
          <span className="category-badge" style={{ backgroundColor: event.color }}>
            {displayIcon} {displayName}
          </span>
          <h2>일정 상세조회 {isAdminMode && <span style={{fontSize:'0.8rem', color:'red'}}>(관리자)</span>}</h2>
        </div>

        <div className="modal-body">
          <div className="display-info-group">
            <div className="info-item title-row">
              <strong>제목:</strong> <span className="highlight-text">{event.title}</span>
            </div>
            <div className="info-item author-row">
              <strong>작성자:</strong> <span>{event.author?.user_nickname}({event.author?.user_name})</span>
            </div>
            <div className="info-item date-row">
              <strong>기간:</strong> <span className="date-badge">📅 {startDate} ~ {endDate}</span>
            </div>
          </div>

          {/* 👇 뷰어 적용 영역 */}
          <div className="detail-item" style={{ marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', minHeight: '150px', backgroundColor: '#fafafa', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '10px', color: '#555', fontWeight: 'bold' }}>상세 내용</label>
            {event.description && event.description.trim() !== "" && event.description !== "<p><br></p>" ? (
              <Viewer initialValue={event.description} />
            ) : (
              <p style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                등록된 상세 내용이 없습니다.
              </p>
            )}
          </div>
        </div>

        <div className="form-actions detail-actions" style={{ marginTop: '20px' }}>
          {canDelete && (
            <button className="btn-delete" onClick={handleDelete}>일정 삭제</button>
          )}
          <div className="right-group">
            {canEdit && (
              <button className="btn-primary" onClick={onEditClick}>수정하기</button>
            )}
            <button className="btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>
        
        {!isAuthor && !isAdminMode && (
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa', marginTop: '10px' }}>
            ※ 본인이 작성한 일정만 수정 및 삭제가 가능합니다.
          </p>
        )}
      </div>
    </div>
  );
};

export default TodoDetailModal;