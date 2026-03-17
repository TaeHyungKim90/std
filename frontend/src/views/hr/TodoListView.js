import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { getContrastColor } from '../../utils/colorUtils';
import { todoService } from '../../services/todoService';
import { holidayService } from '../../services/holidayService'; // ✅ 공휴일 서비스 임포트
import { useAuth } from '../../context/AuthContext';
import TodoSidebar from './TodoSidebar';
import TodoEditModal from './TodoEditModal';
import TodoDetailModal from '../../components/common/TodoDetailModal';

import '../../assets/css/layout.css';
import '../../assets/css/calendar.css';

const TodoListView = () => {
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

    // ✅ 1. 함수 호이스팅 & 의존성 경고 해결 (useCallback 적용)
    const fetchCategoriesAndConfigs = useCallback(async () => {
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
                    hasCustomConfig: !!userConf, 
                    color: userConf?.color || '#3DAF7A', 
                    default_description: userConf?.default_description || ''
                };
            });

            setCategories(mergedCategories);
        } catch (err) {
            console.error("카테고리 및 설정 로드 실패", err);
        }
    }, []);

    // ✅ 2. Todo와 공휴일(Holidays)을 함께 불러와서 병합
    const fetchTodos = useCallback(async () => {
        try {
            const currentYear = new Date().getFullYear().toString();
            
            // Promise.all을 통해 할일과 올해의 공휴일을 동시에 비동기 호출
            const [todoRes, holidayRes] = await Promise.all([
                todoService.getTodos(),
                holidayService.getHolidays(currentYear)
            ]);

            // 할일(Todo) 매핑
            const formattedTodos = todoRes.data.map(todo => {
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
                    startEditable: isOwner,
                    durationEditable: isOwner,
                    extendedProps: { ...todo, isHoliday: false }, // 일반 일정 플래그
                    className: todo.category === 'vacation' ? 'event-vacation' : ''
                };
            });
            holidaysRef.current = holidayRes.data || [];

            // 합쳐서 캘린더 이벤트로 등록
            setEvents(formattedTodos);
            setHolidays(holidayRes.data || []);
        } catch (err) {
            console.error("데이터 로드 실패", err);
        }
    }, [userId]);

    // --- 이벤트 핸들러 ---
    const handleSwitchToEdit = () => { setIsDetailOpen(false); setModalMode('edit'); setIsEditOpen(true); };
    
    const handleDateClick = (info) => { 
        setSelectedDate({ start: info.dateStr, end: info.dateStr }); 
        setModalMode('create'); 
        setIsEditOpen(true); 
    };
    
    const handleEventClick = (info) => { 
        const event = info.event.toPlainObject(); 
        const props = event.extendedProps; 
        
        // ✅ 공휴일을 클릭했을 때는 일반 일정 상세 모달을 띄우지 않음
        if (props.isHoliday) return; 

        setSelectedEvent({ 
            id: event.id, 
            title: props.title || '제목 없음', 
            start: props.start_date.split('T')[0], 
            end: props.end_date.split('T')[0], 
            category: props.category || 'report', 
            color: event.backgroundColor, 
            description: props.description || '', 
            user_id: props.user_id, 
            author: props.author 
        }); 
        setIsDetailOpen(true); 
    };
    
    const handleEventUpdate = async (info) => {
        const { event } = info;
        
        // 방어 로직: 혹시라도 공휴일이 드래그되었다면 원상복구
        if (event.extendedProps.isHoliday) {
            info.revert();
            return;
        }

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
            color: event.backgroundColor, 
            category: event.extendedProps?.category || 'report', 
            description: event.extendedProps?.description || '',
            status: "CREATED"
        };
        info.revert(); 
        await todoService.createTodo(newTodo);
        fetchTodos();
    };

    const openColorModal = (cat) => {
        setColorModal({
            isOpen: true,
            targetCat: cat,
            selectedColor: cat.color, 
            selectedDescription: cat.default_description || ''
        });
    };

    const handleSaveColor = async () => {
        try {
            await todoService.updateTodoConfig({
                category_key: colorModal.targetCat.category_key,
                color: colorModal.selectedColor,
                default_description: colorModal.selectedDescription 
            });
            await fetchCategoriesAndConfigs(); 
            setColorModal({ ...colorModal, isOpen: false });
        } catch (err) {
            alert("색상 설정에 실패했습니다.");
        }
    };

    // ✅ 3. 함수 선언부 하단으로 내려온 안전한 useEffect
    useEffect(() => {
        fetchTodos();
        fetchCategoriesAndConfigs();

        let draggable;
        // DOM Ref가 존재하는지 확인하는 방어 로직 추가
        if (externalEventsRef.current) {
            draggable = new Draggable(externalEventsRef.current, {
                itemSelector: '.fc-event',
                eventData: (eventEl) => ({
                    title: eventEl.getAttribute('data-title'),
                    color: eventEl.getAttribute('data-color'), 
                    extendedProps: {
                        category: eventEl.getAttribute('data-category'),
                        description: eventEl.getAttribute('data-description')
                    }
                }),
            });
        }
        
        return () => {
            if (draggable) draggable.destroy();
        };
    }, [fetchTodos, fetchCategoriesAndConfigs]); // 의존성 배열에 완벽하게 함수 추가됨

    return (
        <div className="calendar-page-container">
            <TodoSidebar 
                ref={externalEventsRef} 
                categories={categories} 
                openColorModal={openColorModal} 
            />

            <section id="calendar-container" className="calendar-main">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                    locale="ko"
                    events={events} // 이제 여기엔 순수 할 일만 들어있습니다
                    editable={true}
                    droppable={true}
                    
                    // 👇👇 새로 추가되는 날짜 디자인 커스텀 로직 👇👇
                    dayCellContent={(arg) => {
                        // 현재 렌더링 중인 칸의 날짜를 YYYY-MM-DD 형식으로 변환
                        const dateStr = new Date(arg.date.getTime() - (arg.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                        
                        // 해당 날짜가 공휴일 배열에 존재하는지 확인
                        const holiday = holidaysRef.current.find(h => h.holiday_date === dateStr);
                        const isHoliday = !!holiday;

                        // 토, 일, 공휴일에 따른 숫자 색상 결정
                        let dateColor = '';
                        if (isHoliday) {
                            dateColor = '#FF4B4B'; // 공휴일은 무조건 빨간색
                        } else if (arg.date.getDay() === 0) {
                            dateColor = '#FF4B4B'; // 일요일 빨간색
                        } else if (arg.date.getDay() === 6) {
                            dateColor = '#2E8AF6'; // 토요일 파란색
                        }

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%', padding: '2px 4px' }}>
                                
                                <span style={{ color: dateColor, fontWeight: isHoliday ? 'bold' : 'normal' }}>
                                    {arg.dayNumberText}
                                </span>
                                {isHoliday && (
                                    <span style={{ fontSize: '0.75rem', color: '#FF4B4B', fontWeight: 'bold', marginTop: '2px' }}>
                                        {holiday.holiday_name}
                                    </span>
                                )}
                            </div>
                        );
                    }}
                    // 👆👆 여기까지 👆👆

                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    eventDrop={handleEventUpdate}
                    eventResize={handleEventUpdate}
                    eventReceive={handleEventReceive}
                />
            </section>

            {colorModal.isOpen && (
                <div className="modal-overlay" onClick={() => setColorModal({...colorModal, isOpen: false})}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ textAlign: 'center' }}>
                            {colorModal.targetCat?.icon} {colorModal.targetCat?.category_name} 색상 설정
                        </h2>
                        
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

            <TodoEditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} mode={modalMode} selectedDate={selectedDate} event={selectedEvent} fetchTodos={fetchTodos} categories={categories} />
            <TodoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} event={selectedEvent} fetchTodos={fetchTodos} onEditClick={handleSwitchToEdit} categories={categories} />
        </div>
    );
};

export default TodoListView;