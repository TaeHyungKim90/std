import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { getContrastColor } from '../../utils/colorUtils';
import { todoService } from '../../services/todoService';
import { useAuth } from '../../context/AuthContext';
import TodoSidebar from './TodoSidebar';
import TodoEditModal from './TodoEditModal';
import TodoDetailModal from '../../components/common/TodoDetailModal';



import '../../assets/css/layout.css';
import '../../assets/css/calendar.css';

const TodoListView = () => {
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [colorModal, setColorModal] = useState({isOpen: false, targetCat: null, selectedColor: '#3DAF7A',selectedDescription: ''});
    const { userId } = useAuth();
    const calendarRef = useRef(null);
    const externalEventsRef = useRef(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [modalMode, setModalMode] = useState('create');

    useEffect(() => {
        fetchTodos();
        fetchCategoriesAndConfigs();

        // 외부 드래그 앤 드롭 설정
        let draggable = new Draggable(externalEventsRef.current, {
            itemSelector: '.fc-event',
            eventData: (eventEl) => ({
                title: eventEl.getAttribute('data-title'),
                color: eventEl.getAttribute('data-color'), // 👈 드래그 시 적용될 캘린더 색상
                extendedProps: {
                    category: eventEl.getAttribute('data-category'),
                    description: eventEl.getAttribute('data-description')
                }
            }),
        });

        return () => draggable.destroy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ 마스터 카테고리 + 유저 개인 설정 병합 (수정됨)
    const fetchCategoriesAndConfigs = async () => {
        try {
            const [catRes, configRes] = await Promise.all([
                todoService.getCategories(),
                todoService.getTodoConfigs()
            ]);

            const masterCategories = catRes.data;
            const userConfigs = configRes.data;

            const mergedCategories = masterCategories.map(cat => {
                const userConf = userConfigs.find(c => c.category_key === cat.category_key);
                return {
                    ...cat,
                    hasCustomConfig: !!userConf, // 커스텀 색상 등록 여부 플래그
                    // 캘린더에 들어갈 실제 색상 (설정 없으면 기본 파란색)
                    color: userConf?.color || '#3DAF7A', 
                    default_description: userConf?.default_description || ''
                };
            });

            setCategories(mergedCategories);
        } catch (err) {
            console.error("카테고리 및 설정 로드 실패", err);
        }
    };

    const fetchTodos = async () => {
        try {
            const res = await todoService.getTodos();
            const formatted = res.data.map(todo => {
                const isOwner = todo.user_id === userId;
                const endDate = new Date(todo.end_date);
                endDate.setSeconds(endDate.getSeconds() + 1);
                const nickname = todo.author?.user_nickname || '';
                const name = todo.author?.user_name || '';
                const eventTextColor = getContrastColor(todo.color);
                return {
                    id: todo.id.toString(),
                    title: `[${nickname}(${name})] ${todo.title}`,
                    start: todo.start_date,
                    end: endDate,
                    allDay: true,
                    backgroundColor: todo.color,
                    borderColor: todo.color,
                    textColor: eventTextColor,
                    startEditable:isOwner,
                    durationEditable: isOwner,
                    extendedProps: { ...todo },
                    className: todo.category === 'vacation' ? 'event-vacation' : ''
                }
            });
            setEvents(formatted);
        } catch (err) {
            console.error("데이터 로드 실패", err);
        }
    };

    // --- 이벤트 핸들러 ---
    const handleSwitchToEdit = () => { setIsDetailOpen(false); setModalMode('edit'); setIsEditOpen(true); };
    const handleDateClick = (info) => { setSelectedDate({ start: info.dateStr, end: info.dateStr }); setModalMode('create'); setIsEditOpen(true); };
    const handleEventClick = (info) => { const event = info.event.toPlainObject(); const props = event.extendedProps; setSelectedEvent({ id: event.id, title: props.title || '제목 없음', start: props.start_date.split('T')[0], end: props.end_date.split('T')[0], category: props.category || 'report', color: event.backgroundColor, description: props.description || '', user_id: props.user_id, author: props.author }); setIsDetailOpen(true); };
    
    const handleEventUpdate = async (info) => {
        const { event } = info;
        const startStr = event.startStr || "";
        const startDate = startStr.includes('T') ? startStr.split('T')[0] + "T00:00:00" : startStr + "T00:00:00";
        const toLocalISO = (date) => new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('.')[0];
        
        let endDate;
        if (event.end) {
            const tempEnd = new Date(event.end);
            tempEnd.setSeconds(tempEnd.getSeconds() - 1);
            endDate = toLocalISO(tempEnd);
        } else {
            endDate = event.startStr.split('T')[0] + "T23:59:59";
        }

        try {
            await todoService.updateTodo(event.id, {
                title: event.extendedProps.title,
                start_date: startDate,
                end_date: endDate,
                category: event.extendedProps.category || 'report',
                color: event.backgroundColor
            });
            fetchTodos();
        } catch (e) { alert("업데이트 오류"); info.revert(); }
    };

    const handleEventReceive = async (info) => {
        const { event } = info;
        const newTodo = {
            title: event.title,
            start_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T00:00:00`,
            end_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T23:59:59`,
            color: event.backgroundColor, // 드래그 시점에 결정된 색상 적용
            category: event.extendedProps?.category || 'report', 
            description: event.extendedProps?.description || '',
            status: "CREATED"
        };
        info.revert(); 
        await todoService.createTodo(newTodo);
        fetchTodos();
    };

    // ✅ 카테고리 색상 설정 모달 열기
    const openColorModal = (cat) => {
        setColorModal({
            isOpen: true,
            targetCat: cat,
            selectedColor: cat.color, // 기존에 쓰던 색상 불러오기
            selectedDescription: cat.default_description || ''
        });
    };

    // ✅ 색상 설정 저장 로직
    const handleSaveColor = async () => {
        try {
            await todoService.updateTodoConfig({
                category_key: colorModal.targetCat.category_key,
                color: colorModal.selectedColor,
                default_description: colorModal.selectedDescription // 기존 설명 유지
            });
            await fetchCategoriesAndConfigs(); // 설정 저장 후 데이터 재호출
            setColorModal({ ...colorModal, isOpen: false });
        } catch (err) {
            alert("색상 설정에 실패했습니다.");
        }
    };

    return (
        <div className="calendar-page-container">
            {/* 스케줄 템플릿 사이드바 */}
            <TodoSidebar 
                ref={externalEventsRef} 
                categories={categories} 
                openColorModal={openColorModal} 
            />

            {/* 메인 캘린더 */}
            <section id="calendar-container" className="calendar-main">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                    locale="ko"
                    events={events}
                    editable={true}
                    droppable={true}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    eventDrop={handleEventUpdate}
                    eventResize={handleEventUpdate}
                    eventReceive={handleEventReceive}
                />
            </section>

            {/* ✅ 카테고리 색상 설정 모달 */}
            {colorModal.isOpen && (
                <div className="modal-overlay" onClick={() => setColorModal({...colorModal, isOpen: false})}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ textAlign: 'center' }}>
                            {colorModal.targetCat?.icon} {colorModal.targetCat?.category_name} 색상 설정
                        </h2>
                        
                        {/* 미리 정의된 색상 팔레트 */}
                        <div className="color-palette" style={{ margin: '30px 0' }}>
                            {['#3DAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'].map(color => (
                                <div 
                                    key={color}
                                    className={`color-swatch ${colorModal.selectedColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color, width: '40px', height: '40px' }}
                                    onClick={() => setColorModal({...colorModal, selectedColor: color})}
                                />
                            ))}
                        </div>
                        
                        {/* 자유 색상 선택기 */}
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <label style={{ fontSize: '0.9rem', color: '#666', marginRight: '10px' }}>직접 선택:</label>
                            <input 
                                type="color" 
                                value={colorModal.selectedColor} 
                                onChange={e => setColorModal({...colorModal, selectedColor: e.target.value})} 
                                style={{ verticalAlign: 'middle', cursor: 'pointer' }}
                            />
                        </div>
                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '8px' }}>
                                📝 기본 등록 멘트 (해당 카테고리 선택 시 자동 입력)
                            </label>
                            <textarea 
                                style={{ 
                                    width: '100%', 
                                    padding: '10px', 
                                    borderRadius: '6px', 
                                    border: '1px solid #E2DFD8',
                                    backgroundColor: '#F0EEE9',
                                    minHeight: '80px',
                                    resize: 'none'
                                }}
                                placeholder="예: 휴가 신청합니다."
                                value={colorModal.selectedDescription}
                                onChange={e => setColorModal({...colorModal, selectedDescription: e.target.value})}
                            />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn-cancel" onClick={() => setColorModal({...colorModal, isOpen: false})}>취소</button>
                            <button type="button" className="btn-save" onClick={handleSaveColor}>저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 기본 모달들 */}
            <TodoEditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} mode={modalMode} selectedDate={selectedDate} event={selectedEvent} fetchTodos={fetchTodos} categories={categories} />
            <TodoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} event={selectedEvent} fetchTodos={fetchTodos} onEditClick={handleSwitchToEdit} categories={categories} />
        </div>
    );
};

export default TodoListView;