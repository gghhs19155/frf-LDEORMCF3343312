// === КОНФИГУРАЦИЯ ===
const SPREADSHEET_ID = '1QX07u6LhEViR6xrRh6xzywvgB2k5kYmjU3uRWvMhymI'; // ← ЗАМЕНИ!
const TELEGRAM_TOKEN = '8458389593:AAH_7DIWUV4EvwYNuMAW4fO2eBjk9Xhv0HM'; // ← ЗАМЕНИ!
const TELEGRAM_CHAT_ID = '7198093055'; // ← ЗАМЕНИ!

const KPTXT = `Здравствуйте! 👋

Наше коммерческое предложение:
✅ Выгодные цены
✅ Быстрая доставка
✅ Гарантия 2 года

Скачать полный PDF: https://example.com/kp.pdf

Ждём вашего ответа! 🙌`;

// === DOM ЭЛЕМЕНТЫ ===
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const totalSentEl = document.getElementById('total-sent');
const conversionRateEl = document.getElementById('conversion-rate');
const phoneInput = document.getElementById('phone-input');
const addClientBtn = document.getElementById('add-client-btn');
const accountsList = document.getElementById('accounts-list');
const addAccountBtn = document.getElementById('add-account-btn');
const sendKpBtn = document.getElementById('send-kp-btn');
const checkStatusBtn = document.getElementById('check-status-btn');
const logList = document.getElementById('log-list');
const clearLogsBtn = document.createElement('button');

// === РАСПИСАНИЕ ===
let scheduleStart = '09:00';   // Начало окна рассылки
let scheduleEnd = '18:00';     // Конец окна рассылки
let isScheduleActive = false;
let lastSendDate = null;       // Дата последней рассылки (для защиты от дублей)
let scheduleInterval = null;

// === ФУНКЦИИ ===

// --- Отправка уведомления в Telegram ---
async function notifyCaptcha(phone) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `⚠️ CAPTCHA! Нужно вручную подтвердить вход!\n\nКлиент: ${phone}\n\nОткрой WhatsApp Web и войди в аккаунт!`
        })
      }
    );
    if (response.ok) logAction(`✅ Уведомление о капче отправлено: ${phone}`);
    else logAction(`❌ Ошибка отправки уведомления: ${response.status}`);
  } catch (e) {
    logAction(`❌ Ошибка сети при отправке уведомления: ${e.message}`);
  }
}

// --- Отправить уведомление за 5 минут до рассылки ---
async function notifyBeforeSend() {
  const msg = `⏰ Через 5 минут начнётся автоматическая рассылка!\n\nВремя: ${scheduleStart}–${scheduleEnd}\nКлиентов: ${clients.filter(c => c.status === 'Зарегистрирован').length}\n\nПриготовьтесь нажать «Отправить» в чатах.`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
    });
    logAction(`🔔 Уведомление за 5 мин отправлено в Telegram`);
  } catch (e) {
    logAction(`❌ Ошибка отправки предупреждения: ${e.message}`);
  }
}

// --- Проверка интернета ---
function checkInternetStatus() {
  isOnline = navigator.onLine;
  statusDot.classList.toggle('active', isOnline);
  statusText.textContent = isOnline ? 'Подключено' : 'Оффлайн';
}

// --- Очистка логов ---
function clearLogs() {
  logList.innerHTML = '<p class="empty-message">Нет действий.</p>';
  logAction('🧹 Логи очищены пользователем');
}

// --- Автообновление данных каждые 5 минут ---
async function autoUpdateData() {
  logAction('🔄 Автообновление данных...');
  await loadClients();
  await loadAccounts();
  updateStats();
  logAction('✅ Данные обновлены');
}

// --- Логирование ---
function logAction(action, details = '') {
  const now = new Date().toLocaleString('ru-RU', { hour12: false });
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <span class="text">${action}</span>
    <span class="time">${now}</span>
  `;
  logList.prepend(item);
  if (logList.children.length > 20) logList.removeChild(logList.lastChild);
}

// --- Загрузка клиентов ---
async function loadClients() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Clients?alt=json&key=${API_KEY}`
    );
    const data = await response.json();
    clients = data.values?.slice(1)?.map(row => ({
      phone: row[0],
      name: row[1] || 'Клиент',
      addedAt: row[2],
      status: row[3] || 'Не проверено'
    })) || [];
    renderClients();
    updateStats();
  } catch (e) {
    logAction('Ошибка загрузки клиентов: ' + e.message);
  }
}

