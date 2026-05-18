import { $, $$, getLogDate } from './utils.js';
import { AppState } from './appState.js';
import { UI } from './uiCtrl.js';
import { db } from './firebaseConfig.js';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

export const TavernCtrl = {
    unsubGlobal: null, unsubSelf: null, unsubQuests: null, pendingSelfImage: null,
    
    bindEvents() {
        $$('.dm-tab').forEach(el => el.addEventListener('click', () => {
            $$('.dm-tab').forEach(t => t.classList.remove('active')); el.classList.add('active');
            $$('.tavern-section').forEach(s => s.classList.remove('active')); $(el.dataset.target).classList.add('active');
            if(el.dataset.target === 'secSelf') this.initSelf(); if(el.dataset.target === 'secQuest') this.initQuests();
        }));
        const sendG = () => this.sendGlobalChat(); $('btnSendGlobal').addEventListener('click', sendG); $('chatInputGlobal').addEventListener('keypress', (e) => { if(e.key==='Enter') sendG(); });
        const sendS = () => this.sendSelfChat(); $('btnSendSelf').addEventListener('click', sendS); $('chatInputSelf').addEventListener('keypress', (e) => { if(e.key==='Enter') sendS(); });
        const addQ = () => this.addQuest(); $('btnAddQuest').addEventListener('click', addQ); $('questInput').addEventListener('keypress', (e) => { if(e.key==='Enter') addQ(); });
    },

    initGlobal() {
        if(this.unsubGlobal) return;
        this.unsubGlobal = onSnapshot(query(collection(db, "tavernChats")), (snapshot) => {
            const msgs = []; snapshot.forEach(doc => msgs.push({id: doc.id, ...doc.data()})); msgs.sort((a,b) => new Date(a.clientTime) - new Date(b.clientTime));
            const stream = $('chatStreamGlobal');
            if(msgs.length === 0) stream.innerHTML = `<div class="empty-chat">길드 주점의 메시지가 없습니다.</div>`;
            else {
                stream.innerHTML = msgs.map(msg => this.buildChatHTML(msg, false)).join('');
                msgs.forEach(msg => { const av = $(`tavernavatar-${msg.id}`); if(av) av.addEventListener('click', () => this.viewUserJourney(msg.uid, msg.name)); });
            }
            setTimeout(() => stream.scrollTop = stream.scrollHeight, 100);
        });
    },
    async sendGlobalChat() { const input = $('chatInputGlobal'); if(!input.value.trim()) return; const text = input.value; input.value = ""; await addDoc(collection(db, "tavernChats"), { uid: AppState.uid, name: AppState.name, avatar: AppState.avatar, message: text, logicalDate: getLogDate(), createdAt: serverTimestamp(), clientTime: new Date().toISOString() }); },

    initSelf() {
        if(this.unsubSelf) return;
        this.unsubSelf = onSnapshot(query(collection(db, "selfChats")), (snapshot) => {
            const msgs = []; snapshot.forEach(doc => msgs.push({id: doc.id, ...doc.data()}));
            const myMsgs = msgs.filter(m => m.uid === AppState.uid).sort((a,b) => new Date(a.clientTime) - new Date(b.clientTime));
            const stream = $('chatStreamSelf');
            if(myMsgs.length === 0) stream.innerHTML = `<div class="empty-chat">나만의 비밀 기록장입니다.</div>`; else stream.innerHTML = myMsgs.map(msg => this.buildChatHTML(msg, true)).join('');
            setTimeout(() => stream.scrollTop = stream.scrollHeight, 100);
        });
        
        $('selfImageUpload').addEventListener('change', (e) => {
            const file = e.target.files[0]; if(!file) return; const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image(); img.onload = () => {
                    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
                    let w = img.width, h = img.height; const maxW = 500; if(w > maxW) { h *= maxW / w; w = maxW; }
                    canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
                    this.pendingSelfImage = canvas.toDataURL('image/jpeg', 0.6); $('chatInputSelf').placeholder = "사진 첨부됨. 캡션 입력...";
                }; img.src = event.target.result;
            }; reader.readAsDataURL(file);
        });
    },
    async sendSelfChat() {
        const input = $('chatInputSelf'), text = input.value.trim(); if(!text && !this.pendingSelfImage) return;
        input.value = ""; input.placeholder = "나에게 메모 남기기..."; let localImgId = null;
        if(this.pendingSelfImage) { localImgId = 's_img_' + Date.now(); try { localStorage.setItem(localImgId, this.pendingSelfImage); } catch(e) {} this.pendingSelfImage = null; }
        await addDoc(collection(db, "selfChats"), { uid: AppState.uid, message: text, localImageId: localImgId, logicalDate: getLogDate(), createdAt: serverTimestamp(), clientTime: new Date().toISOString() });
    },

    buildChatHTML(msg, isSelf) {
        const isMe = msg.uid === AppState.uid, avatarStyle = msg.avatar ? `background-image:url(${msg.avatar}); color:transparent;` : '';
        let imgHtml = ''; 
        if(isSelf && msg.localImageId) { const src = localStorage.getItem(msg.localImageId); imgHtml = src ? `<img src="${src}" style="max-width:100%; border-radius:10px; margin-top:5px; display:block;">` : `<div style="font-size:11px; color:#aaa; margin-top:5px;">[사진 만료됨]</div>`; }
        const safeText = msg.message ? msg.message.replace(/\n/g, '<br>') : ''; 
        return `<div class="chat-msg ${isMe || isSelf ? 'mine' : ''}">${(!isMe && !isSelf) ? `<div class="chat-avatar" id="tavernavatar-${msg.id}" style="${avatarStyle}">${msg.avatar ? '' : '<i class="fa-solid fa-user"></i>'}</div>` : ''}<div class="chat-bubble-wrap">${(!isMe && !isSelf) ? `<div class="chat-name">${msg.name}</div>` : ''}<div class="chat-bubble">${safeText}${imgHtml}</div></div></div>`;
    },

    initQuests() {
        if(this.unsubQuests) return;
        this.unsubQuests = onSnapshot(query(collection(db, "selfQuests")), (snapshot) => {
            const qs = []; snapshot.forEach(doc => qs.push({id: doc.id, ...doc.data()})); 
            const myQs = qs.filter(q => q.uid === AppState.uid).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
            const stream = $('questList');
            if(myQs.length === 0) stream.innerHTML = `<div class="empty-chat">추가된 셀프 퀘스트가 없습니다.</div>`;
            else {
                stream.innerHTML = myQs.map(q => `<div class="quest-card ${q.isDone ? 'done' : ''}"><div class="q-info" id="qinfo-${q.id}"><div class="q-check"><i class="fa-solid fa-check"></i></div><div class="q-title">${q.title}</div></div><div class="q-del" id="qdel-${q.id}"><i class="fa-solid fa-xmark"></i></div></div>`).join('');
                myQs.forEach(q => { $(`qinfo-${q.id}`).addEventListener('click', () => updateDoc(doc(db, "selfQuests", q.id), {isDone: !q.isDone})); $(`qdel-${q.id}`).addEventListener('click', () => deleteDoc(doc(db, "selfQuests", q.id))); });
            }
        });
    },
    async addQuest() { const input = $('questInput'); if(!input.value.trim()) return; await addDoc(collection(db, "selfQuests"), { uid: AppState.uid, title: input.value, isDone: false, createdAt: Date.now() }); input.value = ""; },
    
    async viewUserJourney(targetUid, targetName) {
        $('userJourneyTitle').innerText = `${targetName}님의 오늘 여정`; const logBox = $('userJourneyLog'); logBox.innerHTML = "<div style='text-align:center; padding:20px;'><i class='fa-solid fa-spinner fa-spin'></i> 탐색 중...</div>"; UI.showModal('userJourneyModal');
        try {
            const logs = (await getDocs(collection(db, "questLogs"))).docs.map(d=>d.data()).filter(d=> d.uid === targetUid && d.logicalDate === getLogDate()).sort((a,b) => new Date(a.clientTime) - new Date(b.clientTime));
            if(logs.length === 0) { logBox.innerHTML = "<p style='text-align:center; color:var(--text-dim);'>여정이 없습니다.</p>"; return; }
            logBox.innerHTML = logs.map(l => `<div class="log-item" style="padding: 12px 15px; box-shadow: none; border-color: rgba(0,0,0,0.05); margin-bottom: 8px;"><div class="log-header" style="margin-bottom:4px;"><span class="log-title" style="font-size:13px;">${(l.icon && l.icon.includes('fa-')) ? `<i class="${l.icon}"></i>` : (l.icon || '🐾')} ${l.type}</span><span style="font-size:11px; color:var(--text-dim);">${new Date(l.clientTime).toTimeString().slice(0,5)}</span></div><div class="log-content">${l.content}</div></div>`).join('');
        } catch (e) { logBox.innerHTML = "<p style='color:red;'>불러오지 못했습니다.</p>"; }
    }
};