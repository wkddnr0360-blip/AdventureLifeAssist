import { $, $$ } from './utils.js';
import { AppState } from './appState.js';
import { UI } from './uiCtrl.js';

export const MapCtrl = {
    map: null, marker: null, layer: null, lat: 35.8714, lng: 128.6014, cloaked: false,
    
    getIconHTML() { 
        return AppState.avatar 
            ? `<div class='mystic-avatar' style="background-image: url(${AppState.avatar}); color: transparent;"></div>` 
            : `<div class='mystic-avatar'>🧝🏻‍♀️</div>`; 
    },
    
    updateMarkerIcon() { 
        if(this.marker) this.marker.setIcon(L.divIcon({ className: 'custom-div-icon', html: this.getIconHTML(), iconSize: [50,50], iconAnchor: [25,50] })); 
    },
    
    updateCurrentPosition() {
        return new Promise((resolve) => {
            if (!("geolocation" in navigator)) return resolve();
            navigator.geolocation.getCurrentPosition(
                (p) => {
                    this.lat = p.coords.latitude; this.lng = p.coords.longitude;
                    if(this.marker) this.marker.setLatLng([this.lat, this.lng]);
                    resolve();
                },
                (err) => resolve(),
                { enableHighAccuracy: true, timeout: 2500, maximumAge: 10000 }
            );
        });
    },

    init() {
        if (this.map) return;
        try {
            this.map = L.map('questMap', {zoomControl: false, attributionControl: false}).setView([this.lat, this.lng], 16);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {maxZoom: 19}).addTo(this.map);
            this.layer = L.layerGroup().addTo(this.map);
            
            if ("geolocation" in navigator) {
                navigator.geolocation.watchPosition((p) => {
                    this.lat = p.coords.latitude; this.lng = p.coords.longitude;
                    if(!this.marker) { 
                        this.marker = L.marker([this.lat, this.lng], {icon: L.divIcon({ className: 'custom-div-icon', html: this.getIconHTML(), iconSize: [50,50], iconAnchor: [25,50] }), zIndexOffset:1000}).addTo(this.map); 
                        this.map.setView([this.lat, this.lng], 17); 
                        this.marker.on('click', () => this.toggleCloak());
                    } else { 
                        this.marker.setLatLng([this.lat, this.lng]); 
                    }
                }, () => {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
            }
        } catch(e) { console.error("Map Error", e); }
    },
    
    locateMe() { 
        if(this.marker && this.map) this.map.flyTo([this.lat, this.lng], 17, {animate:true, duration: 1}); 
    },
    
    viewOnMap(lat, lng) { 
        UI.switchView('viewQuest', $$('.nav-item[data-view="viewQuest"]')[0]); 
        setTimeout(() => { 
            if (this.map) { 
                this.map.invalidateSize(); 
                this.map.flyTo([lat, lng], 18, { animate: true, duration: 1 }); 
            } 
        }, 300); 
    },
    
    toggleCloak() {
        this.cloaked = !this.cloaked; 
        const btn = $('btnCloak');
        if (this.marker) { 
            const el = this.marker._icon.querySelector('.mystic-avatar'); 
            if (el) { 
                el.style.opacity = this.cloaked ? '0.3' : '1'; 
                el.style.filter = this.cloaked ? 'grayscale(100%)' : 'none'; 
            } 
        }
        btn.style.background = this.cloaked ? 'var(--primary)' : 'rgba(255,255,255,0.95)'; 
        btn.style.color = this.cloaked ? '#fff' : 'var(--accent)'; 
        btn.style.borderColor = this.cloaked ? 'var(--primary)' : 'var(--accent)';
    },
    
    drawPaths() {
        if (!this.layer || !this.map) return; 
        this.layer.clearLayers();
        const logs = AppState.logCache.filter(l => l.logicalDate === AppState.selDate).sort((a,b) => new Date(a.clientTime) - new Date(b.clientTime));
        const latlngs = [];
        logs.forEach((data, i) => {
            if(data.lat && data.lng) {
                latlngs.push([data.lat, data.lng]);
                const iconHtml = (data.icon && data.icon.includes('fa-')) ? `<i class="${data.icon}"></i>` : (data.icon || '🐾');
                L.marker([data.lat, data.lng], {icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="path-marker"><div class="path-seq">${i + 1}</div><div class="path-emoji">${iconHtml}</div></div>`, iconSize: [32,32], iconAnchor: [16,32] })})
                .bindPopup(`<div style="font-family:'Pretendard'; font-size:13px; text-align:center;"><b>${i + 1}. ${data.type}</b><br>${data.content}</div>`).addTo(this.layer);
            }
        });
        if(latlngs.length > 1) L.polyline(latlngs, {color: '#88B2CC', weight: 4, dashArray: '8, 8', className: 'path-line-anim'}).addTo(this.layer);
    }
};