// ============================================================
//  個人生活助手 — app.js
// ============================================================

// ──────────────────────────────────────────────────────────────
//  Storage  — localStorage helpers
// ──────────────────────────────────────────────────────────────
const Storage = {
  KEYS: {
    expenses: 'pla_expenses',
    todos:    'pla_todos',
    journal:  'pla_journal',
  },

  get(key) {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS[key])) || [];
    } catch { return []; }
  },

  set(key, data) {
    try {
      localStorage.setItem(this.KEYS[key], JSON.stringify(data));
    } catch (e) {
      alert('儲存失敗：儲存空間不足');
    }
  },

  genId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  },
};

// NLExpense and NLTodo are loaded from nl-expense.js / nl-todo.js

// ──────────────────────────────────────────────────────────────
//  Modal  — single shared overlay
// ──────────────────────────────────────────────────────────────
const Modal = {
  _onSubmit: null,
  _onDelete: null,

  open({ title, bodyHTML, onSubmit, onDelete, submitLabel = '儲存' }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-submit').textContent = submitLabel;

    const delBtn = document.getElementById('modal-delete');
    if (onDelete) {
      delBtn.classList.remove('hidden');
      this._onDelete = onDelete;
    } else {
      delBtn.classList.add('hidden');
      this._onDelete = null;
    }

    this._onSubmit = onSubmit;
    document.getElementById('modal-overlay').classList.remove('hidden');

    // Focus first input
    setTimeout(() => {
      const first = document.querySelector('#modal-body input, #modal-body textarea, #modal-body select');
      if (first) first.focus();
    }, 50);
  },

  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this._onSubmit = null;
    this._onDelete = null;
  },

  submit() {
    if (this._onSubmit) this._onSubmit();
  },

  delete() {
    if (this._onDelete) this._onDelete();
  },
};

