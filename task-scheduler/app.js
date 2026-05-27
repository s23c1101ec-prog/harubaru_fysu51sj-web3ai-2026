/* ==========================================
   Priority Scheduler - Application Logic
   ========================================== */

// ------------------------------------------
// 1. 状態管理と初期化
// ------------------------------------------
let tasks = [];
let currentDate = new Date(); // カレンダー表示基準日
let viewMode = 'month'; // 'month' または 'week'
let overdueVisible = true; // 期限切れ未完了エリアの表示状態

// LocalStorageのキー
const STORAGE_KEY = 'priority_scheduler_tasks';
const OVERDUE_VISIBLE_KEY = 'priority_scheduler_overdue_visible';

// DOM要素の取得
const elements = {
    btnNewTask: document.getElementById('btn-new-task'),
    taskModal: document.getElementById('task-modal'),
    taskForm: document.getElementById('task-form'),
    taskId: document.getElementById('task-id'),
    taskName: document.getElementById('task-name'),
    taskDesc: document.getElementById('task-desc'),
    taskDue: document.getElementById('task-due'),
    taskRepeat: document.getElementById('task-repeat'),
    timeSettingsGroup: document.getElementById('time-settings-group'),
    timeTypeRadios: document.getElementsByName('time-type'),
    specificTimeWrapper: document.getElementById('specific-time-input-wrapper'),
    taskTime: document.getElementById('task-time'),
    taskFeedback: document.getElementById('task-feedback'),
    btnDeleteTask: document.getElementById('btn-delete-task'),
    btnCancel: document.getElementById('btn-cancel'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalTitle: document.getElementById('modal-title'),

    // ダッシュボードリスト
    overdueSection: document.getElementById('overdue-section'),
    overdueList: document.getElementById('overdue-list'),
    overdueCount: document.getElementById('overdue-count'),
    btnToggleOverdue: document.getElementById('btn-toggle-overdue'),
    toggleOverdueIcon: document.getElementById('toggle-overdue-icon'),
    toggleOverdueText: document.getElementById('toggle-overdue-text'),

    todayList: document.getElementById('today-list'),
    todayCount: document.getElementById('today-count'),
    highPriorityList: document.getElementById('high-priority-list'),
    highPriorityCount: document.getElementById('high-priority-count'),
    futureList: document.getElementById('future-list'),
    futureCount: document.getElementById('future-count'),
    currentTodayBadge: document.getElementById('current-today-badge'),

    // カレンダー
    btnMonthView: document.getElementById('btn-month-view'),
    btnWeekView: document.getElementById('btn-week-view'),
    btnPrevPeriod: document.getElementById('btn-prev-period'),
    btnNextPeriod: document.getElementById('btn-next-period'),
    calendarPeriodLabel: document.getElementById('calendar-period-label'),
    calendarWeekdays: document.getElementById('calendar-weekdays'),
    calendarGrid: document.getElementById('calendar-grid')
};

// 起動処理
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateDashboard();
    renderCalendar();
    lucide.createIcons();
});

// ------------------------------------------
// 2. ユーティリティ関数（日付・ヘルパー）
// ------------------------------------------

// 今日の日付 (YYYY-MM-DD)
function getTodayString() {
    const d = new Date();
    return formatDateString(d);
}

// Dateオブジェクトを YYYY-MM-DD 文字列に変換
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 曜日の日本語配列
const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

