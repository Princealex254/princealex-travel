// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, onSnapshot, getDoc, increment, serverTimestamp, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

let currentAdmin = null;
const busesCol = collection(db, "buses");
const bookingsCol = collection(db, "bookings");
let busesUnsub = null, busCache = [];
let bookingsUnsub = null, bookingCache = [];
let selectedBusId = null, selectedBusCode = null, selectedDate = null, selectedDepartureTime = null, selectedBusPrice = null, selectedBusRoute = null, selectedBusName = null, selectedTotalSeats = null, selectedSeatNumber = null, seatSelectionUnsubscribe = null;
let busResultsCache = new Map();
const MAX_PDF_BASE64_SIZE_BYTES = 800 * 1024;
const TOTAL_SEATS_DEFAULT = 32;
let currentManifestBus = null, currentManifestBookings = [];

function showCustomAlert(message, type = 'info', callback = null) {
    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(4px);';
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#0f172a';
    modal.innerHTML = `<div style="background:white;padding:2rem;border-radius:16px;text-align:center;max-width:450px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);display:flex;flex-direction:column;gap:1.5rem;"><p style="margin:0;font-size:1.1rem;color:#1e293b;line-height:1.6;">${message}</p><button style="background:var(--primary);color:white;padding:0.75rem 2rem;border:none;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:600;transition:all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'" onclick="this.parentElement.parentElement.remove(); if(window.alertCallback) window.alertCallback();">OK</button></div>`;
    document.body.appendChild(modal);
    window.alertCallback = callback;
}

function showCustomConfirm(message, type = 'confirm', callback = null) {
    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(4px);';
    const confirmColor = type === 'delete' ? '#ef4444' : '#0f172a';
    modal.innerHTML = `<div style="background:white;padding:2rem;border-radius:16px;text-align:center;max-width:450px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);display:flex;flex-direction:column;gap:1.5rem;"><p style="margin:0;font-size:1.1rem;color:${confirmColor};line-height:1.6;">${message}</p><div style="display:flex;justify-content:center;gap:1rem;"><button class="confirm-yes" style="background:#10b981;color:white;padding:0.75rem 2rem;border:none;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:600;transition:all 0.3s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'" onclick="this.parentElement.parentElement.remove(); if(window.confirmCallback) window.confirmCallback(true);">Yes</button><button class="confirm-no" style="background:#ef4444;color:white;padding:0.75rem 2rem;border:none;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:600;transition:all 0.3s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'" onclick="this.parentElement.parentElement.remove(); if(window.confirmCallback) window.confirmCallback(false);">No</button></div></div>`;
    document.body.appendChild(modal);
    window.confirmCallback = callback;
}

function getFriendlyErrorMessage(error) {
    console.error(error);
    const code = error.code;
    const message = error.message;
    if (code === 'auth/invalid-email') return "Please enter a valid email address.";
    if (code === 'auth/user-not-found') return "No account found with this email.";
    if (code === 'auth/wrong-password') return "Incorrect password. Please try again.";
    if (code === 'auth/invalid-credential') return "Incorrect email or password.";
    if (code === 'auth/network-request-failed') return "Network error. Please check your internet connection.";
    if (code === 'auth/too-many-requests') return "Too many attempts. Please try again later.";
    if (code === 'permission-denied') return "You don't have permission to perform this action.";
    if (code === 'unavailable') return "Service currently unavailable. Please try again later.";
    return message.replace('Firebase: ', '') || "An unexpected error occurred.";
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'flex'; }
function hideLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }

function updateBookingStep(step) {
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step${i}`);
        if (el) {
            el.classList.remove('active', 'completed');
            if (i < step) el.classList.add('completed');
            if (i === step) el.classList.add('active');
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentAdmin = null;
        const adminApp = document.getElementById('adminApp');
        const loginContainer = document.getElementById('loginContainer');
        const publicNavbar = document.getElementById('publicNavbar');
        if (adminApp) adminApp.classList.add('hidden');
        if (loginContainer) loginContainer.classList.remove('hidden');
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) loginEmail.focus();
        hideLoading();
        return;
    }
    showLoading();
    const q = query(collection(db, "admins"), where("email", "==", user.email));
    const querySnapshot = await getDocs(q);
    let isAuthorized = false;
    querySnapshot.forEach((doc) => {
        const role = doc.data().role;
        if (role === 'admin' || role === 'super_admin') {
            isAuthorized = true;
        }
    });

    if (isAuthorized) {
        currentAdmin = user;
        const adminEmailBadge = document.getElementById('adminEmailBadge');
        const adminEmailDisplay = document.getElementById('adminEmailDisplay');
        if (adminEmailBadge) adminEmailBadge.textContent = user.email ?? "Admin";
        if (adminEmailDisplay) adminEmailDisplay.textContent = user.email ?? "Admin";
        const adminApp = document.getElementById('adminApp');
        const loginContainer = document.getElementById('loginContainer');
        const publicNavbar = document.getElementById('publicNavbar');
        if (adminApp) adminApp.classList.remove('hidden');
        if (loginContainer) loginContainer.classList.add('hidden');
        if (publicNavbar) publicNavbar.classList.add('hidden');
        attachRealtimeBuses();
        attachRealtimeBookings();
        populateRouteDropdowns();
    } else {
        await signOut(auth);
        currentAdmin = null;
        const adminApp = document.getElementById('adminApp');
        const loginContainer = document.getElementById('loginContainer');
        const publicNavbar = document.getElementById('publicNavbar');
        if (adminApp) adminApp.classList.add('hidden');
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (publicNavbar) publicNavbar.classList.remove('hidden');
        showCustomAlert("Access denied. This account is not an admin.", "error");
    }
    hideLoading();
});

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value;
            showLoading();
            try {
                await signInWithEmailAndPassword(auth, email, pass);
                showToast("Welcome back! Login successful.", "success");
            } catch (err) {
                showToast(getFriendlyErrorMessage(err), "error");
                hideLoading();
            }
        });
    }

    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', async () => {
            showCustomConfirm("Are you sure you want to log out?", "confirm", async (result) => {
                if (result) {
                    showLoading();
                    try {
                        await signOut(auth);
                        showCustomAlert("You have been logged out safely.", "info");
                    } catch (err) {
                        showCustomAlert("Logout failed: " + getFriendlyErrorMessage(err), "error");
                    } finally {
                        hideLoading();
                    }
                }
            });
        });
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            const title = btn.dataset.title;
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
            btn.classList.add('active');
            const targetPanel = document.getElementById(target);
            if (targetPanel) targetPanel.classList.remove('hidden');
            if (title) {
                const pageTitle = document.getElementById('pageTitle');
                if (pageTitle) pageTitle.textContent = title;
            }
        });
    });

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('show');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    }
    document.querySelectorAll('.sidebar-menu button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 900) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('show');
            }
        });
    });

    const adminConfirmBookingBtn = document.getElementById('adminConfirmBooking button[type="submit"]');
    if (adminConfirmBookingBtn) adminConfirmBookingBtn.disabled = true;
    const passengerDetailsCard = document.getElementById('passengerDetailsCard');
    if (passengerDetailsCard) passengerDetailsCard.classList.add('hidden');
});

function attachRealtimeBuses() {
    if (busesUnsub) busesUnsub();
    const q = query(busesCol, orderBy("createdAt", "desc"), limit(50));
    busesUnsub = onSnapshot(q, (snap) => {
        let totalBuses = 0, seatsToday = 0;
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        busCache = [];
        snap.forEach(docSnap => {
            totalBuses++;
            const d = docSnap.data();
            if (d.travelDate === todayStr) seatsToday += Number(d.available_seats ?? 0);
            busCache.push({ id: docSnap.id, ...d });
        });
        const statTotalBuses = document.getElementById('statTotalBuses');
        if (statTotalBuses) statTotalBuses.textContent = totalBuses;
        const statSeatsAvailable = document.getElementById('statSeatsAvailable');
        if (statSeatsAvailable) statSeatsAvailable.textContent = seatsToday;
        renderBusTable(busCache);
    });
}

function renderBusTable(buses) {
    const list = document.getElementById('busTableBody');
    if (!list) return;
    list.innerHTML = '';
    buses.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div style="font-weight:bold;">${d.busName ?? "-"}</div><span class="badge warn" style="font-size:0.7em;">${d.busCode ?? "-"}</span></td>
            <td><div>${d.origin ?? "-"}</div><div style="font-size:0.8em; color:var(--text-light);">to ${d.destination ?? "-"}</div></td>
            <td><div>${d.travelDate ?? "-"}</div><div style="font-size:0.8em; color:var(--text-light);">${d.departureTime ?? "-"}</div></td>
            <td><span style="font-weight:bold; color:${(d.available_seats > 0) ? 'var(--success)' : 'var(--error)'}">${d.available_seats ?? 0}</span> <span style="color:var(--text-light);">/ ${d.totalSeats ?? 0}</span></td>
            <td>${d.price ? "KES " + Number(d.price).toLocaleString() : "-"}</td>
            <td class="nowrap"><button class="btn sm" data-action="edit" data-id="${d.id}"><i class="fa-solid fa-pen-to-square"></i></button> <button class="btn sm danger" data-action="del" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></td>
        `;
        list.appendChild(tr);
    });
}

