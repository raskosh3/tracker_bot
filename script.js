class HabitTracker {
    constructor() {
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

        // Загрузка данных из Telegram WebApp
        if (window.Telegram.WebApp) {
            this.setupTelegramIntegration();
        }
    }

    setupTelegramIntegration() {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();

        // Установка цвета темы Telegram
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#667eea');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
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
    }

    updateHabitProgress(habit) {
        const totalDays = 30; // За последние 30 дней
        const completedDays = Object.keys(habit.history).length;
        habit.progress = Math.round((completedDays / totalDays) * 100);

        // Обновляем серию выполнения
        this.updateStreak(habit);
    }

    updateStreak(habit) {
        const dates = Object.keys(habit.history).sort();
        let streak = 0;
        let currentDate = new Date();

        // Проверяем последовательные дни
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

    renderHabits() {
        const habitsList = document.getElementById('habitsList');
        habitsList.innerHTML = '';

        this.habits.forEach(habit => {
            const habitElement = document.createElement('div');
            habitElement.className = 'habit-card';
            habitElement.style.borderLeftColor = habit.color;

            habitElement.innerHTML = `
                <div class="habit-header">
                    <div class="habit-title">
                        <i class="fas fa-bullseye"></i>
                        ${habit.name}
                    </div>
                    <div class="habit-actions">
                        <button class="btn-icon" onclick="tracker.deleteHabit(${habit.id})">
                            <i class="fas fa-trash"></i>
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
                    ${dayName}<br>${date.getDate()}
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

        // Установка названия месяца
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                           'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        monthYear.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;

        // Генерация календаря
        calendar.innerHTML = '';

        // Заголовки дней недели
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayNames.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'day-header';
            dayElement.textContent = day;
            calendar.appendChild(dayElement);
        });

        // Получаем первый день месяца
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

        // Пустые ячейки в начале
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            calendar.appendChild(emptyDay);
        }

        // Дни месяца
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            dayElement.textContent = day;

            const dateStr = this.formatDate(new Date(this.currentYear, this.currentMonth, day));

            // Проверяем выполнение привычек в этот день
            const habitsForDay = this.habits.filter(habit => habit.history[dateStr]);
            if (habitsForDay.length > 0) {
                dayElement.classList.add('completed');

                // Градиент для нескольких привычек
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

            // Добавляем статистику при наведении
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

        document.getElementById('current-streak').textContent = currentStreak;
        document.getElementById('completion-rate').textContent = `${completionRate}%`;
        document.getElementById('total-done').textContent = totalDone;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    getDayName(dayIndex) {
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[dayIndex];
    }

    showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    setupEventListeners() {
        // Кнопка добавления привычки
        document.getElementById('addHabitBtn').addEventListener('click', () => {
            document.getElementById('habitModal').style.display = 'flex';
        });

        // Кнопка сохранения привычки
        document.getElementById('saveHabitBtn').addEventListener('click', () => {
            const name = document.getElementById('habitName').value.trim();
            const selectedColor = document.querySelector('.color-option.active')?.dataset.color || '#4CAF50';

            if (name) {
                this.addHabit(name, selectedColor);
                document.getElementById('habitModal').style.display = 'none';
                document.getElementById('habitName').value = '';
            }
        });

        // Кнопка отмены
        document.getElementById('cancelBtn').addEventListener('click', () => {
            document.getElementById('habitModal').style.display = 'none';
        });

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
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.renderCalendar();
        });

        // Закрытие модального окна при клике вне его
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('habitModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('habitModal').style.display = 'none';
            }
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('habitModal').style.display = 'flex';
            }
        });
    }
}

// Инициализация при загрузке
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new HabitTracker();

    // Добавляем несколько тестовых привычек при первом запуске
    if (!localStorage.getItem('habits')) {
        tracker.addHabit('Пить воду', '#2196F3');
        tracker.addHabit('Зарядка', '#4CAF50');
        tracker.addHabit('Чтение', '#FF9800');
    }
});

// Экспорт для глобального использования
window.tracker = tracker;