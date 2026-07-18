// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const db = getFirestore(app);

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthLinks();
    const logoutBtn = document.getElementById('logoutLink');
    if (logoutBtn && !logoutBtn.dataset.listener) {
        logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await logout(); });
        logoutBtn.dataset.listener = 'true';
    }

    if (user) {
        document.getElementById('profileContent').style.display = 'block';
        document.getElementById('loggedOutMessage').style.display = 'none';
        const currentMessage = document.getElementById('profileMessage');
        if (!currentMessage.textContent.includes('Welcome')) {
            await loadUserProfile(user);
        }
        await loadPastBookings(user.uid);
    } else {
        document.getElementById('profileContent').style.display = 'none';
        document.getElementById('loggedOutMessage').style.display = 'block';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateProfile();
        });
    }

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

    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) content.classList.add('active');
            });
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newUser') === '1') {
        displayMessage('profileMessage', '👋 Welcome! Please complete your profile details.', 'warning');
    }
    updateAuthLinks();

    const popupOverlay = document.getElementById('popupOverlay');
    if (popupOverlay) popupOverlay.addEventListener('click', function(e) { if (e.target === this) closePopup(); });
});

async function loadUserProfile(user) {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
        const currentMessage = document.getElementById('profileMessage');
        if (!currentMessage.textContent.includes('Welcome')) {
            displayMessage('profileMessage', 'Please update your profile details.', 'warning');
        }
        document.getElementById('profileGreeting').textContent = `Hello, ${user.email.split('@')[0]}!`;
        document.getElementById('profileEmailHeader').textContent = user.email;
        const initials = (user.email[0] || '').toUpperCase();
        document.getElementById('userInitials').textContent = initials;
        return;
    }
    const profileData = docSnap.data();
    const fullName = profileData.passenger_name || user.email.split('@')[0];
    const email = profileData.passenger_email || user.email;
    document.getElementById('profileGreeting').textContent = `Hello, ${fullName}!`;
    document.getElementById('profileEmailHeader').textContent = email;
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('userInitials').textContent = initials || (email[0] || '').toUpperCase();
    document.getElementById('newFullName').value = profileData.passenger_name || '';
    document.getElementById('newPhoneNumber').value = profileData.passenger_phone || '';
    document.getElementById('newIdNumber').value = profileData.passenger_id || '';
    document.getElementById('newEmail').value = email;
}

async function loadPastBookings(userId) {
    const pastBookingsList = document.getElementById('pastBookingsList');
    pastBookingsList.innerHTML = '<p class="no-bookings-message">Loading past bookings...</p>';
    try {
        const bookingsCol = collection(db, "bookings");
        const q = query(bookingsCol, where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        let bookings = [];
        querySnapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() }));
        if (bookings.length === 0) {
            const user = auth.currentUser;
            if (user && user.email) {
                const emailQuery = query(bookingsCol, where("passenger_email", "==", user.email));
                const emailSnapshot = await getDocs(emailQuery);
                emailSnapshot.forEach((doc) => {
                    if (!bookings.some(b => b.id === doc.id)) {
                        bookings.push({ id: doc.id, ...doc.data() });
                    }
                });
            }
        }
        if (bookings.length === 0) {
            pastBookingsList.innerHTML = '<p class="no-bookings-message">No past bookings found.</p>';
            return;
        }
        bookings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        pastBookingsList.innerHTML = '';
        bookings.forEach(booking => {
            const bookingCard = document.createElement('div');
            bookingCard.classList.add('booking-card');
            const statusClass = (booking.status || 'pending').toLowerCase();
            bookingCard.innerHTML = `
                <div><label>Booking Ref</label><span>${booking.booking_ref || 'N/A'}</span></div>
                <div><label>Route</label><span>${booking.bus_route || 'N/A'}</span></div>
                <div><label>Travel Date</label><span>${booking.travel_date || 'N/A'}</span></div>
                <div><label>Seat</label><span>${booking.seat_number || 'N/A'}</span></div>
                <div><label>Price</label><span>Ksh ${Number(booking.price || 0).toLocaleString()}</span></div>
                <div><label>Status</label><span class="status-badge ${statusClass}">${booking.status || 'PENDING'}</span></div>
            `;
            pastBookingsList.appendChild(bookingCard);
        });
    } catch (error) {
        console.error("Error loading bookings:", error);
        pastBookingsList.innerHTML = '<p class="no-bookings-message error">Error loading bookings: ' + error.message + '</p>';
    }
}