function attachRealtimeBookings() {
    if (bookingsUnsub) bookingsUnsub();
    const q = query(bookingsCol, orderBy("createdAt", "desc"), limit(50));
    bookingsUnsub = onSnapshot(q, (snap) => {
        let bookingsToday = 0, paidCount = 0, pendingCount = 0;
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        bookingCache = [];
        snap.forEach(docSnap => {
            const d = docSnap.data();
            bookingCache.push({ id: docSnap.id, ...d });
            let created = null;
            if (d.createdAt && d.createdAt.toDate) created = d.createdAt.toDate();
            else if (d.booking_date) created = new Date(d.booking_date);
            if (created) {
                const createdStr = created.getFullYear() + '-' + String(created.getMonth() + 1).padStart(2, '0') + '-' + String(created.getDate()).padStart(2, '0');
                if (createdStr === todayStr) bookingsToday++;
            }
            if ((d.status || "").toLowerCase() === 'paid') paidCount++;
            else pendingCount++;
        });
        const statTodayBookings = document.getElementById('statTodayBookings');
        if (statTodayBookings) statTodayBookings.textContent = bookingsToday;
        const statPaidPending = document.getElementById('statPaidPending');
        if (statPaidPending) statPaidPending.textContent = `${paidCount} / ${pendingCount}`;
        renderBookingTable(bookingCache);
    });
}

function renderBookingTable(items) {
    const body = document.getElementById('bookingTableBody');
    if (!body) return;
    body.innerHTML = '';
    items.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    for (const b of items) {
        const paid = (b.status || "").toLowerCase() === "paid";
        const tr = document.createElement('tr');
        tr.className = paid ? 'row-paid' : 'row-pending';
        tr.innerHTML = `
            <td><div style="font-weight:bold;">${b.passenger_name ?? "-"}</div><div style="font-size:0.85em; color:var(--text-light);"><i class="fa-regular fa-envelope"></i> ${b.passenger_email ?? "-"}</div><div style="font-size:0.85em; color:var(--text-light);"><i class="fa-solid fa-phone"></i> ${b.passenger_phone ?? "-"}</div></td>
            <td><div style="font-weight:600;">${b.bus_route ?? "-"}</div><div style="font-size:0.85em; color:var(--text-light); margin-top:2px;"><i class="fa-regular fa-calendar"></i> ${b.travel_date ?? "-"} ${b.bus_time ? '<span style="margin-left:5px;"><i class="fa-regular fa-clock"></i> ' + b.bus_time + '</span>' : ""}</div><span class="badge warn" style="font-size:0.65em; margin-top:4px; display:inline-block;">${b.bus_code ?? "-"}</span></td>
            <td style="text-align:center;"><div style="font-weight:bold; font-size:1.2em; color:var(--primary-color);">${b.seat_number ?? "-"}</div></td>
            <td><div style="font-weight:bold;">${b.price ? "KES " + Number(b.price).toLocaleString() : "-"}</div><div style="margin-top:4px;"><span class="badge ${paid ? "success" : "warn"}" style="font-size:0.7em; padding:0.3em 0.6em;">${paid ? "PAID" : "PENDING"}</span></div><div style="font-size:0.75em; color:var(--text-light); margin-top:4px; font-family:monospace;">Ref: ${b.booking_ref ?? b.reference ?? b.ref ?? "-"}</div></td>
            <td class="nowrap">${paid ? "" : `<button class="btn sm success" data-action="markpaid" data-id="${b.id}" title="Mark Paid"><i class="fa-solid fa-check"></i></button>`} <button class="btn sm" data-action="ticket" data-id="${b.id}" title="Download Ticket"><i class="fa-solid fa-ticket"></i></button> <button class="btn sm danger" data-action="del" data-id="${b.id}" title="Delete"><i class="fa-solid fa-trash"></i></button></td>
        `;
        body.appendChild(tr);
    }
}

async function populateRouteDropdowns() {
    const fromDropdown = document.getElementById('abFrom');
    const toDropdown = document.getElementById('abTo');
    if (!fromDropdown || !toDropdown) return;
    fromDropdown.innerHTML = '<option value="">Select Origin</option>';
    toDropdown.innerHTML = '<option value="">Select Destination</option>';
    const uniqueOrigins = new Set(), uniqueDestinations = new Set();
    try {
        const querySnapshot = await getDocs(busesCol);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.origin) uniqueOrigins.add(data.origin);
            if (data.destination) uniqueDestinations.add(data.destination);
        });
        uniqueOrigins.forEach(origin => {
            const option = document.createElement('option');
            option.value = origin;
            option.textContent = origin;
            fromDropdown.appendChild(option);
        });
        uniqueDestinations.forEach(destination => {
            const option = document.createElement('option');
            option.value = destination;
            option.textContent = destination;
            toDropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating route dropdowns:", error);
        showCustomAlert("Could not load bus routes. Please check your connection.", "error");
    }
}

async function openSeatSelectionModal(busId, travelDate, totalSeats, currentAvailableSeats) {
    selectedSeatNumber = null;
    const seatGrid = document.getElementById('seatGrid');
    if (!seatGrid) return;
    seatGrid.innerHTML = '';
    const seatModal = document.getElementById('seatModal');
    if (seatModal) seatModal.classList.remove('hidden');
    const selectedBusInfoAdmin = document.getElementById('selectedBusInfoAdmin');
    if (selectedBusInfoAdmin) selectedBusInfoAdmin.textContent = `Bus ID: ${busId}, Date: ${travelDate}, Available: ${currentAvailableSeats}`;
    seatGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    const driverArea = document.createElement('div');
    driverArea.classList.add('driver-area');
    driverArea.textContent = 'Front (Driver)';
    seatGrid.appendChild(driverArea);
    if (seatSelectionUnsubscribe) {
        seatSelectionUnsubscribe();
        seatSelectionUnsubscribe = null;
    }
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("bus_id", "==", busId), where("travel_date", "==", travelDate), where("status", "in", ['pending', 'paid']));
    seatSelectionUnsubscribe = onSnapshot(q, (snapshot) => {
        const bookedSeatsForThisTrip = new Set(snapshot.docs.map(doc => doc.data().seat_number));
        const existingDriverArea = seatGrid.querySelector('.driver-area');
        seatGrid.innerHTML = '';
        if (existingDriverArea) seatGrid.appendChild(existingDriverArea);
        else {
            const newDriverArea = document.createElement('div');
            newDriverArea.classList.add('driver-area');
            newDriverArea.textContent = 'Front (Driver)';
            seatGrid.appendChild(newDriverArea);
        }
        for (let i = 1; i <= totalSeats; i++) {
            const seatContainer = document.createElement('div');
            seatContainer.classList.add('seat-container');
            seatContainer.setAttribute('data-seat', i);
            const seatIcon = document.createElement('i');
            seatIcon.classList.add('fas', 'fa-chair', 'seat-icon');
            const seatNumSpan = document.createElement('span');
            seatNumSpan.classList.add('seat-number');
            seatNumSpan.textContent = `S${i}`;
            seatContainer.appendChild(seatIcon);
            seatContainer.appendChild(seatNumSpan);
            if (bookedSeatsForThisTrip.has(`S${i}`)) {
                seatContainer.classList.add('booked');
                seatContainer.onclick = null;
            } else {
                seatContainer.classList.add('available');
                if (selectedSeatNumber === i) seatContainer.classList.add('selected');
                seatContainer.onclick = function () {
                    const currentlySelected = document.querySelector('#seatGrid .seat-container.selected');
                    if (currentlySelected) currentlySelected.classList.remove('selected');
                    this.classList.add('selected');
                    selectedSeatNumber = parseInt(this.dataset.seat);
                    const selectedSeatNumberAdmin = document.getElementById('selectedSeatNumberAdmin');
                    const displayedSeatNumber = document.getElementById('displayedSeatNumber');
                    if (selectedSeatNumberAdmin) selectedSeatNumberAdmin.value = `S${selectedSeatNumber}`;
                    if (displayedSeatNumber) displayedSeatNumber.value = `S${selectedSeatNumber}`;
                    showToast(`Seat S${selectedSeatNumber} selected`, "success");
                    updateBookingStep(4);
                    if (seatModal) seatModal.classList.add('hidden');
                    const passengerDetailsCard = document.getElementById('passengerDetailsCard');
                    if (passengerDetailsCard) passengerDetailsCard.classList.remove('hidden');
                    const adminConfirmBookingBtn = document.getElementById('adminConfirmBooking button[type="submit"]');
                    if (adminConfirmBookingBtn) adminConfirmBookingBtn.disabled = false;
                    const abName = document.getElementById('abName');
                    if (abName) abName.focus();
                };
            }
            seatGrid.appendChild(seatContainer);
        }
    }, (error) => {
        console.error("Error fetching booked seats in real-time:", error.message);
        showCustomAlert("Error loading seat availability. Please try again.", "error");
    });
}

