/* ==========================================
   Priority Scheduler - Application Logic (V2)
   ========================================== */

// ------------------------------------------
// 1. 状態管理と初期化
// ------------------------------------------
let items = []; // タスクと予定の両方を格納する配列
let currentDate = new Date(); // カレンダー表示基準日
let viewMode = 'month'; // 'month' または 'week'
let overdueVisible = true; // 期限切れ未完了エリアの表示状態

// Google API 設定情報
let googleConfig = {
    clientId: '',
    apiKey: '',
    accessToken: null
};

// LocalStorageのキー
const STORAGE_KEY = 'priority_scheduler_items_v2';
const OVERDUE_VISIBLE_KEY = 'priority_scheduler_overdue_visible_v2';
const GOOGLE_CONFIG_KEY = 'priority_scheduler_google_config';

// DOM要素の取得
const elements = {
    // ナビゲーション
    tabToday: document.getElementById('tab-today'),
    tabCalendar: document.getElementById('tab-calendar'),
    tabSettings: document.getElementById('tab-settings'),
    viewToday: document.getElementById('view-today'),
    viewCalendar: document.getElementById('view-calendar'),
    viewSettings: document.getElementById('view-settings'),

    // アクションボタン
    btnNewItem: document.getElementById('btn-new-item'),
    itemModal: document.getElementById('item-modal'),
    itemForm: document.getElementById('item-form'),
    itemId: document.getElementById('item-id'),
    itemType: document.getElementById('item-type'),
    itemTitle: document.getElementById('item-title'),
    itemDesc: document.getElementById('item-desc'),
    btnDeleteItem: document.getElementById('btn-delete-item'),
    btnCancel: document.getElementById('btn-cancel'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalTitle: document.getElementById('modal-title'),

    // タブ (モーダル内)
    modalTabTask: document.getElementById('modal-tab-task'),
    modalTabEvent: document.getElementById('modal-tab-event'),
    fieldsTask: document.getElementById('fields-task'),
    fieldsEvent: document.getElementById('fields-event'),

    // タスク用入力項目
    taskDue: document.getElementById('task-due'),
    taskRepeat: document.getElementById('task-repeat'),
    timeSettingsGroup: document.getElementById('time-settings-group'),
    timeTypeRadios: document.getElementsByName('time-type'),
    specificTimeWrapper: document.getElementById('specific-time-input-wrapper'),
    taskTime: document.getElementById('task-time'),
    taskFeedback: document.getElementById('task-feedback'),
    taskEmailTo: document.getElementById('task-email-to'),

    // 予定用入力項目
    eventDate: document.getElementById('event-date'),
    eventSyncGoogle: document.getElementById('event-sync-google'),
    eventStartTime: document.getElementById('event-start-time'),
    eventEndTime: document.getElementById('event-end-time'),

    // タイムライン
    timelineContainer: document.getElementById('timeline-container'),
    timelineDateBadge: document.getElementById('timeline-date-badge'),

    // タスクリスト（ダッシュボード）
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
    googleSyncStatus: document.getElementById('google-sync-status'),

    // カレンダー
    btnMonthView: document.getElementById('btn-month-view'),
    btnWeekView: document.getElementById('btn-week-view'),
    btnPrevPeriod: document.getElementById('btn-prev-period'),
    btnNextPeriod: document.getElementById('btn-next-period'),
    calendarPeriodLabel: document.getElementById('calendar-period-label'),
    calendarWeekdays: document.getElementById('calendar-weekdays'),
    calendarGrid: document.getElementById('calendar-grid'),

    // 設定画面
    googleSettingsForm: document.getElementById('google-settings-form'),
    googleCredentialsInputs: document.getElementById('google-credentials-inputs'),
    googleClientId: document.getElementById('google-client-id'),
    googleApiKey: document.getElementById('google-api-key'),
    btnGoogleAuth: document.getElementById('btn-google-auth')
};

// 起動処理
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupNavigation();
    setupEventListeners();
    updateDashboard();
    renderCalendar();
    lucide.createIcons();
    
    // Google API クライアント初期化準備
    if (googleConfig.clientId) {
        initGoogleApi();
    }
});

// ------------------------------------------
// 2. ユーティリティ関数（日付・ヘルパー）
// ------------------------------------------
function getTodayString() {
    return formatDateString(new Date());
}

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