// --- Загрузка аккаунтов ---
async function loadAccounts() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Accounts?alt=json&key=${API_KEY}`
    );
    const data = await response.json();
    accounts = data.values?.slice(1)?.map(row => ({
      id: row[0],
      phone: row[1],
      name: row[2] || 'Аккаунт',
      isActive: row[3] === 'true'
    })) || [];
    activeAccount = accounts.find(a => a.isActive)?.phone || null;
    renderAccounts();
  } catch (e) {
    logAction('Ошибка загрузки аккаунтов: ' + e.message);
  }
}

// --- Отображение клиентов ---
function renderClients() {
  if (clients.length === 0) {
    accountsList.innerHTML = '<p class="empty-message">Нет клиентов. Добавьте первого.</p>';
    return;
  }
  accountsList.innerHTML = '';
  clients.forEach(client => {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.innerHTML = `
      <span class="name">${client.name}</span>
      <span class="phone">${client.phone}</span>
      <span class="status ${client.status === 'Зарегистрирован' ? 'active' : ''}">
        ${client.status}
      </span>
    `;
    item.addEventListener('click', () => {
      window.open(`https://wa.me/${client.phone.replace('+', '')}`, '_blank');
      logAction(`Открыт чат: ${client.phone}`);
    });
    accountsList.appendChild(item);
  });
}

// --- Отображение аккаунтов ---
function renderAccounts() {
  if (accounts.length === 0) {
    accountsList.innerHTML = '<p class="empty-message">Нет аккаунтов. Добавьте первый.</p>';
    return;
  }
  accountsList.innerHTML = '';
  accounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.innerHTML = `
      <span class="name">${acc.name}</span>
      <span class="phone">${acc.phone}</span>
      <span class="status ${acc.isActive ? 'active' : ''}">${acc.isActive ? 'Активен' : 'Неактивен'}</span>
    `;
    item.addEventListener('click', async () => {
      for (const a of accounts) a.isActive = false;
      acc.isActive = true;
      await updateAccountStatus();
      renderAccounts();
      logAction(`Аккаунт активирован: ${acc.phone}`);
    });
    accountsList.appendChild(item);
  });
}

// --- Обновление статистики ---
function updateStats() {
  const registered = clients.filter(c => c.status === 'Зарегистрирован').length;
  const total = clients.length;
  totalSentEl.textContent = registered;
  conversionRateEl.textContent = total > 0 ? `${Math.round((registered / total) * 100)}%` : '0%';
}

// --- Массовое добавление клиентов ---
async function addClient() {
  let input = phoneInput.value.trim();
  if (!input) { alert('Введите хотя бы один номер!'); return; }

  const rawNumbers = input.split(/[\n,;:\t\s]+/).filter(n => n.trim() !== '');
  const validNumbers = [];
  const invalidNumbers = [];

  for (let raw of rawNumbers) {
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 11) cleaned = '+7' + cleaned.slice(1);
    else if (cleaned.length === 10 && !cleaned.startsWith('+')) cleaned = '+7' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('7') && !cleaned.startsWith('+')) cleaned = '+' + cleaned;
    else if (!cleaned.startsWith('+7') || cleaned.length !== 12) { invalidNumbers.push(raw); continue; }
    validNumbers.push(cleaned);
  }

  if (validNumbers.length === 0) {
    alert('❌ Не найдено корректных номеров!\nПримеры: +79991234567, 89991234567');
    return;
  }

  const batchValues = validNumbers.map(phone => {
    const name = 'Клиент ' + (clients.length + validNumbers.indexOf(phone) + 1);
    const now = new Date().toISOString();
    return [phone, name, now, 'Не проверено'];
  });

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Clients:append?valueInputOption=RAW&key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: batchValues })
      }
    );

    if (response.ok) {
      phoneInput.value = '';
      logAction(`✅ Добавлено ${validNumbers.length} клиентов (${invalidNumbers.length} пропущено)`);
      if (invalidNumbers.length > 0) logAction(`⚠️ Пропущено: ${invalidNumbers.join(', ')}`);
      await loadClients();
      alert(`✅ Успешно добавлено: ${validNumbers.length}\n❌ Пропущено: ${invalidNumbers.length}`);
    } else throw new Error('Ошибка записи');
  } catch (e) { alert('❌ Ошибка сети: ' + e.message); }
}

// --- Отправить КП всем (ручной режим) ---
async function sendKPToAll() {
  const registered = clients.filter(c => c.status === 'Зарегистрирован');
  if (registered.length === 0) { alert('Нет зарегистрированных клиентов!'); return; }

  if (!confirm(`Отправить КП ${registered.length} клиентам?\n\nЭто откроет их чаты в WhatsApp.`)) return;

  logAction(`🔁 Ручная рассылка КП ${registered.length} клиентов`);

  registered.forEach(client => {
    const url = `https://wa.me/${client.phone.replace('+', '')}`;
    window.open(url, '_blank');
    logAction(`Открыт чат: ${client.phone}`);
    notifyCaptcha(client.phone);
  });

  alert('Открыто ' + registered.length + ' окон WhatsApp. Вставьте текст и нажмите "Отправить".');
}

