import { $, $$, getLogDate } from './utils.js';
import { MapCtrl } from './mapCtrl.js';
import { AppState } from './appState.js';
import { DataCtrl } from './dataCtrl.js';
import { TavernCtrl } from './tavernCtrl.js';

export const UI = {
    evtType: null, evtIcon: 'fa-solid fa-route',
    
    switchView(vid, navEl) {
        $$('.view-section').forEach(v => v.classList.remove('active')); $(vid).classList.add('active');
        $$('.nav-item').forEach(i => i.classList.remove('active')); navEl.classList.add('active');
        $('globalHeader').style.display = (vid === 'viewTavern') ? 'none' : 'flex';

        if(vid === 'viewQuest') setTimeout(() => { if(MapCtrl.map) { MapCtrl.map.invalidateSize(); MapCtrl.drawPaths(); } else { MapCtrl.init(); } }, 100);
        if(vid === 'viewJournal') this.renderCalendar();
        if(vid === 'viewTavern') { TavernCtrl.initGlobal(); TavernCtrl.initSelf(); TavernCtrl.initQuests(); } 
    },
    
    showModal(id) { const m = $(id); if(m) { m.style.display = 'flex'; setTimeout(() => m.classList.add('active'), 10); } },
    hideModal(id) { const m = $(id); if(m) { m.classList.remove('active'); setTimeout(() => m.style.display='none', 300); } },
    
    renderCalendar() {
        const grid = $('calendarGrid'), y = AppState.navDate.getFullYear(), m = AppState.navDate.getMonth(), todayStr = getLogDate();
        $('calMonthTitle').innerText = `${y}년 ${m + 1}월`;
        grid.innerHTML = ['일','월','화','수','목','금','토'].map(d => `<div class="cal-day-hdr">${d}</div>`).join('') + Array(new Date(y, m, 1).getDay()).fill('<div></div>').join('');
        for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) {
            const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            let cell = document.createElement('div');
            cell.className = `cal-date ${dStr === todayStr ? 'today' : ''} ${dStr === AppState.selDate ? 'selected' : ''}`; cell.innerText = i;
            cell.addEventListener('click', () => { AppState.selDate = dStr; $('journalDateTitle').innerText = `${dStr.replace(/-/g, '.')}의 여정`; this.renderCalendar(); DataCtrl.renderViews(); });
            grid.appendChild(cell);
        }
    },
    
    bindEvents() {
        $$('.nav-item').forEach(el => el.addEventListener('click', () => this.switchView(el.dataset.view, el)));
        $('btnCloak').addEventListener('click', () => MapCtrl.toggleCloak()); $('btnLocate').addEventListener('click', () => MapCtrl.locateMe());
        $('btnOpenEvents').addEventListener('click', () => this.showModal('eventModal'));
        $('btnOpenProfile').addEventListener('click', () => { $('profileNameInput').value = AppState.name; this.showModal('profileModal'); });
        
        $$('.modal-overlay').forEach(m => m.addEventListener('click', (e) => { 
            if(e.target === m) {
                if (m.id === 'profileModal' && !AppState.uid) return;
                this.hideModal(m.id); 
            }
        }));
        
        $$('.evt-opt').forEach(el => {
            el.addEventListener('click', () => {
                $$('.evt-opt').forEach(x => x.classList.remove('selected')); el.classList.add('selected');
                this.evtType = el.dataset.type; this.evtIcon = el.dataset.icon; $('eventInputs').style.display = 'flex';
            });
        });

        $('btnPrevMonth').addEventListener('click', () => { AppState.navDate.setMonth(AppState.navDate.getMonth() - 1); this.renderCalendar(); });
        $('btnNextMonth').addEventListener('click', () => { AppState.navDate.setMonth(AppState.navDate.getMonth() + 1); this.renderCalendar(); });

        $('quickMemo').addEventListener('keypress', (e) => { if(e.key === 'Enter') DataCtrl.saveQuickMemo(); });
        $('btnSaveMemo').addEventListener('click', () => DataCtrl.saveQuickMemo());
        
        $('btnSaveProfile').addEventListener('click', () => {
            AppState.name = $('profileNameInput').value.trim() || AppState.name;
            localStorage.setItem('mystic_name', AppState.name); localStorage.setItem('mystic_avatar', AppState.avatar);
            this.hideModal('profileModal'); if(MapCtrl.map) { MapCtrl.map.remove(); MapCtrl.map = null; MapCtrl.marker = null; MapCtrl.init(); }
        });

        $('btnResetAvatar').addEventListener('click', () => { AppState.avatar = ""; localStorage.removeItem('mystic_avatar'); AppState.updateAvatarUI(); alert("기본 아바타로 복구되었습니다."); });

        $('btnApplySync').addEventListener('click', () => {
            const code = $('syncCodeInput').value.trim();
            if(code && code.startsWith('uid_')) { if(confirm("데이터를 불러옵니다. 진행할까요?")) { localStorage.setItem('mystic_uid', code); location.reload(); } } else alert("유효하지 않은 코드입니다.");
        });

        $('btnStudyToggle').addEventListener('click', () => DataCtrl.toggleStudyTimer());
        $('btnSaveEvent').addEventListener('click', () => DataCtrl.saveEvent());
        $('btnCloseJourney').addEventListener('click', () => this.hideModal('userJourneyModal'));
    }
};