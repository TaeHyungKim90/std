import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { getContrastColor } from '../../utils/colorUtils';
import { todoService } from '../../services/todoService';
import { holidayService } from '../../services/holidayService';
import { useAuth } from '../../context/AuthContext';
import TodoSidebar from './TodoSidebar';
import TodoEditModal from './TodoEditModal';
import TodoDetailModal from '../../components/common/TodoDetailModal';

import '../../assets/css/layout.css';
import '../../assets/css/calendar.css';

const TodoListView = () => {
    // ... (상단 상태 선언부는 기존과 동일합니다) ...
    const [events, setEvents] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const holidaysRef = useRef([]);
    const [categories, setCategories] = useState([]);
    const [colorModal, setColorModal] = useState({isOpen: false, targetCat: null, selectedColor: '#3DAF7A', selectedDescription: ''});
    const { userId } = useAuth();
    const calendarRef = useRef(null);
    const externalEventsRef = useRef(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [modalMode, setModalMode] = useState('create');

    const fetchCategoriesAndConfigs = useCallback(async () => { /* 기존 동일 */
        try {
            const [catRes, configRes] = await Promise.all([todoService.getCategories(), todoService.getTodoConfigs()]);
            const masterCategories = catRes.data;
            const userConfigs = configRes.data;
            const mergedCategories = masterCategories.map(cat => {
                const userConf = userConfigs.find(c => c.category_key === cat.category_key);
                return { ...cat, hasCustomConfig: !!userConf, color: userConf?.color || '#3DAF7A', default_description: userConf?.default_description || '' };
            });
            setCategories(mergedCategories);
        } catch (err) { console.error("카테고리 및 설정 로드 실패", err); }
    }, []);

    const fetchTodos = useCallback(async () => { /* 기존 동일 */
        try {
            const currentYear = new Date().getFullYear().toString();
            const [todoRes, holidayRes] = await Promise.all([todoService.getTodos(), holidayService.getHolidays(currentYear)]);
            const formattedTodos = todoRes.data.map(todo => {
                const isOwner = todo.user_id === userId;
                const endDate = new Date(todo.end_date);
                endDate.setSeconds(endDate.getSeconds() + 1);
                const nickname = todo.author?.user_nickname || '';
                const name = todo.author?.user_name || '';
                const eventTextColor = getContrastColor(todo.color);
                
                return {
                    id: todo.id.toString(), title: `[${nickname}(${name})] ${todo.title}`,
                    start: todo.start_date, end: endDate, allDay: true, backgroundColor: todo.color, borderColor: todo.color, textColor: eventTextColor,
                    startEditable: isOwner, durationEditable: isOwner, extendedProps: { ...todo, isHoliday: false }, className: todo.category === 'vacation' ? 'event-vacation' : ''
                };
            });
            holidaysRef.current = holidayRes.data || [];
            setEvents(formattedTodos);
            setHolidays(holidayRes.data || []);
        } catch (err) { console.error("데이터 로드 실패", err); }
    }, [userId]);

    const handleSwitchToEdit = () => { setIsDetailOpen(false); setModalMode('edit'); setIsEditOpen(true); };
    const handleDateClick = (info) => { setSelectedDate({ start: info.dateStr, end: info.dateStr }); setModalMode('create'); setIsEditOpen(true); };
    const handleEventClick = (info) => { 
        const event = info.event.toPlainObject(); 
        const props = event.extendedProps; 
        if (props.isHoliday) return; 
        setSelectedEvent({ id: event.id, title: props.title || '제목 없음', start: props.start_date.split('T')[0], end: props.end_date.split('T')[0], category: props.category || 'report', color: event.backgroundColor, description: props.description || '', user_id: props.user_id, author: props.author }); 
        setIsDetailOpen(true); 
    };
    
    // ✅ 달력 안에서 일정을 늘리거나 위치를 옮겼을 때
    const handleEventUpdate = async (info) => {
        const { event } = info;
        if (event.extendedProps.isHoliday) { info.revert(); return; }

        const startStr = event.startStr || "";
        const startDate = startStr.includes('T') ? startStr.split('T')[0] + "T00:00:00" : startStr + "T00:00:00";
        const toLocalISO = (date) => new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('.')[0];
        
        let endDate;
        if (event.end) {
            const tempEnd = new Date(event.end);
            tempEnd.setSeconds(tempEnd.getSeconds() - 1);
            endDate = toLocalISO(tempEnd);
        } else { endDate = event.startStr.split('T')[0] + "T23:59:59"; }

        try {
            await todoService.updateTodo(event.id, {
                title: event.extendedProps.title, start_date: startDate, end_date: endDate,
                category: event.extendedProps.category || 'report', color: event.backgroundColor
            });
            fetchTodos();
        } catch (e) { 
            // 🚨 실패 시 알럿창 띄우고 위치 롤백
            const errorDetail = e.response?.data?.detail || "일정 수정 중 오류가 발생했습니다.";
            alert(errorDetail); 
            info.revert(); 
        }
    };

    // ✅ 사이드바에서 드래그해서 달력에 떨어뜨렸을 때
    const handleEventReceive = async (info) => {
        const { event } = info;
        const newTodo = {
            title: event.title,
            start_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T00:00:00`,
            end_date: event.startStr.includes('T') ? event.startStr : `${event.startStr}T23:59:59`,
            color: event.backgroundColor, 
            category: event.extendedProps?.category || 'report', 
            description: event.extendedProps?.description || '',
            status: "CREATED"
        };
        
        info.revert(); // 가짜 이벤트 잔상 제거 

        try {
            await todoService.createTodo(newTodo);
            fetchTodos(); // DB 저장 성공 시 다시 그림
        } catch (e) {
            // 🚨 연차 부족 시 알럿 출력
            const errorDetail = e.response?.data?.detail || "일정 등록 중 오류가 발생했습니다.";
            alert(errorDetail);
        }
    };

    const openColorModal = (cat) => { setColorModal({ isOpen: true, targetCat: cat, selectedColor: cat.color, selectedDescription: cat.default_description || '' }); };
    const handleSaveColor = async () => { /* 기존 동일 */
        try { await todoService.updateTodoConfig({ category_key: colorModal.targetCat.category_key, color: colorModal.selectedColor, default_description: colorModal.selectedDescription }); await fetchCategoriesAndConfigs(); setColorModal({ ...colorModal, isOpen: false }); } catch (err) { alert("색상 설정에 실패했습니다."); }
    };

    useEffect(() => { /* 기존 동일 */
        fetchTodos(); fetchCategoriesAndConfigs();
        let draggable;
        if (externalEventsRef.current) {
            draggable = new Draggable(externalEventsRef.current, {
                itemSelector: '.fc-event',
                eventData: (eventEl) => ({ title: eventEl.getAttribute('data-title'), color: eventEl.getAttribute('data-color'), extendedProps: { category: eventEl.getAttribute('data-category'), description: eventEl.getAttribute('data-description') } }),
            });
        }
        return () => { if (draggable) draggable.destroy(); };
    }, [fetchTodos, fetchCategoriesAndConfigs]);

    return (
        <div className="calendar-page-container">
            <TodoSidebar ref={externalEventsRef} categories={categories} openColorModal={openColorModal} />
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
                    dayCellContent={(arg) => { /* 기존 동일 */
                        const dateStr = new Date(arg.date.getTime() - (arg.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                        const holiday = holidaysRef.current.find(h => h.holiday_date === dateStr);
                        const isHoliday = !!holiday;
                        let dateColor = '';
                        if (isHoliday) { dateColor = '#FF4B4B'; } else if (arg.date.getDay() === 0) { dateColor = '#FF4B4B'; } else if (arg.date.getDay() === 6) { dateColor = '#2E8AF6'; }
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%', padding: '2px 4px' }}>
                                <span style={{ color: dateColor, fontWeight: isHoliday ? 'bold' : 'normal' }}>{arg.dayNumberText}</span>
                                {isHoliday && <span style={{ fontSize: '0.75rem', color: '#FF4B4B', fontWeight: 'bold', marginTop: '2px' }}>{holiday.holiday_name}</span>}
                            </div>
                        );
                    }}
                    eventAllow={(dropInfo, draggedEvent) => {
                        const category = draggedEvent.extendedProps.category;
                        if (category === "vacation_am" || category === "vacation_pm") {
                            const startDate = new Date(dropInfo.start);
                            const endDate = new Date(dropInfo.end);
                            const diffTime = Math.abs(endDate - startDate);
                            const diffDays = diffTime / (1000 * 60 * 60 * 24);
                            if (diffDays > 1) {
                                alert("반차는 하루 이상 등록할 수 없습니다.");
                                return false;
                            }
                        }
                        return true;
                    }}
                    eventResizableFromStart={false}
                    eventDurationEditable={true}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    eventDrop={handleEventUpdate}
                    eventResize={handleEventUpdate}
                    eventReceive={handleEventReceive}
                />
            </section>
            {/* 컬러 모달 및 공통 모달 부분 동일 유지 */}
            {colorModal.isOpen && (
                /* 컬러 설정 모달 JSX 기존과 완전히 동일 */
                <div className="modal-overlay" onClick={() => setColorModal({...colorModal, isOpen: false})}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ textAlign: 'center' }}>{colorModal.targetCat?.icon} {colorModal.targetCat?.category_name} 색상 설정</h2>
                        <div className="color-palette" style={{ margin: '30px 0' }}>
                            {['#3DAF7A', '#FF6A3D', '#4A90E2', '#F39C12', '#9B59B6', '#141414'].map(color => (
                                <div key={color} className={`color-swatch ${colorModal.selectedColor === color ? 'selected' : ''}`} style={{ backgroundColor: color, width: '40px', height: '40px' }} onClick={() => setColorModal({...colorModal, selectedColor: color})} />
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <label style={{ fontSize: '0.9rem', color: '#666', marginRight: '10px' }}>직접 선택:</label>
                            <input type="color" value={colorModal.selectedColor} onChange={e => setColorModal({...colorModal, selectedColor: e.target.value})} style={{ verticalAlign: 'middle', cursor: 'pointer' }} />
                        </div>
                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.9rem', color: '#666', display: 'block', marginBottom: '8px' }}>📝 기본 등록 멘트 (해당 카테고리 선택 시 자동 입력)</label>
                            <textarea style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #E2DFD8', backgroundColor: '#F0EEE9', minHeight: '80px', resize: 'none' }} placeholder="예: 휴가 신청합니다." value={colorModal.selectedDescription} onChange={e => setColorModal({...colorModal, selectedDescription: e.target.value})} />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn-cancel" onClick={() => setColorModal({...colorModal, isOpen: false})}>취소</button>
                            <button type="button" className="btn-save" onClick={handleSaveColor}>저장</button>
                        </div>
                    </div>
                </div>
            )}
            <TodoEditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} mode={modalMode} selectedDate={selectedDate} event={selectedEvent} fetchTodos={fetchTodos} categories={categories} />
            <TodoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} event={selectedEvent} fetchTodos={fetchTodos} onEditClick={handleSwitchToEdit} categories={categories} />
        </div>
    );
};

export default TodoListView;