async function generatePdfContent(booking) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
    const primaryColor = '#0f172a', accentColor = '#f59e0b', darkTextColor = '#1f2937', lightTextColor = '#6b7280', whiteColor = '#ffffff', lightBgColor = '#f8fafc';
    const status = (booking.status ?? "pending").toUpperCase();
    const statusColor = status === 'PAID' ? '#10b981' : '#f59e0b';
    doc.setFillColor(whiteColor); doc.setDrawColor(primaryColor); doc.setLineWidth(0.5); doc.roundedRect(5, 5, 200, 138, 5, 5, 'FD');
    doc.setFillColor(primaryColor); doc.roundedRect(5, 5, 200, 30, 5, 5, 'F');
    doc.setFillColor(whiteColor); doc.circle(20, 20, 8, 'F'); doc.setTextColor(primaryColor); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("PA", 18, 22);
    doc.setTextColor(whiteColor); doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("Prince Alex Travel", 35, 18); doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text("BOARDING PASS", 35, 26);
    const bw = 35, bx = 205 - bw - 10; doc.setFillColor(statusColor); doc.roundedRect(bx, 15, bw, 10, 3, 3, 'F'); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(whiteColor); doc.text(status, bx + (bw / 2), 21.5, { align: 'center' });
    const mY = 40, sX = 145; doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(lightTextColor); doc.line(sX, mY - 2, sX, 130); doc.setLineDashPattern([], 0);
    let y = mY + 8; const lm = 15, lcw = sX - lm - 5;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("PASSENGER NAME", lm, y); y += 8;
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(darkTextColor); doc.text(booking.passenger_name ?? "-", lm, y, { maxWidth: lcw }); y += 12;
    const [origin, dest] = (booking.bus_route ?? '- to -').split(' to ');
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("FROM", lm, y); doc.text("TO", lm + 60, y); y += 10;
    doc.setFontSize(24); doc.setFont("helvetica", "bold"); doc.setTextColor(primaryColor); doc.text(origin.trim(), lm, y, { maxWidth: 40 }); doc.text("→", lm + 45, y); doc.text(dest.trim(), lm + 60, y, { maxWidth: 65 }); y += 12;
    const dY = y;
    [{ label: "TRAVEL DATE", value: booking.travel_date ?? "-" }, { label: "DEPARTURE", value: booking.bus_time ?? "-" }, { label: "SEAT", value: booking.seat_number ?? "-" }].forEach((item, i) => { const x = lm + (i * 45); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text(item.label, x, dY); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(darkTextColor); doc.text(item.value, x, dY + 8, { maxWidth: 40 }); });
    y += 20;
    doc.setFillColor(lightBgColor); doc.roundedRect(lm - 5, y, lcw + 5, 20, 3, 3, 'F'); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(primaryColor); doc.text("IMPORTANT REMINDERS:", lm, y + 6); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(darkTextColor); doc.text("• Arrive at the terminal 15 minutes before departure.", lm, y + 11); doc.text("• Present this ticket (digital or printed) to the driver.", lm, y + 16);
    y = mY + 8; const rm = sX + 8, rcw = 205 - rm - 5;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("BOOKING REFERENCE", rm, y); y += 8;
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(accentColor); doc.text(booking.booking_ref ?? booking.id, rm, y, { maxWidth: rcw }); y += 12;
    const qd = booking.booking_ref ?? booking.id; const qc = document.createElement('div'); qc.style.display = 'none'; document.body.appendChild(qc); let qi = '';
    try { new window.QRCode(qc, { text: qd, width: 128, height: 128, colorDark: darkTextColor, colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.H }); await new Promise(r => setTimeout(r, 50)); const c = qc.querySelector('canvas'); if (c) qi = c.toDataURL('image/png'); } catch (e) { } finally { document.body.removeChild(qc); }
    if (qi) doc.addImage(qi, 'PNG', rm + 3, y, 40, 40); y += 45;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("BUS NAME", rm, y); y += 5; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(darkTextColor); doc.text(booking.bus_name ?? "-", rm, y, { maxWidth: rcw }); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("PRICE PAID", rm, y); y += 5; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(darkTextColor); doc.text(`KES ${Number(booking.price ?? 0).toLocaleString()}`, rm, y);
    const fY = 132; doc.setDrawColor(primaryColor); doc.setLineWidth(0.2); doc.line(10, fY, 200, fY); const ftY = fY + 5; doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(lightTextColor); doc.text("© 2025 Prince Alex Travel Services", 10, ftY); doc.text("This is an official e-ticket. Terms and conditions apply.", 10, ftY + 4); doc.text("senerwaalex@gmail.com", 205 - 10, ftY, { align: 'right' }); doc.text("+254 717 384 875", 205 - 10, ftY + 4, { align: 'right' });
    return doc;
}

function generateTicketPDF(booking) {
    generatePdfContent(booking).then(doc => {
        doc.save(`PrinceAlex_Ticket_${booking.booking_ref ?? booking.id}.pdf`);
        console.log("PDF download initiated successfully for admin.");
    }).catch(error => {
        console.error("Error generating PDF for admin download:", error);
        showCustomAlert("Failed to generate ticket PDF for download. Please try again.", 'error');
    });
}