// --- Запуск автоматической рассылки (один раз в день) ---
async function startScheduledSend() {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Проверяем, уже ли сегодня была рассылка
  if (lastSendDate === today) {
    logAction('ℹ️ Рассылка уже была запущена сегодня.');
    return;
  }

  const registered = clients.filter(c => c.status === 'Зарегистрирован');
  if (registered.length === 0) {
    logAction('⚠️ Нет зарегистрированных клиентов для рассылки.');
    return;
  }

  logAction(`⏰ ЗАПУСК АВТОМАТИЧЕСКОЙ РАССЫЛКИ в ${now.toLocaleTimeString()} (${registered.length} клиентов)`);

  // Открываем чаты
  registered.forEach(client => {
    const url = `https://wa.me/${client.phone.replace('+', '')}`;
    window.open(url, '_blank');
    logAction(`Открыт чат: ${client.phone}`);
    notifyCaptcha(client.phone);
  });

  // Автоматически вставляем текст в первое поле ввода (после загрузки)
  setTimeout(() => {
    const input = document.querySelector('div[contenteditable="true"]');
    if (input) {
      input.focus();
      document.execCommand('insertText', false, KPTXT);
      logAction('📝 Текст КП автоматически вставлен в первое поле ввода');
    }
  }, 3000);

  // Сохраняем дату рассылки
  lastSendDate = today;
  localStorage.setItem('whatsappPro_lastSendDate', today);

  // Уведомление в Telegram
  const msg = `🕒 Автоматическая рассылка запущена.\nВремя: ${scheduleStart}–${scheduleEnd}\nОтправлено: ${registered.length} клиентов.\nОткройте вкладки и нажмите «Отправить».`;
  fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
  }).catch(e => logAction(`❌ Ошибка Telegram: ${e.message}`));
}

// --- Проверка, попадает ли сейчас во временной диапазон ---
function isInScheduleWindow() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:mm
  const start = scheduleStart;
  const end = scheduleEnd;

  // Преобразуем строки в минуты для сравнения
  const nowMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
  const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
  const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);

  // Если конец меньше начала — значит, расписание пересекает полночь (не поддерживается)
  if (endMinutes <= startMinutes) {
    logAction('⚠️ Расписание не может пересекать полночь. Установите корректное время.');
    return false;
  }

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

// --- Планировщик: проверяет каждую минуту ---
function setupScheduler() {
  scheduleInterval = setInterval(() => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    if (!isScheduleActive) return;

    // Проверяем, входит ли сейчас в диапазон
    if (isInScheduleWindow()) {
      startScheduledSend();
    }

    // За 5 минут до начала — отправляем предупреждение
    const fiveMinBefore = new Date(now.getTime() - 5 * 60000);
    const fiveMinStr = fiveMinBefore.toTimeString().slice(0, 5);
    if (currentTime === fiveMinStr && isInScheduleWindow()) {
      notifyBeforeSend();
    }

  }, 60000); // Проверять каждую минуту
}

// --- Установка времени рассылки ---
function setScheduleTimes() {
  scheduleStart = document.getElementById('schedule-start').value;
  scheduleEnd = document.getElementById('schedule-end').value;
  localStorage.setItem('whatsappPro_scheduleStart', scheduleStart);
  localStorage.setItem('whatsappPro_scheduleEnd', scheduleEnd);
  logAction(`⏱️ Расписание обновлено: ${scheduleStart} – ${scheduleEnd}`);
}

// --- Включение/выключение планировщика ---
function toggleSchedule() {
  isScheduleActive = !isScheduleActive;
  const btn = document.getElementById('toggle-schedule');
  btn.textContent = isScheduleActive ? '⏸️ Остановить расписание' : '▶️ Включить расписание';
  btn.style.backgroundColor = isScheduleActive ? '#ff4757' : '#2ed573';
  localStorage.setItem('whatsappPro_scheduleActive', isScheduleActive);
  logAction(isScheduleActive ? '✅ Расписание включено' : '🛑 Расписание выключено');
}

// --- Проверка регистрации ---
async function checkRegistration(phone) {
  try {
    const res = await fetch(`https://wa.me/${phone.replace('+', '')}`, { method: 'HEAD' });
    return res.status === 200;
  } catch {
    return false;
  }
}

