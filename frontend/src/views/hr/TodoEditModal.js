import React, { useActionState, useState, useEffect, useRef } from 'react';
import { todoService } from '../../services/todoService';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

const TodoEditModal = ({ isOpen, onClose, mode = 'create', selectedDate, event, fetchTodos, categories = [] }) => {
  const [selectedColor, setSelectedColor] = useState('#4a90e2');
  const [category, setCategory] = useState('');
  const editorRef = useRef(null);

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
    const end = isHalfVacation ? start : formData.get("end_date");
    
    // 👈 formData 대신 에디터에서 직접 HTML 내용을 뽑아옵니다.
    const desc = editorRef.current ? editorRef.current.getInstance().getHTML() : "";

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
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
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
          
          {/* 👇 텍스트에어리어를 지우고 에디터 장착! */}
          <div style={{ marginTop: '15px', marginBottom: '15px', textAlign: 'left' }}>
              <Editor
                  ref={editorRef}
                  initialValue={mode === 'edit' ? (event?.description || " ") : " "}
                  previewStyle="tab" // 모달 공간을 고려해 탭(Tab) 스타일로 뷰어 제공
                  height="300px"
                  initialEditType="wysiwyg"
                  useCommandShortcut={true}
                  hideModeSwitch={true}
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