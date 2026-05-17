import 'assets/css/todoEditModal.css';

import { todoService } from 'api/todoApi';
import { useAuth } from 'context/AuthContext';
import React, { useActionState, useEffect, useState } from 'react';
import SunEditor from 'suneditor-react';
import { getEmploymentRangeError, toSeoulYmd } from 'utils/employmentDateUtils';
import { formatApiDetail } from 'utils/formatApiError';
import * as Notify from 'utils/toastUtils';

const COLOR_PRESETS = ['#3FAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'];

function pickYmdFromDateLike(value) {
	if (value == null || value === '') return '';
	const s = String(value);
	if (s.includes('T')) return s.split('T')[0];
	return toSeoulYmd(s) || s.slice(0, 10);
}

const ymdOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
	const { joinDate, resignationDate } = useAuth();
	const [selectedColor, setSelectedColor] = useState('#4a90e2');
	const [category, setCategory] = useState('');
	const [description, setDescription] = useState('');
	const [title, setTitle] = useState('');
	const [startYmd, setStartYmd] = useState('');
	const [endYmd, setEndYmd] = useState('');
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
			setTitle(event.title || '');
			setStartYmd(pickYmdFromDateLike(event.start));
			setEndYmd(pickYmdFromDateLike(event.end));
			setSelectedColor(event.color || '#4a90e2');
			setCategory(event.category || '');
			setDescription(event.description || '');
			return;
		}
		const start = pickYmdFromDateLike(selectedDate?.start);
		const end = pickYmdFromDateLike(selectedDate?.end) || start;
		setStartYmd(start);
		setEndYmd(end);
		setTitle('');
		setDescription('');
	}, [isOpen, mode, event?.id, selectedDate?.start, selectedDate?.end]);

	useEffect(() => {
		if (!isOpen || mode !== 'create' || category) return;
		if (categories.length === 0) return;
		const start = pickYmdFromDateLike(selectedDate?.start);
		const end = pickYmdFromDateLike(selectedDate?.end) || start;
		const multiDay = ymdOk(start) && ymdOk(end) && end > start;
		const defaultCat = multiDay
			? categories.find((c) => c.category_key === 'vacation_full') ??
				categories.find(
					(c) => c.category_key !== 'vacation_am' && c.category_key !== 'vacation_pm'
				) ??
				categories[0]
			: categories[0];
		setCategory(defaultCat.category_key);
		setSelectedColor(defaultCat.color || '#4a90e2');
	}, [isOpen, mode, category, categories, selectedDate?.start, selectedDate?.end]);

	const handleCategoryChange = (e) => {
		const selectedKey = e.target.value;
		setCategory(selectedKey);
		const targetCat = categories.find((cat) => cat.category_key === selectedKey);
		if (targetCat?.color) {
			setSelectedColor(targetCat.color);
		}
		if (selectedKey === 'vacation_am' || selectedKey === 'vacation_pm') {
			setEndYmd(startYmd);
		}
	};

	const handleStartYmdChange = (e) => {
		const next = e.target.value;
		setStartYmd(next);
		if (category === 'vacation_am' || category === 'vacation_pm') {
			setEndYmd(next);
		}
	};

	const [formError, submitAction, isPending] = useActionState(async (prevState, _formData) => {
		const trimmedTitle = String(title).trim();
		if (!trimmedTitle) return '제목을 입력하세요.';

		const start = startYmd;
		const end = isHalfVacation ? startYmd : endYmd;
		if (!start || !end) return '시작일과 종료일을 입력하세요.';
		if (!ymdOk(start) || !ymdOk(end)) {
			return '시작일·종료일을 달력에서 올바르게 선택해 주세요.';
		}
		if (start > end) return '종료일이 시작일보다 빠를 수 없습니다.';

		const empErr = getEmploymentRangeError(start, end, joinDate, resignationDate);
		if (empErr) return empErr;

		const todoData = {
			title: trimmedTitle,
			start_date: `${start}T00:00:00`,
			end_date: `${end}T23:59:59`,
			color: selectedColor,
			category,
			description,
			status: 'CREATED',
		};

		const apiRequest =
			mode === 'edit' ? todoService.updateTodo(event.id, todoData) : todoService.createTodo(todoData);
		let submitErrorMsg = null;

		return Notify.toastPromise(apiRequest, {
			loading: mode === 'edit' ? '일정을 수정하고 있습니다...' : '새 일정을 등록하고 있습니다...',
			success: mode === 'edit' ? '일정이 수정되었습니다. 📝' : '새 일정이 등록되었습니다. 📅',
			error: (e) => {
				submitErrorMsg =
					formatApiDetail(e) || `${mode === 'edit' ? '수정' : '저장'}에 실패했습니다.`;
				return submitErrorMsg;
			},
		})
			.then(async () => {
				await fetchTodos();
				onClose();
				return null;
			})
			.catch((e) => {
				console.error('일정 저장 실패:', e);
			})
			.then((result) => result ?? submitErrorMsg);
	}, null);

	if (!isOpen) return null;

	const hireMin = joinDate ? toSeoulYmd(joinDate) : undefined;
	const resignMax = resignationDate ? toSeoulYmd(resignationDate) : undefined;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content dynamic-enter todo-edit-modal__content" onClick={(e) => e.stopPropagation()}>
				<div className="color-indicator-bar todo-edit__color-bar" style={{ backgroundColor: selectedColor }} />
				<h2>{mode === 'edit' ? '📝 일정 수정' : '📅 새 일정 등록'}</h2>
				<form action={submitAction}>
					<div className="date-group">
						<input
							type="date"
							name="start_date"
							value={startYmd}
							onChange={handleStartYmdChange}
							min={hireMin || undefined}
							max={resignMax || undefined}
							required
							className="bq-input"
						/>
						<input
							type="date"
							name="end_date"
							value={isHalfVacation ? startYmd : endYmd}
							onChange={(e) => setEndYmd(e.target.value)}
							min={hireMin || undefined}
							max={resignMax || undefined}
							disabled={isHalfVacation}
							className="bq-input"
							style={isHalfVacation ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
						/>
					</div>
					<select
						name="category"
						value={category}
						onChange={handleCategoryChange}
						className="bq-select"
						style={{ borderLeft: `5px solid ${selectedColor}` }}
					>
						{categories.length > 0 ? (
							categories.map((cat) => (
								<option key={cat.id} value={cat.category_key}>
									{cat.icon} {cat.category_name}
								</option>
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
									['list', 'link'],
								],
							}}
						/>
					</div>

					<div className="form-actions">
						<button type="button" onClick={onClose} className="btn-cancel">
							취소
						</button>
						<button type="submit" disabled={isPending} className="btn-save">
							{isPending ? '처리 중...' : mode === 'edit' ? '수정 완료' : '저장하기'}
						</button>
					</div>
					{formError && <p className="error-msg">{formError}</p>}
				</form>
			</div>
		</div>
	);
};

export default TodoEditModal;