// --- Проверка всех клиентов ---
async function checkAllClients() {
  logAction('🔍 Проверка всех клиентов на регистрацию...');
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    if (client.status === 'Не проверено') {
      const registered = await checkRegistration(client.phone);
      client.status = registered ? 'Зарегистрирован' : 'Не зарегистрирован';
      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Clients!D:D?range=D${i+2}&valueInputOption=RAW&key=${API_KEY}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[client.status]] })
          }
        );
      } catch (e) {}
      clients[i] = client;
    }
  }
  renderClients();
  updateStats();
  logAction('✅ Проверка завершена.');
}

// --- Обновление статуса аккаунта ---
async function updateAccountStatus() {
  const values = accounts.map(a => [a.phone, a.isActive ? 'true' : 'false']);
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Accounts!B:C?valueInputOption=RAW&key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      }
    );
  } catch (e) { logAction('Ошибка обновления статуса аккаунта'); }
}

// === ИНИЦИАЛИЗАЦИЯ ===
async function init() {
  // Загрузка сохранённых настроек
  scheduleStart = localStorage.getItem('whatsappPro_scheduleStart') || '09:00';
  scheduleEnd = localStorage.getItem('whatsappPro_scheduleEnd') || '18:00';
  isScheduleActive = localStorage.getItem('whatsappPro_scheduleActive') === 'true';
  lastSendDate = localStorage.getItem('whatsappPro_lastSendDate');

  // Проверка интернета
  checkInternetStatus();
  window.addEventListener('online', checkInternetStatus);
  window.addEventListener('offline', checkInternetStatus);

  // Автообновление каждые 5 минут
  autoUpdateData();
  setInterval(autoUpdateData, 5 * 60 * 1000);

  // Загрузка данных
  await loadClients();
  await loadAccounts();
  updateStats();

  // Кнопки
  addClientBtn.addEventListener('click', addClient);
  sendKpBtn.addEventListener('click', sendKPToAll);
  checkStatusBtn.addEventListener('click', checkAllClients);
  addAccountBtn.addEventListener('click', () => {
    const phone = prompt('Введите номер аккаунта WhatsApp (+79991234567):');
    if (phone && /^\+7\d{10}$/.test(phone)) {
      accounts.push({ id: Date.now(), phone, name: 'Аккаунт ' + (accounts.length + 1), isActive: false });
      renderAccounts();
      logAction(`Аккаунт добавлен: ${phone}`);
    }
  });

  // Кнопка очистки логов
  clearLogsBtn.className = 'btn btn-red';
  clearLogsBtn.textContent = '🗑️ Очистить логи';
  clearLogsBtn.style.marginTop = '16px';
  clearLogsBtn.onclick = clearLogs;
  logList.parentNode.insertBefore(clearLogsBtn, logList.nextSibling);

  // === НОВЫЙ ИНТЕРФЕЙС: РАСПИСАНИЕ С НАЧАЛОМ И КОНЦОМ ===
  const scheduleSection = document.createElement('section');
  scheduleSection.innerHTML = `
    <h2>⏰ Автоматическая рассылка</h2>
    <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 140px;">
        <label style="display: block; color: #8d8d9c; font-size: 14px; margin-bottom: 4px;">Начало</label>
        <input type="time" id="schedule-start" value="${scheduleStart}" style="width: 100%; padding: 10px; border-radius: 8px; border: none;">
      </div>
      <div style="flex: 1; min-width: 140px;">
        <label style="display: block; color: #8d8d9c; font-size: 14px; margin-bottom: 4px;">Конец</label>
        <input type="time" id="schedule-end" value="${scheduleEnd}" style="width: 100%; padding: 10px; border-radius: 8px; border: none;">
      </div>
      <button id="toggle-schedule" class="btn ${isScheduleActive ? 'btn-red' : 'btn-green'}" style="min-width: 160px; align-self: flex-end;">
        ${isScheduleActive ? '⏸️ Остановить расписание' : '▶️ Включить расписание'}
      </button>
    </div>
    <p style="color: #8d8d9c; font-size: 14px; margin-top: 8px;">
      Система будет открывать чаты и вставлять текст КП <strong>только в указанном диапазоне времени</strong>.<br>
      Рассылка происходит <strong>один раз в день</strong> — даже если вы откроете страницу несколько раз.<br>
      За 5 минут до старта — вы получите уведомление в Telegram.
    </p>
  `;
  document.querySelector('.controls').after(scheduleSection);

  // Подписки на события
  document.getElementById('schedule-start').addEventListener('change', setScheduleTimes);
  document.getElementById('schedule-end').addEventListener('change', setScheduleTimes);
  document.getElementById('toggle-schedule').addEventListener('click', toggleSchedule);

  // Запуск планировщика
  setupScheduler();

  // Уведомление при первой загрузке
  logAction('🚀 Приложение запущено. Расписание: ' + (isScheduleActive ? 'вкл.' : 'выкл.') + ' — ' + scheduleStart + ' – ' + scheduleEnd);
}

init();