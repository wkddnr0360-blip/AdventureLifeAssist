import { $, $$, getLogDate } from './utils.js';
import { AppState } from './appState.js';
import { UI } from './uiCtrl.js';
import { MapCtrl } from './mapCtrl.js';
import { db } from './firebaseConfig.js';
import { collection, addDoc, getDoc, getDocs, doc, deleteDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

export const DataCtrl = {
    localStartTime: null, tInt: null,
    
    async fetchAllLogs() {
        try {
            const snap = await getDocs(collection(db, "questLogs"));
            // BUG FIX: Removed '|| !d.uid' to prevent users from seeing logs with no UID
            AppState.logCache = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(d => d.uid === AppState.uid);
            this.renderViews();
        } catch(e) { console.error(e); }
    },
    
    renderViews() {
        const dailyLogs = AppState.logCache.filter(l => l.logicalDate === AppState.selDate).sort((a,b) => new Date(a.clientTime) - new Date(b.clientTime));
        let sDay = 0, sWeek = 0, sMonth = 0;
        let dObj = new Date(AppState.selDate), day = dObj.getDay(), diff = dObj.getDate() - day + (day === 0 ? -6 : 1);
        let wStart = new Date(dObj.setDate(diff)).toISOString().slice(0,10), wEnd = new Date(dObj.setDate(diff+6)).toISOString().slice(0,10);

        AppState.logCache.forEach(l => {
            if(l.type === '탐구' && l.duration) { sMonth += l.duration; if(l.logicalDate === AppState.selDate) sDay += l.duration; if(l.logicalDate >= wStart && l.logicalDate <= wEnd) sWeek += l.duration; }
        });
        $('stDay').innerText = sDay + "분"; $('stWeek').innerText = sWeek + "분"; $('stMonth').innerText = sMonth + "분";

        const stream1 = $('logStream'), stream2 = $('journalLogList');
        if (dailyLogs.length === 0) {
            const emptyMsg = '<p style="text-align:center; color:var(--text-dim); margin-top:40px; font-weight:700;">남겨진 여정이 없습니다.</p>';
            stream1.innerHTML = emptyMsg; stream2.innerHTML = emptyMsg;
        } else {
            const html = dailyLogs.map((l, i) => {
                const logIcon = (l.icon && l.icon.includes('fa-')) ? `<i class="${l.icon}"></i>` : (l.icon || '🐾');
                return `
                <div class="log-item" id="log-${l.id}">
                    <div class="log-seq">${i + 1}</div>
                    <div class="log-body">
                        <div class="log-header"><span class="log-title">${logIcon} ${l.type}</span><div class="log-actions"><span class="log-time-edit" id="edit-${l.id}">${new Date(l.clientTime).toTimeString().slice(0,5)}</span><button class="btn-delete" id="del-${l.id}"><i class="fa-solid fa-trash-can"></i></button></div></div>
                        <div class="log-content">${l.content}</div>${l.place ? `<div class="log-place"><i class="fa-solid fa-location-dot"></i> ${l.place}</div>` : ''}
                    </div>
                </div>`;
            }).join('');
            
            stream1.innerHTML = html; stream2.innerHTML = html;
            
            dailyLogs.forEach(l => {
                $$(`#log-${l.id}`).forEach(el => el.addEventListener('click', () => MapCtrl.viewOnMap(l.lat, l.lng)));
                $$(`#del-${l.id}`).forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); this.deleteLog(l.id); }));
                $$(`#edit-${l.id}`).forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); this.editLogTime(l.id, l.clientTime, new Date(l.clientTime).toTimeString().slice(0,5)); }));
            });
        }
        if($('viewQuest').classList.contains('active')) MapCtrl.drawPaths();
    },
    
    async saveEvent() {
        const act = $('inputAction').value || UI.evtType, plc = $('inputPlace').value; if(!act) return;
        try { 
            await MapCtrl.updateCurrentPosition();
            const newLog = { uid: AppState.uid, name: AppState.name, type: UI.evtType, icon: UI.evtIcon, content: act, place: plc, lat: MapCtrl.lat, lng: MapCtrl.lng, logicalDate: getLogDate(), createdAt: serverTimestamp(), clientTime: new Date().toISOString() };
            const docRef = await addDoc(collection(db, "questLogs"), newLog); AppState.logCache.push({ id: docRef.id, ...newLog }); AppState.selDate = getLogDate();
            this.renderViews(); UI.renderCalendar(); UI.hideModal('eventModal'); $('inputAction').value = ""; $('inputPlace').value = ""; 
        } catch (e) { alert("기록 실패"); }
    },
    
    async saveQuickMemo() {
        const btn = $('btnSaveMemo');
        if (btn.disabled) return;
        const txt = $('quickMemo').value.trim(); if(!txt) return;
        
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            await MapCtrl.updateCurrentPosition();
            const newLog = { uid: AppState.uid, name: AppState.name, type: '단상', icon: 'fa-solid fa-pen-nib', content: txt, lat: MapCtrl.lat, lng: MapCtrl.lng, logicalDate: getLogDate(), createdAt: serverTimestamp(), clientTime: new Date().toISOString() };
            const docRef = await addDoc(collection(db, "questLogs"), newLog); AppState.logCache.push({ id: docRef.id, ...newLog });
            $('quickMemo').value = ""; AppState.selDate = getLogDate(); this.renderViews(); UI.renderCalendar();
        } catch (e) { alert("저장 실패"); } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },
    
    async deleteLog(id) { if(confirm("기억을 지우시겠습니까?")) { await deleteDoc(doc(db, "questLogs", id)); AppState.logCache = AppState.logCache.filter(l => l.id !== id); this.renderViews(); } },
    
    async editLogTime(id, fullDateStr, oldHHMM) {
        let newTime = prompt("시간 수정 (HH:MM 형식)", oldHHMM);
        if(newTime && /^\d{2}:\d{2}$/.test(newTime)) {
            let d = new Date(fullDateStr), parts = newTime.split(':'); d.setHours(parseInt(parts[0]), parseInt(parts[1]), 0);
            await updateDoc(doc(db, "questLogs", id), { clientTime: d.toISOString() });
            let idx = AppState.logCache.findIndex(l => l.id === id); if(idx > -1) AppState.logCache[idx].clientTime = d.toISOString(); this.renderViews();
        }
    },

    async checkTimer() { try { const docSnap = await getDoc(doc(db, "activeTimers", AppState.uid)); if (docSnap.exists()) { this.localStartTime = docSnap.data().startTime; this.startTimerUI(); } } catch(e) {} },
    async toggleStudyTimer() {
        const sBtn = $('btnStudyToggle');
        if (!this.localStartTime) {
            this.localStartTime = Date.now(); await setDoc(doc(db, "activeTimers", AppState.uid), { startTime: this.localStartTime, logicalDate: getLogDate() }); this.startTimerUI();
        } else {
            clearInterval(this.tInt); await deleteDoc(doc(db, "activeTimers", AppState.uid));
            const totalMins = Math.floor((Date.now() - this.localStartTime) / 60000);
            if (totalMins >= 1) { 
                await MapCtrl.updateCurrentPosition();
                const newLog = { uid: AppState.uid, name: AppState.name, type: '탐구', icon: 'fa-solid fa-wand-magic-sparkles', content: totalMins < 90 ? `마법 탐구 완료` : `탐구 완료 (기본 90분 + 추가 ${totalMins - 90}분)`, duration: totalMins, place: '지혜의 전당', lat: MapCtrl.lat, lng: MapCtrl.lng, logicalDate: getLogDate(), createdAt: serverTimestamp(), clientTime: new Date().toISOString() };
                const docRef = await addDoc(collection(db, "questLogs"), newLog); AppState.logCache.push({ id: docRef.id, ...newLog }); AppState.selDate = getLogDate(); this.renderViews(); UI.renderCalendar();
            }
            this.localStartTime = null; $('stopwatch').innerHTML = "00:00:00"; sBtn.innerHTML = '<i class="fa-solid fa-book-journal-whills"></i> <span>마법 탐구 시작</span>'; sBtn.classList.remove('active');
        }
    },
    startTimerUI() {
        const sBtn = $('btnStudyToggle'); sBtn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>탐구 종료</span>'; sBtn.classList.add('active');
        this.tInt = setInterval(() => {
            let diff = Date.now() - this.localStartTime, totalMins = Math.floor(diff / 60000), d = new Date(diff), sw = $('stopwatch');
            if (totalMins < 90) sw.innerHTML = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}<span class="ms">:${String(d.getUTCSeconds()).padStart(2,'0')}</span>`; 
            else { let bonus = new Date(diff - (90 * 60000)); sw.innerHTML = `01:30<span class="ms">:00</span><span class="bonus-time">+ ${String(bonus.getUTCHours()).padStart(2,'0')}:${String(bonus.getUTCMinutes()).padStart(2,'0')}:${String(bonus.getUTCSeconds()).padStart(2,'0')}</span>`; }
        }, 1000);
    }
};