function getDaysDifference(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

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
// 3. データ処理とLocalStorage連携
// ------------------------------------------
function loadData() {
    // 設定のロード
    const storedConfig = localStorage.getItem(GOOGLE_CONFIG_KEY);
    if (storedConfig) {
        try {
            googleConfig = { ...googleConfig, ...JSON.parse(storedConfig) };
        } catch(e) { console.error(e); }
    }
    
    // UIへの設定値反映
    elements.googleClientId.value = googleConfig.clientId || '';
    elements.googleApiKey.value = googleConfig.apiKey || '';

    // 表示トグルのロード
    const storedOverdueVisible = localStorage.getItem(OVERDUE_VISIBLE_KEY);
    if (storedOverdueVisible !== null) {
        overdueVisible = storedOverdueVisible === 'true';
    }

    // アイテムのロード
    const storedItems = localStorage.getItem(STORAGE_KEY);
    if (storedItems) {
        try {
            items = JSON.parse(storedItems);
        } catch (e) {
            console.error('データのパースに失敗しました。', e);
            items = [];
        }
    } else {
        items = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ------------------------------------------
// 4. SPAビューナビゲーション
// ------------------------------------------
function setupNavigation() {
    const tabs = [
        { btn: elements.tabToday, view: elements.viewToday },
        { btn: elements.tabCalendar, view: elements.viewCalendar },
        { btn: elements.tabSettings, view: elements.viewSettings }
    ];

    tabs.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            tabs.forEach(t => {
                t.btn.classList.remove('active');
                t.view.classList.add('hidden-view');
            });
            tab.btn.classList.add('active');
            tab.view.classList.remove('hidden-view');
            
            // ビュー切り替え時に再レンダリング
            if (tab.view === elements.viewToday) {
                updateDashboard();
            } else if (tab.view === elements.viewCalendar) {
                renderCalendar();
            }
            lucide.createIcons();
        });
    });
}

// ------------------------------------------
// 5. Google / Gmail デモ・同期ロジック
// ------------------------------------------

// 表示用のアイテム（手動登録＋Googleデモ同期分）を一括取得する関数
function getAllDisplayItems() {
    return [...items];
}

// Google APIsの認証と初期化 (実際の設定がされている場合)
let gapiInited = false;
let gisiInited = false;
let tokenClient;

function initGoogleApi() {
    // 外部からGoogle APIライブラリを非同期で安全に読み込みます。
    // 今回は簡易版として、デモモードを標準装備し、本番キーがある場合は本番リクエストを投げる構成にします。
    console.log("Google API Initializing...");
}

// ------------------------------------------
// 6. 予定・タスクの期間展開およびフィルタリング
// ------------------------------------------

// 特定のアイテムが、ある日付(targetDateStr)に該当（発生）するかどうかを判定
function isItemOccurringOn(item, targetDateStr) {
    if (item.type === 'event') {
        return item.startDate === targetDateStr;
    }

    // タスク(Task)の場合の繰り返し判定
    const due = item.dueDate;
    if (targetDateStr < due) return false; // 期日前は発生しない

    if (item.repeat === 'none') {
        return due === targetDateStr;
    }

    const diffDays = getDaysDifference(due, targetDateStr);
    if (item.repeat === 'weekly') {
        return diffDays % 7 === 0;
    }
    if (item.repeat === 'biweekly') {
        return diffDays % 14 === 0;
    }
    return false;
}

// 指定した日付におけるタスクまたは予定のインスタンスを作成
function getItemInstanceForDate(item, dateStr) {
    if (item.type === 'event') {
        return { ...item, occurrenceDate: dateStr, isInstanceCompleted: false };
    }
    
    // タスクの場合
    const isCompleted = item.completedDates ? item.completedDates.includes(dateStr) : false;
    return {
        ...item,
        occurrenceDate: dateStr,
        isInstanceCompleted: isCompleted
    };
}

// 特定期間内に発生するすべてのアイテム（タスク・予定）インスタンスを取得
function getItemInstancesInRange(startDateStr, endDateStr) {
    const instances = [];
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    const allItems = getAllDisplayItems();

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateString(d);
        allItems.forEach(item => {
            if (isItemOccurringOn(item, dateStr)) {
                instances.push(getItemInstanceForDate(item, dateStr));
            }
        });
    }
    return instances;
}

