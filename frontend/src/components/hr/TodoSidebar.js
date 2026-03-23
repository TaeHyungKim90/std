import React, { forwardRef, useRef } from 'react';
import { getContrastColor } from '../../utils/colorUtils';

const TodoSidebar = forwardRef(({ categories, openColorModal }, ref) => {
    // ✅ 1. 마우스를 누른 시작 좌표를 저장할 공간을 만듭니다.
    const mousePos = useRef({ x: 0, y: 0 });
    // ✅ 2. 마우스를 누를 때(Down) 현재 X, Y 좌표를 기억합니다.
    const handleMouseDown = (e) => {
        mousePos.current = { x: e.clientX, y: e.clientY };
    };
    // ✅ 3. 마우스를 뗄 때(Up) 움직인 거리를 계산합니다.
    const handleMouseUp = (e, cat) => {
        const moveX = Math.abs(e.clientX - mousePos.current.x);
        const moveY = Math.abs(e.clientY - mousePos.current.y);

        // 상하좌우로 5픽셀 미만으로 움직였을 때만 '순수한 클릭'으로 인정합니다!
        if (moveX < 5 && moveY < 5) {
            openColorModal(cat);
        }
    };
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
                    const bgColor = cat.hasCustomConfig ? cat.color : '#ffffff';
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
                            onMouseDown={handleMouseDown}
                            onMouseUp={(e) => handleMouseUp(e, cat)}
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