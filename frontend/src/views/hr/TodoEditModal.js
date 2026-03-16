import React, { useActionState, useState, useEffect } from 'react';
import { todoService } from '../../services/todoService';

const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
  const [selectedColor, setSelectedColor] = useState('#4a90e2');
  const [category, setCategory] = useState('');

  // ✅ 초기 데이터 세팅
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && event) {
        setSelectedColor(event.color || '#4a90e2');
        setCategory(event.category || '');
      } else if (categories.length > 0) {
        // 등록 모드: 첫 번째 카테고리의 정보로 초기화
        setCategory(categories[0].category_key);
        setSelectedColor(categories[0].color || '#4a90e2');
      }
    }
  }, [isOpen, mode, event, categories]);

  // ✅ 카테고리 변경 시 색상을 즉시 동기화하는 핸들러
  const handleCategoryChange = (e) => {
    const selectedKey = e.target.value;
    setCategory(selectedKey);

    // 마스터 데이터에서 해당 카테고리의 색상을 찾아 적용
    const targetCat = categories.find(cat => cat.category_key === selectedKey);
    if (targetCat && targetCat.color) {
      setSelectedColor(targetCat.color);
    }
  };

  const [formError, submitAction, isPending] = useActionState(async (prevState, formData) => {
    const title = formData.get("title");
    const start = formData.get("start_date");
    const end = formData.get("end_date");
    const desc = formData.get("description");

    if (new Date(start) > new Date(end)) return "종료일이 시작일보다 빠를 수 없습니다.";

    const todoData = {
      title,
      start_date: `${start}T00:00:00`,
      end_date: `${end}T23:59:59`,
      color: selectedColor, // ✅ 이제 선택된 카테고리의 색상이 담깁니다.
      category,
      description: desc,
      status: "CREATED"
    };

    try {
      if (mode === 'edit') {
        await todoService.updateTodo(event.id, todoData);
      } else {
        await todoService.createTodo(todoData);
      }
      await fetchTodos();
      onClose();
      return null;
    } catch (e) {
      return `${mode === 'edit' ? '수정' : '저장'}에 실패했습니다.`;
    }
  }, null);

  if (!isOpen) return null;

  const defaultStart = mode === 'edit' ? event?.start?.split('T')[0] : selectedDate?.start;
  const defaultEnd = mode === 'edit' ? event?.end?.split('T')[0] : selectedDate?.end;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* 🎨 현재 선택된 색상을 상단 바 형태로 표시 (시각적 피드백) */}
        <div className="color-indicator-bar" style={{ backgroundColor: selectedColor, height: '6px', borderRadius: '3px 3px 0 0', marginTop: '-20px', marginBottom: '15px' }}></div>
        
        <h2>{mode === 'edit' ? '📝 일정 수정' : '📅 새 일정 등록'}</h2>
        
        <form action={submitAction}>
          <div className="date-group">
            <input type="date" name="start_date" defaultValue={defaultStart} required className="bq-input" />
            <input type="date" name="end_date" defaultValue={defaultEnd} required className="bq-input" />
          </div>

          {/* ✅ 선택 시 색상이 바뀌도록 handleCategoryChange 연결 */}
          <select 
            name="category" 
            value={category} 
            onChange={handleCategoryChange} 
            className="bq-select"
            style={{ borderLeft: `5px solid ${selectedColor}` }} // 선택 박스 옆에 색상 표시
          >
            {categories.length > 0 ? (
              categories.map(cat => (
                <option key={cat.id} value={cat.category_key}>
                  {cat.icon} {cat.category_name}
                </option>
              ))
            ) : (
              <option value="">카테고리 불러오는 중...</option>
            )}
          </select>

          <input 
            type="text" 
            name="title" 
            defaultValue={mode === 'edit' ? event?.title : ''} 
            placeholder="제목을 입력하세요" 
            required 
            className="bq-input-title" 
          />

          <textarea 
            name="description" 
            defaultValue={mode === 'edit' ? event?.description : ''} 
            placeholder="상세 내용을 입력하세요..." 
            className="bq-textarea"
          ></textarea>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">취소</button>
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