// ------------------------------------------
// 7. 今日のタイムライン（スケジュール割）のレンダリング
// ------------------------------------------
function renderTimeline() {
    elements.timelineContainer.innerHTML = '';
    elements.timelineDateBadge.textContent = formatDateJp(new Date());

    const today = getTodayString();
    
    // 06:00 から 24:00 までの時間割を作成
    const startHour = 6;
    const endHour = 24;
    const hourHeight = 60; // 1時間 = 60px

    // タイムライン時間グリッドの描画
    for (let h = startHour; h <= endHour; h++) {
        const row = document.createElement('div');
        row.className = 'timeline-hour-row';
        row.style.top = `${(h - startHour) * hourHeight}px`;

        const label = document.createElement('span');
        label.className = 'hour-label';
        label.textContent = `${String(h).padStart(2, '0')}:00`;

        row.appendChild(label);
        elements.timelineContainer.appendChild(row);
    }

    // 今日のすべての予定（Event）と時間指定のあるタスクを抽出して配置
    const todayInstances = getItemInstancesInRange(today, today);
    
    // A. 予定（Event）の配置
    const todayEvents = todayInstances.filter(inst => inst.type === 'event');

    todayEvents.forEach(evt => {
        const startMin = timeToMinutes(evt.startTime);
        const endMin = timeToMinutes(evt.endTime);
        const timelineStart = startHour * 60; // 06:00を0分とする

        // タイムライン範囲内 (06:00 - 24:00) の場合のみ配置
        if (startMin >= timelineStart && startMin < endHour * 60) {
            const topPx = (startMin - timelineStart) * (hourHeight / 60);
            const heightPx = Math.max(30, (endMin - startMin) * (hourHeight / 60)); // 最低高30px

            const card = document.createElement('div');
            card.className = 'timeline-event-card';
            if (evt.isGoogleEvent) {
                card.classList.add('google-event');
            }
            card.style.top = `${topPx}px`;
            card.style.height = `${heightPx}px`;

            // 表示ラベル
            let iconHtml = evt.isGoogleEvent ? '<i data-lucide="chrome" class="inline-icon" style="color:var(--color-primary);"></i>' : '<i data-lucide="calendar" class="inline-icon" style="color:var(--color-event);"></i>';
            card.innerHTML = `
                <div class="timeline-event-title">${iconHtml} ${escapeHTML(evt.title)}</div>
                <div class="timeline-event-time">
                    <i data-lucide="clock"></i> ${evt.startTime} 〜 ${evt.endTime}
                </div>
            `;

            // クリックで編集
            card.addEventListener('click', () => {
                if (!evt.isGoogleEvent) {
                    openModal(evt.id, today, 'event');
                }
            });

            elements.timelineContainer.appendChild(card);
        }
    });

    // B. 時間指定のあるタスクをタイムライン上にドット（目印）としてプロット
    const todaySpecificTasks = todayInstances.filter(inst => inst.type === 'task' && inst.timeType === 'specific');
    todaySpecificTasks.forEach(task => {
        const taskMin = timeToMinutes(task.time);
        const timelineStart = startHour * 60;
        
        if (taskMin >= timelineStart && taskMin < endHour * 60) {
            const topPx = (taskMin - timelineStart) * (hourHeight / 60);
            const marker = document.createElement('div');
            marker.className = `timeline-task-marker priority-${task.priority}`;
            marker.style.top = `${topPx + 24}px`; // 境界線に揃えるための微調整
            marker.title = `タスク: ${task.title} (${task.time})`;
            
            elements.timelineContainer.appendChild(marker);
        }
    });
}