// ２つの日付の間の日数差を取得 (date2 - date1)
function getDaysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    const diffTime = d2 - d1;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// ------------------------------------------
// 3. データ処理とLocalStorage連携
// ------------------------------------------
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            tasks = JSON.parse(stored);
            // 過去に自動追加されたサンプルタスクを自動クリーンアップ
            const originalLength = tasks.length;
            tasks = tasks.filter(t => !t.id.startsWith('sample-'));
            if (tasks.length !== originalLength) {
                saveData();
            }
        } catch (e) {
            console.error('データのパースに失敗しました。', e);
            tasks = [];
        }
    } else {
        tasks = [];
    }

    const storedOverdueVisible = localStorage.getItem(OVERDUE_VISIBLE_KEY);
    if (storedOverdueVisible !== null) {
        overdueVisible = storedOverdueVisible === 'true';
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// initSampleData 関数は不要になったため削除されました

// ------------------------------------------
// 4. 繰り返しタスク展開ロジック (コア)
// ------------------------------------------

// 特定のタスクが、ある日付(targetDateStr)に該当（発生）するかどうかを判定
function isTaskOccurringOn(task, targetDateStr) {
    const due = task.dueDate;
    if (targetDateStr < due) return false; // 期日前は発生しない

    if (task.repeat === 'none') {
        return due === targetDateStr;
    }

    const diffDays = getDaysDifference(due, targetDateStr);

    if (task.repeat === 'weekly') {
        // 7日おき（同じ曜日）
        return diffDays % 7 === 0;
    }

    if (task.repeat === 'biweekly') {
        // 14日おき（隔週同じ曜日）
        return diffDays % 14 === 0;
    }

    return false;
}

// 指定した日付におけるタスクのインスタンス（実体）を生成
function getTaskInstanceForDate(task, dateStr) {
    const isCompleted = task.completedDates.includes(dateStr);
    return {
        ...task,
        occurrenceDate: dateStr,
        isInstanceCompleted: isCompleted
    };
}

// 特定の期間内 (startDateStr 〜 endDateStr) に発生するすべてのタスクインスタンスを取得
function getTaskInstancesInRange(startDateStr, endDateStr) {
    const instances = [];
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        tasks.forEach(task => {
            if (isTaskOccurringOn(task, dateStr)) {
                instances.push(getTaskInstanceForDate(task, dateStr));
            }
        });
    }
    return instances;
}

// ------------------------------------------
// 5. ダッシュボード表示とソート処理
// ------------------------------------------
function updateDashboard() {
    const today = getTodayString();
    elements.currentTodayBadge.textContent = formatDateJp(new Date());

    // --- 1. 期限切れの未完了タスク ---
    // 期限切れは「単発の過去のタスクかつ未完了」とする
    const overdueTasks = tasks.filter(task => {
        if (task.repeat !== 'none') return false; // 繰り返しはダッシュボードの期限切れには含めない（混乱防止）
        const isCompleted = task.completedDates.includes(task.dueDate);
        return task.dueDate < today && !isCompleted;
    });

    renderOverdueSection(overdueTasks);

    // --- 2. 今日までに行うこと ---
    // 今日発生するタスクインスタンスを取得
    const todayInstances = [];
    tasks.forEach(task => {
        if (isTaskOccurringOn(task, today)) {
            todayInstances.push(getTaskInstanceForDate(task, today));
        }
    });

    // ソート順：
    // ① 未完了が上、完了が下
    // ② 時間指定あり (specific) が上、その日中 (allday) が下
    // ③ 時間指定あり同士は、時間の昇順 (早い時間順)
    // ④ 重要度の高い順 (high > medium > low)
    todayInstances.sort((a, b) => {
        if (a.isInstanceCompleted !== b.isInstanceCompleted) {
            return a.isInstanceCompleted ? 1 : -1;
        }
        if (a.timeType !== b.timeType) {
            return a.timeType === 'specific' ? -1 : 1;
        }
        if (a.timeType === 'specific' && a.time !== b.time) {
            return a.time.localeCompare(b.time);
        }
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    renderTaskList(elements.todayList, todayInstances, today, elements.todayCount);

    // --- 3. 期日前・重要度が最も高いもの ---
    // 今日より後で、かつ重要度が「高」の未完了タスクインスタンスを抽出
    // 今後30日間の範囲で探す
    const futureStartDate = new Date();
    futureStartDate.setDate(futureStartDate.getDate() + 1);
    const futureEndDate = new Date();
    futureEndDate.setDate(futureEndDate.getDate() + 60); // 最大60日先まで

    const futureHighPriority = getTaskInstancesInRange(formatDateString(futureStartDate), formatDateString(futureEndDate))
        .filter(inst => inst.priority === 'high' && !inst.isInstanceCompleted);

    // 重複を避ける（繰り返しタスクの場合、直近の1回分のみをダッシュボードに表示する）
    const uniqueHighPriority = getUniqueInstances(futureHighPriority);
    
    // 期日の近い順
    uniqueHighPriority.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.highPriorityList, uniqueHighPriority, null, elements.highPriorityCount);

    // --- 4. 明日以降に行うこと ---
    // 明日以降（今日より後）で発生する未完了タスクインスタンス（重要度 中・低 を含む全体）
    const allFutureInstances = getTaskInstancesInRange(formatDateString(futureStartDate), formatDateString(futureEndDate))
        .filter(inst => !inst.isInstanceCompleted);

    // 重複排除（直近発生分のみ）
    const uniqueFuture = getUniqueInstances(allFutureInstances);

    // 期日の近い順にソート
    uniqueFuture.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.futureList, uniqueFuture, null, elements.futureCount);

    lucide.createIcons();
}

