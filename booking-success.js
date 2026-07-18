// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let currentBookingData = null;
const MAX_PDF_BASE64_SIZE_BYTES = 800 * 1024;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthLinks();
    const logoutBtn = document.getElementById('logoutLink');
    if (logoutBtn && !logoutBtn.dataset.listener) {
        logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await logout(); });
        logoutBtn.dataset.listener = 'true';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingRef = urlParams.get('bookingRef');

    if (!bookingRef) {
        document.getElementById('bookingDetails').innerHTML = `<p class="error-message">No booking reference provided.</p>`;
        document.getElementById('downloadTicketBtn').classList.add('hidden');
        document.getElementById('sendEmailBtn').classList.add('hidden');
        return;
    }

    try {
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("booking_ref", "==", bookingRef));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            document.getElementById('bookingDetails').innerHTML = `<p class="error-message">Booking "${bookingRef}" not found.</p>`;
            document.getElementById('downloadTicketBtn').classList.add('hidden');
            document.getElementById('sendEmailBtn').classList.add('hidden');
            showCustomAlert(`Booking "${bookingRef}" not found.`, 'error');
            return;
        }

        const bookingDoc = querySnapshot.docs[0];
        currentBookingData = { id: bookingDoc.id, ...bookingDoc.data() };

        document.getElementById('passengerName').textContent = currentBookingData.passenger_name || 'N/A';
        document.getElementById('busRoute').textContent = currentBookingData.bus_route || 'N/A';
        document.getElementById('travelDate').textContent = currentBookingData.travel_date || 'N/A';
        document.getElementById('seatNumber').textContent = currentBookingData.seat_number || 'N/A';
        document.getElementById('status').textContent = (currentBookingData.status || 'N/A').toUpperCase();
        document.getElementById('bookingRef').textContent = currentBookingData.booking_ref || 'N/A';
        document.getElementById('price').textContent = `KES ${Number(currentBookingData.price || 0).toLocaleString()}`;

        const paymentStatusElement = document.getElementById('status');
        const successMsgElement = document.querySelector('.success-subtitle'); // Corrected selector
        const status = (currentBookingData.status || 'pending').toLowerCase().trim();
        console.log('Booking status:', status, '| Raw status:', currentBookingData.status);
        if (paymentStatusElement) paymentStatusElement.textContent = status.toUpperCase();

        console.log('Checking status condition...');
        if (status === 'paid') {
            console.log('Status is PAID - hiding payment section');
            if (paymentStatusElement) paymentStatusElement.classList.add('status-paid');
            const paymentSection = document.getElementById('paymentSection');
            console.log('Payment section element:', paymentSection);
            if (paymentSection) {
                paymentSection.classList.add('hidden');
                console.log('Added hidden class to payment section');
            }
            updateSuccessStep(6);
            if (successMsgElement) successMsgElement.textContent = "Your booking is confirmed! Your e-ticket has been sent to your email."; // This will now run correctly
            const qrCodeSection = document.getElementById('qrCodeSection');
            if (qrCodeSection) qrCodeSection.classList.remove('hidden');
            const downloadTicketBtn = document.getElementById('downloadTicketBtn');
            if (downloadTicketBtn) downloadTicketBtn.classList.remove('hidden');
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            if (sendEmailBtn) sendEmailBtn.classList.remove('hidden');
            generateQRCode(currentBookingData.booking_ref);
            const confirmMsg = document.createElement('p');
            confirmMsg.classList.add('email-confirmation-message');
            confirmMsg.innerHTML = `✅ Confirmation sent to <strong>${currentBookingData.passenger_email || 'your email'}</strong>`;
            const bookingDetails = document.getElementById('bookingDetails');
            if (bookingDetails) bookingDetails.after(confirmMsg);
        } else if (status === 'pending') {
            if (paymentStatusElement) paymentStatusElement.classList.add('status-pending');
            updateSuccessStep(5);
            if (successMsgElement) {
                successMsgElement.innerHTML = `Your booking is reserved!<br><span style="font-size:0.95rem;font-weight:500;color:var(--warning);">Please complete payment to confirm your ticket.</span>`;
            }
            const paymentSection = document.getElementById('paymentSection');
            if (paymentSection) paymentSection.classList.remove('hidden');
            const receiptRow = document.getElementById('receiptNo');
            if (receiptRow && receiptRow.parentElement) receiptRow.parentElement.classList.add('hidden');
            const amountToPay = document.getElementById('amountToPay');
            if (amountToPay) amountToPay.textContent = `Amount to Pay: KES ${Number(currentBookingData.price || 0).toLocaleString()}`;
            const downloadTicketBtn = document.getElementById('downloadTicketBtn');
            if (downloadTicketBtn) downloadTicketBtn.classList.add('hidden');
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            if (sendEmailBtn) sendEmailBtn.classList.add('hidden');
        } else {
            // For any other status (cancelled, etc.), hide payment section
            if (paymentStatusElement) paymentStatusElement.classList.add('status-' + status);
            updateSuccessStep(5);
            if (successMsgElement) {
                successMsgElement.innerHTML = `Your booking status: <strong>${status.toUpperCase()}</strong>`;
            }
            const paymentSection = document.getElementById('paymentSection');
            if (paymentSection) paymentSection.classList.add('hidden');
            const downloadTicketBtn = document.getElementById('downloadTicketBtn');
            if (downloadTicketBtn) downloadTicketBtn.classList.add('hidden');
            const sendEmailBtn = document.getElementById('sendEmailBtn');
            if (sendEmailBtn) sendEmailBtn.classList.add('hidden');
        }

        document.getElementById('downloadTicketBtn').addEventListener('click', () => {
            if (currentBookingData) generateTicketPDF(currentBookingData);
            else showCustomAlert("Booking data not available.", 'error');
        });
        document.getElementById('sendEmailBtn').addEventListener('click', () => {
            if (currentBookingData) sendTicketToEmail(currentBookingData);
            else showCustomAlert("Booking data not available.", 'error');
        });
        const payBtn = document.getElementById('payNowBtn');
        if (payBtn) payBtn.addEventListener('click', payWithPaystack);

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('bookingDetails').innerHTML = `<p class="error-message">Error loading booking details.</p>`;
        document.getElementById('downloadTicketBtn').classList.add('hidden');
        document.getElementById('sendEmailBtn').classList.add('hidden');
        showCustomAlert("Error loading booking details.", 'error');
    }

    // Hamburger menu
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