// ------------------------------------------
// 8. タスク管理ダッシュボードのレンダリング
// ------------------------------------------
function updateDashboard() {
    const today = getTodayString();
    
    // タイムラインのレンダリング
    renderTimeline();

    const allDisplayItems = getAllDisplayItems();

    // --- 1. 期限切れの未完了タスク ---
    // 期限切れは「単発の過去のタスクかつ未完了」とする
    const overdueTasks = allDisplayItems.filter(item => {
        if (item.type !== 'task' || item.repeat !== 'none') return false;
        const isCompleted = item.completedDates.includes(item.dueDate);
        return item.dueDate < today && !isCompleted;
    });

    renderOverdueSection(overdueTasks);

    // --- 2. 今日までに行うこと (タスクのみ) ---
    const todayInstances = [];
    allDisplayItems.forEach(item => {
        if (item.type === 'task' && isItemOccurringOn(item, today)) {
            todayInstances.push(getItemInstanceForDate(item, today));
        }
    });

    // ソート順：未完了優先 ＞ 時間指定優先 ＞ 時間順 ＞ 優先度順
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

    // --- 3. 重要度「高」のタスク (期日前) ---
    const futureStartDate = new Date();
    futureStartDate.setDate(futureStartDate.getDate() + 1);
    const futureEndDate = new Date();
    futureEndDate.setDate(futureEndDate.getDate() + 60);

    const futureHighPriority = getItemInstancesInRange(formatDateString(futureStartDate), formatDateString(futureEndDate))
        .filter(inst => inst.type === 'task' && inst.priority === 'high' && !inst.isInstanceCompleted);

    const uniqueHighPriority = getUniqueInstances(futureHighPriority);
    uniqueHighPriority.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.highPriorityList, uniqueHighPriority, null, elements.highPriorityCount);

    // --- 4. 明日以降に行うこと (タスクのみ) ---
    const allFutureTasks = getItemInstancesInRange(formatDateString(futureStartDate), formatDateString(futureEndDate))
        .filter(inst => inst.type === 'task' && !inst.isInstanceCompleted);

    const uniqueFuture = getUniqueInstances(allFutureTasks);
    uniqueFuture.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    renderTaskList(elements.futureList, uniqueFuture, null, elements.futureCount);

    lucide.createIcons();
}

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

function renderOverdueSection(overdueTasks) {
    if (overdueTasks.length === 0) {
        elements.overdueSection.classList.add('hidden');
        return;
    }

    elements.overdueSection.classList.remove('hidden');
    elements.overdueCount.textContent = overdueTasks.length;

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
        const inst = getItemInstanceForDate(task, task.dueDate);
        const card = createTaskCard(inst, task.dueDate);
        elements.overdueList.appendChild(card);
    });
}

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

// タスクカードのDOM生成 (Gmail連携用の返信ボタンやタグ対応)
function createTaskCard(inst, occurrenceDate) {
    const card = document.createElement('div');
    card.className = `task-card priority-${inst.priority}`;
    if (inst.isInstanceCompleted) {
        card.classList.add('completed');
    }
    if (inst.isGmailTask) {
        card.classList.add('gmail-task');
    }

    let repeatText = '';
    if (inst.repeat === 'weekly') repeatText = '<span class="repeat-badge">毎週</span>';
    if (inst.repeat === 'biweekly') repeatText = '<span class="repeat-badge">隔週</span>';

    let timeText = '';
    if (inst.timeType === 'specific' && inst.time) {
        timeText = `<span class="task-meta-item time-highlight"><i data-lucide="clock"></i> ${inst.time}</span>`;
    } else {
        timeText = `<span class="task-meta-item"><i data-lucide="clock"></i> 終日</span>`;
    }

    // Gmail/フィードバック表示
    let feedbackBadge = '';
    if (inst.isGmailTask) {
        feedbackBadge = `<span class="gmail-badge"><i data-lucide="mail"></i> 返信要(Gmail)</span>`;
    } else if (inst.feedbackRequired) {
        feedbackBadge = `<span class="feedback-badge"><i data-lucide="message-square-text"></i> フィードバック要</span>`;
    }

    const dueFormatted = formatDateJpShort(new Date(occurrenceDate + 'T00:00:00'));

    // クイック返信アクションボタン (メールアドレスが入っているか、またはGmail同期されたもの)
    let replyButton = '';
    if (inst.isGmailTask || (inst.feedbackRequired && inst.emailTo)) {
        const targetTo = inst.emailTo || '';
        const targetSub = inst.emailSubject || `Re: ${inst.title}`;
        const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetTo)}&su=${encodeURIComponent(targetSub)}`;
        replyButton = `
            <button class="btn-gmail-reply" onclick="event.stopPropagation(); window.open('${gmailComposeUrl}', '_blank')">
                <i data-lucide="reply"></i> 返信する
            </button>
        `;
    }

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
            ${replyButton}
            <button class="btn btn-icon btn-edit-item" title="編集">
                <i data-lucide="edit-3"></i>
            </button>
        </div>
    `;

    // イベントリスナー
    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => {
        toggleTaskCompletion(inst.id, occurrenceDate, checkbox.checked);
    });

    const btnEdit = card.querySelector('.btn-edit-item');
    btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(inst.id, occurrenceDate, 'task');
    });

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.task-checkbox-wrapper') && !e.target.closest('.btn-gmail-reply') && !e.target.closest('.btn-edit-item')) {
            openModal(inst.id, occurrenceDate, 'task');
        }
    });

    return card;
}

