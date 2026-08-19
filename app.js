/**
 * 投資型保險商品業務員資格測驗 - 模擬考試系統
 * 核心測驗引擎 (Exam Platform Engine)
 */

const AI_TEACHER_URL = "https://chatgpt.com/g/g-6834094b8b348191a6bd8bb48b1628e5-tou-zi-xing-bao-xian-shang-pin-kao-zhao-fu-dao-xiao-zhu-jiao-by-hao-lao-shi";

const AppState = {
  allQuestions: [],
  currentExam: {
    mode: '',
    title: '',
    questions: [],
    timeMins: 60,
    passScore: 70,
    pointsPerQ: 2
  },
  currentIndex: 0,
  userAnswers: {},        // { [index]: 'A' | 'B' | 'C' | 'D' }
  flaggedQuestions: {},   // { [index]: true }
  timeRemainingSeconds: 3600,
  timeSpentSeconds: 0,
  timerInterval: null,
  isPaused: false,
  history: [],
  errorNotebook: [],      // Array of question IDs
  currentTheme: 'dark',
  reviewFilter: 'all',    // 'all' | 'wrong' | 'flagged'
  errorBookFilter: 'all', // 'all' | 'sub1' | 'sub2' | chapter_num
  lastExamResults: null
};

class ExamEngine {
  constructor() {
    this.init();
  }

  async init() {
    this.initTheme();
    this.loadStorageData();
    await this.loadQuestions();
    this.bindEvents();
    this.updateDashboardStats();
    this.renderChapterPapers();
  }

  /* ========================================================================
     主題與儲存管理
     ======================================================================== */
  initTheme() {
    const savedTheme = localStorage.getItem('INV_THEME') || 'dark';
    AppState.currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon();
  }

  toggleTheme() {
    AppState.currentTheme = AppState.currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', AppState.currentTheme);
    localStorage.setItem('INV_THEME', AppState.currentTheme);
    this.updateThemeIcon();
    this.showToast(`已切換至${AppState.currentTheme === 'dark' ? '深色' : '淺色'}主題`);
  }

  updateThemeIcon() {
    const iconBtn = document.getElementById('theme-toggle-btn');
    if (iconBtn) {
      iconBtn.innerHTML = AppState.currentTheme === 'dark' ? '☀️' : '🌙';
      iconBtn.title = AppState.currentTheme === 'dark' ? '切換淺色主題' : '切換深色主題';
    }
  }

  loadStorageData() {
    try {
      const historyData = localStorage.getItem('INV_EXAM_HISTORY_V1');
      if (historyData) AppState.history = JSON.parse(historyData);
    } catch (e) {
      console.error('Failed to parse history data', e);
      AppState.history = [];
    }

    try {
      const errorData = localStorage.getItem('INV_ERROR_NOTEBOOK_V1');
      if (errorData) AppState.errorNotebook = JSON.parse(errorData);
    } catch (e) {
      console.error('Failed to parse error notebook', e);
      AppState.errorNotebook = [];
    }
  }

  saveStorageData() {
    localStorage.setItem('INV_EXAM_HISTORY_V1', JSON.stringify(AppState.history));
    localStorage.setItem('INV_ERROR_NOTEBOOK_V1', JSON.stringify(AppState.errorNotebook));
    this.updateDashboardStats();
  }

  /* ========================================================================
     題庫載入
     ======================================================================== */
  async loadQuestions() {
    if (window.INV_QUESTIONS && window.INV_QUESTIONS.length > 0) {
      AppState.allQuestions = window.INV_QUESTIONS;
      console.log(`Loaded ${AppState.allQuestions.length} questions from window.INV_QUESTIONS`);
    } else {
      try {
        const res = await fetch('inv_questions.json');
        if (!res.ok) throw new Error('Fetch failed');
        AppState.allQuestions = await res.json();
        console.log(`Loaded ${AppState.allQuestions.length} questions from json`);
      } catch (e) {
        console.error('Failed to load questions:', e);
      }
    }
  }

  updateDashboardStats() {
    const totalQEl = document.getElementById('stat-total-questions');
    const examCountEl = document.getElementById('stat-exam-count');
    const errorCountEl = document.getElementById('stat-error-count');
    const avgScoreEl = document.getElementById('stat-avg-score');

    if (totalQEl) totalQEl.innerText = AppState.allQuestions.length || 1000;
    if (examCountEl) examCountEl.innerText = AppState.history.length;
    if (errorCountEl) errorCountEl.innerText = AppState.errorNotebook.length;

    if (avgScoreEl) {
      if (AppState.history.length === 0) {
        avgScoreEl.innerText = '--';
      } else {
        const total = AppState.history.reduce((acc, cur) => acc + (cur.score || 0), 0);
        const avg = Math.round(total / AppState.history.length);
        avgScoreEl.innerText = `${avg} 分`;
      }
    }

    const badgeErr = document.getElementById('badge-error-count');
    if (badgeErr) badgeErr.innerText = `${AppState.errorNotebook.length}`;
  }

