// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDGErPBeQ1Fdx9EHPXOHepoEoOx7P2f57o",
    authDomain: "princealextravel.firebaseapp.com",
    projectId: "princealextravel",
    storageBucket: "princealextravel.firebasestorage.app",
    messagingSenderId: "947577729462",
    appId: "1:947577729462:web:dd4b4c7cb4a984c5e3d117"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthLinks();
    const logoutBtn = document.getElementById('logoutLink');
    if (logoutBtn && !logoutBtn.dataset.listener) {
        logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await logout(); });
        logoutBtn.dataset.listener = 'true';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuToggle = document.getElementById('mobile-menu');
    const mainNav = document.getElementById('main-nav');

    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', function () {
            this.classList.toggle('open');
            mainNav.classList.toggle('open');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuToggle.classList.remove('open');
                mainNav.classList.remove('open');
            });
        });
        document.addEventListener('click', function(event) {
            if (!mobileMenuToggle.contains(event.target) && !mainNav.contains(event.target)) {
                mobileMenuToggle.classList.remove('open');
                mainNav.classList.remove('open');
            }
        });
    }

    const popupOverlay = document.getElementById('popupOverlay');
    if (popupOverlay) popupOverlay.addEventListener('click', function(e) { if (e.target === this) closePopup(); });
});

function updateAuthLinks() {
    const mp = document.getElementById('myProfileLink'), lr = document.getElementById('loginRegisterLink'), lo = document.getElementById('logoutLink');
    if (currentUser) { lr.style.display='none'; mp.style.display='block'; lo.style.display='block'; }
    else { lr.style.display='block'; mp.style.display='none'; lo.style.display='none'; }
}

async function logout() {
    try { await signOut(auth); window.location.href='index.html'; }
    catch(e){console.error('Logout error:',e);}
}

async function sendEmailWithWorker(payload) {
    const url = "https://payroll.princealexdigital.workers.dev/";
    try { const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); const d=await r.json(); if(r.ok) return true; else {console.error("Worker failed:",d.error,d.details); return false;} }
    catch(e){console.error("Network error:",e); return false;}
}

function subscribeNewsletter() {
    const input = document.querySelector('.newsletter-form input'); const email = input.value.trim();
    if (!email) { showPopup('Email Required', 'Please enter your email.', 'warning'); return; }
    showPopup('🎉 Welcome!', 'Thank you for subscribing!', 'success'); input.value = '';
}

function showPopup(title, message, type='info', buttons=null) {
    const overlay=document.getElementById('popupOverlay'), icon=document.getElementById('popupIcon'), titleEl=document.getElementById('popupTitle'), messageEl=document.getElementById('popupMessage'), buttonsEl=document.getElementById('popupButtons');
    const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    icon.textContent=icons[type]||icons.info; icon.className=`popup-icon ${type}`;
    titleEl.textContent=title; messageEl.textContent=message;
    if(buttons) buttonsEl.innerHTML=buttons; else buttonsEl.innerHTML='<button class="popup-button primary" onclick="closePopup()">Got it!</button>';
    overlay.classList.add('show');
}
function closePopup() { document.getElementById('popupOverlay').classList.remove('show'); }