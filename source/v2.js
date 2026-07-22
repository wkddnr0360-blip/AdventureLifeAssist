
    /* FocusBell 2.0 feature layer */
    Object.assign(State, {
      publicProfiles: [], publicStats: [], presence: [], rtdbPresence: {},
      memos: [], plans: [], achievements: [], friendRequests: [], friendships: [], conversations: [],
      currentConversation: null, messages: [], messageUnsub: null,
      selectedDateKey: dateKey(), calendarCursorMs: new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime(),
      communityTab: 'live', rankPeriod: 'today', friendSearchResult: null,
      presenceInterval: null, rtdbUnsub: null, rtdbDeviceRef: null,
      isAdmin: false, adminClaims: {}, adminRows: [], adminReports: [], adminLoading: false,
      tutorialStep: 0, game: null, gameInterval: null,
      publishTimer: null, lastPublicProfileSignature: '', lastStatsSignature: '',
      v2Ready: false
    });

    const DEVICE_ID = Local.globalGet('deviceId') || makeId('device');
    Local.globalSet('deviceId', DEVICE_ID);
    const ADMIN_EMAIL = 'wkddnr0360@naver.com';
    const FRESH_PRESENCE_MS = 125000;

    const weekKey = (ms=now()) => {
      const d=new Date(ms); d.setHours(12,0,0,0); const diff=(d.getDay()+6)%7; d.setDate(d.getDate()-diff); return dateKey(d.getTime());
    };
    const pairIdFor = (a,b) => [String(a),String(b)].sort().join('__');
    const dateFromKey = key => { const [y,m,d]=String(key).split('-').map(Number); return new Date(y,m-1,d,12,0,0,0); };
    const isFresh = ms => Number(ms||0) > now()-FRESH_PRESENCE_MS;
    const compactText = (value,max=80) => { const text=String(value??'').replace(/\s+/g,' ').trim(); return text.length>max?`${text.slice(0,max-1)}…`:text; };
    const prettyJSON = value => JSON.stringify(value,(key,val)=>key.startsWith('__')?undefined:val,2);
    const safeError = error => firebaseErrorMessage(error).replace(/^FirebaseError:\s*/,'');

    Object.assign(Firebase, {
      publicProfilesCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'publicProfiles'); },
      publicProfileDoc(userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'publicProfiles',userId); },
      publicStatsCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'publicStats'); },
      publicStatsDoc(userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'publicStats',userId); },
      presenceCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'presence'); },
      presenceDoc(userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'presence',userId); },
      adminPresenceCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'adminPresence'); },
      adminPresenceDoc(userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'adminPresence',userId); },
      memosCol(userId=uid()) { return this.mods.collection(this.db,'apps',CONFIG.appId,'users',userId,'memos'); },
      memoDoc(id,userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'users',userId,'memos',id); },
      plansCol(userId=uid()) { return this.mods.collection(this.db,'apps',CONFIG.appId,'users',userId,'plans'); },
      planDoc(id,userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'users',userId,'plans',id); },
      achievementsCol(userId=uid()) { return this.mods.collection(this.db,'apps',CONFIG.appId,'users',userId,'achievements'); },
      achievementDoc(id,userId=uid()) { return this.mods.doc(this.db,'apps',CONFIG.appId,'users',userId,'achievements',id); },
      friendRequestsCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'friendRequests'); },
      friendRequestDoc(id) { return this.mods.doc(this.db,'apps',CONFIG.appId,'friendRequests',id); },
      friendshipsCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'friendships'); },
      friendshipDoc(id) { return this.mods.doc(this.db,'apps',CONFIG.appId,'friendships',id); },
      conversationsCol() { return this.mods.collection(this.db,'apps',CONFIG.appId,'conversations'); },
      conversationDoc(id) { return this.mods.doc(this.db,'apps',CONFIG.appId,'conversations',id); },
      messagesCol(conversationId) { return this.mods.collection(this.db,'apps',CONFIG.appId,'conversations',conversationId,'messages'); },
      messageDoc(conversationId,messageId) { return this.mods.doc(this.db,'apps',CONFIG.appId,'conversations',conversationId,'messages',messageId); }
    });

    const profileById = userId => State.publicProfiles.find(p=>p.uid===userId) || (userId===uid()?State.profile:null) || null;
    const statsById = userId => State.publicStats.find(s=>s.uid===userId) || null;
    const friendshipWith = userId => State.friendships.find(f=>Array.isArray(f.memberIds)&&f.memberIds.includes(userId));
    const otherMemberId = item => (item?.memberIds||[]).find(id=>id!==uid()) || '';
    const publicName = userId => profileById(userId)?.displayName || statsById(userId)?.displayName || '사용자';
    const publicHandle = userId => profileById(userId)?.handle || statsById(userId)?.handle || 'focus';

    function aggregatePresence(userId) {
      const devices=Object.values(State.rtdbPresence?.[userId]||{});
      const visibleDevices=devices.filter(d=>d&&d.state==='online'&&d.visible!==false);
      if(visibleDevices.length) {
        const studying=visibleDevices.filter(d=>d.studying);
        const latest=[...visibleDevices].sort((a,b)=>Number(b.lastChanged||0)-Number(a.lastChanged||0))[0];
        const studyLatest=[...studying].sort((a,b)=>Number(b.lastChanged||0)-Number(a.lastChanged||0))[0];
        return {online:true,studying:!!studying.length,subject:studyLatest?.subject||'',lastSeenAtMs:Number(latest?.lastChanged||now()),source:'realtime'};
      }
      const p=State.presence.find(x=>x.uid===userId);
      const online=!!p&&p.visible!==false&&isFresh(p.lastSeenAtMs);
      return {online,studying:online&&!!p?.studying,subject:online?p?.subject||'':'',lastSeenAtMs:Number(p?.lastSeenAtMs||0),source:'firestore'};
    }

    const AdminAuth = {
      async evaluate(user=Firebase.auth?.currentUser) {
        State.isAdmin=false; State.adminClaims={};
        if(!user||!State.firebaseReady||State.offlineIdentity) return false;
        try {
          const token=await Firebase.mods.getIdTokenResult(user,true); State.adminClaims=token.claims||{};
          State.isAdmin=token.claims?.admin===true || (String(user.email||'').toLowerCase()===ADMIN_EMAIL && token.claims?.email_verified===true);
        } catch(err) { console.warn('Admin claim check failed',err); }
        V2UI.renderSettings();
        return State.isAdmin;
      }
    };

    const PublicPublisher = {
      defaults() {
        return {
          dailyMinutesGoal:Number(State.profile?.dailyMinutesGoal)||120,
          dailyProblemsGoal:Number(State.profile?.dailyProblemsGoal)||50,
          showInRanking:State.profile?.showInRanking!==false,
          shareStudyStatus:State.profile?.shareStudyStatus!==false,
          showOnlineStatus:State.profile?.showOnlineStatus!==false,
          tutorialCompletedAtMs:Number(State.profile?.tutorialCompletedAtMs)||0
        };
      },
      async bootstrap() {
        if(!State.user) return;
        const defaults=this.defaults();
        State.profile={...(State.profile||{}),...defaults};
        Local.set('profile',State.profile); UI.renderAll();
        if(State.firebaseReady&&!State.offlineIdentity) {
          await Firebase.mods.setDoc(Firebase.userDoc(),{...defaults,updatedAtMs:now()},{merge:true});
          await this.publishProfile(true); await this.publishStats(true);
        }
      },
      publicProfilePayload() {
        const p=State.profile||{};
        return {uid:uid(),displayName:p.displayName||State.user?.displayName||'사용자',handle:p.handle||defaultHandle(State.user?.email,uid()),bio:p.bio||'',showInRanking:p.showInRanking!==false,shareStudyStatus:p.shareStudyStatus!==false,showOnlineStatus:p.showOnlineStatus!==false,createdAtMs:Number(p.createdAtMs)||now(),updatedAtMs:now()};
      },
      async publishProfile(force=false) {
        if(!State.firebaseReady||State.offlineIdentity||!State.user) return;
        const payload=this.publicProfilePayload(); const signature=JSON.stringify({...payload,updatedAtMs:0});
        if(!force&&signature===State.lastPublicProfileSignature) return;
        State.lastPublicProfileSignature=signature;
        await Firebase.mods.setDoc(Firebase.publicProfileDoc(),payload,{merge:true});
      },
      statsPayload() {
        const p=this.publicProfilePayload(); const today=dateKey(), week=weekKey();
        const ownLogs=State.logs||[];
        const todayLogs=ownLogs.filter(l=>dateKey(l.endedAtMs||l.startedAtMs)===today);
        const weekLogs=ownLogs.filter(l=>weekKey(l.endedAtMs||l.startedAtMs)===week);
        const completedTodaySec=todayLogs.reduce((s,l)=>s+Number(l.durationSec||0),0);
        const completedWeekSec=weekLogs.reduce((s,l)=>s+Number(l.durationSec||0),0);
        const totalSec=ownLogs.reduce((s,l)=>s+Number(l.durationSec||0),0);
        const active=State.activeSession&&!State.activeSession.pausedAtMs?Session.elapsedSec(State.activeSession):0;
        const activeToday=State.activeSession&&dateKey(State.activeSession.startedAtMs)===today?active:0;
        const activeWeek=State.activeSession&&weekKey(State.activeSession.startedAtMs)===week?active:0;
        const exposeRanking=p.showInRanking!==false;
        return {
          uid:uid(),displayName:p.displayName,handle:p.handle,
          todayKey:today,todayMinutes:exposeRanking?Math.max(0,Math.floor((completedTodaySec+activeToday)/60)):0,todaySolved:exposeRanking?todayLogs.reduce((s,l)=>s+Number(l.solvedCount||0),0):0,
          weekKey:week,weekMinutes:exposeRanking?Math.max(0,Math.floor((completedWeekSec+activeWeek)/60)):0,
          totalMinutes:exposeRanking?Math.max(0,Math.floor(totalSec/60)):0,totalSolved:exposeRanking?ownLogs.reduce((s,l)=>s+Number(l.solvedCount||0),0):0,
          streak:exposeRanking?Stats.streak():0,sessionCount:exposeRanking?ownLogs.length:0,
          isStudying:!!State.activeSession&&!State.activeSession.pausedAtMs&&p.shareStudyStatus&&p.showOnlineStatus,
          currentSubject:p.shareStudyStatus&&p.showOnlineStatus&&State.activeSession&&!State.activeSession.pausedAtMs?State.activeSession.subject:'',
          sessionStartedAtMs:p.shareStudyStatus&&p.showOnlineStatus&&State.activeSession&&!State.activeSession.pausedAtMs?Number(State.activeSession.startedAtMs):0,
          showInRanking:p.showInRanking,shareStudyStatus:p.shareStudyStatus,
          updatedAtMs:now()
        };
      },
      async publishStats(force=false) {
        if(!State.firebaseReady||State.offlineIdentity||!State.user) return;
        const payload=this.statsPayload(); const signature=JSON.stringify({...payload,updatedAtMs:0});
        if(!force&&signature===State.lastStatsSignature) return;
        State.lastStatsSignature=signature;
        await Firebase.mods.setDoc(Firebase.publicStatsDoc(),payload,{merge:true});
      },
      schedule() {
        clearTimeout(State.publishTimer);
        State.publishTimer=setTimeout(()=>Promise.allSettled([this.publishProfile(),this.publishStats()]),500);
      }
    };

    const Presence = {
      rtdbMods:null, rtdb:null, connectedUnsub:null, lastPublicVisible:null,
      payload(state='online') {
        const p=State.profile||{}; const publicVisible=p.showOnlineStatus!==false;
        const studying=publicVisible&&!!State.activeSession&&!State.activeSession.pausedAtMs;
        return {uid:uid(),deviceId:DEVICE_ID,state:publicVisible?state:'offline',studying:publicVisible&&p.shareStudyStatus!==false&&studying,subject:publicVisible&&p.shareStudyStatus!==false&&studying?State.activeSession.subject:'',visible:publicVisible,displayName:p.displayName||State.user?.displayName||'사용자',handle:p.handle||'focus',lastChanged:this.rtdbMods?.serverTimestamp?.()||now()};
      },
      async start() {
        await this.stop(false);
        if(!State.user||!State.firebaseReady||State.offlineIdentity) return;
        try {
          const base=`https://www.gstatic.com/firebasejs/${CONFIG.firebaseSdk}`;
          this.rtdbMods=await import(`${base}/firebase-database.js`);
          this.rtdb=this.rtdbMods.getDatabase(Firebase.app,CONFIG.firebase.databaseURL);
          const root=this.rtdbMods.ref(this.rtdb,`${CONFIG.appId}/presence`);
          State.rtdbUnsub=this.rtdbMods.onValue(root,snap=>{State.rtdbPresence=snap.val()||{};V2UI.renderPresenceViews();},err=>console.warn('Realtime presence read failed',err));
          State.rtdbDeviceRef=this.rtdbMods.ref(this.rtdb,`${CONFIG.appId}/presence/${uid()}/${DEVICE_ID}`);
          const connectedRef=this.rtdbMods.ref(this.rtdb,'.info/connected');
          this.connectedUnsub=this.rtdbMods.onValue(connectedRef,async snap=>{
            if(snap.val()!==true||!State.rtdbDeviceRef) return;
            try {
              await this.rtdbMods.onDisconnect(State.rtdbDeviceRef).set(this.payload('offline'));
              await this.rtdbMods.set(State.rtdbDeviceRef,this.payload('online'));
            } catch(err) { console.warn('Realtime presence setup failed',err); }
          });
        } catch(err) { console.warn('Realtime Database unavailable; Firestore heartbeat will be used.',err); }
        await this.heartbeat(true);
        State.presenceInterval=setInterval(()=>this.heartbeat(),45000);
      },
      async heartbeat(force=false) {
        if(!State.user||!State.firebaseReady||State.offlineIdentity) return;
        const p=State.profile||{}; const publicVisible=p.showOnlineStatus!==false;
        const studying=!!State.activeSession&&!State.activeSession.pausedAtMs;
        const common={uid:uid(),deviceId:DEVICE_ID,studying,subject:studying?State.activeSession.subject:'',displayName:p.displayName||State.user?.displayName||'사용자',handle:p.handle||'focus',lastSeenAtMs:now(),updatedAtMs:now()};
        const publicPayload={...common,visible:true,studying:p.shareStudyStatus!==false&&studying,subject:p.shareStudyStatus!==false&&studying?State.activeSession.subject:''};
        const adminPayload={...common,visible:publicVisible,shareStudyStatus:p.shareStudyStatus!==false,subject:p.shareStudyStatus!==false&&studying?State.activeSession.subject:''};
        const jobs=[Firebase.mods.setDoc(Firebase.adminPresenceDoc(),adminPayload,{merge:true})];
        jobs.push(publicVisible?Firebase.mods.setDoc(Firebase.presenceDoc(),publicPayload,{merge:true}):Firebase.mods.deleteDoc(Firebase.presenceDoc()));
        try { await Promise.all(jobs); } catch(err) { if(force) console.warn('Firestore presence failed',err); }
        try {
          if(State.rtdbDeviceRef&&this.rtdbMods&&(publicVisible||this.lastPublicVisible!==false)) await this.rtdbMods.set(State.rtdbDeviceRef,this.payload('online'));
        } catch {}
        this.lastPublicVisible=publicVisible;
        PublicPublisher.publishStats().catch(()=>{});
      },
      async stop(markOffline=true) {
        if(State.presenceInterval) clearInterval(State.presenceInterval); State.presenceInterval=null;
        try { State.rtdbUnsub?.(); } catch {} State.rtdbUnsub=null;
        try { this.connectedUnsub?.(); } catch {} this.connectedUnsub=null;
        if(markOffline&&State.rtdbDeviceRef&&this.rtdbMods) { try { await this.rtdbMods.set(State.rtdbDeviceRef,this.payload('offline')); await this.rtdbMods.onDisconnect(State.rtdbDeviceRef).cancel(); } catch {} }
        State.rtdbDeviceRef=null; State.rtdbPresence={}; this.lastPublicVisible=null;
      }
    };

    const upsertV2 = (name,item) => {
      const arr=State[name]||[]; const idx=arr.findIndex(x=>x.id===item.id);
      if(idx>=0) arr[idx]={...arr[idx],...item}; else arr.unshift(item);
      State[name]=arr; Local.set(name,arr); V2UI.renderAll();
    };

    const isConnectivityError = error => {
      const code=String(error?.code||'').toLowerCase(),message=String(error?.message||'').toLowerCase();
      return ['unavailable','deadline-exceeded','network-request-failed'].some(value=>code.includes(value)) || /offline|network|connection/.test(message);
    };

    async function queueCloudWrite(factory,{requireOnline=false}={}) {
      if(!State.firebaseReady||State.offlineIdentity)return {localOnly:true};
      if(requireOnline&&!navigator.onLine)throw new Error('온라인 연결이 필요합니다.');
      if(!navigator.onLine) {
        Promise.resolve().then(factory).catch(error=>console.warn('Queued cloud write failed',error));
        return {queued:true};
      }
      return factory();
    }

    const V2Repo = {
      loadMirror(userId=uid()) {
        for(const name of ['memos','plans','achievements']) State[name]=Local.get(name,[],userId)||[];
      },
      async saveMemo(memo) { upsertV2('memos',memo); await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.memoDoc(memo.id),memo,{merge:true})); },
      async deleteMemo(id) { State.memos=State.memos.filter(x=>x.id!==id);Local.set('memos',State.memos);V2UI.renderCalendar();await queueCloudWrite(()=>Firebase.mods.deleteDoc(Firebase.memoDoc(id))); },
      async savePlan(plan) { upsertV2('plans',plan); await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.planDoc(plan.id),plan,{merge:true})); },
      async deletePlan(id) { State.plans=State.plans.filter(x=>x.id!==id);Local.set('plans',State.plans);V2UI.renderCalendar();await queueCloudWrite(()=>Firebase.mods.deleteDoc(Firebase.planDoc(id))); },
      async saveAchievement(item) { if(!State.achievements.some(x=>x.id===item.id))upsertV2('achievements',item);await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.achievementDoc(item.id),item,{merge:true})); },
      async savePreferences(patch) {
        State.profile={...(State.profile||{}),...patch,updatedAtMs:now()};Local.set('profile',State.profile);UI.renderAll();
        await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.userDoc(),{...patch,updatedAtMs:now()},{merge:true}));
        await Promise.allSettled([PublicPublisher.publishProfile(true),PublicPublisher.publishStats(true),Presence.heartbeat(true)]);
      },
      async searchHandle(handle) {
        if(!State.firebaseReady||State.offlineIdentity) throw new Error('친구 검색은 온라인 연결이 필요합니다.');
        const normalized=normalizeHandle(handle); if(!/^[a-z0-9_.]{3,20}$/.test(normalized))throw new Error('아이디 형식을 확인해 주세요.');
        const handleSnap=await Firebase.mods.getDoc(Firebase.handleDoc(normalized)); if(!handleSnap.exists())return null;
        const userId=handleSnap.data().uid; const profileSnap=await Firebase.mods.getDoc(Firebase.publicProfileDoc(userId));
        return profileSnap.exists()?{uid:userId,...profileSnap.data()}:null;
      },
      async sendFriendRequest(target) {
        if(!target||target.uid===uid())throw new Error('내 계정에는 친구 요청을 보낼 수 없습니다.');
        if(friendshipWith(target.uid))throw new Error('이미 친구입니다.');
        const id=pairIdFor(uid(),target.uid); const existing=State.friendRequests.find(r=>r.id===id);
        if(existing)throw new Error(existing.fromId===uid()?'이미 친구 요청을 보냈습니다.':'상대방이 이미 친구 요청을 보냈습니다.');
        const p=State.profile||{}; const request={id,participantIds:[uid(),target.uid].sort(),fromId:uid(),toId:target.uid,fromName:p.displayName||'사용자',fromHandle:p.handle||'focus',toName:target.displayName||'사용자',toHandle:target.handle||'focus',status:'pending',createdAtMs:now(),updatedAtMs:now()};
        await Firebase.mods.setDoc(Firebase.friendRequestDoc(id),request); UI.toast('친구 요청을 보냈습니다.','success');
      },
      async acceptFriendRequest(request) {
        if(!request||request.toId!==uid())throw new Error('받은 친구 요청만 수락할 수 있습니다.');
        const memberIds=[request.fromId,request.toId].sort(); const friendship={id:request.id,memberIds,userAId:memberIds[0],userAName:publicName(memberIds[0]),userAHandle:publicHandle(memberIds[0]),userBId:memberIds[1],userBName:publicName(memberIds[1]),userBHandle:publicHandle(memberIds[1]),createdAtMs:now(),updatedAtMs:now()};
        const batch=Firebase.mods.writeBatch(Firebase.db);batch.set(Firebase.friendshipDoc(request.id),friendship);batch.delete(Firebase.friendRequestDoc(request.id));await batch.commit();UI.toast('친구가 되었습니다.','success');
      },
      async deleteFriendRequest(id) { await Firebase.mods.deleteDoc(Firebase.friendRequestDoc(id)); },
      async removeFriend(friendship) {
        if(!friendship)return; const conversationId=friendship.id; const M=Firebase.mods;
        try {
          const messages=await M.getDocs(M.query(Firebase.messagesCol(conversationId),M.limit(400))); const batch=M.writeBatch(Firebase.db);
          messages.docs.forEach(d=>batch.delete(d.ref));batch.delete(Firebase.conversationDoc(conversationId));batch.delete(Firebase.friendshipDoc(friendship.id));await batch.commit();
        } catch { await M.deleteDoc(Firebase.friendshipDoc(friendship.id)); }
        UI.toast('친구 목록에서 삭제했습니다.');
      },
      conversationPayload(friendship) {
        const memberIds=[...(friendship.memberIds||[])].sort(); const a=memberIds[0],b=memberIds[1];
        return {id:friendship.id,memberIds,userAId:a,userAName:publicName(a),userAHandle:publicHandle(a),userBId:b,userBName:publicName(b),userBHandle:publicHandle(b),lastMessagePreview:'',lastMessageAtMs:0,lastSenderId:'',readAt:{[a]:0,[b]:0},createdAtMs:now(),updatedAtMs:now()};
      },
      async ensureConversation(friendship) {
        const ref=Firebase.conversationDoc(friendship.id); const snap=await Firebase.mods.getDoc(ref);
        if(snap.exists())return{id:snap.id,...snap.data()};
        const payload=this.conversationPayload(friendship);await Firebase.mods.setDoc(ref,payload);return payload;
      },
      async sendMessage(conversation,text) {
        const clean=safeText(text).trim();if(!clean)throw new Error('메시지를 입력해 주세요.');if(clean.length>1000)throw new Error('메시지는 1000자 이하로 입력해 주세요.');
        const id=makeId('message'),createdAtMs=now();const message={id,senderId:uid(),text:clean,createdAtMs,clientId:DEVICE_ID};
        const readAt={...(conversation.readAt||{}),[uid()]:createdAtMs};const batch=Firebase.mods.writeBatch(Firebase.db);
        batch.set(Firebase.messageDoc(conversation.id,id),message);
        batch.set(Firebase.conversationDoc(conversation.id),{lastMessagePreview:compactText(clean,120),lastMessageAtMs:createdAtMs,lastSenderId:uid(),readAt,updatedAtMs:createdAtMs},{merge:true});
        await batch.commit();
      },
      async markConversationRead(conversation) {
        if(!conversation||!State.firebaseReady||State.offlineIdentity)return;
        const field=new Firebase.mods.FieldPath('readAt',uid());
        try { await Firebase.mods.updateDoc(Firebase.conversationDoc(conversation.id),field,now()); } catch {}
      }
    };

    const V2Sync = {
      subscribe(userId) {
        const M=Firebase.mods, add=(unsub)=>State.unsubscribers.push(unsub);
        const listen=(q,handler,label)=>add(M.onSnapshot(q,handler,err=>{console.warn(`${label} listener failed`,err);if(State.currentView==='community'||State.currentView==='calendar')UI.toast(`${label} 동기화를 확인해 주세요.`,'error');}));
        listen(M.query(Firebase.memosCol(userId),M.orderBy('updatedAtMs','desc'),M.limit(300)),snap=>{State.memos=snap.docs.map(d=>({id:d.id,...d.data()}));Local.set('memos',State.memos,userId);V2UI.renderCalendar();},'메모');
        listen(M.query(Firebase.plansCol(userId),M.orderBy('dateKey','asc'),M.limit(500)),snap=>{State.plans=snap.docs.map(d=>({id:d.id,...d.data()}));Local.set('plans',State.plans,userId);V2UI.renderCalendar();},'일정');
        listen(M.query(Firebase.achievementsCol(userId),M.orderBy('earnedAtMs','desc'),M.limit(100)),snap=>{State.achievements=snap.docs.map(d=>({id:d.id,...d.data()}));Local.set('achievements',State.achievements,userId);V2UI.renderHome();},'업적');
        listen(M.query(Firebase.publicProfilesCol(),M.limit(250)),snap=>{State.publicProfiles=snap.docs.map(d=>({uid:d.id,...d.data()}));V2UI.renderAll();},'공개 프로필');
        listen(M.query(Firebase.publicStatsCol(),M.limit(250)),snap=>{State.publicStats=snap.docs.map(d=>({uid:d.id,...d.data()}));V2UI.renderPresenceViews();},'랭킹');
        listen(M.query(Firebase.presenceCol(),M.limit(250)),snap=>{State.presence=snap.docs.map(d=>({uid:d.id,...d.data()}));V2UI.renderPresenceViews();},'접속 상태');
        listen(M.query(Firebase.friendRequestsCol(),M.where('participantIds','array-contains',userId),M.limit(100)),snap=>{State.friendRequests=snap.docs.map(d=>({id:d.id,...d.data()}));V2UI.renderCommunity();},'친구 요청');
        listen(M.query(Firebase.friendshipsCol(),M.where('memberIds','array-contains',userId),M.limit(100)),snap=>{State.friendships=snap.docs.map(d=>({id:d.id,...d.data()}));V2UI.renderCommunity();},'친구');
        listen(M.query(Firebase.conversationsCol(),M.where('memberIds','array-contains',userId),M.limit(100)),snap=>{State.conversations=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>Number(b.lastMessageAtMs||0)-Number(a.lastMessageAtMs||0));V2UI.renderCommunity();},'메시지');
      }
    };

    const V2UI = {
      renderAll() { this.renderHome();this.renderCalendar();this.renderCommunity();this.renderSettings();if(State.currentView==='admin')this.renderAdmin(); },
      renderHome() {
        const card=$('#homeGoalCard'); if(!card)return;
        const s=Stats.summary(),p=State.profile||{},minuteGoal=Number(p.dailyMinutesGoal)||120,problemGoal=Number(p.dailyProblemsGoal)||50;
        const minutePct=clamp(s.todayMinutes/minuteGoal*100,0,100),problemPct=clamp(s.todaySolved/problemGoal*100,0,100);
        const recent=State.achievements.slice(0,5);
        card.innerHTML=`<div class="goal-head"><div><span class="eyebrow">Daily mission</span><h3>${minutePct>=100&&problemPct>=100?'오늘 목표를 모두 달성했어요':'오늘의 페이스를 만들어가요'}</h3></div><span class="live-pill"><i></i>${Stats.streak()}일 연속</span></div><div class="goal-grid"><div class="goal-meter"><div class="goal-meter-top"><strong>${s.todayMinutes}</strong><span>/ ${minuteGoal}분</span></div><div class="goal-track"><i style="width:${minutePct}%"></i></div></div><div class="goal-meter"><div class="goal-meter-top"><strong>${s.todaySolved}</strong><span>/ ${problemGoal}문제</span></div><div class="goal-track"><i style="width:${problemPct}%"></i></div></div></div><div class="achievement-strip">${recent.length?recent.map(a=>`<div class="achievement-pill"><b>${escapeHTML(a.emoji||'🏅')}</b><span>${escapeHTML(a.title||'업적')}</span></div>`).join(''):`<div class="achievement-pill"><b>✨</b><span>첫 목표 달성을 기다리는 중</span></div>`}</div>`;
        this.renderOnlineStrips();
      },
      onlineUsers({studyingOnly=false}={}) {
        const ids=new Set([...State.publicProfiles.map(p=>p.uid),...State.publicStats.map(p=>p.uid),...State.presence.map(p=>p.uid),...Object.keys(State.rtdbPresence||{})]);
        if(State.user)ids.add(uid());
        return [...ids].map(userId=>{const profile=profileById(userId)||{};const presence=aggregatePresence(userId);const stats=statsById(userId)||{};return{uid:userId,profile,presence,stats};}).filter(x=>x.presence.online&&x.profile.showOnlineStatus!==false&&(!studyingOnly||x.presence.studying)).sort((a,b)=>Number(b.presence.studying)-Number(a.presence.studying)||Number(b.presence.lastSeenAtMs)-Number(a.presence.lastSeenAtMs));
      },
      onlinePerson(item) {
        const name=item.profile.displayName||item.stats.displayName||'사용자',status=item.presence.studying?(item.presence.subject||'집중 중'):'온라인';
        return `<button class="online-person" type="button" data-action="open-public-profile" data-user-id="${escapeHTML(item.uid)}"><div class="online-avatar-wrap"><div class="avatar">${escapeHTML(initials(name))}</div><i class="online-presence ${item.presence.studying?'studying':''}"></i></div><strong>${escapeHTML(name)}</strong><span>${escapeHTML(status)}</span></button>`;
      },
      renderOnlineStrips() {
        const studying=this.onlineUsers({studyingOnly:true}),online=this.onlineUsers();
        const home=$('#homeOnlineStrip');if(home)home.innerHTML=studying.length?studying.slice(0,12).map(x=>this.onlinePerson(x)).join(''):`<div class="card empty compact-empty" style="width:100%">현재 공개 상태로 공부 중인 사용자가 없습니다.</div>`;
        const community=$('#communityOnlineStrip');if(community)community.innerHTML=online.length?online.map(x=>this.onlinePerson(x)).join(''):`<div class="empty compact-empty" style="width:100%">접속 상태가 아직 없습니다.</div>`;
      },
      renderPresenceViews() { this.renderOnlineStrips();this.renderCommunity(); },
      renderCalendar() {
        const grid=$('#calendarGrid');if(!grid)return;
        const cursor=new Date(State.calendarCursorMs);cursor.setHours(12,0,0,0);cursor.setDate(1);
        $('#calendarMonthLabel').textContent=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long'}).format(cursor);
        const start=new Date(cursor);start.setDate(1-start.getDay());
        const logByDay=new Map(),planByDay=new Map(),memoByDay=new Map();
        State.logs.forEach(l=>{const k=dateKey(l.endedAtMs||l.startedAtMs);const v=logByDay.get(k)||{sec:0,count:0,solved:0};v.sec+=Number(l.durationSec||0);v.count++;v.solved+=Number(l.solvedCount||0);logByDay.set(k,v);});
        State.plans.forEach(p=>planByDay.set(p.dateKey,(planByDay.get(p.dateKey)||0)+1));State.memos.forEach(m=>memoByDay.set(m.dateKey,(memoByDay.get(m.dateKey)||0)+1));
        const cells=[];
        for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d.getTime()),logs=logByDay.get(key),outside=d.getMonth()!==cursor.getMonth();const dots=[logs?'<i class="log-dot"></i>':'',planByDay.get(key)?'<i class="plan-dot"></i>':'',memoByDay.get(key)?'<i class="memo-dot"></i>':''].join('');cells.push(`<button class="calendar-day ${outside?'outside':''} ${key===dateKey()?'today':''} ${key===State.selectedDateKey?'selected':''}" type="button" data-calendar-date="${key}" aria-label="${key}"><span class="day-number">${d.getDate()}</span><span class="day-minutes">${logs?`${Math.round(logs.sec/60)}분`:''}</span><span class="calendar-dots">${dots}</span></button>`);}
        grid.innerHTML=cells.join('');this.renderSelectedDay();
      },
      renderSelectedDay() {
        const key=State.selectedDateKey||dateKey(),d=dateFromKey(key);const logs=State.logs.filter(l=>dateKey(l.endedAtMs||l.startedAtMs)===key).sort((a,b)=>Number(b.endedAtMs)-Number(a.endedAtMs));const plans=State.plans.filter(p=>p.dateKey===key).sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99')));const memos=State.memos.filter(m=>m.dateKey===key).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Number(b.updatedAtMs)-Number(a.updatedAtMs));
        $('#selectedDateLabel').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(d);
        const sec=logs.reduce((s,l)=>s+Number(l.durationSec||0),0),solved=logs.reduce((s,l)=>s+Number(l.solvedCount||0),0);
        $('#selectedDaySummary').innerHTML=`<div><strong>${Math.round(sec/60)}</strong><span>집중 분</span></div><div><strong>${solved}</strong><span>문제</span></div><div><strong>${plans.filter(p=>p.done).length}/${plans.length}</strong><span>할 일</span></div>`;
        const sections=[];
        sections.push(`<div class="section-head"><h3>할 일</h3><button class="text-btn" type="button" data-action="open-plan">추가</button></div><div class="agenda-list">${plans.length?plans.map(p=>`<div class="agenda-item ${p.done?'done':''}"><button class="agenda-check" type="button" data-action="toggle-plan" data-id="${escapeHTML(p.id)}">${p.done?'✓':''}</button><button class="agenda-copy" type="button" data-action="edit-plan" data-id="${escapeHTML(p.id)}" style="background:transparent;text-align:left"><strong>${escapeHTML(p.title)}</strong><span>${escapeHTML([p.time,p.subject,p.note].filter(Boolean).join(' · ')||'시간 미지정')}</span></button><button class="mini-btn" type="button" data-action="edit-plan" data-id="${escapeHTML(p.id)}">•••</button></div>`).join(''):`<div class="empty compact-empty">이 날짜의 할 일이 없습니다.</div>`}</div>`);
        sections.push(`<div class="section-head" style="margin-top:18px"><h3>메모</h3><button class="text-btn" type="button" data-action="open-memo">추가</button></div><div class="agenda-list">${memos.length?memos.map(m=>`<button class="memo-item" type="button" data-action="edit-memo" data-id="${escapeHTML(m.id)}" style="text-align:left"><strong>${m.pinned?'📌 ':''}${escapeHTML(m.title)}</strong><p>${escapeHTML(compactText(m.content,220))}</p></button>`).join(''):`<div class="empty compact-empty">이 날짜의 메모가 없습니다.</div>`}</div>`);
        sections.push(`<div class="section-head" style="margin-top:18px"><h3>학습 로그</h3><span>${logs.length}세션</span></div><div class="agenda-list">${logs.length?logs.map(l=>`<div class="compact-log"><strong>${escapeHTML(l.subject)} · ${escapeHTML(l.startProblem)} → ${escapeHTML(l.endProblem)}</strong><span>${formatMinutes(l.durationSec)} · ${Number(l.solvedCount||0)}문제 · ${formatClock(l.endedAtMs)}</span></div>`).join(''):`<div class="empty compact-empty">이 날짜에 저장된 학습 로그가 없습니다.</div>`}</div>`);
        $('#selectedDayContent').innerHTML=sections.join('');
      },
      setCommunityTab(tab) {
        State.communityTab=tab;$$('[data-community-tab]').forEach(b=>b.classList.toggle('active',b.dataset.communityTab===tab));
        for(const [name,id] of Object.entries({live:'communityLivePanel',ranking:'communityRankingPanel',friends:'communityFriendsPanel',messages:'communityMessagesPanel'}))document.getElementById(id).hidden=name!==tab;
        this.renderCommunity();
      },
      rankScore(stats) { if(State.rankPeriod==='week')return Number(stats.weekKey===weekKey()?stats.weekMinutes:0);if(State.rankPeriod==='total')return Number(stats.totalMinutes||0);return Number(stats.todayKey===dateKey()?stats.todayMinutes:0); },
      renderCommunity() {
        if(!$('#communityLivePanel'))return;
        this.renderOnlineStrips();
        const live=this.onlineUsers({studyingOnly:true}).filter(x=>x.profile.shareStudyStatus!==false);
        $('#liveStudyCount').textContent=`${live.length}명`;
        $('#liveStudyList').innerHTML=live.length?live.map((x,i)=>this.rankRow(x.stats,x.uid,i+1,true,x.presence)).join(''):`<div class="empty compact-empty">현재 공개 상태로 집중 중인 사용자가 없습니다.</div>`;
        const ranked=State.publicStats.filter(s=>s.showInRanking!==false).map(s=>({...s,__score:this.rankScore(s)})).sort((a,b)=>b.__score-a.__score||Number(b.updatedAtMs)-Number(a.updatedAtMs));
        $('#rankingList').innerHTML=ranked.length?ranked.map((s,i)=>this.rankRow(s,s.uid,i+1,false,aggregatePresence(s.uid))).join(''):`<div class="empty compact-empty">랭킹 데이터가 아직 없습니다.</div>`;
        this.renderFriends();this.renderMessages();
      },
      rankRow(stats,userId,rank,live=false,presence=aggregatePresence(userId)) {
        const profile=profileById(userId)||{},name=profile.displayName||stats?.displayName||'사용자',score=live?Math.max(0,Math.floor((now()-Number(stats?.sessionStartedAtMs||now()))/60000)):this.rankScore(stats||{});const scoreLabel=live?'집중 분':State.rankPeriod==='total'?'누적 분':State.rankPeriod==='week'?'주간 분':'오늘 분';
        return `<div class="rank-row ${userId===uid()?'me':''}"><span class="rank-number">${live?'●':rank}</span><div class="avatar">${escapeHTML(initials(name))}</div><div class="rank-copy"><strong>${escapeHTML(name)} ${userId===uid()?'<span class="live-pill">나</span>':''}</strong><span>@${escapeHTML(profile.handle||stats?.handle||'focus')} · ${presence.studying?escapeHTML(presence.subject||stats?.currentSubject||'집중 중'):presence.online?'온라인':'최근 동기화'}</span></div><div class="rank-score"><strong>${score}</strong><span>${scoreLabel}</span></div></div>`;
      },
      renderFriends() {
        const incoming=State.friendRequests.filter(r=>r.toId===uid()&&r.status==='pending');$('#friendRequestCount').textContent=`${incoming.length}개`;
        $('#friendRequestList').innerHTML=incoming.length?incoming.map(r=>`<div class="person-row"><div class="avatar">${escapeHTML(initials(r.fromName))}</div><div class="person-copy"><strong>${escapeHTML(r.fromName)}</strong><span>@${escapeHTML(r.fromHandle)}</span></div><div class="inline-actions"><button class="btn primary" type="button" data-action="accept-friend" data-id="${escapeHTML(r.id)}" style="min-height:34px;padding:7px 10px">수락</button><button class="btn" type="button" data-action="reject-friend" data-id="${escapeHTML(r.id)}" style="min-height:34px;padding:7px 10px">거절</button></div></div>`).join(''):`<div class="empty compact-empty">받은 친구 요청이 없습니다.</div>`;
        $('#friendCount').textContent=`${State.friendships.length}명`;
        $('#friendList').innerHTML=State.friendships.length?State.friendships.map(f=>{const other=otherMemberId(f),profile=profileById(other)||{},presence=aggregatePresence(other),name=profile.displayName||publicName(other);return`<div class="person-row"><div class="avatar">${escapeHTML(initials(name))}</div><div class="person-copy"><strong>${escapeHTML(name)}</strong><span class="status-mini ${presence.studying?'studying':presence.online?'online':''}"><i></i>@${escapeHTML(profile.handle||publicHandle(other))} · ${presence.studying?escapeHTML(presence.subject||'집중 중'):presence.online?'온라인':'오프라인'}</span></div><div class="inline-actions"><button class="mini-btn" type="button" data-action="message-friend" data-id="${escapeHTML(f.id)}" aria-label="메시지">✉</button><button class="mini-btn" type="button" data-action="remove-friend" data-id="${escapeHTML(f.id)}" aria-label="친구 삭제">•••</button></div></div>`;}).join(''):`<div class="empty compact-empty">친구를 추가하면 온라인 상태와 메시지를 이용할 수 있습니다.</div>`;
        const result=State.friendSearchResult;const slot=$('#friendSearchResult');
        if(!result)slot.innerHTML='';else if(result.error)slot.innerHTML=`<div class="notice warn">${escapeHTML(result.error)}</div>`;else{const already=friendshipWith(result.uid),pending=State.friendRequests.find(r=>r.id===pairIdFor(uid(),result.uid));slot.innerHTML=`<div class="person-row"><div class="avatar">${escapeHTML(initials(result.displayName))}</div><div class="person-copy"><strong>${escapeHTML(result.displayName)}</strong><span>@${escapeHTML(result.handle)} · ${escapeHTML(result.bio||'소개 없음')}</span></div><button class="btn primary" type="button" data-action="send-friend" ${already||pending?'disabled':''} style="min-height:36px;padding:8px 11px">${already?'친구':pending?'요청됨':'추가'}</button></div>`;}
      },
      unreadCount() { return State.conversations.filter(c=>c.lastSenderId&&c.lastSenderId!==uid()&&Number(c.lastMessageAtMs||0)>Number(c.readAt?.[uid()]||0)).length; },
      renderMessages() {
        const count=this.unreadCount(),badge=$('#messageBadge');badge.hidden=!count;badge.textContent=String(count);
        $('#conversationList').innerHTML=State.conversations.length?State.conversations.map(c=>{const other=otherMemberId(c),profile=profileById(other)||{},name=profile.displayName||publicName(other),unread=c.lastSenderId!==uid()&&Number(c.lastMessageAtMs||0)>Number(c.readAt?.[uid()]||0),presence=aggregatePresence(other);return`<button class="conversation-row" type="button" data-action="open-conversation" data-id="${escapeHTML(c.id)}"><div class="avatar">${escapeHTML(initials(name))}</div><div class="conversation-copy"><strong>${escapeHTML(name)}</strong><span>${escapeHTML(c.lastMessagePreview||'대화를 시작해 보세요.')}</span></div><div class="conversation-time">${c.lastMessageAtMs?relativeTime(c.lastMessageAtMs):presence.online?'온라인':''}${unread?'<i class="unread-dot"></i>':''}</div></button>`;}).join(''):`<div class="empty compact-empty">친구 목록에서 메시지 버튼을 눌러 대화를 시작하세요.</div>`;
      },
      renderSettings() {
        if(!$('#adminSettingsRow'))return;const p=State.profile||{};
        $('#adminSettingsRow').hidden=!State.isAdmin;
        $('#emailVerificationState').textContent=(State.adminClaims?.email_verified===true||Firebase.auth?.currentUser?.emailVerified)?'인증 완료':'인증 메일 전송 가능';
        $('#goalSettingState').textContent=`${Number(p.dailyMinutesGoal)||120}분 · ${Number(p.dailyProblemsGoal)||50}문제 · 랭킹 ${p.showInRanking===false?'비공개':'공개'}`;
        const patch=$('[data-action="open-patchnotes"] .setting-copy span');if(patch)patch.textContent='FocusBell 2.0.0 변경 사항';
      },
      renderAdmin() { AdminConsole.render(); }
    };

    const Messaging = {
      async openFriendship(friendshipId) {
        if(!State.firebaseReady||State.offlineIdentity)throw new Error('메시지는 온라인 연결이 필요합니다.');
        const friendship=State.friendships.find(f=>f.id===friendshipId);if(!friendship)throw new Error('친구 관계를 확인할 수 없습니다.');
        const conversation=await V2Repo.ensureConversation(friendship);await this.openConversation(conversation.id,conversation);
      },
      async openConversation(id,preset=null) {
        if(!State.firebaseReady||State.offlineIdentity)throw new Error('메시지는 온라인 연결이 필요합니다.');
        let conversation=preset||State.conversations.find(c=>c.id===id);
        if(!conversation){const snap=await Firebase.mods.getDoc(Firebase.conversationDoc(id));if(!snap.exists())throw new Error('대화방을 찾을 수 없습니다.');conversation={id:snap.id,...snap.data()};}
        if(!(conversation.memberIds||[]).includes(uid()))throw new Error('이 대화방에 접근할 수 없습니다.');
        this.close();State.currentConversation=conversation;State.messages=[];
        const other=otherMemberId(conversation),profile=profileById(other)||{},name=profile.displayName||publicName(other),presence=aggregatePresence(other);
        $('#chatAvatar').textContent=initials(name);$('#chatTitle').textContent=name;$('#chatStatus').textContent=presence.studying?`${presence.subject||'집중'} 공부 중`:presence.online?'온라인':'오프라인';$('#messageList').innerHTML='<div class="empty compact-empty">메시지를 불러오는 중…</div>';
        UI.openModal('chatModal');
        const q=Firebase.mods.query(Firebase.messagesCol(id),Firebase.mods.orderBy('createdAtMs','asc'),Firebase.mods.limit(300));
        State.messageUnsub=Firebase.mods.onSnapshot(q,snap=>{State.messages=snap.docs.map(d=>({id:d.id,...d.data()}));this.render();V2Repo.markConversationRead(State.currentConversation).catch(()=>{});},err=>{$('#messageList').innerHTML=`<div class="notice warn">${escapeHTML(safeError(err))}</div>`;});
        await V2Repo.markConversationRead(conversation);V2UI.renderMessages();
      },
      render() {
        const list=$('#messageList');if(!list)return;
        list.innerHTML=State.messages.length?State.messages.map(m=>`<div class="message ${m.senderId===uid()?'mine':''}"><p>${escapeHTML(m.text)}</p><time>${formatDateTime(m.createdAtMs)}</time></div>`).join(''):'<div class="empty compact-empty">첫 메시지를 보내보세요.</div>';
        requestAnimationFrame(()=>{list.scrollTop=list.scrollHeight;});
      },
      close() {try{State.messageUnsub?.();}catch{}State.messageUnsub=null;State.currentConversation=null;State.messages=[];}
    };

    const AdminConsole = {
      directCollections:{users:'users',publicProfiles:'publicProfiles',publicStats:'publicStats',presence:'presence',adminPresence:'adminPresence',reports:'reports',posts:'posts',friendRequests:'friendRequests',friendships:'friendships',conversations:'conversations'},
      async refresh() {
        if(!State.isAdmin)throw new Error('관리자 권한이 필요합니다.');State.adminLoading=true;this.render();
        const M=Firebase.mods,root=(name)=>M.collection(Firebase.db,'apps',CONFIG.appId,name);
        try {
          const [users,profiles,stats,presence,adminPresence,reports]=await Promise.all(['users','publicProfiles','publicStats','presence','adminPresence','reports'].map(name=>M.getDocs(M.query(root(name),M.limit(500)))));
          this.snapshots={users:users.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path})),publicProfiles:profiles.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path})),publicStats:stats.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path})),presence:presence.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path})),adminPresence:adminPresence.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path})),reports:reports.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path}))};
          State.adminReports=this.snapshots.reports.sort((a,b)=>Number(b.createdAtMs)-Number(a.createdAtMs));
          await this.loadSelected(false);
        } finally {State.adminLoading=false;this.render();}
      },
      async loadNested(kind,userRows) {
        const M=Firebase.mods,out=[],users=(userRows||this.snapshots?.users||[]).slice(0,100);
        for(let i=0;i<users.length;i+=10){const chunk=users.slice(i,i+10);const results=await Promise.all(chunk.map(async u=>{const col=kind==='alarms'?Firebase.alarmsCol(u.id):kind==='logs'?Firebase.logsCol(u.id):kind==='memos'?Firebase.memosCol(u.id):kind==='achievements'?Firebase.achievementsCol(u.id):Firebase.plansCol(u.id);const snap=await M.getDocs(M.query(col,M.limit(150)));return snap.docs.map(d=>({id:d.id,userId:u.id,...d.data(),__path:d.ref.path}));}));out.push(...results.flat());}
        return out;
      },
      async loadSelected(render=true) {
        if(!State.isAdmin)return;const kind=$('#adminCollection')?.value||'users',M=Firebase.mods;
        State.adminLoading=true;if(render)this.render();
        try {
          if(['alarms','logs','memos','plans','achievements'].includes(kind))State.adminRows=await this.loadNested(kind);
          else if(this.snapshots?.[kind])State.adminRows=[...this.snapshots[kind]];
          else {const col=M.collection(Firebase.db,'apps',CONFIG.appId,this.directCollections[kind]||kind);const snap=await M.getDocs(M.query(col,M.limit(500)));State.adminRows=snap.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path}));}
        } finally {State.adminLoading=false;this.render();}
      },
      filteredRows() {const q=String($('#adminSearch')?.value||'').trim().toLowerCase();return q?State.adminRows.filter(row=>JSON.stringify(row).toLowerCase().includes(q)):State.adminRows;},
      render() {
        if(!$('#adminKpis'))return;
        if(!State.isAdmin){$('#adminKpis').innerHTML='<div class="notice warn">관리자 권한이 확인되지 않았습니다.</div>';$('#adminDataList').innerHTML='';$('#adminReportList').innerHTML='';return;}
        const users=this.snapshots?.users?.length||0,online=(this.snapshots?.adminPresence||[]).filter(p=>isFresh(p.lastSeenAtMs)).length,studying=(this.snapshots?.adminPresence||[]).filter(p=>p.studying&&isFresh(p.lastSeenAtMs)).length,openReports=State.adminReports.filter(r=>r.status==='open').length;
        $('#adminKpis').innerHTML=`<div class="admin-kpi"><strong>${users}</strong><span>앱 사용자 문서</span></div><div class="admin-kpi"><strong>${online}</strong><span>최근 접속</span></div><div class="admin-kpi"><strong>${studying}</strong><span>집중 중</span></div><div class="admin-kpi"><strong>${openReports}</strong><span>미처리 신고</span></div>`;
        const rows=this.filteredRows();$('#adminDataList').innerHTML=State.adminLoading?'<div class="empty compact-empty">데이터를 불러오는 중…</div>':rows.length?rows.slice(0,500).map(row=>`<article class="json-card"><div class="json-card-head"><strong>${escapeHTML(row.__path||row.id||'document')}</strong><span class="subtle">${escapeHTML(row.updatedAtMs?relativeTime(row.updatedAtMs):row.createdAtMs?relativeTime(row.createdAtMs):'')}</span></div><pre>${escapeHTML(prettyJSON(row))}</pre></article>`).join(''):'<div class="empty compact-empty">표시할 문서가 없습니다.</div>';
        $('#adminReportCount').textContent=`${openReports}건`;
        $('#adminReportList').innerHTML=State.adminReports.length?State.adminReports.slice(0,100).map(r=>`<article class="json-card ${r.status==='open'?'admin-warning':''}"><div class="json-card-head"><strong>${escapeHTML(r.reason||'신고')}</strong><span class="subtle">${escapeHTML(r.status||'open')} · ${relativeTime(r.createdAtMs)}</span></div><div style="padding:12px"><div class="subtle">게시물 ${escapeHTML(r.postId||'')} · 신고자 ${escapeHTML(r.reporterId||'')}</div>${r.status==='open'?`<div class="inline-actions" style="margin-top:10px"><button class="btn primary" type="button" data-action="admin-resolve-report" data-id="${escapeHTML(r.id)}" style="min-height:36px">처리 완료</button><button class="btn danger" type="button" data-action="admin-delete-post" data-id="${escapeHTML(r.id)}" style="min-height:36px">게시물 삭제</button></div>`:''}</div></article>`).join(''):'<div class="empty compact-empty">신고가 없습니다.</div>';
      },
      async resolveReport(id,deletePost=false) {
        if(!State.isAdmin)throw new Error('관리자 권한이 필요합니다.');const report=State.adminReports.find(r=>r.id===id);if(!report)return;
        if(deletePost&&report.postId){try{await Repo.deletePost(report.postId);}catch(err){console.warn('Reported post delete failed',err);}}
        await Firebase.mods.setDoc(Firebase.mods.doc(Firebase.reportsCol(),id),{status:deletePost?'content_removed':'resolved',resolvedAtMs:now(),resolvedBy:uid()},{merge:true});await this.refresh();UI.toast(deletePost?'게시물을 삭제하고 신고를 처리했습니다.':'신고를 처리 완료로 변경했습니다.','success');
      },
      export() {const kind=$('#adminCollection')?.value||'data';Exporter.download(`focusbell-admin-${kind}-${dateKey()}.json`,JSON.stringify({collection:kind,exportedAt:new Date().toISOString(),rows:this.filteredRows()},null,2),'application/json');UI.toast('관리자 JSON 내보내기를 시작했습니다.','success');}
    };

    const GoalEngine = {
      definitions() {
        const summary=Stats.summary(), totalSec=State.logs.reduce((sum,log)=>sum+Number(log.durationSec||0),0), totalMinutes=Math.floor(totalSec/60), sessionCount=State.logs.length, streak=Stats.streak();
        const p=State.profile||{}, minuteGoal=Number(p.dailyMinutesGoal)||120, problemGoal=Number(p.dailyProblemsGoal)||50, today=dateKey();
        return [
          {id:'first_session',met:sessionCount>=1,emoji:'🌱',title:'첫 집중 완료',body:'FocusBell에 첫 학습 로그를 남겼어요.'},
          {id:`daily_minutes_${today}`,met:summary.todayMinutes>=minuteGoal,emoji:'⏱️',title:'오늘의 시간 목표 달성',body:`오늘 ${minuteGoal}분 집중 목표를 채웠어요.`,priority:30},
          {id:`daily_problems_${today}`,met:summary.todaySolved>=problemGoal,emoji:'✍️',title:'오늘의 문제 목표 달성',body:`오늘 ${problemGoal}문제 목표를 채웠어요.`,priority:29},
          {id:`daily_both_${today}`,met:summary.todayMinutes>=minuteGoal&&summary.todaySolved>=problemGoal,emoji:'🏆',title:'오늘의 미션 올클리어',body:'집중 시간과 문제 목표를 모두 달성했어요!',priority:40},
          {id:'sessions_10',met:sessionCount>=10,emoji:'🔟',title:'집중 10세션',body:'열 번의 집중을 차곡차곡 쌓았어요.'},
          {id:'sessions_50',met:sessionCount>=50,emoji:'🚀',title:'집중 50세션',body:'50개의 학습 세션을 완주했어요.'},
          {id:'streak_3',met:streak>=3,emoji:'🔥',title:'3일 연속 공부',body:'세 날 연속 학습 기록을 이어갔어요.'},
          {id:'streak_7',met:streak>=7,emoji:'🌈',title:'7일 연속 공부',body:'일주일 동안 꾸준히 공부했어요.',priority:20},
          {id:'streak_30',met:streak>=30,emoji:'💎',title:'30일 연속 공부',body:'한 달 동안 학습 흐름을 지켰어요.',priority:25},
          {id:'total_300',met:totalMinutes>=300,emoji:'🎧',title:'누적 5시간',body:'집중 시간이 300분을 넘었어요.'},
          {id:'total_1000',met:totalMinutes>=1000,emoji:'📚',title:'누적 1,000분',body:'집중 시간 1,000분을 기록했어요.',priority:15},
          {id:'total_3000',met:totalMinutes>=3000,emoji:'🏅',title:'누적 3,000분',body:'꾸준함으로 3,000분을 완성했어요.',priority:20}
        ];
      },
      async evaluate({silent=false}={}) {
        if(!State.user)return [];
        const earnedIds=new Set(State.achievements.map(item=>item.id));
        const unlocked=this.definitions().filter(item=>item.met&&!earnedIds.has(item.id)).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
        for(const item of unlocked) {
          await V2Repo.saveAchievement({...item,earnedAtMs:now(),createdAtMs:now()});
        }
        if(unlocked.length&&!silent) {
          const item=unlocked[0];this.show(item);
          await Notify.show(item.title,item.body);
        }
        V2UI.renderHome();
        return unlocked;
      },
      show(item) {
        $('#celebrationEmoji').textContent=item.emoji||'🏆';
        $('#celebrationTitle').textContent=item.title||'목표 달성!';
        $('#celebrationBody').textContent=item.body||'꾸준히 기록한 결과예요.';
        $('#celebrationOverlay').classList.add('open');document.body.style.overflow='hidden';
        try { navigator.vibrate?.([120,80,160]); } catch {}
      },
      close() {$('#celebrationOverlay').classList.remove('open');if(!document.querySelector('.modal.open')&&!$('#ringOverlay').classList.contains('open')&&!$('#tutorialOverlay').classList.contains('open'))document.body.style.overflow='';}
    };

    const Tutorial = {
      steps:[
        {emoji:'⏰',kicker:'1 / 6 · Alarm',title:'알람에서 학습을 시작해요',body:'원하는 시각과 과목·시작 문제를 예약하세요. 알람이 울리면 내용을 확인한 뒤 타이머가 시작됩니다.'},
        {emoji:'✍️',kicker:'2 / 6 · Study log',title:'시작과 끝 문제를 기록해요',body:'세션을 끝낼 때 마지막 문제번호와 정답 수를 입력하면 문제 범위·집중 시간·정답률이 자동으로 로그에 남습니다.'},
        {emoji:'🗓️',kicker:'3 / 6 · Calendar',title:'어제 공부한 것도 바로 찾아요',body:'캘린더의 날짜를 누르면 그날의 학습 로그, 할 일, 메모가 함께 보여요. 어제 보기 버튼도 준비했습니다.'},
        {emoji:'📈',kicker:'4 / 6 · Live & ranking',title:'함께 공부하는 흐름을 확인해요',body:'공개를 허용한 사용자끼리 현재 집중 중인 과목과 오늘·주간·누적 랭킹을 볼 수 있어요. 설정에서 언제든 숨길 수 있습니다.'},
        {emoji:'💬',kicker:'5 / 6 · Friends & DM',title:'친구를 추가하고 메시지를 보내요',body:'상대방의 FocusBell 아이디를 검색해 친구 요청을 보내세요. 수락된 친구끼리만 DM 대화방을 만들 수 있습니다.'},
        {emoji:'🏆',kicker:'6 / 6 · Goals',title:'목표 달성과 설치까지',body:'하루 시간·문제 목표를 달성하면 업적 알림이 표시됩니다. iPhone은 Safari 공유 메뉴, Android·Windows는 브라우저 설치 메뉴에서 앱처럼 설치하세요.'}
      ],
      open(step=0) {State.tutorialStep=clamp(Number(step)||0,0,this.steps.length-1);$('#tutorialOverlay').classList.add('open');document.body.style.overflow='hidden';this.render();},
      render() {
        const step=this.steps[State.tutorialStep]||this.steps[0];
        $('#tutorialArt').textContent=step.emoji;$('#tutorialKicker').textContent=step.kicker;$('#tutorialTitle').textContent=step.title;$('#tutorialBody').textContent=step.body;
        $('#tutorialProgress').innerHTML=this.steps.map((_,i)=>`<i class="${i<=State.tutorialStep?'active':''}"></i>`).join('');
        $('#tutorialNext').textContent=State.tutorialStep===this.steps.length-1?'시작하기':'다음';
      },
      next() {if(State.tutorialStep<this.steps.length-1){State.tutorialStep++;this.render();}else this.finish();},
      async finish() {
        $('#tutorialOverlay').classList.remove('open');if(!document.querySelector('.modal.open')&&!$('#ringOverlay').classList.contains('open'))document.body.style.overflow='';
        try {await V2Repo.savePreferences({tutorialCompletedAtMs:now()});} catch {State.profile={...(State.profile||{}),tutorialCompletedAtMs:now()};Local.set('profile',State.profile);}
      },
      skip() {this.finish().catch(()=>{});},
      maybeOpen() {if(!Number(State.profile?.tutorialCompletedAtMs)&&!Local.get('tutorialDismissed',false)){setTimeout(()=>this.open(0),450);}}
    };

    const MiniGame = {
      open() {UI.openModal('gameModal');this.reset();},
      reset() {
        this.stop();State.game={next:1,startedAtMs:0,finished:false,numbers:Array.from({length:16},(_,i)=>i+1)};
        $('#gameNext').textContent='1';$('#gameTime').textContent='0.0s';$('#gameResult').textContent=`최고 기록: ${Number(Local.get('numberGameBest',0))?`${Number(Local.get('numberGameBest')).toFixed(1)}초`:'아직 없음'}`;
        $('#numberGrid').innerHTML=State.game.numbers.map(n=>`<button type="button" data-game-number="${n}" disabled>${n}</button>`).join('');$('#gameStartBtn').textContent='게임 시작';
      },
      start() {
        this.stop();const numbers=Array.from({length:16},(_,i)=>i+1);
        for(let i=numbers.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[numbers[i],numbers[j]]=[numbers[j],numbers[i]];}
        State.game={next:1,startedAtMs:performance.now(),finished:false,numbers};
        $('#numberGrid').innerHTML=numbers.map(n=>`<button type="button" data-game-number="${n}">${n}</button>`).join('');$('#gameNext').textContent='1';$('#gameResult').textContent='숫자를 순서대로 빠르게 찾아보세요.';$('#gameStartBtn').textContent='다시 섞기';
        State.gameInterval=setInterval(()=>this.renderTime(),50);this.renderTime();
      },
      tap(number,button) {
        const game=State.game;if(!game?.startedAtMs||game.finished||Number(number)!==game.next)return;
        button.disabled=true;button.classList.add('done');game.next++;
        if(game.next>16){this.finish();return;}$('#gameNext').textContent=String(game.next);
      },
      renderTime() {if(!State.game?.startedAtMs||State.game.finished)return;$('#gameTime').textContent=`${((performance.now()-State.game.startedAtMs)/1000).toFixed(1)}s`;},
      finish() {
        const game=State.game;if(!game||game.finished)return;game.finished=true;const seconds=(performance.now()-game.startedAtMs)/1000;this.stop();$('#gameTime').textContent=`${seconds.toFixed(1)}s`;$('#gameNext').textContent='✓';
        const best=Number(Local.get('numberGameBest',0));if(!best||seconds<best){Local.set('numberGameBest',seconds);$('#gameResult').textContent=`새 최고 기록 ${seconds.toFixed(1)}초! 이제 한 번 숨을 고르고 공부로 돌아가요.`;}else $('#gameResult').textContent=`완료 ${seconds.toFixed(1)}초 · 최고 ${best.toFixed(1)}초. 짧게 리프레시했으니 다시 집중해볼까요?`;
      },
      stop() {if(State.gameInterval)clearInterval(State.gameInterval);State.gameInterval=null;}
    };

    const PlannerEngine = {
      checking:false,
      async check() {
        if(this.checking||State.currentRing||!State.user)return;this.checking=true;
        try {
          const due=State.plans.filter(plan=>!plan.done&&plan.reminderAtMs&&Number(plan.reminderAtMs)<=now()&&!plan.notifiedAtMs).sort((a,b)=>Number(a.reminderAtMs)-Number(b.reminderAtMs))[0];
          if(!due)return;
          const updated={...due,notifiedAtMs:now(),updatedAtMs:now()};await V2Repo.savePlan(updated);
          State.currentRing={type:'planReminder',plan:updated};$('#ringOverlay').classList.add('open');document.body.style.overflow='hidden';
          $('#ringKicker').textContent='Calendar reminder';$('#ringTitle').textContent=updated.title;$('#ringBody').textContent=[updated.time,updated.subject,updated.note].filter(Boolean).join(' · ')||'예약한 할 일 시간입니다.';
          $('#ringActions').innerHTML='<button class="btn" data-action="ring-open-calendar">캘린더에서 보기</button><button class="btn secondary" data-action="ring-dismiss">닫기</button>';
          await AudioAlarm.ring();try{navigator.vibrate?.([240,100,240]);}catch{}await Notify.show(`할 일 · ${updated.title}`,updated.note||updated.subject||'예약한 일정을 확인하세요.');
        } finally {this.checking=false;}
      }
    };

    function openPlanModal(id='') {
      const plan=State.plans.find(item=>item.id===id)||null;const key=plan?.dateKey||State.selectedDateKey||dateKey();
      $('#planModalTitle').textContent=plan?'할 일 수정':'할 일 추가';$('#planId').value=plan?.id||'';$('#planTitle').value=plan?.title||'';$('#planDate').value=key;$('#planTime').value=plan?.time||'';$('#planSubject').value=plan?.subject||'';$('#planNote').value=plan?.note||'';$('#planReminder').checked=plan?!!plan.reminderAtMs:true;$('#deletePlanBtn').hidden=!plan;UI.openModal('planModal');
    }

    function openMemoModal(id='') {
      const memo=State.memos.find(item=>item.id===id)||null;const key=memo?.dateKey||State.selectedDateKey||dateKey();
      $('#memoModalTitle').textContent=memo?'메모 수정':'메모 추가';$('#memoId').value=memo?.id||'';$('#memoTitle').value=memo?.title||'';$('#memoDate').value=key;$('#memoContent').value=memo?.content||'';$('#memoPinned').checked=!!memo?.pinned;$('#deleteMemoBtn').hidden=!memo;UI.openModal('memoModal');
    }

    function openGoalsModal() {
      const p=State.profile||{};$('#dailyMinutesGoal').value=Number(p.dailyMinutesGoal)||120;$('#dailyProblemsGoal').value=Number(p.dailyProblemsGoal)||50;$('#showInRanking').checked=p.showInRanking!==false;$('#shareStudyStatus').checked=p.shareStudyStatus!==false;$('#showOnlineStatus').checked=p.showOnlineStatus!==false;UI.openModal('goalsModal');
    }

    async function showPublicProfile(userId) {
      const profile=profileById(userId);if(!profile)return UI.toast('공개 프로필을 찾지 못했습니다.','error');
      if(userId===uid())return openProfileModal();
      const presence=aggregatePresence(userId),friend=friendshipWith(userId),pending=State.friendRequests.find(r=>r.id===pairIdFor(uid(),userId));
      const message=`@${profile.handle||'focus'}\n${profile.bio||'소개 없음'}\n상태: ${presence.studying?`${presence.subject||'공부'} 집중 중`:presence.online?'온라인':'오프라인'}`;
      const ok=await UI.confirm(profile.displayName||'사용자',message,friend?'메시지':pending?'확인':'친구 요청');
      if(!ok)return;if(friend)await Messaging.openFriendship(friend.id);else if(!pending)await V2Repo.sendFriendRequest(profile);
    }

    const _baseMirror=Repo.mirror.bind(Repo);
    Repo.mirror=function(){_baseMirror();PublicPublisher.schedule();};
    const _baseLoadMirror=Repo.loadMirror.bind(Repo);
    Repo.loadMirror=function(userId=uid()){_baseLoadMirror(userId);V2Repo.loadMirror(userId);};

    Repo.saveProfile=async function(patch) {
      State.profile={...(State.profile||{}),...patch,uid:uid(),updatedAtMs:now()};Local.set('profile',State.profile);UI.renderAll();
      await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.userDoc(),State.profile,{merge:true}));
    };
    Repo.saveAlarm=async function(alarm) {this.upsert('alarms',alarm);await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.alarmDoc(alarm.id),alarm,{merge:true}));};
    Repo.deleteAlarm=async function(id) {State.alarms=State.alarms.filter(a=>a.id!==id);this.mirror();UI.renderAll();await queueCloudWrite(()=>Firebase.mods.deleteDoc(Firebase.alarmDoc(id)));};
    Repo.addLog=async function(log) {this.upsert('logs',log);await queueCloudWrite(()=>Firebase.mods.setDoc(Firebase.logDoc(log.id),log));};
    Repo.deleteLog=async function(id) {State.logs=State.logs.filter(l=>l.id!==id);this.mirror();UI.renderAll();await queueCloudWrite(()=>Firebase.mods.deleteDoc(Firebase.logDoc(id)));};

    Repo.saveActive=async function(session) {
      const previous=State.activeSession;const enriched={...session,deviceId:session.deviceId||DEVICE_ID,revision:Math.max(Number(previous?.revision||0),Number(session.revision||0))+1,updatedAtMs:now()};
      if(State.firebaseReady&&!State.offlineIdentity&&navigator.onLine) {
        try {
          await Firebase.mods.runTransaction(Firebase.db,async tx=>{
            const ref=Firebase.userDoc(),snap=await tx.get(ref),remote=snap.exists()?snap.data().activeSession:null;
            if(remote&&remote.id!==enriched.id)throw new Error(`다른 기기에서 “${remote.subject||'학습'}” 세션이 진행 중입니다. 먼저 그 세션을 종료하거나 동기화를 확인해 주세요.`);
            tx.set(ref,{activeSession:enriched,updatedAtMs:now()},{merge:true});
          });
        } catch(error) {
          if(!isConnectivityError(error))throw error;
          Promise.resolve(Firebase.mods.setDoc(Firebase.userDoc(),{activeSession:enriched,updatedAtMs:now()},{merge:true})).catch(err=>console.warn('Offline session queue failed',err));
          UI.toast('연결이 불안정해 이 기기에 먼저 세션을 저장했습니다. 재연결 후 동기화됩니다.');
        }
      } else if(State.firebaseReady&&!State.offlineIdentity) {
        Promise.resolve(Firebase.mods.setDoc(Firebase.userDoc(),{activeSession:enriched,updatedAtMs:now()},{merge:true})).catch(error=>console.warn('Offline session queue failed',error));
      }
      State.activeSession=enriched;Local.set('activeSession',enriched);UI.renderHome();Presence.heartbeat().catch(()=>{});PublicPublisher.schedule();
      return enriched;
    };

    Repo.clearActive=async function(expectedId=State.activeSession?.id) {
      if(State.firebaseReady&&!State.offlineIdentity&&navigator.onLine) {
        try {
          await Firebase.mods.runTransaction(Firebase.db,async tx=>{
            const ref=Firebase.userDoc(),snap=await tx.get(ref),remote=snap.exists()?snap.data().activeSession:null;
            if(remote&&expectedId&&remote.id!==expectedId)throw new Error('다른 기기의 최신 세션이 감지되어 종료 요청을 중단했습니다. 화면을 새로 확인해 주세요.');
            tx.set(ref,{activeSession:null,updatedAtMs:now()},{merge:true});
          });
        } catch(error) {
          if(!isConnectivityError(error))throw error;
          Promise.resolve(Firebase.mods.setDoc(Firebase.userDoc(),{activeSession:null,updatedAtMs:now()},{merge:true})).catch(err=>console.warn('Offline session clear queue failed',err));
        }
      } else if(State.firebaseReady&&!State.offlineIdentity) Promise.resolve(Firebase.mods.setDoc(Firebase.userDoc(),{activeSession:null,updatedAtMs:now()},{merge:true})).catch(error=>console.warn('Offline session clear queue failed',error));
      State.activeSession=null;Local.remove('activeSession');UI.renderHome();Presence.heartbeat().catch(()=>{});PublicPublisher.schedule();
    };

    Session.start=async function(data) {
      if(State.activeSession)throw new Error('이미 진행 중인 세션이 있습니다.');
      const subject=safeText(data.subject).trim(),startProblem=safeText(data.startProblem).trim(),targetMinutes=Number(data.targetMinutes)||60,goalCount=data.goalCount?Number(data.goalCount):null;
      if(!subject)throw new Error('과목을 입력해 주세요.');if(!startProblem)throw new Error('시작 문제번호를 입력해 주세요.');if(!Number.isInteger(targetMinutes)||targetMinutes<1||targetMinutes>240)throw new Error('목표 시간을 확인해 주세요.');if(goalCount!==null&&(!Number.isInteger(goalCount)||goalCount<1||goalCount>9999))throw new Error('목표 문제 수를 확인해 주세요.');
      const createdAtMs=now(),session={id:makeId('session'),subject,startProblem,targetMinutes,goalCount,startNote:safeText(data.startNote).trim(),alarmId:data.alarmId||null,startedAtMs:createdAtMs,pausedAtMs:null,pausedTotalMs:0,targetNotified:false,createdAtMs,deviceId:DEVICE_ID,revision:0,updatedAtMs:createdAtMs};
      await Repo.saveActive(session);await Wake.acquire();await Presence.heartbeat(true);UI.toast('집중 세션을 시작했습니다.','success');
    };

    Session.togglePause=async function() {
      const current=State.activeSession;if(!current)return;const s={...current};
      if(s.pausedAtMs){s.pausedTotalMs=Number(s.pausedTotalMs||0)+(now()-Number(s.pausedAtMs));s.pausedAtMs=null;await Repo.saveActive(s);await Wake.acquire();UI.toast('세션을 다시 시작했습니다.');}
      else{s.pausedAtMs=now();await Repo.saveActive(s);await Wake.release();UI.toast('세션을 일시정지했습니다.');}
    };

    Session.finish=async function(data) {
      const s=State.activeSession;if(!s)throw new Error('진행 중인 세션이 없습니다.');
      const endProblem=safeText(data.endProblem).trim();if(!endProblem)throw new Error('마지막 문제번호를 입력해 주세요.');const durationSec=this.elapsedSec(s),autoSolved=calculateSolved(s.startProblem,endProblem);const solved=data.solvedCount!==''&&data.solvedCount!=null?Number(data.solvedCount):autoSolved;
      if(solved===null)throw new Error('문제번호 형식으로 자동 계산할 수 없습니다. 푼 문제 수를 입력해 주세요.');if(!Number.isInteger(solved)||solved<0||solved>99999)throw new Error('푼 문제 수를 확인해 주세요.');const correct=data.correctCount===''||data.correctCount==null?null:Number(data.correctCount);if(correct!==null&&(!Number.isInteger(correct)||correct<0||correct>solved))throw new Error('맞힌 문제 수는 푼 문제 수 이하로 입력해 주세요.');
      const endedAtMs=now(),log={id:makeId('log'),subject:s.subject,startProblem:s.startProblem,endProblem,durationSec,targetMinutes:s.targetMinutes,goalCount:s.goalCount,solvedCount:solved,correctCount:correct,startNote:s.startNote,reflection:safeText(data.reflection).trim(),startedAtMs:s.startedAtMs,endedAtMs,status:'completed',createdAtMs:endedAtMs,completedByDeviceId:DEVICE_ID,sessionId:s.id};
      if(State.firebaseReady&&!State.offlineIdentity&&navigator.onLine) {
        try {
          await Firebase.mods.runTransaction(Firebase.db,async tx=>{const userRef=Firebase.userDoc(),snap=await tx.get(userRef),remote=snap.exists()?snap.data().activeSession:null;if(!remote||remote.id!==s.id)throw new Error('다른 기기에서 세션 상태가 바뀌었습니다. 최신 화면을 확인한 뒤 다시 시도해 주세요.');tx.set(Firebase.logDoc(log.id),log);tx.set(userRef,{activeSession:null,updatedAtMs:endedAtMs},{merge:true});});
        } catch(error) {
          if(!isConnectivityError(error))throw error;
          const batch=Firebase.mods.writeBatch(Firebase.db);batch.set(Firebase.logDoc(log.id),log);batch.set(Firebase.userDoc(),{activeSession:null,updatedAtMs:endedAtMs},{merge:true});Promise.resolve(batch.commit()).catch(err=>console.warn('Offline completed session queue failed',err));UI.toast('연결이 불안정해 학습 로그를 이 기기에 먼저 저장했습니다.');
        }
      } else if(State.firebaseReady&&!State.offlineIdentity) {const batch=Firebase.mods.writeBatch(Firebase.db);batch.set(Firebase.logDoc(log.id),log);batch.set(Firebase.userDoc(),{activeSession:null,updatedAtMs:endedAtMs},{merge:true});Promise.resolve(batch.commit()).catch(error=>console.warn('Offline completed session queue failed',error));}
      const idx=State.logs.findIndex(item=>item.id===log.id);if(idx>=0)State.logs[idx]=log;else State.logs.unshift(log);State.activeSession=null;Local.set('logs',State.logs);Local.remove('activeSession');Repo.mirror();UI.renderAll();await Wake.release();AlarmEngine.stopRing();await Promise.allSettled([Presence.heartbeat(true),PublicPublisher.publishStats(true)]);await GoalEngine.evaluate({silent:false});UI.toast('학습 로그를 저장했습니다.','success');
    };

    Session.discard=async function(){const id=State.activeSession?.id;await Repo.clearActive(id);await Wake.release();AlarmEngine.stopRing();UI.toast('세션을 취소했습니다.');};

    const _baseAlarmCheck=AlarmEngine.check.bind(AlarmEngine);let alarmEngineBusy=false;
    AlarmEngine.check=async function(){if(alarmEngineBusy)return;alarmEngineBusy=true;try{await _baseAlarmCheck();await PlannerEngine.check();}finally{alarmEngineBusy=false;}};

    const _baseRenderActiveSession=UI.renderActiveSession.bind(UI);
    UI.renderActiveSession=function(){_baseRenderActiveSession();const s=State.activeSession,card=$('#activeSessionSlot .session-card');if(!s||!card)return;const cross=s.deviceId&&s.deviceId!==DEVICE_ID;if(cross){const note=document.createElement('div');note.className='session-device-note';note.textContent='다른 기기에서 시작한 세션입니다. 현재 기기에서도 안전하게 이어서 기록할 수 있어요.';card.append(note);}};
    const _baseRenderHome=UI.renderHome.bind(UI);UI.renderHome=function(){_baseRenderHome();V2UI.renderHome();};
    const _baseRenderSettings=UI.renderSettings.bind(UI);UI.renderSettings=function(){_baseRenderSettings();V2UI.renderSettings();};
    const _baseRenderAll=UI.renderAll.bind(UI);UI.renderAll=function(){_baseRenderAll();V2UI.renderAll();if(State.user)PublicPublisher.schedule();};
    const _baseNavigate=UI.navigate.bind(UI);UI.navigate=function(view){if(view==='admin'&&!State.isAdmin){this.toast('관리자 권한이 필요합니다.','error');view='settings';}_baseNavigate(view);$('#topViewTitle').textContent=({home:'FocusBell',alarms:'알람',logs:'학습 로그',lounge:'라운지',calendar:'캘린더',community:'함께 공부',admin:'관리자 콘솔',settings:'설정'})[view]||'FocusBell';if(view==='calendar')V2UI.renderCalendar();if(view==='community')V2UI.setCommunityTab(State.communityTab);if(view==='admin'){V2UI.renderAdmin();if(!AdminConsole.snapshots)AdminConsole.refresh().catch(err=>UI.toast(safeError(err),'error'));}};
    const _baseCloseModal=UI.closeModal.bind(UI);UI.closeModal=function(id){if(id==='chatModal')Messaging.close();if(id==='gameModal')MiniGame.stop();_baseCloseModal(id);};

    const _baseDataSubscribe=DataSync.subscribe.bind(DataSync);DataSync.subscribe=function(userId){_baseDataSubscribe(userId);V2Sync.subscribe(userId);};
    const _baseEnterUser=DataSync.enterUser.bind(DataSync);DataSync.enterUser=async function(user,options={}){await _baseEnterUser(user,options);State.v2Ready=true;await AdminAuth.evaluate(Firebase.auth?.currentUser);await PublicPublisher.bootstrap();await Presence.start();await GoalEngine.evaluate({silent:true});Tutorial.maybeOpen();V2UI.renderAll();};
    const _baseClearSubs=DataSync.clearSubs.bind(DataSync);DataSync.clearSubs=function(){_baseClearSubs();Messaging.close();};
    const _baseSignOut=Auth.signOut.bind(Auth);Auth.signOut=async function(){await Presence.stop(true);State.publicProfiles=[];State.publicStats=[];State.presence=[];State.memos=[];State.plans=[];State.achievements=[];State.friendRequests=[];State.friendships=[];State.conversations=[];State.isAdmin=false;await _baseSignOut();};

    const _baseAuthSubmit=Auth.submit.bind(Auth);Auth.submit=async function(){const signup=State.authMode==='signup';await _baseAuthSubmit();if(signup&&Firebase.auth?.currentUser){try{await Firebase.mods.sendEmailVerification(Firebase.auth.currentUser);UI.toast('가입 완료! 이메일 인증 링크도 보냈습니다.','success');}catch{UI.toast('가입했습니다. 설정에서 이메일 인증을 다시 보낼 수 있습니다.','success');}}};

    const _baseExporterRun=Exporter.run.bind(Exporter);Exporter.run=function(){_baseExporterRun();const data={app:CONFIG.appName,version:CONFIG.version,exportedAt:new Date().toISOString(),profile:State.profile,alarms:State.alarms,logs:State.logs,memos:State.memos,plans:State.plans,achievements:State.achievements,friendships:State.friendships.map(f=>({id:f.id,memberIds:f.memberIds,createdAtMs:f.createdAtMs})),conversations:State.conversations.map(c=>({id:c.id,memberIds:c.memberIds,lastMessageAtMs:c.lastMessageAtMs})),privacy:{showInRanking:State.profile?.showInRanking!==false,shareStudyStatus:State.profile?.shareStudyStatus!==false,showOnlineStatus:State.profile?.showOnlineStatus!==false}};this.download(`focusbell-complete-${dateKey()}.json`,JSON.stringify(data,null,2),'application/json');};

    function bindV2Events() {
      document.addEventListener('click',async event=>{
        const tab=event.target.closest('[data-community-tab]');if(tab){V2UI.setCommunityTab(tab.dataset.communityTab);return;}
        const period=event.target.closest('[data-rank-period]');if(period){State.rankPeriod=period.dataset.rankPeriod;$$('[data-rank-period]').forEach(btn=>btn.classList.toggle('active',btn===period));V2UI.renderCommunity();return;}
        const day=event.target.closest('[data-calendar-date]');if(day){State.selectedDateKey=day.dataset.calendarDate;const d=dateFromKey(State.selectedDateKey);State.calendarCursorMs=new Date(d.getFullYear(),d.getMonth(),1,12).getTime();V2UI.renderCalendar();return;}
        const gameButton=event.target.closest('[data-game-number]');if(gameButton){MiniGame.tap(Number(gameButton.dataset.gameNumber),gameButton);return;}
        const actionEl=event.target.closest('[data-action]');if(!actionEl)return;const action=actionEl.dataset.action,id=actionEl.dataset.id;
        try {
          switch(action) {
            case 'calendar-prev':{const d=new Date(State.calendarCursorMs);State.calendarCursorMs=new Date(d.getFullYear(),d.getMonth()-1,1,12).getTime();V2UI.renderCalendar();break;}
            case 'calendar-next':{const d=new Date(State.calendarCursorMs);State.calendarCursorMs=new Date(d.getFullYear(),d.getMonth()+1,1,12).getTime();V2UI.renderCalendar();break;}
            case 'calendar-today':State.selectedDateKey=dateKey();State.calendarCursorMs=new Date(new Date().getFullYear(),new Date().getMonth(),1,12).getTime();UI.navigate('calendar');break;
            case 'calendar-yesterday':{const d=new Date();d.setDate(d.getDate()-1);State.selectedDateKey=dateKey(d.getTime());State.calendarCursorMs=new Date(d.getFullYear(),d.getMonth(),1,12).getTime();UI.navigate('calendar');break;}
            case 'open-plan':openPlanModal();break;case 'edit-plan':openPlanModal(id);break;case 'open-memo':openMemoModal();break;case 'edit-memo':openMemoModal(id);break;case 'open-goals':openGoalsModal();break;
            case 'toggle-plan':{const plan=State.plans.find(item=>item.id===id);if(plan)await V2Repo.savePlan({...plan,done:!plan.done,completedAtMs:!plan.done?now():0,updatedAtMs:now()});break;}
            case 'delete-plan-modal':{const planId=$('#planId').value;if(planId&&await UI.confirm('할 일 삭제','이 할 일을 삭제할까요?','삭제')){await V2Repo.deletePlan(planId);UI.closeModal('planModal');}break;}
            case 'delete-memo-modal':{const memoId=$('#memoId').value;if(memoId&&await UI.confirm('메모 삭제','이 메모를 삭제할까요?','삭제')){await V2Repo.deleteMemo(memoId);UI.closeModal('memoModal');}break;}
            case 'open-game':MiniGame.open();break;case 'game-start':MiniGame.start();break;case 'open-tutorial':Tutorial.open(0);break;case 'close-celebration':GoalEngine.close();break;
            case 'send-verification':{const user=Firebase.auth?.currentUser;if(!user)throw new Error('로그인이 필요합니다.');try{await Firebase.mods.reload(user);await Firebase.mods.getIdToken(user,true);}catch{}if(user.emailVerified){await AdminAuth.evaluate(user);UI.toast('이미 인증된 이메일입니다.','success');break;}await Firebase.mods.sendEmailVerification(user);UI.toast('이메일 인증 링크를 보냈습니다. 인증 후 앱을 다시 열어 주세요.','success');break;}
            case 'open-admin':await AdminAuth.evaluate();if(!State.isAdmin)throw new Error('관리자 이메일 인증 또는 admin custom claim이 필요합니다.');UI.navigate('admin');break;
            case 'admin-refresh':await AdminConsole.refresh();break;case 'admin-export':AdminConsole.export();break;case 'admin-resolve-report':await AdminConsole.resolveReport(id,false);break;case 'admin-delete-post':if(await UI.confirm('신고 게시물 삭제','게시물을 삭제하고 신고를 처리할까요?','삭제 및 처리'))await AdminConsole.resolveReport(id,true);break;
            case 'accept-friend':await V2Repo.acceptFriendRequest(State.friendRequests.find(r=>r.id===id));break;case 'reject-friend':await V2Repo.deleteFriendRequest(id);break;case 'send-friend':await V2Repo.sendFriendRequest(State.friendSearchResult);break;
            case 'remove-friend':{const friendship=State.friendships.find(f=>f.id===id);if(friendship&&await UI.confirm('친구 삭제',`${publicName(otherMemberId(friendship))}님을 친구 목록에서 삭제할까요? 기존 대화도 삭제됩니다.`,'삭제'))await V2Repo.removeFriend(friendship);break;}
            case 'message-friend':await Messaging.openFriendship(id);break;case 'open-conversation':await Messaging.openConversation(id);break;case 'open-public-profile':await showPublicProfile(actionEl.dataset.userId);break;
            case 'ring-open-calendar':{const plan=State.currentRing?.plan;AlarmEngine.stopRing();if(plan){State.selectedDateKey=plan.dateKey;const d=dateFromKey(plan.dateKey);State.calendarCursorMs=new Date(d.getFullYear(),d.getMonth(),1,12).getTime();}UI.navigate('calendar');break;}
          }
        } catch(err){console.error(err);UI.toast(safeError(err),'error');}
      });

      $('#planForm')?.addEventListener('submit',async event=>{event.preventDefault();const title=safeText($('#planTitle').value).trim(),key=$('#planDate').value,time=$('#planTime').value,reminder=$('#planReminder').checked;if(!title||!key)return UI.toast('할 일과 날짜를 입력해 주세요.','error');if(reminder&&!time)return UI.toast('알림을 사용하려면 시간을 입력해 주세요.','error');const existing=State.plans.find(item=>item.id===$('#planId').value),id=existing?.id||makeId('plan');const reminderAtMs=reminder&&time?new Date(`${key}T${time}:00`).getTime():0;const plan={...existing,id,title,dateKey:key,time,subject:safeText($('#planSubject').value).trim(),note:safeText($('#planNote').value).trim(),done:existing?.done||false,completedAtMs:existing?.completedAtMs||0,reminderAtMs:Number.isFinite(reminderAtMs)?reminderAtMs:0,notifiedAtMs:existing?.reminderAtMs===reminderAtMs?existing?.notifiedAtMs||0:0,createdAtMs:existing?.createdAtMs||now(),updatedAtMs:now()};try{await V2Repo.savePlan(plan);State.selectedDateKey=key;UI.closeModal('planModal');UI.navigate('calendar');UI.toast('할 일을 저장했습니다.','success');}catch(err){UI.toast(safeError(err),'error');}});
      $('#memoForm')?.addEventListener('submit',async event=>{event.preventDefault();const title=safeText($('#memoTitle').value).trim(),content=safeText($('#memoContent').value).trim(),key=$('#memoDate').value;if(!title||!content||!key)return UI.toast('제목, 날짜, 내용을 입력해 주세요.','error');const existing=State.memos.find(item=>item.id===$('#memoId').value),memo={...existing,id:existing?.id||makeId('memo'),title,content,dateKey:key,pinned:$('#memoPinned').checked,createdAtMs:existing?.createdAtMs||now(),updatedAtMs:now()};try{await V2Repo.saveMemo(memo);State.selectedDateKey=key;UI.closeModal('memoModal');UI.navigate('calendar');UI.toast('메모를 저장했습니다.','success');}catch(err){UI.toast(safeError(err),'error');}});
      $('#goalsForm')?.addEventListener('submit',async event=>{event.preventDefault();const minutes=Number($('#dailyMinutesGoal').value),problems=Number($('#dailyProblemsGoal').value);if(!Number.isInteger(minutes)||minutes<1||minutes>1440||!Number.isInteger(problems)||problems<1||problems>9999)return UI.toast('목표 값을 확인해 주세요.','error');try{await V2Repo.savePreferences({dailyMinutesGoal:minutes,dailyProblemsGoal:problems,showInRanking:$('#showInRanking').checked,shareStudyStatus:$('#shareStudyStatus').checked,showOnlineStatus:$('#showOnlineStatus').checked});UI.closeModal('goalsModal');await GoalEngine.evaluate({silent:true});UI.toast('목표와 공개 범위를 저장했습니다.','success');}catch(err){UI.toast(safeError(err),'error');}});
      $('#friendSearchForm')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;UI.setBusy(button,true,'검색 중…');try{const result=await V2Repo.searchHandle($('#friendSearchInput').value);State.friendSearchResult=result||{error:'일치하는 사용자를 찾지 못했습니다.'};V2UI.renderFriends();}catch(err){State.friendSearchResult={error:safeError(err)};V2UI.renderFriends();}finally{UI.setBusy(button,false);}});
      $('#messageForm')?.addEventListener('submit',async event=>{event.preventDefault();if(!State.currentConversation)return;const input=$('#messageInput'),button=event.submitter;UI.setBusy(button,true,'전송 중…');try{await V2Repo.sendMessage(State.currentConversation,input.value);input.value='';}catch(err){UI.toast(safeError(err),'error');}finally{UI.setBusy(button,false);input.focus();}});
      $('#tutorialNext')?.addEventListener('click',()=>Tutorial.next());$('#tutorialSkip')?.addEventListener('click',()=>Tutorial.skip());
      $('#adminCollection')?.addEventListener('change',()=>AdminConsole.loadSelected().catch(err=>UI.toast(safeError(err),'error')));$('#adminSearch')?.addEventListener('input',()=>AdminConsole.render());
      document.addEventListener('visibilitychange',()=>{if(State.user){Presence.heartbeat().catch(()=>{});if(document.visibilityState==='visible')PlannerEngine.check().catch(()=>{});}});
      window.addEventListener('online',()=>{if(State.user)Promise.allSettled([Presence.heartbeat(true),PublicPublisher.publishProfile(true),PublicPublisher.publishStats(true)]);});
      window.addEventListener('beforeunload',()=>{MiniGame.stop();});
      State.v2Ready=true;
    }