async function sendEmailWithWorker(payload) {
    const url = "https://payroll.princealexdigital.workers.dev/";
    try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const d = await r.json(); if (r.ok) return true; else { console.error("Worker failed:", d.error, d.details); return false; } }
    catch (e) { console.error("Network error:", e); return false; }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const busSearch = document.getElementById('busSearch');
    if (busSearch) {
        busSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = busCache.filter(b => (b.busName || "").toLowerCase().includes(term) || (b.busCode || "").toLowerCase().includes(term) || (b.origin || "").toLowerCase().includes(term) || (b.destination || "").toLowerCase().includes(term));
            renderBusTable(filtered);
        });
    }

    const openAddBusModalBtn = document.getElementById('openAddBusModalBtn');
    if (openAddBusModalBtn) openAddBusModalBtn.addEventListener('click', () => { const addBusModal = document.getElementById('addBusModal'); if (addBusModal) addBusModal.classList.remove('hidden'); });
    const addBusCancel = document.getElementById('addBusCancel');
    if (addBusCancel) addBusCancel.addEventListener('click', () => { const addBusModal = document.getElementById('addBusModal'); if (addBusModal) addBusModal.classList.add('hidden'); });

    const addBusForm = document.getElementById('addBusForm');
    if (addBusForm) {
        addBusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const busCode = 'BUS-' + Date.now().toString().slice(-6);
            const data = { busName: document.getElementById('busCompany').value.trim(), busCode: busCode, origin: document.getElementById('busFrom').value.trim(), destination: document.getElementById('busTo').value.trim(), travelDate: document.getElementById('busTravelDate').value, departureTime: document.getElementById('busTime').value.trim(), price: Number(document.getElementById('busPrice').value), totalSeats: Number(document.getElementById('busSeats').value), available_seats: Number(document.getElementById('busSeats').value), image: document.getElementById('busImage').value.trim(), createdAt: serverTimestamp() };
            if (!data.busName || !data.origin || !data.destination || !data.travelDate || !data.departureTime || isNaN(data.price) || data.price <= 0 || isNaN(data.totalSeats) || data.totalSeats <= 0) { showCustomAlert("Please fill all required fields correctly.", "error"); return; }
            showLoading();
            try { 
                await addDoc(busesCol, data); 
                e.target.reset(); 
                const addBusModal = document.getElementById('addBusModal'); 
                if (addBusModal) addBusModal.classList.add('hidden'); 
                showCustomAlert("New bus added successfully! 🚌", "success"); 
                populateRouteDropdowns();
                // Send new bus notification email to admin
                await sendEmailWithWorker({
                    to: ["senerwaalex@gmail.com"],
                    message: {
                        subject: "New Bus Added - Prince Alex Travel Admin 🚌",
                        text: `Dear Admin,\n\nA new bus has been added to the system.\n\nBus Details:\nBus Name: ${data.busName}\nBus Code: ${busCode}\nRoute: ${data.origin} to ${data.destination}\nTravel Date: ${data.travelDate}\nDeparture Time: ${data.departureTime}\nPrice: KES ${data.price.toLocaleString()}\nTotal Seats: ${data.totalSeats}\n\nThis action was performed by: ${currentAdmin?.email ?? "Unknown"}\n\nBest regards,\nPrince Alex Travel System`,
                        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>New Bus Added - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#10b981,#059669);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.bus-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="container"><div class="header"><h1>🚌 New Bus Added</h1><p>Prince Alex Travel - Admin Notification</p></div><div class="content"><h2>Dear Admin,</h2><p>A new bus has been added to the system. Please review the details below:</p><div class="bus-details"><h3 style="margin-top:0;color:#1e3a8a;">🚌 New Bus Details</h3><div class="detail-row"><span class="detail-label">Bus Name:</span><span class="detail-value">${data.busName}</span></div><div class="detail-row"><span class="detail-label">Bus Code:</span><span class="detail-value">${busCode}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${data.origin} to ${data.destination}</span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${data.travelDate}</span></div><div class="detail-row"><span class="detail-label">Departure Time:</span><span class="detail-value">${data.departureTime}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value">KES ${data.price.toLocaleString()}</span></div><div class="detail-row"><span class="detail-label">Total Seats:</span><span class="detail-value">${data.totalSeats}</span></div><div class="detail-row"><span class="detail-label">Added By:</span><span class="detail-value">${currentAdmin?.email ?? "Unknown"}</span></div></div><p><strong>✅ Action Complete:</strong></p><p>The bus is now available for booking in the system.</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`
                    },
                    createdAt: serverTimestamp()
                });
            } catch (err) { 
                showCustomAlert("Failed to add bus: " + getFriendlyErrorMessage(err), "error"); 
            } finally { 
                hideLoading(); 
            }
        });
    }

    const busTableBody = document.getElementById('busTableBody');
    if (busTableBody) {
        busTableBody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.dataset.action === 'del') {
                showCustomConfirm("Delete this bus? This action cannot be undone.", "delete", async (result) => {
                    if (result) { 
                        showLoading(); 
                        try { 
                            const busData = busCache.find(b => b.id === id);
                            await deleteDoc(doc(db, "buses", id)); 
                            showCustomAlert("Bus deleted successfully.", "success"); 
                            populateRouteDropdowns();
                            // Send bus deletion notification email to admin
                            if (busData) {
                                await sendEmailWithWorker({
                                    to: ["senerwaalex@gmail.com"],
                                    message: {
                                        subject: "Bus Deleted - Prince Alex Travel Admin 🚌",
                                        text: `Dear Admin,\n\nA bus has been deleted from the system.\n\nBus Details:\nBus Name: ${busData.busName ?? "N/A"}\nBus Code: ${busData.busCode ?? "N/A"}\nRoute: ${busData.origin ?? "N/A"} to ${busData.destination ?? "N/A"}\nTravel Date: ${busData.travelDate ?? "N/A"}\n\nThis action was performed by: ${currentAdmin?.email ?? "Unknown"}\n\nPlease review if this deletion was intentional.\n\nBest regards,\nPrince Alex Travel System`,
                                        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bus Deleted - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.bus-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="container"><div class="header"><h1>🚌 Bus Deleted</h1><p>Prince Alex Travel - Admin Notification</p></div><div class="content"><h2>Dear Admin,</h2><p>A bus has been deleted from the system. Please review the details below:</p><div class="bus-details"><h3 style="margin-top:0;color:#1e3a8a;">🚌 Deleted Bus Details</h3><div class="detail-row"><span class="detail-label">Bus Name:</span><span class="detail-value">${busData.busName ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Bus Code:</span><span class="detail-value">${busData.busCode ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${busData.origin ?? "N/A"} to ${busData.destination ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${busData.travelDate ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Departure Time:</span><span class="detail-value">${busData.departureTime ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value">KES ${busData.price ? Number(busData.price).toLocaleString() : "N/A"}</span></div><div class="detail-row"><span class="detail-label">Deleted By:</span><span class="detail-value">${currentAdmin?.email ?? "Unknown"}</span></div></div><p><strong>⚠️ Action Required:</strong></p><p>If this deletion was not intentional, please contact support immediately.</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`
                                    },
                                    createdAt: serverTimestamp()
                                });
                            }
                        } catch (err) { 
                            showCustomAlert("Delete failed: " + getFriendlyErrorMessage(err), "error"); 
                        } finally { 
                            hideLoading(); 
                        } 
                    }
                });
            } else if (btn.dataset.action === 'edit') {
                const s = await getDoc(doc(db, "buses", id));
                if (!s.exists()) return;
                const d = s.data();
                const editBusId = document.getElementById('editBusId');
                const editBusCompany = document.getElementById('editBusCompany');
                const editBusFrom = document.getElementById('editBusFrom');
                const editBusTo = document.getElementById('editBusTo');
                const editBusTravelDate = document.getElementById('editBusTravelDate');
                const editBusTime = document.getElementById('editBusTime');
                const editBusPrice = document.getElementById('editBusPrice');
                const editBusSeats = document.getElementById('editBusSeats');
                const editBusImage = document.getElementById('editBusImage');
                if (editBusId) editBusId.value = id;
                if (editBusCompany) editBusCompany.value = d.busName ?? "";
                if (editBusFrom) editBusFrom.value = d.origin ?? "";
                if (editBusTo) editBusTo.value = d.destination ?? "";
                if (editBusTravelDate) editBusTravelDate.value = d.travelDate ?? "";
                if (editBusTime) editBusTime.value = d.departureTime ?? "";
                if (editBusPrice) editBusPrice.value = d.price ?? "";
                if (editBusSeats) editBusSeats.value = d.totalSeats ?? "";
                if (editBusImage) editBusImage.value = d.image ?? "";
                const editBusModal = document.getElementById('editBusModal');
                if (editBusModal) editBusModal.classList.remove('hidden');
            }
        });
    }

    const editBusForm = document.getElementById('editBusForm');
    if (editBusForm) {
        editBusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editBusId').value;
            const updatedData = { busName: document.getElementById('editBusCompany').value.trim(), origin: document.getElementById('editBusFrom').value.trim(), destination: document.getElementById('editBusTo').value.trim(), travelDate: document.getElementById('editBusTravelDate').value, departureTime: document.getElementById('editBusTime').value.trim(), price: Number(document.getElementById('editBusPrice').value), totalSeats: Number(document.getElementById('editBusSeats').value), image: document.getElementById('editBusImage').value.trim() };
            if (!updatedData.busName || !updatedData.origin || !updatedData.destination || !updatedData.travelDate || !updatedData.departureTime || isNaN(updatedData.price) || updatedData.price <= 0 || isNaN(updatedData.totalSeats) || updatedData.totalSeats <= 0) { showCustomAlert("Please fill all required fields correctly.", "error"); return; }
            showLoading();
            try { 
                const oldBusDoc = await getDoc(doc(db, "buses", id));
                await updateDoc(doc(db, "buses", id), updatedData); 
                const editBusModal = document.getElementById('editBusModal'); 
                if (editBusModal) editBusModal.classList.add('hidden'); 
                showCustomAlert("Bus details updated successfully!", "success"); 
                populateRouteDropdowns();
                // Send bus edit notification email to admin
                const oldBusData = oldBusDoc.exists() ? oldBusDoc.data() : null;
                await sendEmailWithWorker({
                    to: ["senerwaalex@gmail.com"],
                    message: {
                        subject: "Bus Details Updated - Prince Alex Travel Admin 🚌",
                        text: `Dear Admin,\n\nBus details have been updated in the system.\n\n${oldBusData ? 'Previous Details:' : 'New Bus Details:'}\nBus Name: ${oldBusData?.busName ?? "N/A"} → ${updatedData.busName}\nBus Code: ${oldBusData?.busCode ?? "N/A"}\nRoute: ${oldBusData?.origin ?? "N/A"} to ${oldBusData?.destination ?? "N/A"} → ${updatedData.origin} to ${updatedData.destination}\nTravel Date: ${oldBusData?.travelDate ?? "N/A"} → ${updatedData.travelDate}\nDeparture Time: ${oldBusData?.departureTime ?? "N/A"} → ${updatedData.departureTime}\nPrice: KES ${oldBusData?.price ? Number(oldBusData.price).toLocaleString() : "N/A"} → KES ${updatedData.price.toLocaleString()}\nTotal Seats: ${oldBusData?.totalSeats ?? "N/A"} → ${updatedData.totalSeats}\n\nThis action was performed by: ${currentAdmin?.email ?? "Unknown"}\n\nBest regards,\nPrince Alex Travel System`,
                        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bus Updated - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#f59e0b,#fbbf24);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.bus-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.old-value{text-decoration:line-through;color:#ef4444;margin-right:8px}.new-value{color:#10b981;font-weight:600}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="container"><div class="header"><h1>🚌 Bus Details Updated</h1><p>Prince Alex Travel - Admin Notification</p></div><div class="content"><h2>Dear Admin,</h2><p>Bus details have been updated in the system. Please review the changes below:</p><div class="bus-details"><h3 style="margin-top:0;color:#1e3a8a;">🚌 Updated Bus Information</h3><div class="detail-row"><span class="detail-label">Bus Name:</span><span class="detail-value">${updatedData.busName}</span></div><div class="detail-row"><span class="detail-label">Bus Code:</span><span class="detail-value">${oldBusData?.busCode ?? "N/A"}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${updatedData.origin} to ${updatedData.destination}</span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${updatedData.travelDate}</span></div><div class="detail-row"><span class="detail-label">Departure Time:</span><span class="detail-value">${updatedData.departureTime}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value">KES ${updatedData.price.toLocaleString()}</span></div><div class="detail-row"><span class="detail-label">Total Seats:</span><span class="detail-value">${updatedData.totalSeats}</span></div><div class="detail-row"><span class="detail-label">Updated By:</span><span class="detail-value">${currentAdmin?.email ?? "Unknown"}</span></div></div><p><strong>⚠️ Note:</strong></p><p>If you did not make this change, please contact support immediately.</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`
                    },
                    createdAt: serverTimestamp()
                });
            } catch (err) { 
                showCustomAlert("Update failed: " + getFriendlyErrorMessage(err), "error"); 
            } finally { 
                hideLoading(); 
            }
        });
    }

    const editBusCancel = document.getElementById('editBusCancel');
    if (editBusCancel) editBusCancel.addEventListener('click', () => { const editBusModal = document.getElementById('editBusModal'); if (editBusModal) editBusModal.classList.add('hidden'); });

    const bookingSearch = document.getElementById('bookingSearch');
    if (bookingSearch) {
        bookingSearch.addEventListener('input', () => {
            const q = bookingSearch.value.trim().toLowerCase();
            if (!q) return renderBookingTable(bookingCache);
            const results = bookingCache.filter(b => (b.passenger_name ?? "").toLowerCase().includes(q) || (b.passenger_email ?? "").toLowerCase().includes(q) || (b.booking_ref ?? b.reference ?? b.ref ?? "").toLowerCase().includes(q));
            renderBookingTable(results);
        });
    }

    const bookingTableBody = document.getElementById('bookingTableBody');
    if (bookingTableBody) {
        bookingTableBody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            const item = bookingCache.find(x => x.id === id);
            if (!item) return;
            if (btn.dataset.action === 'del') {
                showCustomConfirm("Delete this booking? This action cannot be undone.", "delete", async (result) => {
                    if (result) { 
                        showLoading(); 
                        try { 
                            await deleteDoc(doc(db, "bookings", id)); 
                            if (item.bus_id && item.seat_number) { 
                                const busDocRef = doc(db, "buses", item.bus_id); 
                                try { 
                                    await updateDoc(busDocRef, { available_seats: increment(1) }); 
                                } catch (busErr) { 
                                    console.warn("Could not update bus seats:", busErr); 
                                } 
                            }
                            // Send cancellation email through worker
                            if (item.passenger_email) {
                                const cancellationHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking Cancelled - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.cancellation-notice{background:#fee2e2;padding:15px;border-radius:5px;border-left:4px solid #ef4444;margin:20px 0}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="container"><div class="header"><h1>❌ Booking Cancelled</h1><p>Prince Alex Travel - Booking Cancellation Notice</p></div><div class="content"><h2>Dear ${item.passenger_name ?? "Customer"},</h2><p>We regret to inform you that your booking has been cancelled by our admin team.</p><div class="cancellation-notice"><h4 style="margin-top:0;color:#dc2626;">⚠️ Cancellation Details</h4><p style="margin-bottom:0;color:#dc2626;">Your ticket is no longer valid. Please do not travel with this booking.</p></div><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Original Booking Details</h3><div class="detail-row"><span class="detail-label">Booking Reference:</span><span class="detail-value">${item.booking_ref ?? id}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${item.bus_route ?? "-"}</span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${item.travel_date ?? "-"}</span></div><div class="detail-row"><span class="detail-label">Seat:</span><span class="detail-value">${item.seat_number ?? "-"}</span></div></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
                                await sendEmailWithWorker({
                                    to: [item.passenger_email],
                                    message: {
                                        subject: "Booking Cancellation Notice - Prince Alex Travel ❌",
                                        text: `Dear ${item.passenger_name ?? "Customer"},\n\nWe regret to inform you that your booking has been cancelled by our admin team.\n\nOriginal Booking Details:\nBooking Reference: ${item.booking_ref ?? id}\nRoute: ${item.bus_route ?? "-"}\nTravel Date: ${item.travel_date ?? "-"}\nSeat: ${item.seat_number ?? "-"}\n\nYour ticket is no longer valid. Please do not travel with this booking.\n\nIf you have any questions or need assistance, please contact us:\n📧 Email: senerwaalex@gmail.com\n📞 Phone: +254 717 384 875\n\nBest regards,\nPrince Alex Travel Team`,
                                        html: cancellationHtml
                                    },
                                    createdAt: serverTimestamp()
                                });
                            }
                            showCustomAlert("Booking deleted successfully. Cancellation email sent.", "success"); 
                        } catch (err) { 
                            showCustomAlert("Delete failed: " + getFriendlyErrorMessage(err), "error"); 
                        } finally { 
                            hideLoading(); 
                        } 
                    }
                });
            } else if (btn.dataset.action === 'markpaid') {
                showLoading();
                try {
                    await updateDoc(doc(db, "bookings", id), { status: "paid", paidAt: serverTimestamp() });
                    showCustomAlert("Marked as PAID.", "success");
                    if (item.passenger_email) {
                        const updatedItem = { ...item, status: "paid" };
                        const pdfDoc = await generatePdfContent(updatedItem);
                        const pdfDataUri = pdfDoc.output("datauristring");
                        const pdfBase64 = pdfDataUri.split(",")[1];
                        const pdfBase64SizeBytes = new TextEncoder().encode(pdfBase64).length;
                        if (pdfBase64SizeBytes > MAX_PDF_BASE64_SIZE_BYTES) {
                            console.warn(`PDF for email is too large (${(pdfBase64SizeBytes / 1024).toFixed(2)} KB). Skipping email attachment.`);
                            showCustomAlert(`Marked as PAID. Note: Ticket PDF was too large for email attachment. Please download it locally.`, 'warning');
                            await addDoc(collection(db, "mail"), { to: [item.passenger_email], message: { subject: "Your Prince Alex Travel Booking Confirmation", text: `Dear ${item.passenger_name ?? "Customer"},\n\nThank you for booking a ticket with us!.\nYour ticket has been booked successfully. \n\nYour Ticket details:\nBooking Reference: ${item.booking_ref ?? id}\nRoute: ${item.bus_route ?? "-"}\nTravel Date: ${item.travel_date ?? "-"}\nDeparture Time: ${item.bus_time ?? "-"}\nSeat: ${item.seat_number ?? "-"}\nPrice: KES ${item.price ? Number(item.price).toLocaleString() : "-"}`, html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Confirmed - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="container"><div class="header"><h1>💳 Payment Confirmed!</h1><p>Prince Alex Travel - Payment Successfully Processed</p></div><div class="content"><h2>Dear ${item.passenger_name ?? "Customer"},</h2><p>Great news! Your payment has been successfully processed and your ticket is now confirmed!</p><p><strong>Your Ticket Details:</strong></p><ul><li><strong>Booking Reference:</strong> ${item.booking_ref ?? id}</li><li><strong>Route:</strong> ${item.bus_route ?? "-"}</li><li><strong>Travel Date:</strong> ${item.travel_date ?? "-"}</li><li><strong>Departure Time:</strong> ${item.bus_time ?? "-"}</li><li><strong>Seat:</strong> ${item.seat_number ?? "-"}</li><li><strong>Price:</strong> KES ${item.price ? Number(item.price).toLocaleString() : "-"}</li></ul><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>` }, createdAt: serverTimestamp() });
                        } else {
                            const paymentConfirmationHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Confirmed - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.ticket-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}.payment-success{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.attachment-notice{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.status-paid{background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold}</style></head><body><div class="container"><div class="header"><h1>💳 Payment Confirmed!</h1><p>Prince Alex Travel - Payment Successfully Processed</p></div><div class="content"><h2>Hello ${item.passenger_name ?? "Customer"}!</h2><p>Great news! Your payment has been successfully processed and your ticket is now confirmed!</p><div class="payment-success"><h4 style="margin-top:0;color:#065f46;">✅ Payment Successful</h4><p style="margin-bottom:0;color:#065f46;">Your booking is now fully confirmed and your e-ticket is ready!</p></div><div class="ticket-details"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Confirmed Ticket Details</h3><div class="detail-row"><span class="detail-label">Booking Reference:</span><span class="detail-value"><strong>${item.booking_ref ?? id}</strong></span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${item.bus_route ?? "-"}</span></div><div class="detail-row"><span class="detail-label">Seat Number:</span><span class="detail-value"><strong>${item.seat_number ?? "-"}</strong></span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${item.travel_date ?? "-"}</span></div><div class="detail-row"><span class="detail-label">Departure Time:</span><span class="detail-value">${item.bus_time ?? "-"}</span></div><div class="detail-row"><span class="detail-label">Price Paid:</span><span class="detail-value"><strong>KES ${item.price ? Number(item.price).toLocaleString() : "-"}</strong></span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-paid">PAID & CONFIRMED</span></span></div></div><div class="attachment-notice"><h4 style="margin-top:0;color:#065f46;">📎 E-Ticket Attached</h4><p style="margin-bottom:0;color:#065f46;">Your confirmed e-ticket PDF is attached to this email. You can download it and present it at the bus terminal.</p></div><div style="background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0;"><h4 style="margin-top:0;color:#92400e;">📱 Important Reminders</h4><ul style="margin-bottom:0;color:#92400e;"><li>Arrive at the terminal 15 minutes before departure</li><li>Present your e-ticket (digital or printed) to the driver</li><li>Keep your booking reference handy</li></ul></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
                            await addDoc(collection(db, "mail"), { to: [item.passenger_email], message: { subject: "Payment Confirmed - Your Ticket is Ready! 🎫", text: `Dear ${item.passenger_name ?? "Customer"},\n\nGreat news! Your payment has been successfully processed and your ticket is now confirmed!\n\nConfirmed Ticket Details:\nBooking Reference: ${item.booking_ref ?? id}\nRoute: ${item.bus_route ?? "-"}\nTravel Date: ${item.travel_date ?? "-"}\nDeparture Time: ${item.bus_time ?? "-"}\nSeat: ${item.seat_number ?? "-"}\nPrice Paid: KES ${item.price ? Number(item.price).toLocaleString() : "-"}\nStatus: PAID & CONFIRMED\n\nYour confirmed e-ticket PDF is attached to this email. You can download it and present it at the bus terminal.\n\nImportant Reminders:\n- Arrive at the terminal 15 minutes before departure\n- Present your e-ticket (digital or printed) to the driver\n- Keep your booking reference handy\n\nThank you for choosing Prince Alex Travel Services!\n\nBest regards,\nPrince Alex Travel Team`, html: paymentConfirmationHtml, attachments: [{ filename: `PrinceAlex_Ticket_${item.booking_ref ?? id}.pdf`, content: pdfBase64, encoding: "base64" }] }, createdAt: serverTimestamp() });
                            showCustomAlert("Marked as PAID. Confirmation email with ticket sent! 📧", "success");
                        }
                    }
                } catch (err) { showCustomAlert("Failed to mark paid or send email: " + getFriendlyErrorMessage(err), "error"); } finally { hideLoading(); }
            } else if (btn.dataset.action === 'ticket') {
                generateTicketPDF(item);
            }
        });
    }

    const adminBookingSearch = document.getElementById('adminBookingSearch');
    if (adminBookingSearch) {
        adminBookingSearch.addEventListener('submit', async (e) => {
            e.preventDefault();
            const origin = document.getElementById('abFrom').value.trim();
            const destination = document.getElementById('abTo').value.trim();
            const date = document.getElementById('abDate').value;
            if (!origin || !destination || !date) return showCustomAlert("Please select origin, destination, and travel date.", "warn");
            selectedDate = date;
            showLoading();
            const q1 = query(busesCol, where("origin", "==", origin), where("destination", "==", destination), where("travelDate", "==", date));
            const qs = await getDocs(q1);
            const list = document.getElementById('abResults');
            if (list) list.innerHTML = '';
            busResultsCache.clear();
            if (qs.empty) {
                if (list) list.innerHTML = '<p style="text-align:center; margin-top:20px;">No buses found for this route and date.</p>';
                updateBookingStep(1);
                hideLoading();
                return;
            }
            qs.forEach(s => {
                const d = s.data();
                const busId = s.id;
                busResultsCache.set(busId, { totalSeats: d.totalSeats ?? TOTAL_SEATS_DEFAULT, departureTime: d.departureTime ?? "-", price: d.price ?? 0, route: `${d.origin} to ${d.destination}`, name: d.busName ?? 'Bus', code: d.busCode ?? "-", availableSeats: d.available_seats ?? d.totalSeats ?? 0 });
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = `<div class="result-details"><h4>${d.busName ?? "Bus"} <span class="badge warn" style="font-size:0.7em">${d.busCode ?? "-"}</span></h4><p><strong>Route:</strong> ${d.origin} → ${d.destination}</p><p><strong>Travel Date:</strong> ${d.travelDate}</p><p><strong>Depart:</strong> ${d.departureTime ?? "-"}</p><p><strong>Price:</strong> KES ${d.price ? Number(d.price).toLocaleString() : "-"}</p><p><strong>Available Seats:</strong> ${d.available_seats ?? d.totalSeats ?? 0}</p><p><strong>Total Seats:</strong> ${d.totalSeats ?? TOTAL_SEATS_DEFAULT}</p><button class="btn" data-busid="${busId}">Proceed to Book</button></div>`;
                if (list) list.appendChild(card);
            });
            updateBookingStep(2);
            hideLoading();
        });
    }

    const abResults = document.getElementById('abResults');
    if (abResults) {
        abResults.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-busid]');
            if (!btn) return;
            const busId = btn.dataset.busid;
            const busData = busResultsCache.get(busId);
            if (!busData) return showCustomAlert("Could not find bus details. Please try searching again.", "error");
            selectedBusId = busId;
            selectedBusCode = busData.code;
            selectedTotalSeats = Number(busData.totalSeats || 0);
            selectedDepartureTime = busData.departureTime;
            selectedBusPrice = Number(busData.price);
            selectedBusRoute = busData.route;
            selectedBusName = busData.name;
            const availableSeats = Number(busData.availableSeats);
            const abPrice = document.getElementById('abPrice');
            if (abPrice) abPrice.value = selectedBusPrice.toFixed(2);
            const adminConfirmBookingBtn = document.getElementById('adminConfirmBooking button[type="submit"]');
            if (adminConfirmBookingBtn) adminConfirmBookingBtn.disabled = true;
            if (availableSeats <= 0) { showCustomAlert("Sorry, this bus is fully booked. Please choose another one.", "warn"); return; }
            updateBookingStep(3);
            await openSeatSelectionModal(selectedBusId, selectedDate, selectedTotalSeats, availableSeats);
        });
    }

    const seatCancel = document.getElementById('seatCancel');
    if (seatCancel) {
        seatCancel.addEventListener('click', () => {
            const seatModal = document.getElementById('seatModal');
            if (seatModal) seatModal.classList.add('hidden');
            if (seatSelectionUnsubscribe) { seatSelectionUnsubscribe(); seatSelectionUnsubscribe = null; }
            const abName = document.getElementById('abName'); if (abName) abName.value = '';
            const abEmail = document.getElementById('abEmail'); if (abEmail) abEmail.value = '';
            const abPhone = document.getElementById('abPhone'); if (abPhone) abPhone.value = '';
            const abID = document.getElementById('abID'); if (abID) abID.value = '';
            const abGender = document.getElementById('abGender'); if (abGender) abGender.value = '';
            const abPrice = document.getElementById('abPrice'); if (abPrice) abPrice.value = '';
            const selectedSeatNumberAdmin = document.getElementById('selectedSeatNumberAdmin'); if (selectedSeatNumberAdmin) selectedSeatNumberAdmin.value = '';
            const displayedSeatNumber = document.getElementById('displayedSeatNumber'); if (displayedSeatNumber) displayedSeatNumber.value = '';
            selectedBusId = null; selectedBusCode = null; selectedDate = null; selectedDepartureTime = null; selectedBusPrice = null; selectedBusRoute = null; selectedBusName = null; selectedTotalSeats = null; selectedSeatNumber = null;
            const adminConfirmBookingBtn = document.getElementById('adminConfirmBooking button[type="submit"]');
            if (adminConfirmBookingBtn) adminConfirmBookingBtn.disabled = true;
            const passengerDetailsCard = document.getElementById('passengerDetailsCard');
            if (passengerDetailsCard) passengerDetailsCard.classList.add('hidden');
            updateBookingStep(2);
        });
    }

    const adminConfirmBooking = document.getElementById('adminConfirmBooking');
    if (adminConfirmBooking) {
        adminConfirmBooking.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!selectedBusId || !selectedDate) return showCustomAlert("Please search and select a bus first.", "warn");
            if (!selectedSeatNumber) return showCustomAlert("Please select a seat.", "warn");
            const passenger_name = document.getElementById('abName').value.trim();
            const passenger_email = document.getElementById('abEmail').value.trim();
            const passenger_phone = document.getElementById('abPhone').value.trim();
            const passenger_id = document.getElementById('abID').value.trim();
            const passenger_gender = document.getElementById('abGender').value;
            if (!passenger_name || !passenger_phone || !passenger_email || !passenger_id || !passenger_gender) return showCustomAlert("Please fill all passenger details.", "error");
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(passenger_email)) return showCustomAlert("Please enter a valid email address.", "error");
            const phoneRegex = /^\+?[0-9\s-]{7,20}$/;
            if (!phoneRegex.test(passenger_phone)) return showCustomAlert("Please enter a valid Phone Number (e.g., +254712345678 or 0712345678).", "error");
            const booking_ref = 'PA-' + Date.now().toString().slice(-6) + '-' + String(selectedSeatNumber).padStart(2, '0');
            showLoading();
            try {
                const existingBookingsQ = query(collection(db, "bookings"), where("bus_id", "==", selectedBusId), where("travel_date", "==", selectedDate), where("seat_number", "==", `S${selectedSeatNumber}`), where("status", "in", ['pending', 'paid']));
                const existingBookingsSnapshot = await getDocs(existingBookingsQ);
                if (!existingBookingsSnapshot.empty) { showCustomAlert(`Seat S${selectedSeatNumber} has just been booked. Please choose another seat.`, "warn"); const busDoc = await getDoc(doc(db, "buses", selectedBusId)); if (busDoc.exists()) await openSeatSelectionModal(selectedBusId, selectedDate, busDoc.data().totalSeats, busDoc.data().available_seats); return; }
                const bookingData = { booking_ref, passenger_name, passenger_id, passenger_gender, passenger_phone, passenger_email, bus_id: selectedBusId, bus_code: selectedBusCode, bus_name: selectedBusName, bus_route: selectedBusRoute, bus_time: selectedDepartureTime, travel_date: selectedDate, seat_number: `S${selectedSeatNumber}`, price: selectedBusPrice, status: 'paid', booking_date: new Date().toISOString(), user_id: currentAdmin?.uid ?? null, createdAt: serverTimestamp() };
                const newBookingDocRef = await addDoc(bookingsCol, bookingData);
                const busDocRef = doc(db, "buses", selectedBusId);
                await updateDoc(busDocRef, { available_seats: increment(-1) });
                if (passenger_email) {
                    try {
                        const pdfBookingData = { ...bookingData, status: "paid" };
                        const pdfDoc = await generatePdfContent(pdfBookingData);
                        const pdfDataUri = pdfDoc.output("datauristring");
                        const pdfBase64 = pdfDataUri.split(",")[1];
                        const pdfBase64SizeBytes = new TextEncoder().encode(pdfBase64).length;
                        let mailPayload;
                        const professionalEmailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ticket Confirmation - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.ticket-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}.attachment-notice{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.status-paid{background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold}.no-attachment-notice{background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0}</style></head><body><div class="container"><div class="header"><h1>🎫 Ticket Confirmed!</h1><p>Prince Alex Travel - Admin Booking Confirmation</p></div><div class="content"><h2>Hello ${passenger_name}!</h2><p>Thank you for choosing <strong>Prince Alex Travel Services</strong>. Your ticket has been successfully booked and confirmed by our admin team!</p><div class="ticket-details"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Ticket Information</h3><div class="detail-row"><span class="detail-label">Booking Reference:</span><span class="detail-value"><strong>${booking_ref}</strong></span></div><div class="detail-row"><span class="detail-label">Bus Name:</span><span class="detail-value">${selectedBusName}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${selectedBusRoute}</span></div><div class="detail-row"><span class="detail-label">Seat Number:</span><span class="detail-value"><strong>S${selectedSeatNumber}</strong></span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${selectedDate}</span></div><div class="detail-row"><span class="detail-label">Departure Time:</span><span class="detail-value">${selectedDepartureTime}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value"><strong>KES ${selectedBusPrice.toFixed(2)}</strong></span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-paid">PAID & CONFIRMED</span></span></div></div><div style="background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0;"><h4 style="margin-top:0;color:#92400e;">📱 Important Reminders</h4><ul style="margin-bottom:0;color:#92400e;"><li>Arrive at the terminal 15 minutes before departure</li><li>Present your ticket (digital or printed) to the driver</li><li>Keep your booking reference handy</li></ul></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
                        const attachmentNoticeHtml = `<div class="attachment-notice"><h4 style="margin-top:0;color:#065f46;">📎 E-Ticket Attached</h4><p style="margin-bottom:0;color:#065f46;">Your e-ticket PDF is attached to this email. You can download it and present it at the bus terminal.</p></div>`;
                        const noAttachmentNoticeHtml = `<div class="no-attachment-notice"><h4 style="margin-top:0;color:#92400e;">📄 Ticket Available</h4><p style="margin-bottom:0;color:#92400e;">Your ticket has been confirmed. Please contact us if you need a copy of your ticket.</p></div>`;
                        if (pdfBase64SizeBytes > MAX_PDF_BASE64_SIZE_BYTES) {
                            console.warn(`PDF for email is too large (${(pdfBase64SizeBytes / 1024).toFixed(2)} KB). Skipping email attachment.`);
                            showCustomAlert(`Booking created & marked PAID. Note: Ticket PDF was too large for email attachment. Confirmation email sent without attachment.`, 'warning');
                            mailPayload = { to: [passenger_email], message: { subject: "Your Ticket Confirmation - Prince Alex Travel 🎫", text: `Dear ${passenger_name},\n\nThank you for booking a ticket with Prince Alex Travel Services!\nYour ticket has been successfully booked and confirmed.\n\nTicket Details:\nBooking Reference: ${booking_ref}\nBus Name: ${selectedBusName}\nRoute: ${selectedBusRoute}\nTravel Date: ${selectedDate}\nDeparture Time: ${selectedDepartureTime}\nSeat: S${selectedSeatNumber}\nPrice: KES ${selectedBusPrice.toFixed(2)}\nStatus: PAID & CONFIRMED\n\nThank you for choosing Prince Alex Travel Services.\n\nBest regards,\nPrince Alex Travel Team`, html: professionalEmailHtml + noAttachmentNoticeHtml }, createdAt: serverTimestamp() };
                        } else {
                            mailPayload = { to: [passenger_email], message: { subject: "Your Ticket Confirmation - Prince Alex Travel 🎫", text: `Dear ${passenger_name},\n\nThank you for booking a ticket with Prince Alex Travel Services!\nYour ticket has been successfully booked and confirmed.\n\nTicket Details:\nBooking Reference: ${booking_ref}\nBus Name: ${selectedBusName}\nRoute: ${selectedBusRoute}\nTravel Date: ${selectedDate}\nDeparture Time: ${selectedDepartureTime}\nSeat: S${selectedSeatNumber}\nPrice: KES ${selectedBusPrice.toFixed(2)}\nStatus: PAID & CONFIRMED\n\nPlease find your e-Ticket attached as a PDF file.\n\nThank you for choosing Prince Alex Travel Services.\n\nBest regards,\nPrince Alex Travel Team`, html: professionalEmailHtml + attachmentNoticeHtml, attachments: [{ filename: `PrinceAlex_Ticket_${booking_ref}.pdf`, content: pdfBase64, encoding: "base64" }] }, createdAt: serverTimestamp() };
                            showCustomAlert("Booking created & marked PAID. Confirmation email with ticket sent! 🎫", "success");
                        }
                        await addDoc(collection(db, "mail"), mailPayload);
                        console.log("Admin-initiated booking confirmation email queued successfully in mail collection.");
                    } catch (pdfError) {
                        console.error("Error generating PDF or queuing email:", pdfError);
                        showCustomAlert("Booking created & marked PAID. Failed to generate ticket PDF or send email.", "error");
                    }
                } else {
                    showCustomAlert("Booking created & marked PAID. No email sent as passenger email is missing.", "info");
                }
                const seatModal = document.getElementById('seatModal');
                if (seatModal) seatModal.classList.add('hidden');
                e.target.reset();
                const adminConfirmBookingBtn2 = document.getElementById('adminConfirmBooking button[type="submit"]');
                if (adminConfirmBookingBtn2) adminConfirmBookingBtn2.disabled = true;
                const passengerDetailsCard2 = document.getElementById('passengerDetailsCard');
                if (passengerDetailsCard2) passengerDetailsCard2.classList.add('hidden');
                selectedBusId = null; selectedBusCode = null; selectedDate = null; selectedDepartureTime = null; selectedBusPrice = null; selectedBusRoute = null; selectedBusName = null; selectedTotalSeats = null; selectedSeatNumber = null;
                const adminBookingSearchForm = document.getElementById('adminBookingSearch');
                if (adminBookingSearchForm) adminBookingSearchForm.reset();
                const abResults2 = document.getElementById('abResults');
                if (abResults2) abResults2.innerHTML = '';
                updateBookingStep(1);
                const adminPdfData = { ...bookingData, status: "paid" };
                generateTicketPDF(adminPdfData);
                if (seatSelectionUnsubscribe) { seatSelectionUnsubscribe(); seatSelectionUnsubscribe = null; }
                attachRealtimeBookings();
            } catch (err) { showCustomAlert("Booking failed: " + getFriendlyErrorMessage(err), "error"); } finally { hideLoading(); }
        });
    }

    const btnSearchManifest = document.getElementById('btnSearchManifest');
    if (btnSearchManifest) {
        btnSearchManifest.addEventListener('click', async () => {
            const code = document.getElementById('manifestBusCode').value.trim();
            if (!code) return showCustomAlert("Please enter a Bus Code", "warn");
            showLoading();
            try {
                const qBus = query(collection(db, "buses"), where("busCode", "==", code));
                const busSnap = await getDocs(qBus);
                if (busSnap.empty) return showCustomAlert("No bus found with this code.", "error");
                const busDoc = busSnap.docs[0];
                currentManifestBus = { id: busDoc.id, ...busDoc.data() };
                const qBookings = query(collection(db, "bookings"), where("bus_id", "==", busDoc.id));
                const bookSnap = await getDocs(qBookings);
                currentManifestBookings = [];
                bookSnap.forEach(b => currentManifestBookings.push(b.data()));
                renderManifestUI();
            } finally { hideLoading(); }
        });
    }

    const btnDownloadManifestPDF = document.getElementById('btnDownloadManifestPDF');
    if (btnDownloadManifestPDF) {
        btnDownloadManifestPDF.addEventListener('click', () => {
            if (!currentManifestBus) return;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text("Bus Manifest", 14, 20);
            doc.setFontSize(12);
            doc.text(`Bus: ${currentManifestBus.busName} (${currentManifestBus.busCode})`, 14, 30);
            doc.text(`Route: ${currentManifestBus.origin} to ${currentManifestBus.destination}`, 14, 36);
            doc.text(`Date: ${currentManifestBus.travelDate} ${currentManifestBus.departureTime}`, 14, 42);
            const headers = [["Seat", "Name", "Phone", "ID", "Gender", "Ref", "Status"]];
            const data = currentManifestBookings.filter(b => ['paid', 'pending'].includes((b.status || '').toLowerCase())).sort((a, b) => parseInt((a.seat_number || "0").replace(/\D/g, '')) - parseInt((b.seat_number || "0").replace(/\D/g, ''))).map(b => [b.seat_number, b.passenger_name, b.passenger_phone, b.passenger_id || '-', b.passenger_gender || '-', b.booking_ref, b.status]);
            doc.autoTable({ head: headers, body: data, startY: 50 });
            doc.save(`Manifest_${currentManifestBus.busCode}.pdf`);
        });
    }
});

function renderManifestUI() {
    const manifestResults = document.getElementById('manifestResults');
    if (manifestResults) manifestResults.classList.remove('hidden');
    const manBusName = document.getElementById('manBusName');
    const manBusRoute = document.getElementById('manBusRoute');
    const manBusDate = document.getElementById('manBusDate');
    if (manBusName) manBusName.textContent = `${currentManifestBus.busName} (${currentManifestBus.busCode})`;
    if (manBusRoute) manBusRoute.textContent = `${currentManifestBus.origin} → ${currentManifestBus.destination}`;
    if (manBusDate) manBusDate.textContent = `${currentManifestBus.travelDate} @ ${currentManifestBus.departureTime}`;
    const total = Number(currentManifestBus.totalSeats || 0);
    const validBookings = currentManifestBookings.filter(b => ['paid', 'pending'].includes((b.status || '').toLowerCase()));
    const booked = validBookings.length;
    const avail = total - booked;
    const revenue = validBookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
    const manTotalSeats = document.getElementById('manTotalSeats');
    const manBookedSeats = document.getElementById('manBookedSeats');
    const manAvailSeats = document.getElementById('manAvailSeats');
    const manRevenue = document.getElementById('manRevenue');
    if (manTotalSeats) manTotalSeats.textContent = total;
    if (manBookedSeats) manBookedSeats.textContent = booked;
    if (manAvailSeats) manAvailSeats.textContent = avail;
    if (manRevenue) manRevenue.textContent = `KES ${revenue.toLocaleString()}`;
    const tbody = document.getElementById('manifestTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    validBookings.sort((a, b) => { const sA = parseInt((a.seat_number || "0").replace(/\D/g, '')); const sB = parseInt((b.seat_number || "0").replace(/\D/g, '')); return sA - sB; });
    if (validBookings.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No passengers found.</td></tr>'; } else { validBookings.forEach(b => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${b.seat_number || '-'}</td><td>${b.passenger_name || '-'}</td><td>${b.passenger_phone || '-'}</td><td>${b.passenger_gender || '-'}</td><td>${b.booking_ref || '-'}</td><td><span class="badge ${b.status === 'paid' ? 'success' : 'warn'}">${b.status}</span></td>`; tbody.appendChild(tr); }); }
}
