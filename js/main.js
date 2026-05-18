import { AppState } from './appState.js';
import { MapCtrl } from './mapCtrl.js';
import { UI } from './uiCtrl.js';
import { DataCtrl } from './dataCtrl.js';
import { TavernCtrl } from './tavernCtrl.js';
import { AuthCtrl } from './authCtrl.js';

window.addEventListener('DOMContentLoaded', () => { 
    AppState.init(); 
    AuthCtrl.init();
    UI.bindEvents(); 
    TavernCtrl.bindEvents(); 
    setTimeout(() => MapCtrl.init(), 100); 
});