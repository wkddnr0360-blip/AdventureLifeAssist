import { $, getLogDate } from './utils.js';
import { MapCtrl } from './mapCtrl.js';

export const AppState = {
    uid: localStorage.getItem('mystic_uid') || ('uid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
    name: localStorage.getItem('mystic_name') || "모험가_" + Math.floor(Math.random() * 9999),
    avatar: localStorage.getItem('mystic_avatar') || "",
    selDate: getLogDate(), 
    navDate: new Date(), 
    logCache: [],
    
    init() {
        localStorage.setItem('mystic_uid', this.uid); 
        localStorage.setItem('mystic_name', this.name);
        $('headerDate').innerText = this.selDate.replace(/-/g, '. '); 
        $('syncCodeDisplay').innerText = this.uid;
        this.updateAvatarUI();
    },
    
    updateAvatarUI() {
        const hasAv = !!this.avatar;
        $('btnOpenProfile').style.backgroundImage = hasAv ? `url(${this.avatar})` : 'none'; 
        $('profileAvatarUI').style.backgroundImage = hasAv ? `url(${this.avatar})` : 'none';
        $('headerAvatarIcon').style.display = hasAv ? 'none' : 'block'; 
        $('profileModalIcon').style.display = hasAv ? 'none' : 'block';
        if(MapCtrl.marker) MapCtrl.updateMarkerIcon();
    }
};