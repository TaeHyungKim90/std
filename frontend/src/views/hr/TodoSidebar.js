import React, { forwardRef } from 'react';
import { getContrastColor } from '../../utils/colorUtils';

const TodoSidebar = forwardRef(({ categories, openColorModal }, ref) => {
    return (
        <aside ref={ref} id="external-events" className="calendar-sidebar">
            <h4 className="sidebar-title">
                📅 빠른 등록 템플릿 
                <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal', display: 'block' }}>
                    (클릭하여 색상 변경)
                </span>
            </h4>

            {categories.length > 0 ? (
                categories.map(cat => {
                    // 배경색 결정 (커스텀 설정이 없으면 흰색)
                    const bgColor = cat.hasCustomConfig ? cat.color : '#ffffff';
                    // 🎨 배경색에 따른 자동 글자색 계산
                    const textColor = cat.hasCustomConfig ? getContrastColor(bgColor) : '#333';
                    const borderColor = cat.hasCustomConfig ? cat.color : '#ddd';

                    return (
                        <div 
                            key={cat.id}
                            className='fc-event'
                            onClick={() => openColorModal(cat)}
                            data-title={cat.category_name} 
                            data-color={cat.color}
                            data-category={cat.category_key} 
                            data-description={cat.default_description}
                            style={{ 
                                backgroundColor: bgColor, 
                                color: textColor, // ✅ 자동 반전된 글자색 적용
                                borderColor: borderColor,
                                marginBottom: '8px',
                                padding: '10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            {cat.icon} {cat.category_name}
                        </div>
                    );
                })
            ) : (
                <p style={{ fontSize: '0.85rem', color: '#888' }}>카테고리를 불러오는 중...</p>
            )}
        </aside>
    );
});

export default TodoSidebar;