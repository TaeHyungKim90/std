import React from 'react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import * as Notify from 'utils/toastUtils';
import { todoService } from 'api/todoApi';

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
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
				<h2 style={{ textAlign: 'center', marginBottom: '10px' }}>
					{colorModal.targetCat?.icon} {colorModal.targetCat?.category_name} 템플릿 설정
				</h2>
				
				<div className="color-palette-container">
					{['#3DAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'].map(color => (
						<div 
							key={color} 
							className={`color-circle-btn ${colorModal.selectedColor === color ? 'selected' : ''}`}
							style={{ backgroundColor: color }} 
							onClick={() => setColorModal({...colorModal, selectedColor: color})}
						/>
					))}
				</div>

				<div style={{ textAlign: 'center', marginBottom: '30px' }}>
					<label className="modal-field-label inline">직접 선택:</label>
					<input 
						type="color" 
						value={colorModal.selectedColor} 
						onChange={e => setColorModal({...colorModal, selectedColor: e.target.value})} 
						style={{ verticalAlign: 'middle', cursor: 'pointer', border: 'none', width: '35px', height: '35px', padding: '0', borderRadius: '4px' }} 
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

				<div className="form-actions" style={{ marginTop: '25px' }}>
					<button type="button" className="btn-cancel" onClick={onClose}>취소</button>
					<button type="button" className="btn-save" onClick={handleSaveColor}>저장</button>
				</div>
			</div>
		</div>
	);
};

export default TodoTemplateModal;