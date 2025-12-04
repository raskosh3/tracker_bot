// Инициализация Telegram WebApp БЕЗОПАСНО
function initTelegramWebApp() {
    // Проверяем несколькими способами
    let tg = null;
    
    if (typeof window !== 'undefined') {
        if (window.Telegram && window.Telegram.WebApp) {
            tg = window.Telegram.WebApp;
            console.log('Telegram WebApp найден');
        } else if (window.TelegramWebApp) {
            tg = window.TelegramWebApp;
            console.log('Telegram WebApp найден (старый формат)');
        }
    }
    
    if (tg) {
        try {
            tg.expand();
            tg.ready();
            
            // Настраиваем кнопку назад если доступна
            if (tg.BackButton) {
                tg.BackButton.onClick(() => {
                    tg.close();
                });
                tg.BackButton.show();
            }
            
            console.log('Telegram WebApp инициализирован');
        } catch (e) {
            console.log('Ошибка инициализации Telegram WebApp:', e);
        }
    } else {
        console.log('Telegram WebApp не найден - режим разработки');
        
        // Создаем заглушку для разработки
        tg = {
            expand: () => console.log('WebApp расширен (заглушка)'),
            ready: () => console.log('WebApp готов (заглушка)'),
            sendData: (data) => console.log('Данные отправлены:', data),
            close: () => console.log('WebApp закрыт (заглушка)'),
            initData: '',
            initDataUnsafe: {},
            themeParams: {
                bg_color: '#ffffff',
                text_color: '#000000'
            }
        };
    }
    
    return tg;
}

// Основной класс трекера
class HabitTracker {
    constructor() {
        // Инициализируем Telegram WebApp ПЕРВЫМ ДЕЛОМ
        this.tg = initTelegramWebApp();
        
        // Затем всё остальное
        this.habits = JSON.parse(localStorage.getItem('habits')) || [];
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        
        this.init();
    }

    init() {
        this.renderHabits();
        this.renderCalendar();
        this.setupEventListeners();
        this.updateStats();
    }

    addHabit(name, color = '#4CAF50') {
        const habit = {
            id: Date.now(),
            name,
            color,
            progress: 0,
            history: {},
            streak: 0,
            createdAt: new Date().toISOString()
        };
        
        this.habits.push(habit);
        this.saveHabits();
        this.renderHabits();
        this.showNotification(`Привычка "${name}" добавлена!`);
    }

    toggleHabitDay(habitId, dateString) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        if (habit.history[dateString]) {
            delete habit.history[dateString];
        } else {
            habit.history[dateString] = true;
        }

        this.updateHabitProgress(habit);
        this.saveHabits();
        this.renderHabits();
        this.renderCalendar();
        this.updateStats();
        