  /* ========================================================================
     章節試卷清單動態生成
     ======================================================================== */
  renderChapterPapers() {
    const container = document.getElementById('chapter-papers-container');
    if (!container) return;

    const chapters = [
      { num: 1, name: "第一章 投資型保險概論", start: 1, end: 196, sub: 1, papers: [
        { label: "A 卷", start: 1, end: 50 },
        { label: "B 卷", start: 51, end: 100 },
        { label: "C 卷", start: 101, end: 150 },
        { label: "D 卷", start: 151, end: 196 }
      ]},
      { num: 2, name: "第二章 投資型保險商品種類與特性", start: 197, end: 271, sub: 1, papers: [
        { label: "A 卷", start: 197, end: 235 },
        { label: "B 卷", start: 236, end: 271 }
      ]},
      { num: 3, name: "第三章 投資型保險條款解析", start: 272, end: 359, sub: 1, papers: [
        { label: "A 卷", start: 272, end: 315 },
        { label: "B 卷", start: 316, end: 359 }
      ]},
      { num: 4, name: "第四章 投資型保險之銷售規範與自律", start: 360, end: 489, sub: 1, papers: [
        { label: "A 卷", start: 360, end: 400 },
        { label: "B 卷", start: 401, end: 450 },
        { label: "C 卷", start: 451, end: 489 }
      ]},
      { num: 5, name: "第五章 投資型保險之租稅優惠與相關法規", start: 490, end: 511, sub: 2, papers: [
        { label: "全卷", start: 490, end: 511 }
      ]},
      { num: 6, name: "第六章 金融市場與金融工具", start: 512, end: 587, sub: 2, papers: [
        { label: "A 卷", start: 512, end: 550 },
        { label: "B 卷", start: 551, end: 587 }
      ]},
      { num: 7, name: "第七章 債券評價與投資風險", start: 588, end: 657, sub: 2, papers: [
        { label: "A 卷", start: 588, end: 620 },
        { label: "B 卷", start: 621, end: 657 }
      ]},
      { num: 8, name: "第八章 股票評價與分析", start: 658, end: 728, sub: 2, papers: [
        { label: "A 卷", start: 658, end: 690 },
        { label: "B 卷", start: 691, end: 728 }
      ]},
      { num: 9, name: "第九章 投資組合理論與績效評估", start: 729, end: 784, sub: 2, papers: [
        { label: "A 卷", start: 729, end: 755 },
        { label: "B 卷", start: 756, end: 784 }
      ]},
      { num: 10, name: "第十章 共同基金與衍生性商品", start: 785, end: 1000, sub: 2, papers: [
        { label: "A 卷", start: 785, end: 835 },
        { label: "B 卷", start: 836, end: 885 },
        { label: "C 卷", start: 886, end: 940 },
        { label: "D 卷", start: 941, end: 1000 }
      ]}
    ];

    container.innerHTML = chapters.map(ch => {
      const totalQ = ch.end - ch.start + 1;
      const subBadge = ch.sub === 1 ? '<span class="chapter-badge tag-sub1">第一科</span>' : '<span class="chapter-badge tag-sub2">第二科</span>';
      
      const subPaperBtns = ch.papers.map(p => `
        <button class="chip-paper" onclick="app.startChapterPaper(${p.start}, ${p.end}, '${ch.name} · ${p.label}')">
          <span>${p.label}</span>
          <span>第 ${p.start} ~ ${p.end} 題 (${p.end - p.start + 1}題)</span>
        </button>
      `).join('');

      return `
        <div class="chapter-card">
          <div class="chapter-header">
            ${subBadge}
            <span class="chapter-name">${ch.name}</span>
            <span class="chapter-count">${totalQ} 題</span>
          </div>
          <div class="chapter-subpapers">
            ${subPaperBtns}
            <button class="chip-paper chip-all" onclick="app.startChapterPaper(${ch.start}, ${ch.end}, '${ch.name} · 全章練習')">
              <span>📚 全章完整循序練習 (${totalQ} 題)</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     事件綁定與快捷鍵
     ======================================================================== */
  bindEvents() {
    window.addEventListener('keydown', (e) => {
      const examView = document.getElementById('view-exam');
      if (!examView || !examView.classList.contains('active')) return;
      if (document.querySelector('.modal-overlay.active')) return;

      const key = e.key.toUpperCase();
      if (['1', 'A'].includes(key)) {
        e.preventDefault();
        this.selectOption('A');
      } else if (['2', 'B'].includes(key)) {
        e.preventDefault();
        this.selectOption('B');
      } else if (['3', 'C'].includes(key)) {
        e.preventDefault();
        this.selectOption('C');
      } else if (['4', 'D'].includes(key)) {
        e.preventDefault();
        this.selectOption('D');
      } else if (e.key === 'ArrowLeft' || key === 'J') {
        e.preventDefault();
        this.prevQuestion();
      } else if (e.key === 'ArrowRight' || key === 'K') {
        e.preventDefault();
        this.nextQuestion();
      } else if (key === 'F' || key === 'M') {
        e.preventDefault();
        this.toggleFlag();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      }
    });
  }

  switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* ========================================================================
     測驗發起邏輯
     ======================================================================== */
  startExam(mode) {
    if (AppState.allQuestions.length === 0) {
      this.showToast('⚠️ 題庫載入中，請稍候重試！');
      return;
    }

    let questions = [];
    let title = '';
    let timeMins = 60;
    let pointsPerQ = 2;
    let passScore = 70;

    const sub1Questions = AppState.allQuestions.filter(q => q.id >= 1 && q.id <= 489);
    const sub2Questions = AppState.allQuestions.filter(q => q.id >= 490 && q.id <= 1000);

    switch (mode) {
      // 第一科隨機全真模考 (50題 / 60分鐘 / 70及格 / 2分/題)
      case 'random_sub1_50':
        title = '【第一科】投資型保險商品概要、金融體系概述 · 全真模擬考 (50題)';
        questions = this.shuffleArray(sub1Questions).slice(0, 50);
        timeMins = 60;
        pointsPerQ = 2;
        passScore = 70;
        break;

      // 第一科加強隨機模考 (100題 / 80分鐘 / 70及格 / 1分/題)
      case 'random_sub1_100':
        title = '【第一科】投資型保險商品概要、金融體系概述 · 100題精熟衝刺考';
        questions = this.shuffleArray(sub1Questions).slice(0, 100);
        timeMins = 80;
        pointsPerQ = 1;
        passScore = 70;
        break;

      // 第一科全題庫循序練習 (489題)
      case 'all_sub1':
        title = '【第一科】投資型保險商品概要、金融體系概述 · 489題完整刷題';
        questions = [...sub1Questions];
        timeMins = 240;
        pointsPerQ = (100 / sub1Questions.length);
        passScore = 70;
        break;

      // 第二科隨機全真模考 (100題 / 100分鐘 / 70及格 / 1分/題) ★ 使用者特別指定更正
      case 'random_sub2_100':
        title = '【第二科】投資學概要、債券與證券之評價分析、投資組合管理 · 全真模擬考 (100題)';
        questions = this.shuffleArray(sub2Questions).slice(0, 100);
        timeMins = 100;
        pointsPerQ = 1;
        passScore = 70;
        break;

      // 第二科快速隨機模考 (50題 / 60分鐘 / 70及格 / 2分/題)
      case 'random_sub2_50':
        title = '【第二科】投資學概要、債券與證券之評價分析、投資組合管理 · 快速模考 (50題)';
        questions = this.shuffleArray(sub2Questions).slice(0, 50);
        timeMins = 60;
        pointsPerQ = 2;
        passScore = 70;
        break;

      // 第二科全題庫循序練習 (511題)
      case 'all_sub2':
        title = '【第二科】投資學概要、債券與證券之評價分析、投資組合管理 · 511題完整刷題';
        questions = [...sub2Questions];
        timeMins = 240;
        pointsPerQ = (100 / sub2Questions.length);
        passScore = 70;
        break;

      // 雙科綜合全真模擬考 (第一科50題 + 第二科50題 / 100分鐘 / 70及格 / 1分/題)
      case 'random_combo_100':
        title = '【雙科綜合】全真大模擬考 (第一科50題 + 第二科50題)';
        const pickSub1 = this.shuffleArray(sub1Questions).slice(0, 50);
        const pickSub2 = this.shuffleArray(sub2Questions).slice(0, 50);
        questions = [...pickSub1, ...pickSub2];
        timeMins = 100;
        pointsPerQ = 1;
        passScore = 70;
        break;

      // 1000題終極挑戰
      case 'all_1000':
        title = '【投資型保險商品】1000題 終極馬拉松大刷題';
        questions = [...AppState.allQuestions];
        timeMins = 300;
        pointsPerQ = 0.1;
        passScore = 70;
        break;

      default:
        return;
    }

    this.launchExamSession({ mode, title, questions, timeMins, pointsPerQ, passScore });
  }

  startChapterPaper(startId, endId, title) {
    const questions = AppState.allQuestions.filter(q => q.id >= startId && q.id <= endId);
    if (questions.length === 0) {
      this.showToast('⚠️ 未找到該範圍題目');
      return;
    }

    const timeMins = Math.max(30, Math.ceil(questions.length * 1.2));
    const pointsPerQ = 100 / questions.length;
    this.launchExamSession({
      mode: `chapter_${startId}_${endId}`,
      title: `【循序練習】${title}`,
      questions,
      timeMins,
      pointsPerQ,
      passScore: 70
    });
  }

  startErrorDrill(scope = 'all') {
    if (AppState.errorNotebook.length === 0) {
      this.showToast('🎉 錯題本目前是空的！繼續保持！');
      return;
    }

    let errorList = AppState.allQuestions.filter(q => AppState.errorNotebook.includes(q.id));
    let title = '【智慧錯題本】全範圍錯題強化重測';

    if (scope === 'sub1') {
      errorList = errorList.filter(q => q.id >= 1 && q.id <= 489);
      title = '【智慧錯題本】第一科錯題強化重測';
    } else if (scope === 'sub2') {
      errorList = errorList.filter(q => q.id >= 490 && q.id <= 1000);
      title = '【智慧錯題本】第二科錯題強化重測';
    }

    if (errorList.length === 0) {
      this.showToast('🎉 該範圍內暫無錯題！');
      return;
    }

    const shuffled = this.shuffleArray(errorList);
    const timeMins = Math.max(20, Math.ceil(shuffled.length * 1.5));
    const pointsPerQ = 100 / shuffled.length;

    this.launchExamSession({
      mode: `error_drill_${scope}`,
      title: `${title} (${shuffled.length}題)`,
      questions: shuffled,
      timeMins,
      pointsPerQ,
      passScore: 70
    });
  }

  launchExamSession({ mode, title, questions, timeMins, pointsPerQ, passScore }) {
    AppState.currentExam = { mode, title, questions, timeMins, pointsPerQ, passScore };
    AppState.currentIndex = 0;
    AppState.userAnswers = {};
    AppState.flaggedQuestions = {};
    AppState.timeRemainingSeconds = timeMins * 60;
    AppState.timeSpentSeconds = 0;
    AppState.isPaused = false;

    this.startTimer();
    this.renderExamInterface();
    this.switchView('view-exam');
    this.showToast(`🎯 開始測驗：${title}`);
  }

  /* ========================================================================
     計時器模組
     ======================================================================== */
  startTimer() {
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    this.updateTimerDisplay();

    AppState.timerInterval = setInterval(() => {
      if (!AppState.isPaused) {
        AppState.timeRemainingSeconds--;
        AppState.timeSpentSeconds++;
        this.updateTimerDisplay();

        if (AppState.timeRemainingSeconds <= 0) {
          clearInterval(AppState.timerInterval);
          this.submitExam(true);
        }
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById('exam-timer');
    if (!timerEl) return;

    const mins = Math.floor(Math.max(0, AppState.timeRemainingSeconds) / 60);
    const secs = Math.max(0, AppState.timeRemainingSeconds) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    timerEl.innerText = formatted;
    if (AppState.timeRemainingSeconds <= 300) {
      timerEl.parentElement.classList.add('timer-warning');
    } else {
      timerEl.parentElement.classList.remove('timer-warning');
    }
  }

  togglePause() {
    AppState.isPaused = !AppState.isPaused;
    const pauseBtn = document.getElementById('btn-pause-exam');
    if (pauseBtn) {
      pauseBtn.innerHTML = AppState.isPaused ? '▶️ 繼續' : '⏸️ 暫停';
    }
    this.showToast(AppState.isPaused ? '⏸️ 測驗已暫停' : '▶️ 測驗已繼續');
  }

  /* ========================================================================
     測驗介面與題目渲染
     ======================================================================== */
  renderExamInterface() {
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = AppState.currentExam.title;

    this.renderCurrentQuestion();
    this.renderPalette();
  }

  renderCurrentQuestion() {
    const q = AppState.currentExam.questions[AppState.currentIndex];
    if (!q) return;

    // 更新進度與標籤
    const progressEl = document.getElementById('exam-progress');
    if (progressEl) {
      progressEl.innerText = `第 ${AppState.currentIndex + 1} 題 / 共 ${AppState.currentExam.questions.length} 題`;
    }

    const badgeChapterEl = document.getElementById('exam-q-chapter');
    if (badgeChapterEl) badgeChapterEl.innerText = q.chapter;

    const badgeIdEl = document.getElementById('exam-q-id');
    if (badgeIdEl) badgeIdEl.innerText = `原題庫 #${q.id}`;

    // 題目文字
    const bodyEl = document.getElementById('exam-q-body');
    if (bodyEl) bodyEl.innerText = `${AppState.currentIndex + 1}. ${q.question}`;

    // 選項
    const optionsContainer = document.getElementById('exam-options-container');
    if (optionsContainer) {
      const selected = AppState.userAnswers[AppState.currentIndex];
      const optKeys = ['A', 'B', 'C', 'D'];
      
      optionsContainer.innerHTML = optKeys.map(k => {
        const text = q.options[k] || '';
        const isSelected = selected === k;
        return `
          <div class="option-item ${isSelected ? 'selected' : ''}" onclick="app.selectOption('${k}')">
            <div class="option-key">${k}</div>
            <div class="option-text">${text}</div>
          </div>
        `;
      }).join('');
    }

    // Flag 狀態
    const flagBtn = document.getElementById('btn-flag-question');
    if (flagBtn) {
      const isFlagged = !!AppState.flaggedQuestions[AppState.currentIndex];
      if (isFlagged) {
        flagBtn.classList.add('active');
        flagBtn.innerHTML = '🚩 已標記';
      } else {
        flagBtn.classList.remove('active');
        flagBtn.innerHTML = '🏳️ 標記此題';
      }
    }

    // 上下題按鈕狀態
    const prevBtn = document.getElementById('btn-prev-q');
    const nextBtn = document.getElementById('btn-next-q');
    if (prevBtn) prevBtn.disabled = AppState.currentIndex === 0;
    if (nextBtn) {
      if (AppState.currentIndex === AppState.currentExam.questions.length - 1) {
        nextBtn.innerHTML = '<span>交卷結算</span> ➜';
        nextBtn.onclick = () => this.confirmSubmit();
      } else {
        nextBtn.innerHTML = '<span>下一題</span> ➜';
        nextBtn.onclick = () => this.nextQuestion();
      }
    }

    this.updatePaletteActiveItem();
  }

  selectOption(optKey) {
    AppState.userAnswers[AppState.currentIndex] = optKey;
    this.renderCurrentQuestion();
    this.updatePaletteActiveItem();
  }

  prevQuestion() {
    if (AppState.currentIndex > 0) {
      AppState.currentIndex--;
      this.renderCurrentQuestion();
    }
  }

  nextQuestion() {
    if (AppState.currentIndex < AppState.currentExam.questions.length - 1) {
      AppState.currentIndex++;
      this.renderCurrentQuestion();
    }
  }

  jumpToQuestion(idx) {
    if (idx >= 0 && idx < AppState.currentExam.questions.length) {
      AppState.currentIndex = idx;
      this.renderCurrentQuestion();
    }
  }

  toggleFlag() {
    const curr = AppState.currentIndex;
    AppState.flaggedQuestions[curr] = !AppState.flaggedQuestions[curr];
    this.renderCurrentQuestion();
  }

  /* ========================================================================
     答題地圖網格 (Palette)
     ======================================================================== */
  renderPalette() {
    const grid = document.getElementById('exam-palette-grid');
    if (!grid) return;

    grid.innerHTML = AppState.currentExam.questions.map((q, idx) => {
      const isAnswered = AppState.userAnswers[idx] !== undefined;
      const isFlagged = !!AppState.flaggedQuestions[idx];
      const isCurrent = AppState.currentIndex === idx;

      let cls = ['palette-item'];
      if (isCurrent) cls.push('current');
      if (isAnswered) cls.push('answered');
      if (isFlagged) cls.push('flagged');

      return `
        <button class="${cls.join(' ')}" onclick="app.jumpToQuestion(${idx})" id="palette-btn-${idx}">
          ${idx + 1}
        </button>
      `;
    }).join('');
  }

  updatePaletteActiveItem() {
    document.querySelectorAll('.palette-item').forEach((el, idx) => {
      el.classList.remove('current', 'answered', 'flagged');
      if (AppState.currentIndex === idx) el.classList.add('current');
      if (AppState.userAnswers[idx] !== undefined) el.classList.add('answered');
      if (AppState.flaggedQuestions[idx]) el.classList.add('flagged');
    });
  }

  /* ========================================================================
     交卷確認與成績結算
     ======================================================================== */
  confirmSubmit() {
    const totalQ = AppState.currentExam.questions.length;
    const answeredCount = Object.keys(AppState.userAnswers).length;
    const unAnsweredCount = totalQ - answeredCount;
    const flaggedCount = Object.values(AppState.flaggedQuestions).filter(Boolean).length;

    const modal = document.getElementById('modal-submit-confirm');
    const msgEl = document.getElementById('submit-modal-msg');
    if (msgEl) {
      msgEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          <p>總題數：<strong>${totalQ}</strong> 題</p>
          <p style="color:var(--color-success);">已作答：<strong>${answeredCount}</strong> 題</p>
          <p style="color:var(--color-danger);">未作答：<strong>${unAnsweredCount}</strong> 題</p>
          <p style="color:var(--color-warning);">標記題目：<strong>${flaggedCount}</strong> 題</p>
          ${unAnsweredCount > 0 ? '<p style="color:var(--color-danger); font-weight:bold; margin-top:0.5rem;">⚠️ 尚有未作答題目，確定現在交卷嗎？</p>' : '<p style="color:var(--color-success); font-weight:bold; margin-top:0.5rem;">已全部作答完畢，準備交卷！</p>'}
        </div>
      `;
    }
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  submitExam(isTimeUp = false) {
    this.closeModal('modal-submit-confirm');
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);

    const questions = AppState.currentExam.questions;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const reviewDetails = [];

    questions.forEach((q, idx) => {
      const userAns = AppState.userAnswers[idx];
      const isCorrect = userAns === q.answer;
      const isSkipped = userAns === undefined;

      if (isCorrect) {
        correctCount++;
      } else if (isSkipped) {
        skippedCount++;
        // 漏做的題目也加入錯題本強化
        if (!AppState.errorNotebook.includes(q.id)) {
          AppState.errorNotebook.push(q.id);
        }
      } else {
        wrongCount++;
        // 答錯加入錯題本
        if (!AppState.errorNotebook.includes(q.id)) {
          AppState.errorNotebook.push(q.id);
        }
      }

      reviewDetails.push({
        index: idx,
        question: q,
        userAns: userAns || '未作答',
        correctAns: q.answer,
        isCorrect,
        isSkipped,
        isFlagged: !!AppState.flaggedQuestions[idx]
      });
    });

    const totalQ = questions.length;
    const rawScore = Math.round(correctCount * AppState.currentExam.pointsPerQ * 10) / 10;
    const finalScore = Math.min(100, Math.max(0, rawScore));
    const isPassed = finalScore >= AppState.currentExam.passScore;
    const accuracy = Math.round((correctCount / totalQ) * 100);

    const resultRecord = {
      id: Date.now(),
      dateStr: new Date().toLocaleString('zh-TW', { hour12: false }),
      title: AppState.currentExam.title,
      mode: AppState.currentExam.mode,
      score: finalScore,
      isPassed,
      totalQ,
      correctCount,
      wrongCount,
      skippedCount,
      accuracy,
      timeSpentSeconds: AppState.timeSpentSeconds,
      reviewDetails
    };

    AppState.lastExamResults = resultRecord;
    AppState.history.unshift(resultRecord);
    this.saveStorageData();

    this.renderResultView(resultRecord);
    this.switchView('view-result');

    if (isTimeUp) {
      this.showToast('⏰ 時間到！系統已自動為您交卷結算！');
    } else {
      this.showToast(`🎉 測驗完成！得分：${finalScore} 分`);
    }
  }

  /* ========================================================================
     結算檢討與落點分析
     ======================================================================== */
  renderResultView(result) {
    const scoreNumEl = document.getElementById('result-score-num');
    const scoreBadgeEl = document.getElementById('result-score-status');
    const titleEl = document.getElementById('result-exam-title');

    if (titleEl) titleEl.innerText = result.title;
    if (scoreNumEl) scoreNumEl.innerText = result.score;
    if (scoreBadgeEl) {
      if (result.isPassed) {
        scoreBadgeEl.className = 'score-status pass';
        scoreBadgeEl.innerText = `🎉 及格通過 (${result.score}分 / 及格標準 70分)`;
      } else {
        scoreBadgeEl.className = 'score-status fail';
        scoreBadgeEl.innerText = `❌ 未達及格 (${result.score}分 / 及格標準 70分)`;
      }
    }

    // 統計卡片
    const statAccEl = document.getElementById('res-stat-accuracy');
    const statCorrectEl = document.getElementById('res-stat-correct');
    const statWrongEl = document.getElementById('res-stat-wrong');
    const statTimeEl = document.getElementById('res-stat-time');

    if (statAccEl) statAccEl.innerText = `${result.accuracy}%`;
    if (statCorrectEl) statCorrectEl.innerText = `${result.correctCount} / ${result.totalQ} 題`;
    if (statWrongEl) statWrongEl.innerText = `${result.wrongCount + result.skippedCount} 題`;
    if (statTimeEl) {
      const mins = Math.floor(result.timeSpentSeconds / 60);
      const secs = result.timeSpentSeconds % 60;
      statTimeEl.innerText = `${mins}分 ${secs}秒`;
    }

    // 章節落點分析
    this.renderChapterAnalysis(result);

    // 預設篩選「全部」
    this.setReviewFilter('all');
  }

  renderChapterAnalysis(result) {
    const container = document.getElementById('result-chapter-analysis');
    if (!container) return;

    const chStats = {};
    result.reviewDetails.forEach(item => {
      const ch = item.question.chapter;
      if (!chStats[ch]) chStats[ch] = { total: 0, correct: 0 };
      chStats[ch].total++;
      if (item.isCorrect) chStats[ch].correct++;
    });

    container.innerHTML = Object.entries(chStats).map(([ch, stat]) => {
      const acc = Math.round((stat.correct / stat.total) * 100);
      const color = acc >= 70 ? 'var(--color-success)' : acc >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
      return `
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-bottom:0.5rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700; margin-bottom:0.35rem;">
            <span>${ch}</span>
            <span style="color:${color}">${stat.correct} / ${stat.total} (${acc}%)</span>
          </div>
          <div style="height:6px; background:var(--bg-card); border-radius:var(--radius-full); overflow:hidden;">
            <div style="width:${acc}%; height:100%; background:${color}; border-radius:var(--radius-full);"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  setReviewFilter(filterType) {
    AppState.reviewFilter = filterType;
    document.querySelectorAll('.filter-tab').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById(`tab-review-${filterType}`);
    if (activeTab) activeTab.classList.add('active');

    this.renderReviewList();
  }

  renderReviewList() {
    const listEl = document.getElementById('result-review-list');
    if (!listEl || !AppState.lastExamResults) return;

    const filter = AppState.reviewFilter;
    const items = AppState.lastExamResults.reviewDetails.filter(item => {
      if (filter === 'wrong') return !item.isCorrect;
      if (filter === 'flagged') return item.isFlagged;
      return true;
    });

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎯</div>
          <p>此篩選條件下無題目！</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map(item => {
      const q = item.question;
      const statusCls = item.isCorrect ? 'is-correct' : 'is-wrong';
      const badgeStatus = item.isCorrect 
        ? '<span class="review-badge-status correct">✓ 答對</span>'
        : item.isSkipped 
          ? '<span class="review-badge-status skipped">⚠️ 未作答</span>'
          : '<span class="review-badge-status wrong">✗ 答錯</span>';

      const isInErrorBook = AppState.errorNotebook.includes(q.id);

      const optsHtml = ['A', 'B', 'C', 'D'].map(k => {
        let optCls = ['review-opt'];
        if (k === item.correctAns) optCls.push('is-correct-answer');
        if (k === item.userAns && !item.isCorrect) optCls.push('is-user-answer');
        
        return `
          <div class="${optCls.join(' ')}">
            <strong>(${k})</strong>
            <span>${q.options[k] || ''}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="review-item ${statusCls}">
          <div class="review-header">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span class="q-badge q-num">題號 ${item.index + 1}</span>
              <span class="q-badge">原題庫 #${q.id}</span>
              <span class="q-badge">${q.chapter}</span>
            </div>
            <div>${badgeStatus}</div>
          </div>

          <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">
            ${q.question}
          </div>

          <div class="review-options-grid">
            ${optsHtml}
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary); background:var(--bg-surface); padding:0.6rem 0.85rem; border-radius:var(--radius-md);">
            <div>
              <span>您的作答：<strong style="color:${item.isCorrect ? 'var(--color-success)' : 'var(--color-danger)'};">${item.userAns}</strong></span>
              <span style="margin-left:1rem;">標準答案：<strong style="color:var(--color-success);">${item.correctAns}</strong></span>
            </div>
          </div>

          ${q.explanation ? `
            <div class="review-explanation">
              <strong>💡 題目解析說明：</strong> ${q.explanation}
            </div>
          ` : ''}

          <div class="review-actions">
            <button class="btn-nav" style="font-size:0.8rem; padding:0.4rem 0.75rem;" onclick="app.toggleErrorItem(${q.id}, this)">
              ${isInErrorBook ? '📕 移出租題本' : '➕ 加至錯題本'}
            </button>
            <button class="btn-ai-ask" onclick="app.askAiTeacher(${q.id})">
              🤖 向豪老師請教此題
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  toggleErrorItem(qId, btnEl) {
    const idx = AppState.errorNotebook.indexOf(qId);
    if (idx > -1) {
      AppState.errorNotebook.splice(idx, 1);
      if (btnEl) btnEl.innerText = '➕ 加至錯題本';
      this.showToast('已從錯題本移除');
    } else {
      AppState.errorNotebook.push(qId);
      if (btnEl) btnEl.innerText = '📕 移出租題本';
      this.showToast('已加入錯題本');
    }
    this.saveStorageData();
  }

  /* ========================================================================
     AI 助教深度串接
     ======================================================================== */
  askAiTeacher(qId) {
    const q = AppState.allQuestions.find(item => item.id === qId);
    if (!q) {
      window.open(AI_TEACHER_URL, '_blank');
      return;
    }

    const textToCopy = `【投資型保險商品 考照提問】
章節：${q.chapter}
題號：#${q.id}
題目：${q.question}
選項：
(A) ${q.options.A || ''}
(B) ${q.options.B || ''}
(C) ${q.options.C || ''}
(D) ${q.options.D || ''}
標準答案：(${q.answer})
${q.explanation ? `官方備註：${q.explanation}\n` : ''}
請豪老師為我深度解析此題的概念考點、核心法規/公式與容易混淆的陷阱！`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      this.showToast('📋 已複製題目至剪貼簿！正為您開啟豪老師 AI 助教...');
    }).catch(() => {
      this.showToast('🤖 正為您開啟豪老師 AI 助教...');
    }).finally(() => {
      setTimeout(() => {
        window.open(AI_TEACHER_URL, '_blank');
      }, 350);
    });
  }

  /* ========================================================================
     錯題本 Modal 與獨立視圖管理
     ======================================================================== */
  openErrorBookModal() {
    this.renderErrorBookList();
    const modal = document.getElementById('modal-error-book');
    if (modal) modal.classList.add('active');
  }

  filterErrorBook(scope) {
    AppState.errorBookFilter = scope;
    document.querySelectorAll('.filter-err-tab').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById(`tab-err-${scope}`);
    if (tab) tab.classList.add('active');
    this.renderErrorBookList();
  }

  renderErrorBookList() {
    const listContainer = document.getElementById('error-book-list');
    const countEl = document.getElementById('error-book-count-text');
    if (!listContainer) return;

    let errorQuestions = AppState.allQuestions.filter(q => AppState.errorNotebook.includes(q.id));

    if (AppState.errorBookFilter === 'sub1') {
      errorQuestions = errorQuestions.filter(q => q.id >= 1 && q.id <= 489);
    } else if (AppState.errorBookFilter === 'sub2') {
      errorQuestions = errorQuestions.filter(q => q.id >= 490 && q.id <= 1000);
    }

    if (countEl) countEl.innerText = `目前收錄：${errorQuestions.length} 題`;

    if (errorQuestions.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🎉</div>
          <p style="font-size:1.1rem; font-weight:700; color:var(--text-primary);">太棒了！無待複習的錯題！</p>
          <p style="font-size:0.85rem; margin-top:0.3rem;">平時測驗中答錯或未作答的題目會自動匯集到這裡。</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = errorQuestions.map(q => `
      <div class="review-item is-wrong" style="margin-bottom:1rem; padding:1.25rem;">
        <div class="review-header">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="q-badge q-num">原題庫 #${q.id}</span>
            <span class="q-badge">${q.chapter}</span>
          </div>
          <span class="review-badge-status wrong">待強化</span>
        </div>

        <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">
          ${q.question}
        </div>

        <div class="review-options-grid" style="margin:0.5rem 0;">
          ${['A', 'B', 'C', 'D'].map(k => `
            <div class="review-opt ${k === q.answer ? 'is-correct-answer' : ''}" style="font-size:0.88rem; padding:0.5rem 0.75rem;">
              <strong>(${k})</strong> ${q.options[k] || ''}
            </div>
          `).join('')}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
          <span>標準答案：<strong style="color:var(--color-success); font-size:1rem;">(${q.answer})</strong></span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-nav" style="font-size:0.78rem; padding:0.35rem 0.65rem;" onclick="app.removeFromErrorNotebook(${q.id})">
              ✓ 標記已掌握(移除)
            </button>
            <button class="btn-ai-ask" style="font-size:0.78rem; padding:0.35rem 0.65rem;" onclick="app.askAiTeacher(${q.id})">
              🤖 請教豪老師
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  removeFromErrorNotebook(qId) {
    const idx = AppState.errorNotebook.indexOf(qId);
    if (idx > -1) {
      AppState.errorNotebook.splice(idx, 1);
      this.saveStorageData();
      this.renderErrorBookList();
      this.showToast('✓ 已標記已掌握並從錯題本移除！');
    }
  }

  clearErrorNotebook() {
    if (AppState.errorNotebook.length === 0) return;
    if (confirm('確定要清空所有錯題紀錄嗎？此動作無法復原。')) {
      AppState.errorNotebook = [];
      this.saveStorageData();
      this.renderErrorBookList();
      this.showToast('已清空錯題本');
    }
  }

  /* ========================================================================
     練習紀錄 Modal
     ======================================================================== */
  openHistoryModal() {
    const listEl = document.getElementById('history-records-list');
    const modal = document.getElementById('modal-history');
    if (!listEl || !modal) return;

    if (AppState.history.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📊</div>
          <p>尚無測驗紀錄，快去進行第一次模擬考吧！</p>
        </div>
      `;
    } else {
      listEl.innerHTML = AppState.history.map((rec, idx) => {
        const mins = Math.floor(rec.timeSpentSeconds / 60);
        const secs = rec.timeSpentSeconds % 60;
        const passBadge = rec.isPassed 
          ? '<span class="score-status pass" style="font-size:0.8rem; padding:0.15rem 0.6rem;">及格通過</span>'
          : '<span class="score-status fail" style="font-size:0.8rem; padding:0.15rem 0.6rem;">未達標</span>';

        return `
          <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem 1.25rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
            <div style="flex:1; min-width:240px;">
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                <strong style="color:var(--text-primary); font-size:0.95rem;">${rec.title}</strong>
                ${passBadge}
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted);">
                <span>📅 ${rec.dateStr}</span>
                <span style="margin-left:0.75rem;">⏱️ 耗時 ${mins}分${secs}秒</span>
                <span style="margin-left:0.75rem;">🎯 答對 ${rec.correctCount}/${rec.totalQ} 題</span>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:1rem;">
              <div style="font-size:1.8rem; font-weight:900; color:${rec.isPassed ? 'var(--color-success)' : 'var(--color-danger)'};">
                ${rec.score} <span style="font-size:0.9rem; font-weight:normal; color:var(--text-muted);">分</span>
              </div>
              <button class="btn-nav" style="font-size:0.8rem; padding:0.4rem 0.75rem;" onclick="app.reviewHistoryItem(${idx})">
                檢視
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    modal.classList.add('active');
  }

  reviewHistoryItem(idx) {
    const record = AppState.history[idx];
    if (record) {
      AppState.lastExamResults = record;
      this.closeModal('modal-history');
      this.renderResultView(record);
      this.switchView('view-result');
    }
  }

  clearHistory() {
    if (AppState.history.length === 0) return;
    if (confirm('確定要清除所有測驗紀錄嗎？')) {
      AppState.history = [];
      this.saveStorageData();
      this.openHistoryModal();
      this.showToast('已清空歷次測驗紀錄');
    }
  }

  /* ========================================================================
     Toast 提示系統
     ======================================================================== */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>💬</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
}

// 實例化全域 App 物件
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new ExamEngine();
});