function toggleTaskCompletion(taskId, dateStr, isCompleted) {
    const item = items.find(i => i.id === taskId);
    if (!item) return;

    if (!item.completedDates) {
        item.completedDates = [];
    }

    if (isCompleted) {
        if (!item.completedDates.includes(dateStr)) {
            item.completedDates.push(dateStr);
        }
    } else {
        item.completedDates = item.completedDates.filter(d => d !== dateStr);
    }

    saveData();
    updateDashboard();
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ------------------------------------------
// 9. カレンダーのレンダリング (枠固定スクロール対応)
// ------------------------------------------
function renderCalendar() {
    elements.calendarGrid.innerHTML = '';
    elements.calendarWeekdays.innerHTML = '';

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

function renderMonthView() {
    elements.calendarGrid.classList.remove('week-view');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    elements.calendarPeriodLabel.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();

    const startDate = new Date(year, month, 1 - startDayOfWeek);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41);

    const startStr = formatDateString(startDate);
    const endStr = formatDateString(endDate);
    const instances = getItemInstancesInRange(startStr, endStr);

    const instancesByDate = {};
    instances.forEach(inst => {
        if (!instancesByDate[inst.occurrenceDate]) {
            instancesByDate[inst.occurrenceDate] = [];
        }
        instancesByDate[inst.occurrenceDate].push(inst);
    });

    let d = new Date(startDate);
    const todayStr = getTodayString();

    for (let i = 0; i < 42; i++) {
        const dateStr = formatDateString(d);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        if (d.getMonth() !== month) {
            dayCell.classList.add(d.getMonth() < month ? 'prev-month' : 'next-month');
        }
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

        // ソート: 予定(Event)優先 ＞ タスク時間指定 ＞ タスク終日
        dayInstances.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
            const timeA = a.type === 'event' ? a.startTime : (a.timeType === 'specific' ? a.time : '24:00');
            const timeB = b.type === 'event' ? b.startTime : (b.timeType === 'specific' ? b.time : '24:00');
            return timeA.localeCompare(timeB);
        });

        dayInstances.forEach(inst => {
            const item = document.createElement('div');
            item.className = `cal-task-item`;
            
            if (inst.type === 'event') {
                if (inst.isGoogleEvent) {
                    item.classList.add('google-event-item');
                } else {
                    item.classList.add('event-item');
                }
            } else {
                item.classList.add(`priority-${inst.priority}`);
                if (inst.isInstanceCompleted) {
                    item.classList.add('completed');
                }
            }

            // マーク
            let label = '';
            if (inst.type === 'event') {
                label = `📅 [${inst.startTime}] ${inst.title}`;
            } else {
                const timePrefix = (inst.timeType === 'specific' && inst.time) ? `[${inst.time}] ` : '';
                const star = inst.feedbackRequired ? '💬 ' : '';
                label = `${star}${timePrefix}${inst.title}`;
            }

            item.innerHTML = `<span>${escapeHTML(label)}</span>`;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!inst.isGoogleEvent) {
                    openModal(inst.id, dateStr, inst.type);
                }
            });

            tasksContainer.appendChild(item);
        });

        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => {
            openModal(null, targetDateVal, 'task');
        });

        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1);
    }
}

