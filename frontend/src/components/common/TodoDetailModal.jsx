import 'assets/css/todoDetailModal.css';

import { adminApi } from 'api/adminApi';
import { todoService } from 'api/todoApi';
import { useAuth } from 'context/AuthContext';
import parse from 'html-react-parser';
import React from 'react';
import { sanitizeEditorHtml } from 'utils/sanitizeHtml';
import * as Notify from 'utils/toastUtils';
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
			// 🌟 try-catch와 잘못된 toast.success를 날려버리고 toastPromise 적용!
			const deleteApiCall = isAdminMode 
			? adminApi.deleteTodoByAdmin(event.id) 
			: todoService.deleteTodo(event.id);

			Notify.toastPromise(
			deleteApiCall,
			{
				loading: '일정을 삭제하고 있습니다...',
				success: '성공적으로 삭제되었습니다. 🗑️',
				error: '삭제에 실패하였습니다.'
			}
			).then(() => {
			// 완료된 후 목록 새로고침 및 모달 닫기
			fetchTodos();
			onClose();
			}).catch((e) => {
			console.error("삭제 에러:", e);
			});
		}
	};

	const startDate = event.start ? event.start.split('T')[0] : "";
	const endDate = event.end ? event.end.split('T')[0] : startDate;

	const targetCategory = categories.find(c => c.category_key === event.category);
	const displayIcon = targetCategory ? targetCategory.icon : '📌';
	const displayName = targetCategory ? targetCategory.category_name : (event.category_name || event.category);

	const parseContent = (htmlString) => {
		if (!htmlString || htmlString.trim() === "" || htmlString === "<p><br></p>") return null;

		const safe = sanitizeEditorHtml(htmlString);
		if (!safe.trim()) return null;

		const options = {
			replace: (domNode) => {
				// img 태그를 발견했을 때 리액트 스타일 객체로 변환
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
							style={{ 
								...styleObj, 
								maxWidth: '100%', 
								height: styleObj.height || 'auto' 
							}} 
							alt={domNode.attribs.alt || '일정 상세 이미지'}
						/>
					);
				}
			}
		};
		return parse(safe, options);
	};

	// 본문 파싱 결과 저장
	const parsedDescription = parseContent(event.description);

	return (
		<div className="modal-overlay" onClick={onClose}>
		<div className="modal-content detail-modal dynamic-enter todo-detail-modal__content" onClick={e => e.stopPropagation()}>
			<button className="close-x" onClick={onClose}>&times;</button>
			
			<div className="modal-header" style={{ borderBottom: `4px solid ${event.color}` }}>
			<span className="category-badge" style={{ backgroundColor: event.color }}>
				{displayIcon} {displayName}
			</span>
			<h2>일정 상세조회 {isAdminMode && <span className="todo-detail-modal__admin-tag">(관리자)</span>}</h2>
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

			{/* 🌟 3. dangerouslySetInnerHTML 걷어내고 파서 결과물 출력 */}
			<div className="detail-item todo-detail-modal__description-block">
				<label className="todo-detail-modal__description-label">상세 내용</label>
				{parsedDescription ? (
				<div 
					className="sun-editor-editable todo-detail-modal__sun-body" 
				>
					{parsedDescription}
				</div>
				) : (
				<p className="todo-detail-modal__empty-text">
					등록된 상세 내용이 없습니다.
				</p>
				)}
			</div>
			</div>

			<div className="form-actions detail-actions todo-detail-modal__actions">
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
			<p className="todo-detail-modal__hint">
				※ 본인이 작성한 일정만 수정 및 삭제가 가능합니다.
			</p>
			)}
		</div>
		</div>
	);
};

export default TodoDetailModal;