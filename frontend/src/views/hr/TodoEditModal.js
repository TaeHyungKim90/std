import React, { useActionState, useState, useEffect } from 'react';
import { todoService } from '../../services/todoService';

const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
  const [selectedColor, setSelectedColor] = useState('#4a90e2');
  const [category, setCategory] = useState('');

  // ✅ 반차 여부를 실시간으로 감지합니다.
  const isHalfVacation = category === 'vacation_am' || category === 'vacation_pm';

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && event) {
        setSelectedColor(event.color || '#4a90e2');
        setCategory(event.category || '');
      } else if (categories.length > 0) {
        setCategory(categories[0].category_key);
        setSelectedColor(categories[0].color || '#4a90e2');
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
    // ✅ 반차일 경우 폼에서 뭘 보냈든 무조건 시작일과 동일하게 덮어씁니다!
    const end = isHalfVacation ? start : formData.get("end_date");
    const desc = formData.get("description");

    if (new Date(start) > new Date(end)) return "종료일이 시작일보다 빠를 수 없습니다.";

    const todoData = {
      title,
      start_date: `${start}T00:00:00`,
      end_date: `${end}T23:59:59`,
      color: selectedColor,
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
      // 🚨 백엔드 에러 메시지를 가로채서 화면에 알럿으로 띄웁니다!
      const errorDetail = e.response?.data?.detail || `${mode === 'edit' ? '수정' : '저장'}에 실패했습니다.`;
      alert(errorDetail); 
      return errorDetail;
    }
  }, null);

  if (!isOpen) return null;

  const defaultStart = mode === 'edit' ? event?.start?.split('T')[0] : selectedDate?.start;
  const defaultEnd = mode === 'edit' ? event?.end?.split('T')[0] : selectedDate?.end;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="color-indicator-bar" style={{ backgroundColor: selectedColor, height: '6px', borderRadius: '3px 3px 0 0', marginTop: '-20px', marginBottom: '15px' }}></div>
        <h2>{mode === 'edit' ? '📝 일정 수정' : '📅 새 일정 등록'}</h2>
        <form action={submitAction}>
          <div className="date-group">
            <input type="date" name="start_date" defaultValue={defaultStart} required className="bq-input" />
            {/* ✅ 반차일 경우 종료일 창을 비활성화(disabled)하여 클릭 자체를 막습니다. */}
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
          <textarea name="description" defaultValue={mode === 'edit' ? event?.description : ''} placeholder="상세 내용을 입력하세요..." className="bq-textarea"></textarea>
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