function updateSuccessStep(step) {
    document.querySelectorAll('.step-item').forEach(item => {
        const s = parseInt(item.dataset.step);
        item.classList.toggle('active', s === step);
        item.classList.toggle('completed', s < step);
    });
}

function payWithPaystack() {
    if (!currentBookingData) { showCustomAlert("Booking data missing.", 'error'); return; }
    const handler = PaystackPop.setup({
        key: 'pk_live_534321af1df8706853f3f560a599307c289c56df',
        email: currentBookingData.passenger_email,
        phone: currentBookingData.passenger_phone,
        amount: Math.round(currentBookingData.price * 100),
        currency: 'KES',
        callback: function(response) { handlePaymentSuccess(response); },
        onClose: function() { showCustomAlert("Transaction cancelled.", 'warning'); }
    });
    handler.openIframe();
}

async function handlePaymentSuccess(response) {
    showCustomAlert("Payment Successful! Reference: " + response.reference, 'success');
    try {
        const bookingRefDoc = doc(db, "bookings", currentBookingData.id);
        await updateDoc(bookingRefDoc, {
            status: 'paid', paystack_ref: response.reference, receipt_number: response.reference,
            amount_paid: currentBookingData.price, payment_method: 'Paystack', paid_at: serverTimestamp()
        });
        const updatedData = { ...currentBookingData, status: 'paid', paystack_ref: response.reference, receipt_number: response.reference };
        const pdfDoc = await generateTicketPDF(updatedData, true);
        const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Confirmed - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.ticket-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}.payment-success{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.attachment-notice{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.status-paid{background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold}</style></head><body><div class="container"><div class="header"><h1>💳 Payment Confirmed!</h1><p>Prince Alex Travel - Payment Successfully Processed</p></div><div class="content"><h2>Hello ${updatedData.passenger_name}!</h2><p>Great news! Your payment has been successfully processed and your ticket is now confirmed!</p><div class="payment-success"><h4 style="margin-top:0;color:#065f46;">✅ Payment Successful</h4><p style="margin-bottom:0;color:#065f46;">Your booking is now fully confirmed and your e-ticket is ready!</p></div><div class="ticket-details"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Payment Receipt & Travel Summary</h3><div class="detail-row"><span class="detail-label">Booking Ref:</span><span class="detail-value"><strong>${updatedData.booking_ref}</strong></span></div><div class="detail-row"><span class="detail-label">Receipt No:</span><span class="detail-value">${updatedData.receipt_number}</span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${updatedData.bus_route}</span></div><div class="detail-row"><span class="detail-label">Date & Time:</span><span class="detail-value">${updatedData.travel_date} @ ${updatedData.bus_time}</span></div><div class="detail-row"><span class="detail-label">Seat:</span><span class="detail-value"><strong style="color:#f59e0b;">${updatedData.seat_number}</strong></span></div><div class="detail-row"><span class="detail-label">Amount Paid:</span><span class="detail-value"><strong>KES ${Number(updatedData.price).toLocaleString()}</strong></span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-paid">PAID & CONFIRMED</span></span></div></div><div class="attachment-notice"><h4 style="margin-top:0;color:#065f46;">📎 E-Ticket Attached</h4><p style="margin-bottom:0;color:#065f46;">Your confirmed e-ticket PDF is attached. Present it at boarding.</p></div><div style="background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0;"><h4 style="margin-top:0;color:#92400e;">📱 Important Reminders</h4><ul style="margin-bottom:0;color:#92400e;"><li>Arrive at the terminal 15 minutes before departure</li><li>Present your e-ticket (digital or printed) to the driver</li><li>Keep your booking reference handy</li></ul></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
        await sendEmailWithWorker({ toEmail: updatedData.passenger_email, toName: updatedData.passenger_name, subject: `Confirmed: Ticket for ${updatedData.bus_route} 🎫`, htmlContent: emailHtml, attachments: [{ filename: `Ticket_${updatedData.booking_ref}.pdf`, content: pdfBase64, encoding: "base64" }] });
        setTimeout(() => location.reload(), 1500);
    } catch (error) { console.error("Error updating booking:", error); }
}

async function sendTicketToEmail(booking) {
    if (!booking) { showCustomAlert("No ticket details available.", 'error'); return; }
    if (booking.status !== 'paid') { showCustomAlert('Ticket can only be sent after payment.', 'warning'); return; }
    const passengerEmail = booking.passenger_email;
    const bookingId = booking.booking_ref;
    const passengerName = booking.passenger_name || 'Valued Customer';
    if (!passengerEmail || !isValidEmail(passengerEmail)) { showCustomAlert("Invalid email.", 'error'); return; }
    showCustomAlert("Preparing and sending your ticket...", 'info');
    try {
        const pdfDoc = await generateTicketPDF(booking, true);
        const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];
        const size = new TextEncoder().encode(pdfBase64).length;
        if (size > MAX_PDF_BASE64_SIZE_BYTES) { showCustomAlert(`PDF too large (${(size/1024).toFixed(2)} KB).`, 'error'); return; }
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E-Ticket - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.ticket-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}.attachment-notice{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.status-paid{background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold}</style></head><body><div class="container"><div class="header"><h1>🎫 Your E-Ticket is Ready!</h1><p>Prince Alex Travel - Digital Ticket Delivery</p></div><div class="content"><h2>Hello ${passengerName}!</h2><p>Thank you for choosing <strong>Prince Alex Travel Services</strong>. Your e-ticket is ready and attached!</p><div class="ticket-details"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Ticket Information</h3><div class="detail-row"><span class="detail-label">Booking Reference:</span><span class="detail-value"><strong>${bookingId}</strong></span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${booking.bus_route}</span></div><div class="detail-row"><span class="detail-label">Seat:</span><span class="detail-value"><strong>${booking.seat_number}</strong></span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${booking.travel_date}</span></div><div class="detail-row"><span class="detail-label">Departure:</span><span class="detail-value">${booking.bus_time}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value"><strong>Ksh ${booking.price.toLocaleString()}</strong></span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-paid">PAID</span></span></div></div><div class="attachment-notice"><h4 style="margin-top:0;color:#065f46;">📎 E-Ticket Attached</h4><p style="margin-bottom:0;color:#065f46;">Your e-ticket PDF is attached. Present it at boarding.</p></div><div style="background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0;"><h4 style="margin-top:0;color:#92400e;">📱 Important Reminders</h4><ul style="margin-bottom:0;color:#92400e;"><li>Arrive at the terminal 15 minutes before departure</li><li>Present your e-ticket (digital or printed) to the driver</li><li>Keep your booking reference handy</li></ul></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
        const sent = await sendEmailWithWorker({ toEmail: passengerEmail, toName: passengerName, subject: "Your E-Ticket - Prince Alex Travel 🎫", htmlContent: emailHtml, attachments: [{ filename: `Ticket_${bookingId}.pdf`, content: pdfBase64, encoding: "base64" }] });
        if(sent) showCustomAlert("Ticket sent to your email!", 'success');
        else showCustomAlert("Failed to send ticket.", 'error');
    } catch (error) { console.error("Error:", error); showCustomAlert("Failed to send ticket.", 'error'); }
}