// 繰り返しタスクの重複排除（ダッシュボードには次の1回分のみ表示）
function getUniqueInstances(instances) {
    const seen = new Set();
    const result = [];
    instances.forEach(inst => {
        const key = `${inst.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(inst);
        }
    });
    return result;
}

// 期限切れセクションの描画
function renderOverdueSection(overdueTasks) {
    if (overdueTasks.length === 0) {
        elements.overdueSection.classList.add('hidden');
        return;
    }

    elements.overdueSection.classList.remove('hidden');
    elements.overdueCount.textContent = overdueTasks.length;

    // トグル表示の反映
    if (overdueVisible) {
        elements.overdueList.style.display = 'flex';
        elements.toggleOverdueIcon.setAttribute('data-lucide', 'eye-off');
        elements.toggleOverdueText.textContent = '非表示にする';
    } else {
        elements.overdueList.style.display = 'none';
        elements.toggleOverdueIcon.setAttribute('data-lucide', 'eye');
        elements.toggleOverdueText.textContent = '表示する';
    }

    elements.overdueList.innerHTML = '';
    overdueTasks.forEach(task => {
        // インスタンス化して渡す (期限切れ日付での完了状態)
        const inst = getTaskInstanceForDate(task, task.dueDate);
        const card = createTaskCard(inst, task.dueDate);
        elements.overdueList.appendChild(card);
    });
}

// 通常のタスクリストの描画
function renderTaskList(containerEl, instances, targetDate, countEl) {
    containerEl.innerHTML = '';
    countEl.textContent = instances.length;

    if (instances.length === 0) {
        let icon = 'calendar-days';
        let msg = '予定されているタスクはありません。';
        if (containerEl === elements.todayList) {
            icon = 'check-circle-2';
            msg = '今日のタスクはありません。素晴らしい一日を！';
        } else if (containerEl === elements.highPriorityList) {
            icon = 'star';
            msg = '期日前の最重要タスクはありません。';
        }
        
        containerEl.innerHTML = `
            <div class="empty-state">
                <i data-lucide="${icon}"></i>
                <p>${msg}</p>
            </div>
        `;
        return;
    }

    instances.forEach(inst => {
        const card = createTaskCard(inst, inst.occurrenceDate);
        containerEl.appendChild(card);
    });
}

// タスクカードHTML要素の生成
function createTaskCard(inst, occurrenceDate) {
    const card = document.createElement('div');
    card.className = `task-card priority-${inst.priority}`;
    if (inst.isInstanceCompleted) {
        card.classList.add('completed');
    }

    // 繰り返し表示用のテキスト
    let repeatText = '';
    if (inst.repeat === 'weekly') repeatText = '<span class="repeat-badge">毎週</span>';
    if (inst.repeat === 'biweekly') repeatText = '<span class="repeat-badge">隔週</span>';

    // 時間指定の表示用テキスト
    let timeText = '';
    if (inst.timeType === 'specific' && inst.time) {
        timeText = `<span class="task-meta-item time-highlight"><i data-lucide="clock"></i> ${inst.time}</span>`;
    } else {
        timeText = `<span class="task-meta-item"><i data-lucide="clock"></i> 終日</span>`;
    }

    // フィードバック要否のバッジ
    let feedbackBadge = '';
    if (inst.feedbackRequired) {
        feedbackBadge = `<span class="feedback-badge"><i data-lucide="message-square-text"></i> フィードバック要</span>`;
    }

    // 期日の日本語表示
    const dueFormatted = formatDateJpShort(new Date(occurrenceDate + 'T00:00:00'));

    card.innerHTML = `
        <div class="task-card-left">
            <div class="task-checkbox-wrapper">
                <input type="checkbox" class="task-checkbox" ${inst.isInstanceCompleted ? 'checked' : ''}>
                <span class="task-checkbox-custom"><i data-lucide="check"></i></span>
            </div>
            <div class="task-details">
                <div class="task-title-row">
                    <span class="task-title">${escapeHTML(inst.title)}</span>
                    ${feedbackBadge}
                </div>
                ${inst.description ? `<span class="task-desc-sub">${escapeHTML(inst.description)}</span>` : ''}
                <div class="task-meta-row">
                    <span class="task-meta-item"><i data-lucide="calendar"></i> ${dueFormatted}</span>
                    ${timeText}
                    ${repeatText}
                </div>
            </div>
        </div>
        <div class="task-card-right">
            <button class="btn btn-icon btn-edit-task" title="タスクを編集">
                <i data-lucide="edit-3"></i>
            </button>
        </div>
    `;

    // チェックボックスイベントハンドラ (完了切り替え)
    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => {
        toggleTaskCompletion(inst.id, occurrenceDate, checkbox.checked);
    });

    // 編集ボタンハンドラ (モーダルを開く)
    const btnEdit = card.querySelector('.btn-edit-task');
    btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(inst.id, occurrenceDate);
    });

    // カード自体をクリックしても編集モーダルを開く（チェックボックス以外）
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.task-checkbox-wrapper') && !e.target.closest('.btn-edit-task')) {
            openModal(inst.id, occurrenceDate);
        }
    });

    return card;
}

// HTMLエスケープ（XSS対策）
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// 日本語の分かりやすい日付フォーマット (例: 5月27日(水))
function formatDateJp(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = WEEKDAYS_JP[date.getDay()];
    return `${date.getFullYear()}年${month}月${day}日(${dayName})`;
}

function formatDateJpShort(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = WEEKDAYS_JP[date.getDay()];
    return `${month}月${day}日(${dayName})`;
}

// ------------------------------------------
// 6. タスク完了・削除・保存の制御
// ------------------------------------------
function toggleTaskCompletion(taskId, dateStr, isCompleted) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.completedDates) {
        task.completedDates = [];
    }

    if (isCompleted) {
        if (!task.completedDates.includes(dateStr)) {
            task.completedDates.push(dateStr);
        }
    } else {
        task.completedDates = task.completedDates.filter(d => d !== dateStr);
    }

    saveData();
    updateDashboard();
    renderCalendar();
}

function deleteTask(taskId) {
    if (confirm('このタスクを削除してもよろしいですか？（繰り返しの予定もすべて削除されます）')) {
        tasks = tasks.filter(t => t.id !== taskId);
        saveData();
        closeModal();
        updateDashboard();
        renderCalendar();
    }
}

// ------------------------------------------
// 7. カレンダーレンダリング処理
// ------------------------------------------
function renderCalendar() {
    elements.calendarGrid.innerHTML = '';
    elements.calendarWeekdays.innerHTML = '';

    // 曜日の描画
    WEEKDAYS_JP.forEach(day => {
        const span = document.createElement('span');
        span.textContent = day;
        elements.calendarWeekdays.appendChild(span);
    });

    if (viewMode === 'month') {
        renderMonthView();
    } else {
        renderWeekView();
    }
}

// 月表示カレンダー
function renderMonthView() {
    elements.calendarGrid.classList.remove('week-view');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    elements.calendarPeriodLabel.textContent = `${year}年${month + 1}月`;

    // 月の最初の日と最後の日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 開始曜日 (0:日〜6:土)
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // 先月の最後の日
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // カレンダーグリッドに配置するセルの生成 (前後月分も含む)
    const todayStr = getTodayString();
    
    // カレンダーの開始日付 (月曜日始まりではなく日曜日始まり)
    const startDate = new Date(year, month, 1 - startDayOfWeek);
    
    // 6週間分 (42セル) 描画
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41);

    // 期間内のすべてのタスクインスタンスを一括取得してマッピング
    const startStr = formatDateString(startDate);
    const endStr = formatDateString(endDate);
    const instances = getTaskInstancesInRange(startStr, endStr);

    // 日付ごとにグループ化
    const instancesByDate = {};
    instances.forEach(inst => {
        if (!instancesByDate[inst.occurrenceDate]) {
            instancesByDate[inst.occurrenceDate] = [];
        }
        instancesByDate[inst.occurrenceDate].push(inst);
    });

    // 42個のセルを描画
    let d = new Date(startDate);
    for (let i = 0; i < 42; i++) {
        const dateStr = formatDateString(d);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        // 当月以外の日付のスタイル
        if (d.getMonth() !== month) {
            dayCell.classList.add(d.getMonth() < month ? 'prev-month' : 'next-month');
        }
        
        // 今日のスタイル
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }

        dayCell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${d.getDate()}</span>
            </div>
            <div class="calendar-tasks"></div>
        `;

        const tasksContainer = dayCell.querySelector('.calendar-tasks');
        const dayInstances = instancesByDate[dateStr] || [];

        // カレンダー内タスクのソート（時間指定あり優先）
        dayInstances.sort((a, b) => {
            if (a.timeType !== b.timeType) {
                return a.timeType === 'specific' ? -1 : 1;
            }
            if (a.timeType === 'specific' && a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            return 0;
        });

        dayInstances.forEach(inst => {
            const item = document.createElement('div');
            item.className = `cal-task-item priority-${inst.priority}`;
            if (inst.isInstanceCompleted) {
                item.classList.add('completed');
            }

            // マークや時間の付与
            let label = '';
            if (inst.timeType === 'specific' && inst.time) {
                label += `${inst.time} `;
            }
            label += inst.title;

            let fbIcon = '';
            if (inst.feedbackRequired) {
                fbIcon = '<i data-lucide="message-square-text" class="cal-feedback-star"></i>';
            }

            item.innerHTML = `${fbIcon} <span>${escapeHTML(label)}</span>`;
            
            // カレンダー内のタスククリックで編集
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(inst.id, dateStr);
            });

            tasksContainer.appendChild(item);
        });

        // 空白部分をクリックしたら、その日付で新規タスクを作成
        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => {
            openModal(null, targetDateVal);
        });

        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1); // 次の日へ
    }
}