        // Отправляем данные в Telegram бота
        this.sendToTelegram({
            action: 'toggle_habit',
            habitId: habitId,
            date: dateString,
            completed: habit.history[dateString]
        });
    }

    updateHabitProgress(habit) {
        const totalDays = 30;
        const completedDays = Object.keys(habit.history).length;
        habit.progress = Math.round((completedDays / totalDays) * 100);
        
        // Обновляем серию выполнения
        this.updateStreak(habit);
    }

    updateStreak(habit) {
        const dates = Object.keys(habit.history).sort();
        let streak = 0;
        let currentDate = new Date();
        
        for (let i = 0; i < 365; i++) {
            const dateStr = this.formatDate(currentDate);
            if (habit.history[dateStr]) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        habit.streak = streak;
    }

    deleteHabit(habitId) {
        this.habits = this.habits.filter(h => h.id !== habitId);
        this.saveHabits();
        this.renderHabits();
        this.updateStats();
        this.showNotification('Привычка удалена');
    }

    saveHabits() {
        localStorage.setItem('habits', JSON.stringify(this.habits));
    }

    sendToTelegram(data) {
        if (this.tg && this.tg.sendData) {
            try {
                this.tg.sendData(JSON.stringify(data));
            } catch (e) {
                console.log('Не удалось отправить данные в Telegram:', e);
            }
        }
    }

    renderHabits() {
        const habitsList = document.getElementById('habitsList');
        if (!habitsList) return;
        
        habitsList.innerHTML = '';

        this.habits.forEach(habit => {
            const habitElement = document.createElement('div');
            habitElement.className = 'habit-card';
            habitElement.style.borderLeftColor = habit.color;

            habitElement.innerHTML = `
                <div class="habit-header">
                    <div class="habit-title">
                        <span class="icon-fallback">🎯</span>
                        ${habit.name}
                    </div>
                    <div class="habit-actions">
                        <button class="btn-icon" onclick="tracker.deleteHabit(${habit.id})">
                            <span class="icon-fallback">🗑</span>
                        </button>
                    </div>
                </div>
                <div class="progress-container">
                    <div class="progress-info">
                        <span>Прогресс: ${habit.progress}%</span>
                        <span>🔥 ${habit.streak} дней</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${habit.progress}%; background: ${habit.color};"></div>
                    </div>
                </div>
                <div class="days-grid" id="days-${habit.id}">
                    ${this.generateWeekDays(habit)}
                </div>
            `;

            habitsList.appendChild(habitElement);
            this.attachDayClicks(habit.id);
        });
    }

    generateWeekDays(habit) {
        let html = '';
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = this.formatDate(date);
            const isCompleted = habit.history[dateStr];
            const dayName = this.getDayName(date.getDay());
            
            html += `
                <div class="day ${isCompleted ? 'completed' : ''}" 
                     data-date="${dateStr}"
                     data-habit="${habit.id}"
                     style="${isCompleted ? `background: ${habit.color}` : ''}">
                    ${dayName}<br><small>${date.getDate()}</small>
                </div>
            `;
        }
        
        return html;
    }

    attachDayClicks(habitId) {
        const daysContainer = document.getElementById(`days-${habitId}`);
        if (!daysContainer) return;

        daysContainer.querySelectorAll('.day').forEach(day => {
            day.addEventListener('click', (e) => {
                const dateStr = e.currentTarget.dataset.date;
                this.toggleHabitDay(habitId, dateStr);
            });
        });
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        const monthYear = document.getElementById('currentMonth');
        
        if (!calendar || !monthYear) return;

        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                           'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        monthYear.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;

        calendar.innerHTML = '';
        
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayNames.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'day-header';
            dayElement.textContent = day;
            calendar.appendChild(dayElement);
        });

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            calendar.appendChild(emptyDay);
        }

        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            dayElement.textContent = day;
            
            const dateStr = this.formatDate(new Date(this.currentYear, this.currentMonth, day));
            
            const habitsForDay = this.habits.filter(habit => habit.history[dateStr]);
            if (habitsForDay.length > 0) {
                dayElement.classList.add('completed');
                
                if (habitsForDay.length > 1) {
                    const gradient = habitsForDay.map((habit, index) => {
                        const position = (index / habitsForDay.length) * 100;
                        const nextPosition = ((index + 1) / habitsForDay.length) * 100;
                        return `${habit.color} ${position}% ${nextPosition}%`;
                    }).join(', ');
                    
                    dayElement.style.background = `linear-gradient(135deg, ${gradient})`;
                } else {
                    dayElement.style.background = habitsForDay[0].color;
                }
            }
            
            dayElement.title = `Выполнено привычек: ${habitsForDay.length}`;
            
            calendar.appendChild(dayElement);
        }
    }

    updateStats() {
        const totalHabits = this.habits.length;
        let totalCompleted = 0;
        let currentStreak = 0;
        let totalDone = 0;

        this.habits.forEach(habit => {
            totalCompleted += habit.progress;
            currentStreak = Math.max(currentStreak, habit.streak);
            totalDone += Object.keys(habit.history).length;
        });

        const completionRate = totalHabits > 0 ? Math.round(totalCompleted / totalHabits) : 0;

        const currentStreakEl = document.getElementById('current-streak');
        const completionRateEl = document.getElementById('completion-rate');
        const totalDoneEl = document.getElementById('total-done');
        
        if (currentStreakEl) currentStreakEl.textContent = currentStreak;
        if (completionRateEl) completionRateEl.textContent = `${completionRate}%`;
        if (totalDoneEl) totalDoneEl.textContent = totalDone;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getDayName(dayIndex) {
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[dayIndex];
    }

    showNotification(message) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    setupEventListeners() {
        // Кнопка добавления привычки
        const addHabitBtn = document.getElementById('addHabitBtn');
        if (addHabitBtn) {
            addHabitBtn.addEventListener('click', () => {
                document.getElementById('habitModal').style.display = 'flex';
            });
        }

        // Кнопка сохранения привычки
        const saveHabitBtn = document.getElementById('saveHabitBtn');
        if (saveHabitBtn) {
            saveHabitBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('habitName');
                if (!nameInput) return;
                
                const name = nameInput.value.trim();
                const selectedColor = document.querySelector('.color-option.active')?.dataset.color || '#4CAF50';
                
                if (name) {
                    this.addHabit(name, selectedColor);
                    document.getElementById('habitModal').style.display = 'none';
                    nameInput.value = '';
                }
            });
        }

        // Кнопка отмены
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('habitModal').style.display = 'none';
            });
        }

        // Выбор цвета
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
            });
        });

        // Навигация по месяцам
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.currentMonth--;
                if (this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
                this.renderCalendar();
            });
        }
        
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.currentMonth++;
                if (this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
                this.renderCalendar();
            });
        }

        // Закрытие модального окна
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('habitModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Инициализация при загрузке
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, инициализируем трекер...');
    
    try {
        tracker = new HabitTracker();
        window.tracker = tracker;
        
        // Добавляем несколько тестовых привычек при первом запуске
        if (!localStorage.getItem('habits')) {
            tracker.addHabit('Пить воду', '#2196F3');
            tracker.addHabit('Зарядка', '#4CAF50');
            tracker.addHabit('Чтение', '#FF9800');
        }
        
        console.log('Трекер успешно инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации трекера:', error);
        
        // Аварийный режим
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <h2>😕 Что-то пошло не так</h2>
                    <p>Попробуйте обновить страницу или перезапустить Telegram.</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 10px; margin-top: 20px;">
                        Обновить
                    </button>
                </div>
            `;
        }
    }
});

// Экспорт для глобального использования
window.tracker = tracker;
