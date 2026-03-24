import React, { useState, useEffect } from 'react';
import { recruitmentApi } from '../../api/recruitmentApi';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';

const JobPostingModal = ({ isOpen, onClose, onRefresh, editingJob }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: '',
        status: 'open'
    });

    useEffect(() => {
        if (editingJob) {
            setFormData({
                ...editingJob,
                deadline: editingJob.deadline ? editingJob.deadline.split('T')[0] : ''
            });
        } else {
            setFormData({ title: '', description: '', deadline: '', status: 'open' });
        }
    }, [editingJob, isOpen]);

    const handleEditorChange = (content) => {
        setFormData(prev => ({ ...prev, description: content }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingJob) {
                await recruitmentApi.updateJobPosting(editingJob.id, formData);
                alert("채용 공고가 성공적으로 수정되었습니다.");
            } else {
                await recruitmentApi.createJobPosting(formData);
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
            <div className="modal-content" style={{ maxWidth: '800px' }}>
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
                            <SunEditor
                                setContents={formData.description}
                                onChange={handleEditorChange}
                                height="400px"
                                setOptions={{
                                    buttonList: [
                                        ['undo', 'redo'],
                                        ['font', 'fontSize', 'formatBlock'],
                                        ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                                        ['fontColor', 'hiliteColor', 'textStyle'],
                                        ['removeFormat'],
                                        '/', // 두 번째 줄로 넘김
                                        ['outdent', 'indent'],
                                        ['align', 'horizontalRule', 'list', 'lineHeight'],
                                        ['table', 'link', 'image', 'video'],
                                        ['fullScreen', 'showBlocks', 'codeView']
                                    ]
                                }}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>마감일</label>
                        <input 
                            type="date" 
                            value={formData.deadline} 
                            onChange={e => setFormData({...formData, deadline: e.target.value})}
                            required 
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