// 週表示カレンダー
function renderWeekView() {
    elements.calendarGrid.classList.add('week-view');
    const todayStr = getTodayString();

    // 今週の開始日（日曜日）を求める
    const dayOfWeek = currentDate.getDay();
    const sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - dayOfWeek);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    elements.calendarPeriodLabel.textContent = `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日 〜 ${saturday.getDate()}日`;

    const startStr = formatDateString(sunday);
    const endStr = formatDateString(saturday);
    const instances = getTaskInstancesInRange(startStr, endStr);

    const instancesByDate = {};
    instances.forEach(inst => {
        if (!instancesByDate[inst.occurrenceDate]) {
            instancesByDate[inst.occurrenceDate] = [];
        }
        instancesByDate[inst.occurrenceDate].push(inst);
    });

    // 7日間を描画
    let d = new Date(sunday);
    for (let i = 0; i < 7; i++) {
        const dateStr = formatDateString(d);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        if (dateStr === todayStr) {
            dayCell.classList.add('today');
        }

        const weekdayJp = WEEKDAYS_JP[d.getDay()];
        dayCell.innerHTML = `
            <div class="day-header">
                <span class="day-number">${d.getDate()}日 (${weekdayJp})</span>
            </div>
            <div class="calendar-tasks"></div>
        `;

        const tasksContainer = dayCell.querySelector('.calendar-tasks');
        const dayInstances = instancesByDate[dateStr] || [];

        // ソート
        dayInstances.sort((a, b) => {
            if (a.timeType !== b.timeType) {
                return a.timeType === 'specific' ? -1 : 1;
            }
            if (a.timeType === 'specific' && a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            return 0;
        });

        dayInstances.forEach(inst => {
            // 週表示用は少し大きく表示するため、詳細なカードのように表示
            const item = document.createElement('div');
            item.className = `cal-task-item priority-${inst.priority}`;
            item.style.whiteSpace = 'normal'; // 週表示は縦長なので改行可能にする
            item.style.padding = '4px 6px';
            item.style.minHeight = '36px';
            if (inst.isInstanceCompleted) {
                item.classList.add('completed');
            }

            let label = '';
            if (inst.timeType === 'specific' && inst.time) {
                label += `[${inst.time}] `;
            }
            label += inst.title;

            let fbIcon = '';
            if (inst.feedbackRequired) {
                fbIcon = '<i data-lucide="message-square-text" class="cal-feedback-star" style="margin-right:3px;"></i>';
            }

            item.innerHTML = `
                <div style="display:flex; align-items:flex-start;">
                    ${fbIcon}
                    <span style="font-weight: 600;">${escapeHTML(label)}</span>
                </div>
            `;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(inst.id, dateStr);
            });

            tasksContainer.appendChild(item);
        });

        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => {
            openModal(null, targetDateVal);
        });

        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1);
    }
}