async function updateProfile() {
    const newFullName = document.getElementById('newFullName').value.trim();
    const newPhoneNumber = document.getElementById('newPhoneNumber').value.trim();
    const newIdNumber = document.getElementById('newIdNumber').value.trim();
    const newEmail = document.getElementById('newEmail').value.trim();
    const user = auth.currentUser;
    if (!user) {
        displayMessage('profileMessage', 'You must be logged in to update.', 'error');
        return;
    }
    try {
        const userDocRef = doc(db, "users", user.uid);
        const updates = {};
        if (newFullName) updates.passenger_name = newFullName;
        if (newPhoneNumber) updates.passenger_phone = newPhoneNumber;
        if (newIdNumber) updates.passenger_id = newIdNumber;
        if (newEmail && newEmail !== user.email) {
            updates.passenger_email = newEmail;
            try {
                await updateEmail(user, newEmail);
            } catch (emailError) {
                if (emailError.code === 'auth/requires-recent-login') {
                    displayMessage('profileMessage', 'Please log out and log in again before updating your email.', 'error');
                    return;
                }
                throw emailError;
            }
        }
        await setDoc(userDocRef, updates, { merge: true });
        displayMessage('profileMessage', '✅ Profile updated successfully!', 'success');
        const emailPayload = {
            toEmail: newEmail || user.email,
            toName: newFullName || user.displayName,
            subject: "Your Prince Alex Travel Profile Has Been Updated",
            htmlContent: `<h1>Hello ${newFullName || 'Valued Customer'},</h1><p>This is a confirmation that your profile details on Prince Alex Travel Services have been successfully updated.</p><p>If you did not make this change, please contact our support team immediately.</p><p>Thank you for keeping your information current!</p>`
        };
        await sendEmailWithWorker(emailPayload);
        await loadUserProfile(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        displayMessage('profileMessage', 'Update failed: ' + error.message, 'error');
    }
}

async function logout() {
    try {
        await signOut(auth);
        showCustomAlert('Logged out successfully!');
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error:", error);
        showCustomAlert('An unexpected error occurred during logout.');
    }
}

function updateAuthLinks() {
    const mp = document.getElementById('myProfileLink'), lr = document.getElementById('loginRegisterLink'), lo = document.getElementById('logoutLink');
    if (currentUser) {
        lr.style.display='none'; mp.style.display='block'; lo.style.display='block';
        if (window.location.pathname.includes('profile.html')) {
            mp.style.color = 'var(--accent)';
            mp.style.borderBottom = '2px solid var(--accent)';
        } else {
            mp.style.color = 'white';
            mp.style.borderBottom = 'none';
        }
    } else {
        lr.style.display='block'; mp.style.display='none'; lo.style.display='none';
    }
}

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function showCustomAlert(message) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10001;';
    modal.innerHTML = `<div style="background:white;padding:25px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);"><p style="margin-bottom:20px;font-size:1.1em;">${message}</p><button style="background:var(--primary);color:white;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:600;" onclick="this.parentNode.parentNode.remove()">OK</button></div>`;
    document.body.appendChild(modal);
}

function displayMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (type === 'warning') {
        element.innerHTML = `<span>${message}</span><button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:inherit;font-size:1.2em;cursor:pointer;margin-left:10px;float:right;">×</button>`;
    } else {
        element.textContent = message;
    }
    element.className = `message ${type}`;
    element.style.display = 'block';
    if (type === 'warning') return;
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

