// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let fetchedBookingData = null;
const MAX_PDF_BASE64_SIZE_BYTES = 800 * 1024;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthLinks();
});

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    const bookingRefInput = document.getElementById('bookingRefInput');
    const lookupTicketBtn = document.getElementById('lookupTicketBtn');
    const messageElem = document.getElementById('message');
    const ticketDetailsSection = document.getElementById('ticketDetailsSection');
    const paymentSection = document.getElementById('paymentSection');
    const downloadTicketBtn = document.getElementById('downloadTicketBtn');
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    const mobileMenuToggle = document.getElementById('mobile-menu');
    const mainNav = document.getElementById('main-nav');

    lookupTicketBtn.addEventListener('click', loadBookingDetails);
    downloadTicketBtn.addEventListener('click', downloadTicket);
    sendEmailBtn.addEventListener('click', sendTicketToEmail);

    const payBtn = document.getElementById('payNowBtn');
    if (payBtn) payBtn.addEventListener('click', payWithPaystack);

    // Hamburger menu
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

    // Popup overlay click
    const popupOverlay = document.getElementById('popupOverlay');
    if (popupOverlay) popupOverlay.addEventListener('click', function(e) { if (e.target === this) closePopup(); });

    // Logout link
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.addEventListener('click', async (e) => { e.preventDefault(); await logout(); });

    // ===== Load Booking Details =====
    async function loadBookingDetails() {
        const bookingRef = bookingRefInput.value.trim();
        messageElem.textContent = '';
        messageElem.className = 'message';
        ticketDetailsSection.classList.remove('show');
        paymentSection.style.display = 'none';
        fetchedBookingData = null;

        if (!bookingRef) {
            messageElem.textContent = 'Please enter a booking reference.';
            messageElem.className = 'message error show';
            return;
        }

        lookupTicketBtn.disabled = true;
        lookupTicketBtn.innerHTML = '<span class="loading-spinner"></span> Searching...';
        messageElem.textContent = 'Searching for your ticket...';
        messageElem.className = 'message loading show';

        try {
            const bookingsCollectionRef = collection(db, "bookings");
            const q = query(bookingsCollectionRef, where("booking_ref", "==", bookingRef));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const data = docSnap.data();
                fetchedBookingData = { id: docSnap.id, ...data };

                document.getElementById('passengerName').textContent = data.passenger_name;
                document.getElementById('busRoute').textContent = data.bus_route;
                document.getElementById('travelDate').textContent = data.travel_date;
                document.getElementById('seatNumber').textContent = data.seat_number;
                document.getElementById('status').textContent = data.status ? data.status.toUpperCase() : 'N/A';
                document.getElementById('passengerEmail').value = data.passenger_email || '';
                document.getElementById('bookingRef').value = data.booking_ref || '';

                const status = (data.status || 'pending').toLowerCase();
                if (status === 'pending') {
                    paymentSection.style.display = 'block';
                    document.getElementById('amountToPay').textContent = `Amount to Pay: KES ${Number(data.price || 0).toLocaleString()}`;
                    downloadTicketBtn.style.display = 'none';
                    sendEmailBtn.style.display = 'none';
                } else {
                    paymentSection.style.display = 'none';
                    downloadTicketBtn.style.display = 'inline-flex';
                    sendEmailBtn.style.display = 'inline-flex';
                }

                messageElem.textContent = '✅ Ticket found successfully!';
                messageElem.className = 'message success show';
                ticketDetailsSection.classList.add('show');

                setTimeout(() => ticketDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            } else {
                messageElem.textContent = '❌ Booking not found. Please check your reference ID.';
                messageElem.className = 'message error show';
            }
        } catch (error) {
            console.error("Error:", error);
            messageElem.textContent = '❌ An unexpected error occurred. Please try again later.';
            messageElem.className = 'message error show';
        } finally {
            lookupTicketBtn.disabled = false;
            lookupTicketBtn.innerHTML = '<i class="fas fa-search"></i> Retrieve Ticket';
        }
    }

    // ===== PDF Generation =====
    async function generatePdfContent(booking) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
        const primaryColor = '#0f172a', accentColor = '#f59e0b', darkTextColor = '#1f2937', lightTextColor = '#6b7280', whiteColor = '#ffffff', lightBgColor = '#f8fafc';
        const status = (booking.status ?? "pending").toUpperCase();
        const statusColor = status === 'PAID' ? '#10b981' : '#f59e0b';
        doc.setFillColor(whiteColor); doc.setDrawColor(primaryColor); doc.setLineWidth(0.5); doc.roundedRect(5, 5, 200, 138, 5, 5, 'FD');
        doc.setFillColor(primaryColor); doc.roundedRect(5, 5, 200, 30, 5, 5, 'F');
        doc.setFillColor(whiteColor); doc.circle(20, 20, 8, 'F'); doc.setTextColor(primaryColor); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text("PA",18,22);
        doc.setTextColor(whiteColor); doc.setFontSize(22); doc.setFont("helvetica","bold"); doc.text("Prince Alex Travel",35,18); doc.setFontSize(12); doc.setFont("helvetica","normal"); doc.text("BOARDING PASS",35,26);
        const bw=35,bx=205-bw-10; doc.setFillColor(statusColor); doc.roundedRect(bx,15,bw,10,3,3,'F'); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(whiteColor); doc.text(status,bx+(bw/2),21.5,{align:'center'});
        const mY=40,sX=145; doc.setLineDashPattern([2,2],0); doc.setDrawColor(lightTextColor); doc.line(sX,mY-2,sX,130); doc.setLineDashPattern([],0);
        let y=mY+8; const lm=15,lcw=sX-lm-5;
        doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("PASSENGER NAME",lm,y); y+=8;
        doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.setTextColor(darkTextColor); doc.text(booking.passenger_name??"-",lm,y,{maxWidth:lcw}); y+=12;
        const [origin,dest]=(booking.bus_route??'- to -').split(' to ');
        doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("FROM",lm,y); doc.text("TO",lm+60,y); y+=10;
        doc.setFontSize(24); doc.setFont("helvetica","bold"); doc.setTextColor(primaryColor); doc.text(origin.trim(),lm,y,{maxWidth:40}); doc.text("→",lm+45,y); doc.text(dest.trim(),lm+60,y,{maxWidth:65}); y+=12;
        const dY=y;
        [{label:"TRAVEL DATE",value:booking.travel_date??"-"},{label:"DEPARTURE",value:booking.bus_time??"-"},{label:"SEAT",value:booking.seat_number??"-"}].forEach((item,i)=>{const x=lm+(i*45);doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(lightTextColor);doc.text(item.label,x,dY);doc.setFontSize(16);doc.setFont("helvetica","bold");doc.setTextColor(darkTextColor);doc.text(item.value,x,dY+8,{maxWidth:40});});
        y+=20;
        doc.setFillColor(lightBgColor); doc.roundedRect(lm-5,y,lcw+5,20,3,3,'F'); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(primaryColor); doc.text("IMPORTANT REMINDERS:",lm,y+6); doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(darkTextColor); doc.text("• Arrive 15 min before departure.",lm,y+11); doc.text("• Present this ticket at boarding.",lm,y+16);
        y=mY+8; const rm=sX+8,rcw=205-rm-5;
        doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("BOOKING REFERENCE",rm,y); y+=8;
        doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.setTextColor(accentColor); doc.text(booking.booking_ref??booking.id,rm,y,{maxWidth:rcw}); y+=12;
        const qd=booking.booking_ref??booking.id; const qc=document.createElement('div'); qc.style.display='none'; document.body.appendChild(qc); let qi='';
        try{new QRCode(qc,{text:qd,width:128,height:128,colorDark:darkTextColor,colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});await new Promise(r=>setTimeout(r,50));const c=qc.querySelector('canvas');if(c)qi=c.toDataURL('image/png');}catch(e){}finally{document.body.removeChild(qc);}
        if(qi) doc.addImage(qi,'PNG',rm+3,y,40,40); y+=45;
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("BUS NAME",rm,y); y+=5; doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(darkTextColor); doc.text(booking.bus_name??"-",rm,y,{maxWidth:rcw}); y+=8;
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("PRICE PAID",rm,y); y+=5; doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(darkTextColor); doc.text(`KES ${Number(booking.price??0).toLocaleString()}`,rm,y);
        const fY=132; doc.setDrawColor(primaryColor); doc.setLineWidth(0.2); doc.line(10,fY,200,fY); const ftY=fY+5; doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(lightTextColor); doc.text("© 2025 Prince Alex Travel Services",10,ftY); doc.text("Official e-ticket. Terms apply.",10,ftY+4); doc.text("senerwaalex@gmail.com",205-10,ftY,{align:'right'}); doc.text("+254 717 384 875",205-10,ftY+4,{align:'right'});
        return doc;
    }

    // ===== Download Ticket =====
    async function downloadTicket() {
        if (!fetchedBookingData) { showCustomAlert("No ticket details available. Please search for a ticket first."); return; }
        if (fetchedBookingData.status !== 'paid') { showCustomAlert('Ticket can only be downloaded after payment is confirmed.'); return; }
        try { const doc = await generatePdfContent(fetchedBookingData); doc.save(`PrinceAlex_Ticket_${fetchedBookingData.booking_ref}.pdf`); }
        catch (error) { console.error("Error downloading PDF:", error); showCustomAlert("Failed to download ticket.", 'error'); }
    }

    // ===== Send Ticket to Email =====
    async function sendTicketToEmail() {
        if (!fetchedBookingData) { showCustomAlert("No ticket details available. Please search for a ticket first."); return; }
        if (fetchedBookingData.status !== 'paid') { showCustomAlert('Ticket can only be sent after payment is confirmed.'); return; }
        const passengerEmail = fetchedBookingData.passenger_email;
        const bookingId = fetchedBookingData.booking_ref;
        const passengerName = fetchedBookingData.passenger_name || 'Valued Customer';
        if (!passengerEmail || !isValidEmail(passengerEmail)) { showCustomAlert("Invalid or missing passenger email.", 'error'); return; }
        showCustomAlert("Preparing and sending your ticket...", 'info');
        try {
            const pdfDoc = await generatePdfContent(fetchedBookingData);
            const pdfDataUri = pdfDoc.output("datauristring");
            const pdfBase64 = pdfDataUri.split(",")[1];
            if (!pdfBase64) { showCustomAlert("Failed to generate PDF.", 'error'); return; }
            const size = new TextEncoder().encode(pdfBase64).length;
            if (size > MAX_PDF_BASE64_SIZE_BYTES) { showCustomAlert(`PDF too large (${(size/1024).toFixed(2)} KB). Please download instead.`, 'error'); return; }
            const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E-Ticket - Prince Alex Travel</title><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f8fafc;padding:30px;border-radius:0 0 10px 10px}.ticket-details{background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #1e3a8a}.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.detail-label{font-weight:bold;color:#374151}.detail-value{color:#1f2937}.footer{text-align:center;margin-top:30px;color:#666;font-size:14px}.attachment-notice{background:#d1fae5;padding:15px;border-radius:5px;border-left:4px solid #10b981;margin:20px 0}.status-paid{background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold}</style></head><body><div class="container"><div class="header"><h1>🎫 Your E-Ticket is Ready!</h1><p>Prince Alex Travel - Digital Ticket Delivery</p></div><div class="content"><h2>Hello ${passengerName}!</h2><p>Thank you for choosing <strong>Prince Alex Travel Services</strong>. Your e-ticket is ready and attached!</p><div class="ticket-details"><h3 style="margin-top:0;color:#1e3a8a;">🎫 Ticket Information</h3><div class="detail-row"><span class="detail-label">Booking Reference:</span><span class="detail-value"><strong>${bookingId}</strong></span></div><div class="detail-row"><span class="detail-label">Route:</span><span class="detail-value">${fetchedBookingData.bus_route}</span></div><div class="detail-row"><span class="detail-label">Seat:</span><span class="detail-value"><strong>${fetchedBookingData.seat_number}</strong></span></div><div class="detail-row"><span class="detail-label">Travel Date:</span><span class="detail-value">${fetchedBookingData.travel_date}</span></div><div class="detail-row"><span class="detail-label">Departure:</span><span class="detail-value">${fetchedBookingData.bus_time}</span></div><div class="detail-row"><span class="detail-label">Price:</span><span class="detail-value"><strong>Ksh ${fetchedBookingData.price.toLocaleString()}</strong></span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="status-paid">PAID</span></span></div></div><div class="attachment-notice"><h4 style="margin-top:0;color:#065f46;">📎 E-Ticket Attached</h4><p style="margin-bottom:0;color:#065f46;">Your e-ticket PDF is attached. Present it at boarding.</p></div><div style="background:#fef3c7;padding:15px;border-radius:5px;border-left:4px solid #f59e0b;margin:20px 0;"><h4 style="margin-top:0;color:#92400e;">📱 Important Reminders</h4><ul style="margin-bottom:0;color:#92400e;"><li>Arrive at the terminal 15 minutes before departure</li><li>Present your e-ticket (digital or printed) to the driver</li><li>Keep your booking reference handy</li></ul></div><p><strong>📱 Need Help?</strong></p><p>If you have any questions or need assistance, please don't hesitate to contact us:</p><p><strong>📧 Email:</strong> senerwaalex@gmail.com<br><strong>📞 Phone:</strong> +254 717 384 875</p></div><div class="footer"><p>© 2025 Prince Alex Digital. All rights reserved.</p><p>Nairobi, Kenya | Prince Alex Travel Services</p></div></div></body></html>`;
            const sent = await sendEmailWithWorker({ toEmail: passengerEmail, toName: passengerName, subject: `Your E-Ticket - Prince Alex Travel 🎫`, htmlContent: emailHtml, attachments: [{ filename: `Ticket_${bookingId}.pdf`, content: pdfBase64, encoding: "base64" }] });
            if(sent) showCustomAlert("Ticket sent to your email successfully!", 'success');
            else showCustomAlert("Failed to send ticket. Please try again.", 'error');
        } catch (error) { console.error("Error sending email:", error); showCustomAlert("Failed to send ticket.", 'error'); }
    }

    // ===== Email Worker =====
    async function sendEmailWithWorker(payload) {
        const url = "https://payroll.princealexdigital.workers.dev/";
        try { const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); const d=await r.json(); if(r.ok) return true; else {console.error("Worker failed:",d.error,d.details); return false;} }
        catch(e){console.error("Network error:",e); return false;}
    }

    // ===== Custom Alert =====
    function showCustomAlert(message, type='info') {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10001;';
        const bg = type === 'error' ? '#dc3545' : type === 'success' ? '#10b981' : '#0f172a';
        modal.innerHTML = `<div style="background:${bg};color:white;padding:25px;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);"><p style="margin-bottom:20px;font-size:1.1em;">${message}</p><button style="background:white;color:${bg};padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:600;" onclick="this.parentNode.parentNode.remove()">OK</button></div>`;
        document.body.appendChild(modal);
    }

    // ===== Email Validation =====
    function isValidEmail(email) { return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(String(email).toLowerCase()); }

    // ===== Paystack =====
    function payWithPaystack() {
        if (!fetchedBookingData) { showCustomAlert("Booking data missing.", 'error'); return; }
        const handler = PaystackPop.setup({
            key: 'pk_live_534321af1df8706853f3f560a599307c289c56df',
            email: fetchedBookingData.passenger_email,
            phone: fetchedBookingData.passenger_phone,
            amount: Math.round(fetchedBookingData.price * 100),
            currency: 'KES',
            callback: function(response) { handlePaymentSuccess(response); },
            onClose: function() { showCustomAlert("Transaction cancelled.", 'warning'); }
        });
        handler.openIframe();
    }

    // ===== Payment Success =====
    async function handlePaymentSuccess(response) {
        showCustomAlert("Payment Successful! Reference: " + response.reference, 'success');
        try {
            const bookingDocRef = doc(db, "bookings", fetchedBookingData.id);
            await updateDoc(bookingDocRef, {
                status: 'paid', paystack_ref: response.reference, receipt_number: response.reference,
                amount_paid: fetchedBookingData.price, payment_method: 'Paystack', paid_at: serverTimestamp()
            });
            const updatedData = { ...fetchedBookingData, status: 'paid', paystack_ref: response.reference, receipt_number: response.reference };
            const pdfDocForEmail = await generatePdfContent(updatedData);
            const pdfBase64 = pdfDocForEmail.output("datauristring").split(",")[1];
            const emailHtml = `<div style="font-family:'Segoe UI',Arial,sans-serif;border:1px solid #eee;border-radius:16px;overflow:hidden;max-width:600px;margin:auto;color:#1e293b;"><div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);color:white;padding:40px 20px;text-align:center;"><h1 style="margin:0;font-size:26px;">🎫 Payment Confirmed!</h1><p style="margin:5px 0 0;opacity:0.9;font-size:16px;">Prince Alex Travel - Safe & Secure Journey</p></div><div style="padding:30px;background:#ffffff;"><p style="font-size:16px;margin-top:0;">Hello <strong>${updatedData.passenger_name}</strong>,</p><p>Great news! Your payment has been received and your trip is now fully confirmed.</p><div style="background:#f8fafc;padding:20px;border-radius:12px;margin:25px 0;border:1px solid #e2e8f0;border-left:5px solid #0f172a;"><h3 style="margin:0 0 15px 0;color:#0f172a;font-size:18px;">Travel Summary</h3><table style="width:100%;font-size:14px;border-collapse:collapse;"><tr><td style="padding:10px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Booking Ref:</td><td style="padding:10px 0;text-align:right;font-weight:bold;color:#0f172a;">${updatedData.booking_ref}</td></tr><tr><td style="padding:10px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Route:</td><td style="padding:10px 0;text-align:right;font-weight:bold;">${updatedData.bus_route}</td></tr><tr><td style="padding:10px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Date & Time:</td><td style="padding:10px 0;text-align:right;font-weight:bold;">${updatedData.travel_date} @ ${updatedData.bus_time}</td></tr><tr><td style="padding:10px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Seat:</td><td style="padding:10px 0;text-align:right;font-weight:bold;color:#f59e0b;">${updatedData.seat_number}</td></tr><tr><td style="padding:10px 0;color:#64748b;">Amount Paid:</td><td style="padding:10px 0;text-align:right;font-weight:bold;">KES ${Number(updatedData.price).toLocaleString()}</td></tr></table></div><div style="background:#fdf2f2;padding:15px;border-radius:8px;border-left:4px solid #ef4444;color:#991b1b;font-size:13px;"><strong>Important:</strong> Arrive 15 min before departure.</div><p style="margin-top:25px;">Your E-Ticket is attached as a PDF.</p></div><div style="background:#f1f5f9;padding:25px;text-align:center;font-size:12px;color:#94a3b8;">© 2025 Prince Alex Travel Services | Support: senerwaalex@gmail.com | +254 717 384 875</div></div>`;
            await sendEmailWithWorker({ toEmail: updatedData.passenger_email, toName: updatedData.passenger_name, subject: "Your Ticket is Confirmed! 🎫", htmlContent: emailHtml, attachments: [{ filename: `Ticket_${updatedData.booking_ref}.pdf`, content: pdfBase64, encoding: "base64" }] });
            setTimeout(() => loadBookingDetails(), 1500);
        } catch (error) { console.error("Error updating booking:", error); }
    }
});

// ===== Global Functions (needed by inline onclick in popup) =====
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

function updateAuthLinks() {
    const mp = document.getElementById('myProfileLink'), lr = document.getElementById('loginRegisterLink'), lo = document.getElementById('logoutLink');
    if (currentUser) { lr.style.display='none'; mp.style.display='block'; lo.style.display='block'; }
    else { lr.style.display='block'; mp.style.display='none'; lo.style.display='none'; }
}
async function logout() {
    try { await signOut(auth); window.location.href='index.html'; }
    catch(e){console.error('Logout error:',e);}
}