// ------------------------------------------
// 8. モーダル制御とイベント設定
// ------------------------------------------
function openModal(taskId = null, defaultDate = null) {
    elements.taskForm.reset();
    elements.taskId.value = '';
    
    // 時間指定入力を非表示にする初期状態
    elements.specificTimeWrapper.classList.add('hidden');
    elements.timeSettingsGroup.classList.remove('hidden');

    if (taskId) {
        // 編集モード
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            elements.modalTitle.innerHTML = '<i data-lucide="edit-3"></i> タスクの編集・期日変更';
            elements.taskId.value = task.id;
            elements.taskName.value = task.title;
            elements.taskDesc.value = task.description || '';
            
            // 編集対象の期日。繰り返しの個別インスタンスから開いた場合は、
            // 「期日」として本来の基準日または編集中の該当日の日付を代入できるようにします。
            // ここではシンプルに、全体の基準日の期日を変更できるようにします（または該当日の日付にする）。
            // ユーザーは「タスクは期日を変更できるようにして」とのことなので、このタスク全体の基準日を変更します。
            elements.taskDue.value = task.dueDate;
            elements.taskRepeat.value = task.repeat;
            elements.taskFeedback.checked = task.feedbackRequired;

            // 優先度の選択
            document.querySelector(`input[name="task-priority"][value="${task.priority}"]`).checked = true;

            // 繰り返し設定がその日のみ(none)の場合のみ時間指定の選択を表示
            if (task.repeat === 'none') {
                elements.timeSettingsGroup.classList.remove('hidden');
                document.querySelector(`input[name="time-type"][value="${task.timeType}"]`).checked = true;
                if (task.timeType === 'specific') {
                    elements.specificTimeWrapper.classList.remove('hidden');
                    elements.taskTime.value = task.time || '09:00';
                }
            } else {
                elements.timeSettingsGroup.classList.add('hidden');
            }

            elements.btnDeleteTask.classList.remove('hidden');
        }
    } else {
        // 新規作成モード
        elements.modalTitle.innerHTML = '<i data-lucide="plus-circle"></i> 新規タスク追加';
        elements.btnDeleteTask.classList.add('hidden');
        if (defaultDate) {
            elements.taskDue.value = defaultDate;
        } else {
            elements.taskDue.value = getTodayString();
        }
        
        // 優先度はデフォルト「低」
        document.querySelector('input[name="task-priority"][value="low"]').checked = true;
        // 時間設定はデフォルト「終日」
        document.querySelector('input[name="time-type"][value="allday"]').checked = true;
    }

    elements.taskModal.classList.remove('hidden');
    lucide.createIcons();
}

