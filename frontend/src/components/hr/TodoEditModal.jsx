import React, { useActionState, useState, useEffect } from 'react';
import * as Notify from 'utils/toastUtils';
import { formatApiDetail } from 'utils/formatApiError';
import { todoService } from 'api/todoApi';
import SunEditor from 'suneditor-react';
const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
	const [selectedColor, setSelectedColor] = useState('#4a90e2');
	const [category, setCategory] = useState('');
	const [description, setDescription] = useState(''); // 에디터 내용을 관리할 새로운 State

	const isHalfVacation = category === 'vacation_am' || category === 'vacation_pm';

	useEffect(() => {
		if (isOpen) {
			if (mode === 'edit' && event) {
				setSelectedColor(event.color || '#4a90e2');
				setCategory(event.category || '');
				setDescription(event.description || '');
			} else if (categories.length > 0) {
				setCategory(categories[0].category_key);
				setSelectedColor(categories[0].color || '#4a90e2');
				setDescription('');
			}
		}
	}, [isOpen, mode, event, categories]);

	const handleCategoryChange = (e) => {
		const selectedKey = e.target.value;
		setCategory(selectedKey);
		const targetCat = categories.find(cat => cat.category_key === selectedKey);
		if (targetCat && targetCat.color) {
			setSelectedColor(targetCat.color);
		}
	};

	const [formError, submitAction, isPending] = useActionState(async (prevState, formData) => {
		const title = formData.get("title");
		const start = formData.get("start_date");
		const end = isHalfVacation ? start : formData.get("end_date");

		if (new Date(start) > new Date(end)) return "종료일이 시작일보다 빠를 수 없습니다.";

		const todoData = {
			title,
			start_date: `${start}T00:00:00`,
			end_date: `${end}T23:59:59`,
			color: selectedColor,
			category,
			description: description, // State에서 직접 가져옴
			status: "CREATED"
		};

		const apiRequest = mode === 'edit'
			? todoService.updateTodo(event.id, todoData)
			: todoService.createTodo(todoData);
		let submitErrorMsg = null;

		// 🌟 2. 지저분한 try-catch를 지우고 toastPromise로 리턴!
		return Notify.toastPromise(
			apiRequest,
			{
				loading: mode === 'edit' ? '일정을 수정하고 있습니다...' : '새 일정을 등록하고 있습니다...',
				success: mode === 'edit' ? '일정이 수정되었습니다. 📝' : '새 일정이 등록되었습니다. 📅',
				error: (e) => {
					submitErrorMsg =
						formatApiDetail(e.response?.data?.detail) ||
						`${mode === 'edit' ? '수정' : '저장'}에 실패했습니다.`;
					return submitErrorMsg;
				}
			}
		).then(async () => {
			// 통신 성공 시 목록 갱신 및 모달 닫기
			await fetchTodos();
			onClose();
			return null; // 에러 메시지 없음 (성공)
		}).catch((e) => {
			console.error("일정 저장 실패:", e);
		}).then((result) => {
			return result ?? submitErrorMsg;
		});
	}, null);

	if (!isOpen) return null;

	const defaultStart = mode === 'edit' ? event?.start?.split('T')[0] : selectedDate?.start;
	const defaultEnd = mode === 'edit' ? event?.end?.split('T')[0] : selectedDate?.end;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
				<div className="color-indicator-bar" style={{ backgroundColor: selectedColor, height: '6px', borderRadius: '3px 3px 0 0', marginTop: '-20px', marginBottom: '15px' }}></div>
				<h2>{mode === 'edit' ? '📝 일정 수정' : '📅 새 일정 등록'}</h2>
				<form action={submitAction}>
					<div className="date-group">
						<input type="date" name="start_date" defaultValue={defaultStart} required className="bq-input" />
						<input
							type="date"
							name="end_date"
							defaultValue={isHalfVacation ? defaultStart : defaultEnd}
							disabled={isHalfVacation}
							className="bq-input"
							style={isHalfVacation ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
						/>
					</div>
					<select name="category" value={category} onChange={handleCategoryChange} className="bq-select" style={{ borderLeft: `5px solid ${selectedColor}` }}>
						{categories.length > 0 ? (
							categories.map(cat => (
								<option key={cat.id} value={cat.category_key}>{cat.icon} {cat.category_name}</option>
							))
						) : (
							<option value="">카테고리 불러오는 중...</option>
						)}
					</select>
					<input type="text" name="title" defaultValue={mode === 'edit' ? event?.title : ''} placeholder="제목을 입력하세요" required className="bq-input-title" />

					<div style={{ marginTop: '15px', marginBottom: '15px', textAlign: 'left' }}>
						<SunEditor
							setContents={description}
							onChange={setDescription}
							height="250px"
							setOptions={{
								buttonList: [
									['undo', 'redo'],
									['font', 'fontSize', 'formatBlock'],
									['bold', 'underline', 'italic', 'strike', 'fontColor', 'hiliteColor'],
									['align', 'list', 'table', 'link']
								]
							}}
						/>
					</div>

					<div className="form-actions">
						<button type="button" onClick={onClose} className="btn-cancel">취소</button>
						<button type="submit" disabled={isPending} className="btn-save">{isPending ? '처리 중...' : mode === 'edit' ? '수정 완료' : '저장하기'}</button>
					</div>
					{formError && <p className="error-msg">{formError}</p>}
				</form>
			</div>
		</div>
	);
};

export default TodoEditModal;