function renderWeekView() {
    elements.calendarGrid.classList.add('week-view');
    const todayStr = getTodayString();

    const dayOfWeek = currentDate.getDay();
    const sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - dayOfWeek);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    elements.calendarPeriodLabel.textContent = `${sunday.getFullYear()}年${sunday.getMonth() + 1}月${sunday.getDate()}日 〜 ${saturday.getDate()}日`;

    const startStr = formatDateString(sunday);
    const endStr = formatDateString(saturday);
    const instances = getItemInstancesInRange(startStr, endStr);

    const instancesByDate = {};
    instances.forEach(inst => {
        if (!instancesByDate[inst.occurrenceDate]) {
            instancesByDate[inst.occurrenceDate] = [];
        }
        instancesByDate[inst.occurrenceDate].push(inst);
    });

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

        dayInstances.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
            const timeA = a.type === 'event' ? a.startTime : (a.timeType === 'specific' ? a.time : '24:00');
            const timeB = b.type === 'event' ? b.startTime : (b.timeType === 'specific' ? b.time : '24:00');
            return timeA.localeCompare(timeB);
        });

        dayInstances.forEach(inst => {
            const item = document.createElement('div');
            item.className = `cal-task-item`;
            item.style.whiteSpace = 'normal';
            item.style.padding = '4px 6px';
            item.style.minHeight = '36px';
            
            if (inst.type === 'event') {
                if (inst.isGoogleEvent) {
                    item.classList.add('google-event-item');
                } else {
                    item.classList.add('event-item');
                }
            } else {
                item.classList.add(`priority-${inst.priority}`);
                if (inst.isInstanceCompleted) {
                    item.classList.add('completed');
                }
            }

            let label = '';
            if (inst.type === 'event') {
                label = `📅 [${inst.startTime}-${evt.endTime}] ${inst.title}`;
            } else {
                const timePrefix = (inst.timeType === 'specific' && inst.time) ? `[${inst.time}] ` : '';
                label = `${timePrefix}${inst.title}`;
            }

            let fbIcon = '';
            if (inst.type === 'task' && inst.feedbackRequired) {
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
                if (!inst.isGoogleEvent) {
                    openModal(inst.id, dateStr, inst.type);
                }
            });

            tasksContainer.appendChild(item);
        });

        const targetDateVal = dateStr;
        dayCell.addEventListener('click', () => {
            openModal(null, targetDateVal, 'task');
        });

        elements.calendarGrid.appendChild(dayCell);
        d.setDate(d.getDate() + 1);
    }
}

// ------------------------------------------
// 10. モーダルの動作制御 (タスク・予定の切り替え)
// ------------------------------------------
function openModal(id = null, defaultDate = null, defaultType = 'task') {
    elements.itemForm.reset();
    elements.itemId.value = '';
    
    // タブの初期切り替え
    setModalType(defaultType);

    if (id) {
        // 編集モード
        const item = items.find(i => i.id === id);
        if (item) {
            elements.itemId.value = item.id;
            elements.itemTitle.value = item.title;
            elements.itemDesc.value = item.description || '';
            setModalType(item.type);

            if (item.type === 'task') {
                elements.modalTitle.innerHTML = '<i data-lucide="edit-3"></i> タスクの編集';
                elements.taskDue.value = item.dueDate;
                elements.taskRepeat.value = item.repeat;
                elements.taskFeedback.checked = item.feedbackRequired;
                elements.taskEmailTo.value = item.emailTo || '';
                document.querySelector(`input[name="task-priority"][value="${item.priority}"]`).checked = true;

                if (item.repeat === 'none') {
                    elements.timeSettingsGroup.classList.remove('hidden');
                    document.querySelector(`input[name="time-type"][value="${item.timeType}"]`).checked = true;
                    if (item.timeType === 'specific') {
                        elements.specificTimeWrapper.classList.remove('hidden');
                        elements.taskTime.value = item.time || '09:00';
                    }
                } else {
                    elements.timeSettingsGroup.classList.add('hidden');
                }
            } else {
                elements.modalTitle.innerHTML = '<i data-lucide="edit-3"></i> 予定の編集';
                elements.eventDate.value = item.startDate;
                elements.eventStartTime.value = item.startTime;
                elements.eventEndTime.value = item.endTime;
                elements.eventSyncGoogle.checked = !!item.syncGoogle;
            }
            elements.btnDeleteItem.classList.remove('hidden');
        }
    } else {
        // 新規作成モード
        elements.modalTitle.innerHTML = '<i data-lucide="plus-circle"></i> 新規アイテム作成';
        elements.btnDeleteItem.classList.add('hidden');
        
        const dateVal = defaultDate || getTodayString();
        elements.taskDue.value = dateVal;
        elements.eventDate.value = dateVal;
        
        document.querySelector('input[name="task-priority"][value="low"]').checked = true;
        document.querySelector('input[name="time-type"][value="allday"]').checked = true;
        elements.specificTimeWrapper.classList.add('hidden');
        elements.timeSettingsGroup.classList.remove('hidden');
    }

    elements.itemModal.classList.remove('hidden');
    lucide.createIcons();
}