function closeModal() {
    elements.taskModal.classList.add('hidden');
}

// ------------------------------------------
// 9. イベントリスナー定義
// ------------------------------------------
function setupEventListeners() {
    // 新規タスクボタン
    elements.btnNewTask.addEventListener('click', () => openModal());

    // キャンセルボタンと閉じるボタン
    elements.btnCancel.addEventListener('click', closeModal);
    elements.btnCloseModal.addEventListener('click', closeModal);

    // 削除ボタン
    elements.btnDeleteTask.addEventListener('click', () => {
        const id = elements.taskId.value;
        if (id) {
            deleteTask(id);
        }
    });

    // 繰り返し選択時の時間設定表示/非表示制御
    elements.taskRepeat.addEventListener('change', (e) => {
        if (e.target.value === 'none') {
            elements.timeSettingsGroup.classList.remove('hidden');
        } else {
            elements.timeSettingsGroup.classList.add('hidden');
            // 繰り返し時は「その日中」をデフォルト扱いにする
            document.querySelector('input[name="time-type"][value="allday"]').checked = true;
            elements.specificTimeWrapper.classList.add('hidden');
        }
    });

    // 時間指定のラジオボタン変更時
    Array.from(elements.timeTypeRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'specific') {
                elements.specificTimeWrapper.classList.remove('hidden');
            } else {
                elements.specificTimeWrapper.classList.add('hidden');
            }
        });
    });

    // 期限切れトグルボタン
    elements.btnToggleOverdue.addEventListener('click', () => {
        overdueVisible = !overdueVisible;
        localStorage.setItem(OVERDUE_VISIBLE_KEY, overdueVisible);
        updateDashboard();
    });

    // フォームの送信処理 (保存)
    elements.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = elements.taskId.value;
        const title = elements.taskName.value.trim();
        const description = elements.taskDesc.value.trim();
        const dueDate = elements.taskDue.value;
        const repeat = elements.taskRepeat.value;
        const feedbackRequired = elements.taskFeedback.checked;
        const priority = document.querySelector('input[name="task-priority"]:checked').value;

        // 時間設定の取得
        let timeType = 'allday';
        let time = null;
        if (repeat === 'none') {
            timeType = document.querySelector('input[name="time-type"]:checked').value;
            if (timeType === 'specific') {
                time = elements.taskTime.value;
            }
        }

        if (id) {
            // 更新処理
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                // すでに完了した日付の履歴は引き継ぐ（ただし期日変更された場合などは調整が必要かもしれないが、
                // 今回はシンプルに、履歴は維持する）
                tasks[index] = {
                    ...tasks[index],
                    title,
                    description,
                    dueDate,
                    repeat,
                    timeType,
                    time,
                    priority,
                    feedbackRequired
                };
            }
        } else {
            // 新規登録
            const newTask = {
                id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                title,
                description,
                dueDate,
                repeat,
                timeType,
                time,
                priority,
                feedbackRequired,
                completedDates: []
            };
            tasks.push(newTask);
        }

        saveData();
        closeModal();
        updateDashboard();
        renderCalendar();
    });

    // カレンダー表示切り替え
    elements.btnMonthView.addEventListener('click', () => {
        viewMode = 'month';
        elements.btnMonthView.classList.add('active');
        elements.btnWeekView.classList.remove('active');
        renderCalendar();
    });

    elements.btnWeekView.addEventListener('click', () => {
        viewMode = 'week';
        elements.btnWeekView.classList.add('active');
        elements.btnMonthView.classList.remove('active');
        renderCalendar();
    });

    // カレンダー期間移動
    elements.btnPrevPeriod.addEventListener('click', () => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentDate.setDate(currentDate.getDate() - 7);
        }
        renderCalendar();
    });

    elements.btnNextPeriod.addEventListener('click', () => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setDate(currentDate.getDate() + 7);
        }
        renderCalendar();
    });
}