// ──────────────────────────────────────────────────────────────
//  Expenses
// ──────────────────────────────────────────────────────────────
const Expenses = {
  _chart: null,
  state: { month: dayjs().format('YYYY-MM') },

  CAT_EXPENSE: ['餐飲', '交通', '購物', '娛樂', '醫療', '住房', '教育', '其他'],
  CAT_INCOME:  ['薪水', '兼職', '投資', '禮金', '其他'],
  CAT_ICONS: {
    餐飲: '🍜', 交通: '🚌', 購物: '🛍️', 娛樂: '🎮', 醫療: '💊',
    住房: '🏠', 教育: '📚', 薪水: '💼', 兼職: '💡', 投資: '📈',
    禮金: '🎁', 其他: '📌',
  },
  CHART_COLORS: [
    '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
    '#8b5cf6','#ec4899','#14b8a6',
  ],

  getAll() { return Storage.get('expenses'); },

  getFiltered() {
    return this.getAll().filter(r => r.date.startsWith(this.state.month));
  },

  getSummary() {
    const rows = this.getFiltered();
    let income = 0, expense = 0;
    rows.forEach(r => {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    });
    return { income, expense, net: income - expense };
  },

  save(record) {
    const all = this.getAll();
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) all[idx] = record;
    else all.unshift(record);
    Storage.set('expenses', all);
  },

  delete(id) {
    Storage.set('expenses', this.getAll().filter(r => r.id !== id));
  },

  getChartData() {
    const rows = this.getFiltered().filter(r => r.type === 'expense');
    const map = {};
    rows.forEach(r => { map[r.category] = (map[r.category] || 0) + r.amount; });
    const labels = Object.keys(map);
    const data = labels.map(l => map[l]);
    return { labels, data };
  },

  formatAmount(n) {
    return '$' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  buildMonthOptions() {
    const sel = document.getElementById('exp-month-filter');
    sel.innerHTML = '';
    const now = dayjs();
    for (let i = 0; i < 12; i++) {
      const m = now.subtract(i, 'month').format('YYYY-MM');
      const label = now.subtract(i, 'month').format('YYYY年MM月');
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = label;
      if (m === this.state.month) opt.selected = true;
      sel.appendChild(opt);
    }
  },

  renderChart() {
    const { labels, data } = this.getChartData();
    const container = document.getElementById('exp-chart-container');
    const empty = document.getElementById('exp-chart-empty');

    if (data.length === 0) {
      container.classList.add('hidden');
      empty.classList.remove('hidden');
      if (this._chart) { this._chart.destroy(); this._chart = null; }
      return;
    }
    container.classList.remove('hidden');
    empty.classList.add('hidden');

    if (this._chart) this._chart.destroy();
    const ctx = document.getElementById('expense-chart').getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: this.CHART_COLORS.slice(0, labels.length),
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8 } },
        },
      },
    });
  },

  render() {
    this.buildMonthOptions();

    const { income, expense, net } = this.getSummary();
    document.getElementById('exp-total-income').textContent  = this.formatAmount(income);
    document.getElementById('exp-total-expense').textContent = this.formatAmount(expense);
    const netEl = document.getElementById('exp-net');
    netEl.textContent = (net >= 0 ? '+' : '') + this.formatAmount(net);
    netEl.style.color = net >= 0 ? '#6366f1' : '#ef4444';

    this.renderChart();

    const rows = this.getFiltered().sort((a, b) => b.date.localeCompare(a.date));
    const list = document.getElementById('exp-list');
    const empty = document.getElementById('exp-empty');

    if (rows.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = rows.map(r => {
      const isExp = r.type === 'expense';
      const icon = this.CAT_ICONS[r.category] || '📌';
      const color = isExp ? '#fee2e2' : '#dcfce7';
      const amtColor = isExp ? 'text-red-500' : 'text-green-600';
      const sign = isExp ? '-' : '+';
      return `
        <div class="exp-row">
          <div class="exp-icon" style="background:${color}">${icon}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${r.category}${r.note ? ' · ' + r.note : ''}</p>
            <p class="text-xs text-gray-400">${r.date}</p>
          </div>
          <span class="font-semibold text-sm ${amtColor}">${sign}${this.formatAmount(r.amount)}</span>
          <div class="flex gap-1 ml-1">
            <button onclick="Expenses.openForm('${r.id}')" class="text-gray-300 hover:text-indigo-400 text-lg leading-none">✎</button>
            <button onclick="Expenses.confirmDelete('${r.id}')" class="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        </div>`;
    }).join('');
  },

  openForm(id) {
    const all = this.getAll();
    const record = id ? all.find(r => r.id === id) : null;
    const type = record ? record.type : 'expense';

    const bodyHTML = `
      <div class="form-group">
        <label class="form-label">類型</label>
        <div class="type-toggle" id="exp-type-toggle">
          <button data-type="expense" class="${type === 'expense' ? 'active-expense' : ''}" onclick="Expenses._toggleType('expense')">支出</button>
          <button data-type="income"  class="${type === 'income'  ? 'active-income'  : ''}" onclick="Expenses._toggleType('income')">收入</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">金額</label>
        <input id="ef-amount" type="number" min="0" step="0.01" class="form-input" placeholder="0" value="${record ? record.amount : ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">分類</label>
        <select id="ef-category" class="form-input">${this._catOptions(type, record ? record.category : '')}</select>
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input id="ef-date" type="date" class="form-input" value="${record ? record.date : dayjs().format('YYYY-MM-DD')}" />
      </div>
      <div class="form-group">
        <label class="form-label">備註</label>
        <input id="ef-note" type="text" class="form-input" placeholder="選填" value="${record ? record.note : ''}" />
      </div>`;

    Modal.open({
      title: record ? '編輯記帳' : '新增記帳',
      bodyHTML,
      onDelete: record ? () => {
        this.delete(record.id);
        this.render();
        Modal.close();
      } : null,
      onSubmit: () => {
        const amount = parseFloat(document.getElementById('ef-amount').value);
        const category = document.getElementById('ef-category').value;
        const date = document.getElementById('ef-date').value;
        const note = document.getElementById('ef-note').value.trim();
        const t = document.querySelector('#exp-type-toggle button.active-expense, #exp-type-toggle button.active-income')?.dataset.type || 'expense';

        if (!amount || amount <= 0) { alert('請輸入有效金額'); return; }
        if (!date) { alert('請選擇日期'); return; }

        this.save({
          id: record ? record.id : Storage.genId('exp'),
          type: t,
          amount,
          category,
          date,
          note,
          createdAt: record ? record.createdAt : Date.now(),
        });
        this.render();
        Modal.close();
      },
    });
  },

  _catOptions(type, selected) {
    const cats = type === 'income' ? this.CAT_INCOME : this.CAT_EXPENSE;
    return cats.map(c => `<option value="${c}"${c === selected ? ' selected' : ''}>${c}</option>`).join('');
  },

  _toggleType(type) {
    const btns = document.querySelectorAll('#exp-type-toggle button');
    btns.forEach(b => b.className = '');
    const active = document.querySelector(`#exp-type-toggle button[data-type="${type}"]`);
    active.className = type === 'expense' ? 'active-expense' : 'active-income';
    document.getElementById('ef-category').innerHTML = this._catOptions(type, '');
  },

  confirmDelete(id) {
    if (confirm('確定要刪除這筆記錄嗎？')) {
      this.delete(id);
      this.render();
    }
  },

  // ── NL confirm form helpers ──────────────────────────────
  _showConfirmForm(parsed) {
    this._toggleConfirmType(parsed.type);
    document.getElementById('exp-confirm-amount').value   = parsed.amount;
    document.getElementById('exp-confirm-category').innerHTML = this._catOptions(parsed.type, parsed.category);
    document.getElementById('exp-confirm-date').value    = parsed.date;
    document.getElementById('exp-confirm-note').value    = parsed.note || '';
    const form = document.getElementById('exp-nl-confirm');
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('exp-confirm-amount').focus();
  },

  _toggleConfirmType(type) {
    document.querySelectorAll('#exp-confirm-type-toggle button').forEach(b => b.className = '');
    const active = document.querySelector(`#exp-confirm-type-toggle button[data-type="${type}"]`);
    if (active) active.className = type === 'expense' ? 'active-expense' : 'active-income';
    const catSel = document.getElementById('exp-confirm-category');
    if (catSel) catSel.innerHTML = this._catOptions(type, catSel.value);
  },
};