function setModalType(type) {
    elements.itemType.value = type;
    if (type === 'task') {
        elements.modalTabTask.classList.add('active');
        elements.modalTabEvent.classList.remove('active');
        elements.fieldsTask.classList.remove('hidden');
        elements.fieldsEvent.classList.add('hidden');
    } else {
        elements.modalTabEvent.classList.add('active');
        elements.modalTabTask.classList.remove('active');
        elements.fieldsEvent.classList.remove('hidden');
        elements.fieldsTask.classList.add('hidden');
    }
}

function closeModal() {
    elements.itemModal.classList.add('hidden');
}

function deleteItem(id) {
    if (confirm('このアイテムを削除しますか？')) {
        items = items.filter(i => i.id !== id);
        saveData();
        closeModal();
        updateDashboard();
        renderCalendar();
    }
}

// ------------------------------------------
// 11. イベントリスナーと初期フック
// ------------------------------------------
function setupEventListeners() {
    // 新規作成ボタン
    elements.btnNewItem.addEventListener('click', () => openModal(null, getTodayString(), 'task'));

    // 閉じる & キャンセル
    elements.btnCloseModal.addEventListener('click', closeModal);
    elements.btnCancel.addEventListener('click', closeModal);

    // モーダル内タブ切り替え
    elements.modalTabTask.addEventListener('click', () => setModalType('task'));
    elements.modalTabEvent.addEventListener('click', () => setModalType('event'));

    // 削除ボタン
    elements.btnDeleteItem.addEventListener('click', () => {
        const id = elements.itemId.value;
        if (id) deleteItem(id);
    });

    // 繰り返し選択連動
    elements.taskRepeat.addEventListener('change', (e) => {
        if (e.target.value === 'none') {
            elements.timeSettingsGroup.classList.remove('hidden');
        } else {
            elements.timeSettingsGroup.classList.add('hidden');
            document.querySelector('input[name="time-type"][value="allday"]').checked = true;
            elements.specificTimeWrapper.classList.add('hidden');
        }
    });

    // 時間指定のラジオ
    Array.from(elements.timeTypeRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'specific') {
                elements.specificTimeWrapper.classList.remove('hidden');
            } else {
                elements.specificTimeWrapper.classList.add('hidden');
            }
        });
    });

    // 期限切れ表示トグル
    elements.btnToggleOverdue.addEventListener('click', () => {
        overdueVisible = !overdueVisible;
        localStorage.setItem(OVERDUE_VISIBLE_KEY, overdueVisible);
        updateDashboard();
    });

    // カレンダー操作
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

    // 設定保存
    elements.googleSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        googleConfig.clientId = elements.googleClientId.value.trim();
        googleConfig.apiKey = elements.googleApiKey.value.trim();
        
        localStorage.setItem(GOOGLE_CONFIG_KEY, JSON.stringify({
            clientId: googleConfig.clientId,
            apiKey: googleConfig.apiKey
        }));
        
        alert('設定を保存しました！');
        updateDashboard();
        renderCalendar();
    });

    // モーダル保存処理
    elements.itemForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = elements.itemId.value;
        const type = elements.itemType.value;
        const title = elements.itemTitle.value.trim();
        const description = elements.itemDesc.value.trim();

        let newItem = { id: id || 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9), type, title, description };

        if (type === 'task') {
            const dueDate = elements.taskDue.value;
            const repeat = elements.taskRepeat.value;
            const feedbackRequired = elements.taskFeedback.checked;
            const priority = document.querySelector('input[name="task-priority"]:checked').value;
            const emailTo = elements.taskEmailTo.value.trim();

            let timeType = 'allday';
            let time = null;
            if (repeat === 'none') {
                timeType = document.querySelector('input[name="time-type"]:checked').value;
                if (timeType === 'specific') {
                    time = elements.taskTime.value;
                }
            }

            newItem = {
                ...newItem,
                dueDate,
                repeat,
                timeType,
                time,
                priority,
                feedbackRequired,
                emailTo,
                completedDates: id ? (items.find(i => i.id === id)?.completedDates || []) : []
            };
        } else {
            // 予定(Event)の場合
            const startDate = elements.eventDate.value;
            const startTime = elements.eventStartTime.value;
            const endTime = elements.eventEndTime.value;
            const syncGoogle = elements.eventSyncGoogle.checked;

            newItem = {
                ...newItem,
                startDate,
                startTime,
                endDate: startDate,
                endTime,
                syncGoogle
            };
        }

        if (id) {
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) items[idx] = newItem;
        } else {
            items.push(newItem);
        }

        saveData();
        closeModal();
        updateDashboard();
        renderCalendar();
    });
}