async function downloadTicketFromBooking(bookingId) {
    const bookingDocRef = doc(db, "bookings", bookingId);
    const docSnap = await getDoc(bookingDocRef);
    if (!docSnap.exists()) {
        showCustomAlert("Failed to retrieve booking details for PDF. Please try again.");
        return;
    }
    const booking = { id: docSnap.id, ...docSnap.data() };
    if (booking.status !== 'paid') {
        showCustomAlert('Ticket can only be downloaded after payment is confirmed.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 7;
    const leftMargin = 20;
    const primaryColor = '#0f172a';
    const accentColor = '#f59e0b';
    const darkTextColor = '#1f2937';
    const secondaryTextColor = '#64748b';
    const img = new Image();
    img.src = 'mylogo.png';
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => { console.error("Error loading logo image"); resolve(); };
    });
    if (img.complete && img.naturalWidth !== 0) {
        doc.addImage(img, 'PNG', 15, y, 40, 40);
    }
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Prince Alex Travel Services", 60, y + 15);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("E-Ticket & Booking Confirmation", 60, y + 25);
    const qrCodeData = booking.booking_ref;
    const qrCodeSize = 50;
    const qrCodeDiv = document.createElement('div');
    qrCodeDiv.style.display = 'none';
    document.body.appendChild(qrCodeDiv);
    let qrCodeImgData = '';
    try {
        new window.QRCode(qrCodeDiv, { text: qrCodeData, width: qrCodeSize, height: qrCodeSize, colorDark: primaryColor, colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.H });
        await new Promise(resolve => setTimeout(resolve, 50));
        qrCodeImgData = qrCodeDiv.querySelector('canvas').toDataURL("image/png");
    } catch (qrError) {
        console.error("Error generating QR code:", qrError);
    } finally {
        document.body.removeChild(qrCodeDiv);
    }
    if (qrCodeImgData) {
        doc.addImage(qrCodeImgData, 'PNG', 160, y, 40, 40);
    }
    y += 55;
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(1.5);
    doc.line(10, y, 200, y);
    y += 10;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor);
    doc.text(`Booking Reference: ${booking.booking_ref}`, 20, y);
    y += 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Passenger Details:", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkTextColor);
    doc.text(`Name: ${booking.passenger_name}`, 20, y); y += lineHeight;
    doc.text(`Phone: ${booking.passenger_phone}`, 20, y); y += lineHeight;
    doc.text(`Email: ${booking.passenger_email || 'N/A'}`, 20, y); y += 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Journey Details:", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkTextColor);
    doc.text(`Bus Name: ${booking.bus_name || 'N/A'}`, 20, y); y += lineHeight;
    doc.text(`Route: ${booking.bus_route}`, 20, y); y += lineHeight;
    doc.text(`Travel Date: ${booking.travel_date}`, 20, y); y += lineHeight;
    doc.text(`Departure Time: ${booking.bus_time}`, 20, y); y += lineHeight;
    doc.text(`Bus ID: ${booking.bus_id || 'N/A'}`, 20, y); y += lineHeight;
    doc.text(`Seat Number: ${booking.seat_number}`, 20, y); y += 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("Payment Summary:", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkTextColor);
    doc.text(`Amount: Ksh ${booking.price.toFixed(2)}`, 20, y); y += lineHeight;
    doc.text(`Payment Status: ${booking.status.toUpperCase()}`, 20, y); y += 12;
    doc.text(`Booking Date: ${new Date(booking.booking_date).toLocaleDateString()}`, 20, y); y += 12;
    if (booking.status.toUpperCase() === 'PENDING') {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(200, 0, 0);
        doc.text("NOTE: This ticket is PENDING PAYMENT. Please complete payment to validate.", 20, y);
        y += 5;
        doc.text("Contact support for assistance: +254 717 384 875", 20, y);
        doc.setTextColor(darkTextColor);
        y += 15;
    }
    y = doc.internal.pageSize.height - 25;
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(0.5);
    doc.line(10, y, 200, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkTextColor);
    doc.text("Prince Alex Travel Services | Email: senerwaalex@gmail.com | Phone: +254 717 384 875", doc.internal.pageSize.width / 2, y, { align: "center" });
    y += 5;
    doc.text("© 2025 Prince Alex Digital. All rights reserved.", doc.internal.pageSize.width / 2, y, { align: "center" });
    doc.save(`ticket-${booking.booking_ref}.pdf`);
}

function subscribeNewsletter() {
    const emailInput = document.querySelector('.newsletter-form input');
    const email = emailInput.value.trim();
    if (!email) {
        showPopup('Email Required', 'Please enter your email address to subscribe to our newsletter.', 'warning');
        return;
    }
    const payload = {
        toEmail: email,
        subject: "🎉 Welcome to Our Newsletter!",
        htmlContent: "<h1>Thank you for subscribing!</h1><p>You'll now receive updates about our latest offers, travel news, and special promotions directly to your inbox.</p>"
    };
    sendEmailWithWorker(payload).then(success => {
        if (success) {
            showPopup('🎉 Subscribed!', 'Thank you for subscribing! A confirmation has been sent to your email.', 'success');
        } else {
            showPopup('Subscription Failed', 'Could not subscribe at this time. Please try again later.', 'error');
        }
    });
    emailInput.value = '';
}

function showPopup(title, message, type = 'info', buttons = null) {
    const overlay = document.getElementById('popupOverlay');
    const icon = document.getElementById('popupIcon');
    const titleEl = document.getElementById('popupTitle');
    const messageEl = document.getElementById('popupMessage');
    const buttonsEl = document.getElementById('popupButtons');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    icon.textContent = icons[type] || icons.info;
    icon.className = `popup-icon ${type}`;
    titleEl.textContent = title;
    messageEl.textContent = message;
    if (buttons) {
        buttonsEl.innerHTML = buttons;
    } else {
        buttonsEl.innerHTML = '<button class="popup-button primary" onclick="closePopup()">Got it!</button>';
    }
    overlay.classList.add('show');
}

function closePopup() {
    const overlay = document.getElementById('popupOverlay');
    overlay.classList.remove('show');
}

async function sendEmailWithWorker(payload) {
    const url = "https://payroll.princealexdigital.workers.dev/";
    try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (r.ok) return true;
        else { console.error("Worker failed:", d.error, d.details); return false; }
    } catch (e) { console.error("Network error:", e); return false; }
}