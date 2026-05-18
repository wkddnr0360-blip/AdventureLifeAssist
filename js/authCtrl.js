import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { AppState } from './appState.js';
import { UI } from './uiCtrl.js';
import { DataCtrl } from './dataCtrl.js';

export const AuthCtrl = {
    init() {
        this.bindEvents();
        this.observeAuthState();
    },

    bindEvents() {
        const btnLogin = document.getElementById('btnLogin');
        const btnSignup = document.getElementById('btnSignup');
        const btnLogout = document.getElementById('btnLogout');
        const btnGoogleLogin = document.getElementById('btnGoogleLogin');

        if (btnLogin) {
            btnLogin.addEventListener('click', () => this.login());
        }
        if (btnSignup) {
            btnSignup.addEventListener('click', () => this.signup());
        }
        if (btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
        if (btnGoogleLogin) {
            btnGoogleLogin.addEventListener('click', () => this.googleLogin());
        }
    },

    async login() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if(!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in as:", result.user.uid);
        } catch (error) {
            console.error("Login Error:", error.message);
            alert("로그인에 실패했습니다: " + error.message);
        }
    },

    async signup() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if(!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Signed up as:", result.user.uid);
            alert("회원가입이 완료되었습니다. 환영합니다!");
        } catch (error) {
            console.error("Signup Error:", error.message);
            alert("회원가입에 실패했습니다: " + error.message);
        }
    },

    async googleLogin() {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            console.log("Logged in with Google:", result.user.uid);
        } catch (error) {
            console.error("Google Login Error:", error.message);
            alert("구글 로그인에 실패했습니다: " + error.message);
        }
    },

    async logout() {
        try {
            await signOut(auth);
            console.log("Logged out");
        } catch (error) {
            console.error("Logout Error:", error.message);
        }
    },

    observeAuthState() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User is signed in:", user.uid);
                AppState.uid = user.uid; 
                this.updateUI(user);
                DataCtrl.fetchAllLogs(); 
                DataCtrl.checkTimer();
            } else {
                console.log("User is signed out");
                AppState.uid = null;
                this.updateUI(null);
            }
        });
    },

    updateUI(user) {
        const loginSect = document.getElementById('loginSection');
        const userSect = document.getElementById('userInfoSection');
        const userNameDisp = document.getElementById('userNameDisplay');
        const appContainer = document.querySelector('.app-container');

        if (user) {
            if (loginSect) loginSect.style.display = 'none';
            if (userSect) userSect.style.display = 'block';
            if (userNameDisp) userNameDisp.textContent = user.displayName || user.email?.split('@')[0] || '모험가';
            if (appContainer) appContainer.style.display = 'flex';
            UI.hideModal('profileModal');
        } else {
            if (loginSect) loginSect.style.display = 'block';
            if (userSect) userSect.style.display = 'none';
            if (appContainer) appContainer.style.display = 'none';
            UI.showModal('profileModal');
        }
    }
};