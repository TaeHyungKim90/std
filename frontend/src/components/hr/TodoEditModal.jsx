import 'assets/css/todoEditModal.css';

import { todoService } from 'api/todoApi';
import { useAuth } from 'context/AuthContext';
import React, { useActionState, useEffect, useState } from 'react';
import SunEditor from 'suneditor-react';
import { getEmploymentRangeError, toSeoulYmd } from 'utils/employmentDateUtils';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';

const COLOR_PRESETS = ['#3FAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'];

const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
	const { joinDate, resignationDate } = useAuth();
	const [selectedColor, setSelectedColor] = useState('#4a90e2');
	const [category, setCategory] = useState('');
	const [description, setDescription] = useState(''); // 에디터 내용을 관리할 새로운 State
	const [title, setTitle] = useState('');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [isCompactEditor, setIsCompactEditor] = useState(false);

	const isHalfVacation = category === 'vacation_am' || category === 'vacation_pm';

	useEffect(() => {
		const media = window.matchMedia('(max-width: 640px)');
		const syncCompactEditor = () => setIsCompactEditor(media.matches);
		syncCompactEditor();
		media.addEventListener('change', syncCompactEditor);
		return () => media.removeEventListener('change', syncCompactEditor);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		if (mode === 'edit' && event) {
			setSelectedColor(event.color || '#4a90e2');
			setCategory(event.category || '');
			setDescription(event.description || '');
			setTitle(event.title || '');
			setStartDate(event.start?.split('T')[0] || '');
			setEndDate(event.end?.split('T')[0] || '');
		} else {
			if (categories.length > 0) {
				setCategory(categories[0].category_key);
				setSelectedColor(categories[0].color || '#4a90e2');
			}
			setDescription('');
			setTitle('');
			const s = selectedDate?.start?.split?.('T')?.[0] ?? selectedDate?.start ?? '';
			const e = selectedDate?.end?.split?.('T')?.[0] ?? selectedDate?.end ?? '';
			setStartDate(s);
			setEndDate(e || s);
		}
	}, [isOpen, mode, event, categories, selectedDate]);

	/** 오전/오후 반차일 때 종료일은 시작일과 동일하게 유지 */
	useEffect(() => {
		if (!isOpen || !isHalfVacation) return;
		setEndDate(startDate);
	}, [isOpen, isHalfVacation, startDate]);

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

		const ymdOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
		if (!ymdOk(String(start)) || !ymdOk(String(end))) {
			return '시작일·종료일을 달력에서 올바르게 선택해 주세요.';
		}

		if (new Date(start) > new Date(end)) return "종료일이 시작일보다 빠를 수 없습니다.";

		const startY = String(start).slice(0, 10);
		const endY = String(end).slice(0, 10);
		const empErr = getEmploymentRangeError(startY, endY, joinDate, resignationDate);
		if (empErr) return empErr;

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
						formatApiDetail(e) ||
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

	const hireMin = joinDate ? toSeoulYmd(joinDate) : undefined;
	const resignMax = resignationDate ? toSeoulYmd(resignationDate) : undefined;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content dynamic-enter todo-edit-modal__content" onClick={e => e.stopPropagation()}>
				<div className="color-indicator-bar todo-edit__color-bar" style={{ backgroundColor: selectedColor }}></div>
				<h2>{mode === 'edit' ? '📝 일정 수정' : '📅 새 일정 등록'}</h2>
				<form action={submitAction}>
					<div className="date-group">
						<input
							type="date"
							name="start_date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							min={hireMin || undefined}
							max={resignMax || undefined}
							required
							className="bq-input"
						/>
						<input
							type="date"
							name="end_date"
							value={isHalfVacation ? startDate : endDate}
							onChange={(e) => !isHalfVacation && setEndDate(e.target.value)}
							min={hireMin || undefined}
							max={resignMax || undefined}
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
					<div className="todo-edit__color-picker" aria-label="일정 색상 선택">
						<span className="todo-edit__color-picker-label">색상</span>
						<div className="todo-edit__color-options">
							{COLOR_PRESETS.map((color) => (
								<button
									type="button"
									key={color}
									className={`todo-edit__color-dot${selectedColor === color ? ' todo-edit__color-dot--selected' : ''}`}
									style={{ backgroundColor: color }}
									aria-label={`${color} 색상 선택`}
									onClick={() => setSelectedColor(color)}
								/>
							))}
							<label className="todo-edit__native-color-label">
								직접
								<input
									type="color"
									value={selectedColor}
									onChange={(e) => setSelectedColor(e.target.value)}
									className="todo-edit__native-color"
									aria-label="직접 색상 선택"
								/>
							</label>
						</div>
					</div>
					<input
						type="text"
						name="title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="제목을 입력하세요"
						required
						className="bq-input-title"
					/>

					<div className="todo-edit__editor-shell">
						<SunEditor
							setContents={description}
							onChange={setDescription}
							height={isCompactEditor ? '150px' : '250px'}
							setOptions={{
								buttonList: [
									...(isCompactEditor ? [] : [['undo', 'redo']]),
									...(isCompactEditor ? [] : [['font', 'fontSize', 'formatBlock']]),
									['bold', 'underline', 'italic', 'fontColor'],
									['list', 'link']
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