// ──────────────────────────────────────────────────────────────
//  Todos
// ──────────────────────────────────────────────────────────────
const Todos = {
  state: { filter: 'all' },
  _menuTargetId: null,

  PRIORITY_LABEL: { high: '高', medium: '中', low: '低' },
  PRIORITY_ORDER: { high: 0, medium: 1, low: 2 },

  getAll() { return Storage.get('todos'); },

  getFiltered() {
    const all = this.getAll();
    if (this.state.filter === 'active') return all.filter(t => !t.done);
    if (this.state.filter === 'done')   return all.filter(t => t.done);
    return all;
  },

  getSorted(items) {
    return [...items].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const po = (this.PRIORITY_ORDER[a.priority] || 1) - (this.PRIORITY_ORDER[b.priority] || 1);
      if (po !== 0) return po;
      return b.createdAt - a.createdAt;
    });
  },

  save(todo) {
    const all = this.getAll();
    const idx = all.findIndex(t => t.id === todo.id);
    if (idx >= 0) all[idx] = todo;
    else all.unshift(todo);
    Storage.set('todos', all);
  },

  delete(id) {
    Storage.set('todos', this.getAll().filter(t => t.id !== id));
  },

  toggle(id) {
    const all = this.getAll();
    const t = all.find(t => t.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    Storage.set('todos', all);
    this.render();
  },

  add(text, priority = 'medium') {
    const text_ = text.trim();
    if (!text_) return;
    this.save({
      id: Storage.genId('todo'),
      text: text_,
      done: false,
      priority,
      dueDate: null,
      createdAt: Date.now(),
      completedAt: null,
    });
    this.render();
  },

  setFilter(filter) {
    this.state.filter = filter;
    document.querySelectorAll('.todo-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    this.render();
  },

  render() {
    const items = this.getSorted(this.getFiltered());
    const list = document.getElementById('todo-list');
    const empty = document.getElementById('todo-empty');

    if (items.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const frag = document.createDocumentFragment();
    items.forEach(t => {
      const div = document.createElement('div');
      div.innerHTML = this._renderItem(t);
      frag.appendChild(div.firstElementChild);
    });
    list.innerHTML = '';
    list.appendChild(frag);
  },

  _renderItem(t) {
    const dueLine = t.dueDate ? `<span class="text-xs ${this._isDueWarning(t) ? 'text-red-400' : 'text-gray-400'}">📅 ${t.dueDate}</span>` : '';
    return `
      <div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
        <div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="Todos.toggle('${t.id}')"></div>
        <div class="priority-dot priority-${t.priority}"></div>
        <div class="flex-1 min-w-0">
          <p class="todo-text text-sm">${this._escapeHtml(t.text)}</p>
          ${dueLine}
        </div>
        <button class="text-gray-300 hover:text-gray-500 text-xl leading-none px-1" onclick="Todos._openMenu(event, '${t.id}')">⋮</button>
      </div>`;
  },

  _isDueWarning(t) {
    if (!t.dueDate || t.done) return false;
    return dayjs(t.dueDate).isBefore(dayjs().add(1, 'day'), 'day');
  },

  _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  _openMenu(e, id) {
    e.stopPropagation();
    this._menuTargetId = id;
    const menu = document.getElementById('todo-menu');
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
    menu.classList.remove('hidden');
  },

  closeMenu() {
    document.getElementById('todo-menu').classList.add('hidden');
    this._menuTargetId = null;
  },

  menuEdit() {
    const id = this._menuTargetId;
    this.closeMenu();
    if (!id) return;
    const todo = this.getAll().find(t => t.id === id);
    if (!todo) return;

    Modal.open({
      title: '編輯任務',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">任務內容</label>
          <input id="te-text" type="text" class="form-input" value="${this._escapeHtml(todo.text)}" />
        </div>
        <div class="form-group">
          <label class="form-label">優先級</label>
          <select id="te-priority" class="form-input">
            <option value="high"   ${todo.priority==='high'   ? 'selected':''}>🔴 高</option>
            <option value="medium" ${todo.priority==='medium' ? 'selected':''}>🟡 中</option>
            <option value="low"    ${todo.priority==='low'    ? 'selected':''}>🟢 低</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">到期日</label>
          <input id="te-due" type="date" class="form-input" value="${todo.dueDate || ''}" />
        </div>`,
      onSubmit: () => {
        const text = document.getElementById('te-text').value.trim();
        if (!text) { alert('請輸入任務內容'); return; }
        this.save({
          ...todo,
          text,
          priority: document.getElementById('te-priority').value,
          dueDate: document.getElementById('te-due').value || null,
        });
        this.render();
        Modal.close();
      },
    });
  },

  menuPriority() {
    const id = this._menuTargetId;
    this.closeMenu();
    if (!id) return;
    const todo = this.getAll().find(t => t.id === id);
    if (!todo) return;

    Modal.open({
      title: '設定優先級',
      bodyHTML: `
        <div class="form-group">
          <select id="tp-priority" class="form-input">
            <option value="high"   ${todo.priority==='high'   ? 'selected':''}>🔴 高優先</option>
            <option value="medium" ${todo.priority==='medium' ? 'selected':''}>🟡 中優先</option>
            <option value="low"    ${todo.priority==='low'    ? 'selected':''}>🟢 低優先</option>
          </select>
        </div>`,
      onSubmit: () => {
        this.save({ ...todo, priority: document.getElementById('tp-priority').value });
        this.render();
        Modal.close();
      },
    });
  },

  menuDue() {
    const id = this._menuTargetId;
    this.closeMenu();
    if (!id) return;
    const todo = this.getAll().find(t => t.id === id);
    if (!todo) return;

    Modal.open({
      title: '設定到期日',
      bodyHTML: `
        <div class="form-group">
          <input id="td-due" type="date" class="form-input" value="${todo.dueDate || dayjs().format('YYYY-MM-DD')}" />
        </div>`,
      onSubmit: () => {
        this.save({ ...todo, dueDate: document.getElementById('td-due').value || null });
        this.render();
        Modal.close();
      },
    });
  },

  menuDelete() {
    const id = this._menuTargetId;
    this.closeMenu();
    if (!id) return;
    if (confirm('確定要刪除此任務嗎？')) {
      this.delete(id);
      this.render();
    }
  },
};

// ──────────────────────────────────────────────────────────────
//  Journal
// ──────────────────────────────────────────────────────────────
const Journal = {
  state: {
    viewMonth: dayjs().format('YYYY-MM'),
    selectedDate: dayjs().format('YYYY-MM-DD'),
  },

  MOODS: [
    { key: 'great',   emoji: '😄', label: '很好' },
    { key: 'happy',   emoji: '🙂', label: '還不錯' },
    { key: 'neutral', emoji: '😐', label: '普通' },
    { key: 'sad',     emoji: '😔', label: '不太好' },
    { key: 'awful',   emoji: '😢', label: '很糟' },
  ],
  WEATHERS: [
    { key: 'sunny',  emoji: '☀️', label: '晴' },
    { key: 'cloudy', emoji: '⛅', label: '多雲' },
    { key: 'rainy',  emoji: '🌧️', label: '雨' },
    { key: 'snowy',  emoji: '❄️', label: '雪' },
    { key: 'stormy', emoji: '⛈️', label: '雷雨' },
  ],

  getAll() { return Storage.get('journal'); },

  getByDate(date) {
    return this.getAll().find(e => e.date === date) || null;
  },

  getMonthDates(month) {
    return new Set(this.getAll().filter(e => e.date.startsWith(month)).map(e => e.date));
  },

  save(entry) {
    const all = this.getAll().filter(e => e.date !== entry.date || e.id === entry.id);
    const idx = all.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      all[idx] = { ...entry, updatedAt: Date.now() };
    } else {
      all.unshift({ ...entry, createdAt: Date.now(), updatedAt: Date.now() });
    }
    Storage.set('journal', all);
  },

  delete(id) {
    Storage.set('journal', this.getAll().filter(e => e.id !== id));
  },

  prevMonth() {
    this.state.viewMonth = dayjs(this.state.viewMonth).subtract(1, 'month').format('YYYY-MM');
    this.renderCalendar();
  },

  nextMonth() {
    this.state.viewMonth = dayjs(this.state.viewMonth).add(1, 'month').format('YYYY-MM');
    this.renderCalendar();
  },

  selectDate(date) {
    this.state.selectedDate = date;
    this.renderCalendar();
    this.renderEntryList();
  },

  renderCalendar() {
    const vm = dayjs(this.state.viewMonth);
    document.getElementById('journal-month-label').textContent = vm.format('YYYY年MM月');

    const datesWithEntries = this.getMonthDates(this.state.viewMonth);
    const today = dayjs().format('YYYY-MM-DD');
    const firstDay = vm.startOf('month').day(); // 0=Sun
    const daysInMonth = vm.daysInMonth();

    const grid = document.getElementById('journal-calendar');
    const cells = [];

    // Padding cells for days before month start
    for (let i = 0; i < firstDay; i++) {
      cells.push(`<div class="cal-day other-month"></div>`);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = vm.date(d).format('YYYY-MM-DD');
      const isToday    = date === today;
      const isSelected = date === this.state.selectedDate;
      const hasEntry   = datesWithEntries.has(date);
      const classes = [
        'cal-day',
        isToday    ? 'today'    : '',
        isSelected && !isToday ? 'selected' : '',
      ].filter(Boolean).join(' ');

      cells.push(`
        <div class="${classes}" onclick="Journal.selectDate('${date}')">
          ${d}
          ${hasEntry ? '<span class="entry-dot"></span>' : ''}
        </div>`);
    }

    grid.innerHTML = cells.join('');
    this.renderEntryList();
  },

  renderEntryList() {
    const date = this.state.selectedDate;
    const d = dayjs(date);
    document.getElementById('journal-selected-label').textContent =
      d.format('YYYY年MM月DD日') + ' ' + ['日','一','二','三','四','五','六'][d.day()];

    const entry = this.getByDate(date);
    const area = document.getElementById('journal-entry-area');

    const writeBtn = document.getElementById('journal-write-btn');
    writeBtn.textContent = entry ? '✏️ 編輯' : '+ 寫日記';

    if (!entry) {
      area.innerHTML = `
        <div class="text-center py-8 text-gray-400">
          <p class="text-4xl mb-2">✍️</p>
          <p class="text-sm">今天還沒有日記<br>點擊「寫日記」開始記錄吧！</p>
        </div>`;
      return;
    }

    const mood = this.MOODS.find(m => m.key === entry.mood);
    const weather = this.WEATHERS.find(w => w.key === entry.weather);
    const preview = entry.content.length > 120 ? entry.content.slice(0, 120) + '...' : entry.content;

    area.innerHTML = `
      <div class="journal-card">
        <div class="flex items-center gap-3 mb-3">
          ${mood    ? `<span class="text-xl" title="${mood.label}">${mood.emoji}</span>` : ''}
          ${weather ? `<span class="text-xl" title="${weather.label}">${weather.emoji}</span>` : ''}
          <span class="text-xs text-gray-400 ml-auto">${dayjs(entry.updatedAt).format('HH:mm 更新')}</span>
        </div>
        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" id="journal-preview-text">${this._escapeHtml(preview)}</p>
        ${entry.content.length > 120 ? `
          <button onclick="Journal._showFull('${entry.id}')" class="text-indigo-400 text-xs mt-2 hover:underline">閱讀全文</button>
        ` : ''}
        <div class="flex gap-2 mt-3 pt-3 border-t">
          <button onclick="Journal.openForm('${date}')" class="text-indigo-500 text-sm hover:underline">編輯</button>
          <button onclick="Journal.confirmDelete('${entry.id}')" class="text-red-400 text-sm hover:underline ml-auto">刪除</button>
        </div>
      </div>`;
  },

  _showFull(id) {
    const entry = this.getAll().find(e => e.id === id);
    if (!entry) return;
    const el = document.getElementById('journal-preview-text');
    if (el) {
      el.textContent = entry.content;
      el.nextElementSibling && el.nextElementSibling.remove();
    }
  },

  _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  openForm(date) {
    const entry = this.getByDate(date);
    const mood = entry ? entry.mood : 'neutral';
    const weather = entry ? entry.weather : 'sunny';

    const moodHTML = this.MOODS.map(m => `
      <div class="emoji-option ${m.key === mood ? 'selected' : ''}" data-mood="${m.key}" title="${m.label}" onclick="Journal._selectMood('${m.key}')">${m.emoji}</div>
    `).join('');

    const weatherHTML = this.WEATHERS.map(w => `
      <div class="emoji-option ${w.key === weather ? 'selected' : ''}" data-weather="${w.key}" title="${w.label}" onclick="Journal._selectWeather('${w.key}')">${w.emoji}</div>
    `).join('');

    Modal.open({
      title: entry ? '編輯日記' : '寫日記',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">日期</label>
          <input id="jf-date" type="date" class="form-input" value="${date}" />
        </div>
        <div class="form-group">
          <label class="form-label">心情</label>
          <div class="emoji-selector" id="jf-mood">${moodHTML}</div>
        </div>
        <div class="form-group">
          <label class="form-label">天氣</label>
          <div class="emoji-selector" id="jf-weather">${weatherHTML}</div>
        </div>
        <div class="form-group">
          <label class="form-label">日記內容</label>
          <textarea id="jf-content" class="form-input" placeholder="今天發生了什麼事...">${entry ? this._escapeHtml(entry.content) : ''}</textarea>
        </div>`,
      onDelete: entry ? () => {
        this.delete(entry.id);
        this.renderCalendar();
        Modal.close();
      } : null,
      onSubmit: () => {
        const date_ = document.getElementById('jf-date').value;
        const content = document.getElementById('jf-content').value.trim();
        const moodSel = document.querySelector('#jf-mood .emoji-option.selected');
        const weatSel = document.querySelector('#jf-weather .emoji-option.selected');

        if (!date_) { alert('請選擇日期'); return; }
        if (!content) { alert('請寫下今天的日記'); return; }

        this.save({
          id: entry ? entry.id : Storage.genId('jnl'),
          date: date_,
          mood: moodSel ? moodSel.dataset.mood : 'neutral',
          weather: weatSel ? weatSel.dataset.weather : 'sunny',
          content,
          createdAt: entry ? entry.createdAt : Date.now(),
          updatedAt: Date.now(),
        });

        this.state.selectedDate = date_;
        this.state.viewMonth = date_.slice(0, 7);
        this.renderCalendar();
        Modal.close();
      },
    });
  },

  _selectMood(key) {
    document.querySelectorAll('#jf-mood .emoji-option').forEach(el => el.classList.toggle('selected', el.dataset.mood === key));
  },

  _selectWeather(key) {
    document.querySelectorAll('#jf-weather .emoji-option').forEach(el => el.classList.toggle('selected', el.dataset.weather === key));
  },

  confirmDelete(id) {
    if (confirm('確定要刪除這篇日記嗎？')) {
      this.delete(id);
      this.renderCalendar();
    }
  },

  render() {
    this.renderCalendar();
  },
};

// ──────────────────────────────────────────────────────────────
//  App  — init & tab switching
// ──────────────────────────────────────────────────────────────
const App = {
  activeTab: 'expenses',
  _rendered: { expenses: false, todos: false, journal: false },

  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  },

  init() {
    // Set header date
    document.getElementById('header-date').textContent = dayjs().format('YYYY年MM月DD日');

    // Wire tab nav (both desktop and mobile)
    ['tab-nav', 'tab-nav-mobile'].forEach(navId => {
      const nav = document.getElementById(navId);
      if (nav) {
        nav.addEventListener('click', e => {
          const btn = e.target.closest('[data-tab]');
          if (btn) this.switchTab(btn.dataset.tab);
        });
      }
    });

    // Month filter change
    document.getElementById('exp-month-filter').addEventListener('change', e => {
      Expenses.state.month = e.target.value;
      Expenses.render();
    });

    // Expense add button (manual form)
    document.getElementById('exp-add-btn').addEventListener('click', () => Expenses.openForm(null));

    // NL expense input — real-time preview
    document.getElementById('exp-nl-input').addEventListener('input', e => {
      const text = e.target.value.trim();
      const preview = document.getElementById('exp-nl-preview');
      if (!text) { preview.classList.add('hidden'); return; }

      const parsed = NLExpense.parse(text);
      if (!parsed) {
        preview.className = 'mt-2 text-xs rounded-lg px-3 py-2 bg-orange-50 text-orange-600';
        preview.textContent = '⚠️ 無法識別金額，請在文字中包含數字';
        preview.classList.remove('hidden');
        return;
      }
      const icon = Expenses.CAT_ICONS[parsed.category] || '📌';
      const sign = parsed.type === 'expense' ? '-' : '+';
      const typeLabel = parsed.type === 'expense' ? '支出' : '收入';
      preview.className = 'mt-2 text-xs rounded-lg px-3 py-2 bg-indigo-50 text-indigo-700';
      preview.innerHTML = `✓ ${icon} <strong>${parsed.category}</strong> ${typeLabel} <strong>${sign}$${parsed.amount}</strong> · ${parsed.date}${parsed.note ? ' · ' + parsed.note : ''}`;
      preview.classList.remove('hidden');
    });

    // NL expense submit — shows confirm form instead of saving immediately
    const submitNLExpense = () => {
      const input = document.getElementById('exp-nl-input');
      const text = input.value.trim();
      if (!text) return;

      const parsed = NLExpense.parse(text);
      if (!parsed) {
        App.toast('⚠️ 無法識別金額，請在文字中包含數字');
        return;
      }

      Expenses._showConfirmForm(parsed);
      document.getElementById('exp-nl-preview').classList.add('hidden');
    };

    document.getElementById('exp-nl-btn').addEventListener('click', submitNLExpense);
    document.getElementById('exp-nl-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitNLExpense();
    });

    // NL expense confirm form — cancel
    document.getElementById('exp-confirm-cancel').addEventListener('click', () => {
      document.getElementById('exp-nl-confirm').classList.add('hidden');
    });

    // NL expense confirm form — save
    document.getElementById('exp-confirm-save').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('exp-confirm-amount').value);
      const category = document.getElementById('exp-confirm-category').value;
      const date = document.getElementById('exp-confirm-date').value;
      const note = document.getElementById('exp-confirm-note').value.trim();
      const typeBtn = document.querySelector(
        '#exp-confirm-type-toggle button.active-expense, #exp-confirm-type-toggle button.active-income'
      );
      const type = typeBtn ? typeBtn.dataset.type : 'expense';

      if (!amount || amount <= 0) { App.toast('⚠️ 請輸入有效金額'); return; }
      if (!date) { App.toast('⚠️ 請選擇日期'); return; }

      Expenses.save({
        id: Storage.genId('exp'),
        type, amount, category, date, note,
        createdAt: Date.now(),
      });

      const month = date.slice(0, 7);
      if (month !== Expenses.state.month) Expenses.state.month = month;

      Expenses.render();
      document.getElementById('exp-nl-input').value = '';
      document.getElementById('exp-nl-confirm').classList.add('hidden');

      const icon = Expenses.CAT_ICONS[category] || '📌';
      const sign = type === 'expense' ? '-' : '+';
      App.toast(`${icon} 已記帳！${sign}$${amount} · ${category}`);
    });

    // Todo add with NL parsing
    const submitTodo = () => {
      const input = document.getElementById('todo-input');
      const raw = input.value.trim();
      if (!raw) return;

      const parsed = NLTodo.parse(raw);
      Todos.save({
        id: Storage.genId('todo'),
        text: parsed.text,
        done: false,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        createdAt: Date.now(),
        completedAt: null,
      });
      Todos.render();
      input.value = '';
      document.getElementById('todo-nl-preview').classList.add('hidden');

      const priLabel = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' }[parsed.priority];
      const dueTxt = parsed.dueDate ? ` · 到期 ${parsed.dueDate}` : '';
      App.toast(`✅ 已新增：${parsed.text}${dueTxt} [${priLabel}]`);
    };

    document.getElementById('todo-add-btn').addEventListener('click', submitTodo);
    document.getElementById('todo-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitTodo();
    });

    // Todo input real-time NL preview
    document.getElementById('todo-input').addEventListener('input', e => {
      const text = e.target.value.trim();
      const preview = document.getElementById('todo-nl-preview');
      if (!text) { preview.classList.add('hidden'); return; }
      const parsed = NLTodo.parse(text);
      if (!parsed) { preview.classList.add('hidden'); return; }
      const priLabel = { high: '🔴 高優先', medium: '🟡 中優先', low: '🟢 低優先' }[parsed.priority];
      const dueTxt = parsed.dueDate ? ` · 📅 ${parsed.dueDate}` : '';
      preview.className = 'text-xs rounded-lg px-3 py-2 bg-indigo-50 text-indigo-700';
      preview.innerHTML = `✓ <strong>${parsed.text}</strong>${dueTxt} · ${priLabel}`;
      preview.classList.remove('hidden');
    });

    // Todo filter pills
    document.getElementById('todo-filters').addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]');
      if (btn) Todos.setFilter(btn.dataset.filter);
    });

    // Journal nav
    document.getElementById('journal-prev-month').addEventListener('click', () => Journal.prevMonth());
    document.getElementById('journal-next-month').addEventListener('click', () => Journal.nextMonth());
    document.getElementById('journal-write-btn').addEventListener('click', () => Journal.openForm(Journal.state.selectedDate));

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => Modal.close());
    document.getElementById('modal-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('modal-submit').addEventListener('click', () => Modal.submit());
    document.getElementById('modal-delete').addEventListener('click', () => Modal.delete());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) Modal.close();
    });

    // Todo context menu
    document.getElementById('tmenu-edit').addEventListener('click', () => Todos.menuEdit());
    document.getElementById('tmenu-priority').addEventListener('click', () => Todos.menuPriority());
    document.getElementById('tmenu-due').addEventListener('click', () => Todos.menuDue());
    document.getElementById('tmenu-delete').addEventListener('click', () => Todos.menuDelete());
    document.addEventListener('click', e => {
      if (!document.getElementById('todo-menu').contains(e.target)) Todos.closeMenu();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        Modal.close();
        Todos.closeMenu();
      }
    });

    // Initial render
    this.switchTab('expenses');
  },

  switchTab(tab) {
    const tabs = ['expenses', 'todos', 'journal'];
    tabs.forEach(t => {
      const section = document.getElementById(`tab-${t}`);
      section.classList.toggle('hidden', t !== tab);
      document.querySelectorAll(`[data-tab="${t}"]`).forEach(btn => {
        btn.classList.toggle('active', t === tab);
      });
    });
    this.activeTab = tab;

    // Lazy render
    if (!this._rendered[tab]) {
      this._rendered[tab] = true;
      if (tab === 'expenses') Expenses.render();
      if (tab === 'todos')    Todos.render();
      if (tab === 'journal')  Journal.render();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
