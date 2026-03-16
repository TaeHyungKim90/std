import React from 'react';
import { todoService } from '../../services/todoService';
import { adminService } from '../../services/adminService';

// ✅ categories props 추가 수신
const TodoDetailModal = ({ isOpen, onClose, event, fetchTodos, onEditClick, mode = 'user', categories = [] }) => {
  const currentUserId = localStorage.getItem('userId');
  
  if (!isOpen || !event) return null;

  // 권한 설정 (이전 수정사항 적용됨: String 변환으로 타입 불일치 버그 방지)
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

  // ✅ 마스터 카테고리에서 현재 일정의 아이콘과 이름 찾기
  const targetCategory = categories.find(c => c.category_key === event.category);
  const displayIcon = targetCategory ? targetCategory.icon : '📌';
  const displayName = targetCategory ? targetCategory.category_name : (event.category_name || event.category);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}>&times;</button>
        
        <div className="modal-header" style={{ borderBottom: `4px solid ${event.color}` }}>
          <span className="category-badge" style={{ backgroundColor: event.color }}>
             {/* ✅ 찾은 아이콘과 이름 적용 */}
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

          <div className="detail-item">
            <label>상세 내용</label>
            <textarea 
              className="bq-textarea detail-view" 
              value={event.description || "등록된 상세 내용이 없습니다."} 
              readOnly 
            ></textarea>
          </div>
        </div>

        <div className="form-actions detail-actions">
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