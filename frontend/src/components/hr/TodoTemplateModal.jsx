import 'assets/css/todoTemplateModal.css';

import { todoService } from 'api/todoApi';
import AppModal from 'components/common/AppModal';
import React from 'react';
import SunEditor from 'suneditor-react';
import * as Notify from 'utils/toastUtils';

const TodoTemplateModal = ({ isOpen, onClose, colorModal, setColorModal, fetchCategoriesAndConfigs }) => {
	if (!isOpen) return null;

	const handleSaveColor = async () => { 
		Notify.toastPromise(
			todoService.updateTodoConfig({ 
				category_key: colorModal.targetCat.category_key, 
				color: colorModal.selectedColor, 
				default_description: colorModal.selectedDescription 
			}),
			{
				loading: '템플릿 설정을 저장하고 있습니다...',
				success: '템플릿 설정이 성공적으로 저장되었습니다!',
				error: '템플릿 설정에 실패했습니다.'
			}
		).then(() => {
			fetchCategoriesAndConfigs(); 
			onClose(); 
		});
	};

	return (
		<AppModal isOpen={isOpen} onClose={onClose} contentClassName="todo-template-modal__content">
				<h2 className="todo-template-modal__title">
					{colorModal.targetCat?.icon} {colorModal.targetCat?.category_name} 템플릿 설정
				</h2>
				
				<div className="color-palette-container">
					{['#3FAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'].map(color => (
						<div 
							key={color} 
							className={`color-circle-btn ${colorModal.selectedColor === color ? 'selected' : ''}`}
							style={{ backgroundColor: color }} 
							onClick={() => setColorModal({...colorModal, selectedColor: color})}
						/>
					))}
				</div>

				<div className="todo-template-modal__custom-color-row">
					<label className="modal-field-label inline">직접 선택:</label>
					<input 
						type="color" 
						value={colorModal.selectedColor} 
						onChange={e => setColorModal({...colorModal, selectedColor: e.target.value})} 
						className="todo-template-modal__native-color"
					/>
				</div>

				<div className="editor-wrapper">
					<label className="modal-field-label">
						📝 기본 등록 멘트 (해당 카테고리 선택 시 자동 입력)
					</label>
					<SunEditor
						setContents={colorModal.selectedDescription || " "}
						onChange={(content) => setColorModal(prev => ({ ...prev, selectedDescription: content }))}
						height="200px"
						setOptions={{
							buttonList: [
								['font', 'fontSize', 'bold', 'underline', 'italic', 'fontColor', 'hiliteColor'],
								['align', 'list', 'table', 'link']
							]
						}}
					/>
				</div>

				<div className="form-actions todo-template-modal__form-actions">
					<button type="button" className="btn-cancel" onClick={onClose}>취소</button>
					<button type="button" className="btn-save" onClick={handleSaveColor}>저장</button>
				</div>
		</AppModal>
	);
};

export default TodoTemplateModal;