async function sendEmailWithWorker(payload) {
    const url = "https://payroll.princealexdigital.workers.dev/";
    try { const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); const d=await r.json(); if(r.ok) return true; else {console.error("Worker failed:",d.error,d.details); return false;} }
    catch(e){console.error("Network error:",e); return false;}
}

function showCustomAlert(message, type='info') {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10001;';
    const bg = type === 'error' ? '#dc3545' : type === 'success' ? '#10b981' : '#0f172a';
    modal.innerHTML = `<div style="background:${bg};color:white;padding:25px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);"><p style="margin-bottom:20px;font-size:1.1em;">${message}</p><button style="background:white;color:${bg};padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:600;" onclick="this.parentNode.parentNode.remove()">OK</button></div>`;
    document.body.appendChild(modal);
}

function isValidEmail(email) { return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(String(email).toLowerCase()); }

function generateQRCode(data) {
    const qrcodeDiv = document.getElementById('qrcode');
    qrcodeDiv.innerHTML = '';
    if (data && typeof window.QRCode !== 'undefined') {
        new window.QRCode(qrcodeDiv, { text: data, width: 128, height: 128, colorDark: "#000000", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.H });
    }
}

async function generateTicketPDF(booking, forEmail = false) {
    const { jsPDF } = window.jspdf;
    const newDoc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
    const primaryColor = '#0f172a', accentColor = '#f59e0b', darkTextColor = '#1f2937', lightTextColor = '#6b7280', whiteColor = '#ffffff', lightBgColor = '#f8fafc';
    const status = (booking.status ?? "pending").toUpperCase();
    const statusColor = status === 'PAID' ? '#10b981' : '#f59e0b';
    newDoc.setFillColor(whiteColor); newDoc.setDrawColor(primaryColor); newDoc.setLineWidth(0.5); newDoc.roundedRect(5, 5, 200, 138, 5, 5, 'FD');
    newDoc.setFillColor(primaryColor); newDoc.roundedRect(5, 5, 200, 30, 5, 5, 'F');
    newDoc.setFillColor(whiteColor); newDoc.circle(20, 20, 8, 'F'); newDoc.setTextColor(primaryColor); newDoc.setFontSize(10); newDoc.setFont("helvetica","bold"); newDoc.text("PA",18,22);
    newDoc.setTextColor(whiteColor); newDoc.setFontSize(22); newDoc.setFont("helvetica","bold"); newDoc.text("Prince Alex Travel",35,18); newDoc.setFontSize(12); newDoc.setFont("helvetica","normal"); newDoc.text("BOARDING PASS",35,26);
    const bw=35,bx=205-bw-10; newDoc.setFillColor(statusColor); newDoc.roundedRect(bx,15,bw,10,3,3,'F'); newDoc.setFontSize(10); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(whiteColor); newDoc.text(status,bx+(bw/2),21.5,{align:'center'});
    const mY=40,sX=145; newDoc.setLineDashPattern([2,2],0); newDoc.setDrawColor(lightTextColor); newDoc.line(sX,mY-2,sX,130); newDoc.setLineDashPattern([],0);
    let y=mY+8; const lm=15,lcw=sX-lm-5;
    newDoc.setFontSize(10); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("PASSENGER NAME",lm,y); y+=8;
    newDoc.setFontSize(18); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(darkTextColor); newDoc.text(booking.passenger_name??"-",lm,y,{maxWidth:lcw}); y+=12;
    const [origin,dest]=(booking.bus_route??'- to -').split(' to ');
    newDoc.setFontSize(10); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("FROM",lm,y); newDoc.text("TO",lm+60,y); y+=10;
    newDoc.setFontSize(24); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(primaryColor); newDoc.text(origin.trim(),lm,y,{maxWidth:40}); newDoc.text("→",lm+45,y); newDoc.text(dest.trim(),lm+60,y,{maxWidth:65}); y+=12;
    const dY=y;
    [{label:"TRAVEL DATE",value:booking.travel_date??"-"},{label:"DEPARTURE",value:booking.bus_time??"-"},{label:"SEAT",value:booking.seat_number??"-"}].forEach((item,i)=>{const x=lm+(i*45);newDoc.setFontSize(10);newDoc.setFont("helvetica","normal");newDoc.setTextColor(lightTextColor);newDoc.text(item.label,x,dY);newDoc.setFontSize(16);newDoc.setFont("helvetica","bold");newDoc.setTextColor(darkTextColor);newDoc.text(item.value,x,dY+8,{maxWidth:40});});
    y+=20;
    newDoc.setFillColor(lightBgColor); newDoc.roundedRect(lm-5,y,lcw+5,20,3,3,'F'); newDoc.setFontSize(8); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(primaryColor); newDoc.text("IMPORTANT REMINDERS:",lm,y+6); newDoc.setFontSize(8); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(darkTextColor); newDoc.text("• Arrive 15 min before departure.",lm,y+11); newDoc.text("• Present this ticket at boarding.",lm,y+16);
    y=mY+8; const rm=sX+8,rcw=205-rm-5;
    newDoc.setFontSize(10); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("BOOKING REFERENCE",rm,y); y+=8;
    newDoc.setFontSize(16); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(accentColor); newDoc.text(booking.booking_ref??booking.id,rm,y,{maxWidth:rcw}); y+=12;
    const qd=booking.booking_ref??booking.id; const qc=document.createElement('div'); qc.style.display='none'; document.body.appendChild(qc); let qi='';
    try{new window.QRCode(qc,{text:qd,width:128,height:128,colorDark:darkTextColor,colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.H});await new Promise(r=>setTimeout(r,50));const c=qc.querySelector('canvas');if(c)qi=c.toDataURL('image/png');}catch(e){}finally{document.body.removeChild(qc);}
    if(qi) newDoc.addImage(qi,'PNG',rm+3,y,40,40); y+=45;
    newDoc.setFontSize(9); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("BUS NAME",rm,y); y+=5; newDoc.setFontSize(11); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(darkTextColor); newDoc.text(booking.bus_name??"-",rm,y,{maxWidth:rcw}); y+=8;
    newDoc.setFontSize(9); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("PRICE PAID",rm,y); y+=5; newDoc.setFontSize(11); newDoc.setFont("helvetica","bold"); newDoc.setTextColor(darkTextColor); newDoc.text(`KES ${Number(booking.price??0).toLocaleString()}`,rm,y);
    const fY=132; newDoc.setDrawColor(primaryColor); newDoc.setLineWidth(0.2); newDoc.line(10,fY,200,fY); const ftY=fY+5; newDoc.setFontSize(7); newDoc.setFont("helvetica","normal"); newDoc.setTextColor(lightTextColor); newDoc.text("© 2025 Prince Alex Travel Services",10,ftY); newDoc.text("Official e-ticket. Terms apply.",10,ftY+4); newDoc.text("senerwaalex@gmail.com",205-10,ftY,{align:'right'}); newDoc.text("+254 717 384 875",205-10,ftY+4,{align:'right'});
    if (forEmail) return newDoc;
    else { newDoc.save(`PrinceAlex_Ticket_${booking.booking_ref??booking.id}.pdf`); }
}

function updateAuthLinks() {
    const mp = document.getElementById('myProfileLink'), lr = document.getElementById('loginRegisterLink'), lo = document.getElementById('logoutLink');
    if (currentUser) { lr.style.display='none'; mp.style.display='block'; lo.style.display='block'; }
    else { lr.style.display='block'; mp.style.display='none'; lo.style.display='none'; }
}

async function logout() {
    try { await signOut(auth); window.location.href='index.html'; }
    catch(e){console.error('Logout error:',e);}
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
