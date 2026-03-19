import React, { useState, useEffect, useRef } from 'react';
import { recruitmentService } from '../../services/recruitmentService';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';

const JobPostingModal = ({ isOpen, onClose, onRefresh, editingJob }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: '',
        status: 'open'
    });
    const editorRef = useRef(null);
    useEffect(() => {
        if (editingJob) {
            setFormData({
                ...editingJob,
                deadline: editingJob.deadline ? editingJob.deadline.split('T')[0] : ''
            });
            if (editorRef.current) {
                editorRef.current.getInstance().setHTML(editingJob.description || '');
            }
        } else {
            setFormData({ title: '', description: '', deadline: '', status: 'open' });
            if (editorRef.current) {
                editorRef.current.getInstance().setHTML('');
            }
        }
    }, [editingJob, isOpen]);
    const handleEditorChange = () => {
        if (editorRef.current) {
            const htmlContent = editorRef.current.getInstance().getHTML();
            setFormData(prev => ({ ...prev, description: htmlContent }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingJob) {
                await recruitmentService.updateJobPosting(editingJob.id, formData);
                alert("채용 공고가 성공적으로 수정되었습니다.");
            } else {
                await recruitmentService.createJobPosting(formData);
                alert("채용 공고가 등록되었습니다.");
            }
            onRefresh();
            onClose();
        } catch (err) {
            console.error("공고 저장 실패", err);
            alert("저장에 실패했습니다.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
                <h2>{editingJob ? '공고 수정' : '새 채용 공고 등록'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>공고명</label>
                        <input 
                            type="text" 
                            placeholder="예: 2026 상반기 신입 개발자 채용"
                            value={formData.title} 
                            onChange={e => setFormData({...formData, title: e.target.value})} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>직무 설명 (JD)</label>
                        <div style={{ marginTop: '10px' }}>
                            <Editor
                                ref={editorRef}
                                initialValue={formData.description || " "} // 초기값 (빈칸 방지)
                                previewStyle="vertical" // 미리보기 스타일 (vertical: 화면 분할)
                                height="400px" // 에디터 높이
                                initialEditType="wysiwyg" // 초기 모드 (wysiwyg 또는 markdown)
                                useCommandShortcut={true}
                                onChange={handleEditorChange} // 내용 변경 이벤트
                                hideModeSwitch={true} // 하단 마크다운/위지윅 전환 탭 숨기기 (원하면 false로 변경)
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>마감일</label>
                        <input 
                            type="date" 
                            value={formData.deadline} 
                            onChange={e => setFormData({...formData, deadline: e.target.value})} 
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="btn-save">등록하기</button>
                        <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JobPostingModal;