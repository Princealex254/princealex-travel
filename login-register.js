// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    getDoc,
    doc, 
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDGErPBeQ1Fdx9EHPXOHepoEoOx7P2f57o",
    authDomain: "princealextravel.firebaseapp.com",
    projectId: "princealextravel",
    storageBucket: "princealextravel.firebasestorage.app",
    messagingSenderId: "947577729462",
    appId: "1:947577729462:web:dd4b4c7cb4a984c5e3d117"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== UI Helper Functions =====

function displayMessage(elementId, message, type, autoHide = true) {
    const messageElement = document.getElementById(elementId);
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.classList.remove('hidden');
    if (autoHide) {
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }
}

function showPopup(title, message, type = 'info', buttons = null) {
    const overlay = document.getElementById('popupOverlay');
    const icon = document.getElementById('popupIcon');
    const titleEl = document.getElementById('popupTitle');
    const messageEl = document.getElementById('popupMessage');
    const buttonsEl = document.getElementById('popupButtons');

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    icon.textContent = icons[type] || icons.info;
    icon.className = `popup-icon ${type}`;

    titleEl.textContent = title;
    messageEl.textContent = message;

    if (buttons) {
        buttonsEl.innerHTML = buttons;
    } else {
        buttonsEl.innerHTML = '<button class="popup-button primary" id="popupDefaultBtn">Got it!</button>';
    }

    overlay.classList.add('show');
}

function closePopup() {
    const overlay = document.getElementById('popupOverlay');
    overlay.classList.remove('show');
}

function showForm(formType) {
    document.querySelectorAll('.form-section').forEach(form => {
        form.classList.add('hidden');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`${formType}Form`).classList.remove('hidden');
    document.getElementById(`${formType}TabBtn`).classList.add('active');

    document.querySelectorAll('.message').forEach(msg => msg.classList.add('hidden'));
}

function switchToRegister() {
    closePopup();
    showForm('register');
}

function switchToLogin() {
    closePopup();
    showForm('login');
}

// ===== Email Service =====

async function sendEmailWithWorker(payload) {
    const url = "https://payroll.princealexdigital.workers.dev/";
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Email sent successfully via worker! Message ID:", data.messageId);
            return true;
        } else {
            console.error("Worker failed to send email:", data.error, data.details);
            return false;
        }
    } catch (error) {
        console.error("Network or parsing error when sending email via worker:", error);
        return false;
    }
}

async function sendWelcomeEmail(userEmail) {
    try {
        const workerPayload = {
            toEmail: userEmail,
            subject: "Welcome to Prince Alex Travel Services! 🚌",
            htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to Prince Alex Travel Services</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                        .highlight { background: #fef3c7; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚌 Welcome to Prince Alex Travel Services!</h1>
                            <p>Your account has been successfully created</p>
                        </div>
                        <div class="content">
                            <h2>Hello!</h2>
                            <p>Thank you for registering with Prince Alex Travel Services. We're excited to have you on board!</p>
                            <div class="highlight">
                                <h3>📋 Next Steps:</h3>
                                <ol>
                                    <li><strong>Log in</strong> to your account using your email and password</li>
                                    <li><strong>Complete your profile</strong> by adding your personal details</li>
                                    <li><strong>Start booking</strong> your bus tickets for seamless travel</li>
                                </ol>
                            </div>
                            <p>To get started, please log in to your account and complete your profile:</p>
                            <a href="https://travel.princealex.pro/login-register.html" class="button">Log In & Complete Profile</a>
                            <h3>🎯 What you can do:</h3>
                            <ul>
                                <li>✅ Book bus tickets online</li>
                                <li>✅ View your booking history</li>
                                <li>✅ Download e-tickets</li>
                                <li>✅ Manage your travel preferences</li>
                            </ul>
                            <p>If you have any questions or need assistance, please don't hesitate to contact us:</p>
                            <p><strong>📧 Email:</strong> senerwaalex@gmail.com<br>
                            <strong>📞 Phone:</strong> +254 717 384 875</p>
                        </div>
                        <div class="footer">
                            <p>© 2025 Prince Alex Digital. All rights reserved.</p>
                            <p>Nairobi, Kenya | Prince Alex Travel Services</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        const success = await sendEmailWithWorker(workerPayload);
        if(success) console.log("✅ Welcome email sent successfully via worker for:", userEmail);
        return success;
    } catch (error) {
        console.error("❌ Error queuing welcome email:", error);
        return false;
    }
}

// ===== Auth Functions =====

async function register() {
    const registerButton = document.querySelector('#registerForm .btn-register');
    registerButton.disabled = true;

    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            passenger_email: email,
            createdAt: serverTimestamp()
        });

        console.log("✅ User profile initialized:", user.uid);

        const emailSent = await sendWelcomeEmail(email);
        if (emailSent) {
            console.log("✅ Welcome email sent successfully");
        } else {
            console.log("⚠️ Welcome email failed to send, but registration was successful");
        }

        showPopup(
            '🎉 Welcome Aboard!',
            'Your account has been created successfully! We\'ve sent you a welcome email with all the details. You can now log in and start booking your bus tickets.',
            'success',
            '<button class="popup-button primary" id="popupLoginBtn">Login Now</button>'
        );

    } catch (error) {
        console.error("❌ Registration failed:", error);
        
        let friendlyMessage = 'Something went wrong while creating your account. ';
        if (error.code === 'auth/email-already-in-use') {
            friendlyMessage = 'This email is already registered. Please try logging in instead.';
        } else if (error.code === 'auth/weak-password') {
            friendlyMessage = 'Please choose a stronger password with at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            friendlyMessage = 'Please enter a valid email address.';
        } else {
            friendlyMessage += 'Please try again or contact support if the problem persists.';
        }

        showPopup('Oops! Registration Failed', friendlyMessage, 'error');
    } finally {
        registerButton.disabled = false;
    }
}

async function login() {
    const loginButton = document.querySelector('#loginForm .btn-login');
    loginButton.disabled = true;

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!validateEmail(email)) {
        showPopup('Invalid Email', 'Please enter a valid email address to continue.', 'warning');
        loginButton.disabled = false;
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        
        showPopup(
            '🎉 Welcome Back!',
            'Login successful! You\'re being redirected to your profile page where you can manage your bookings and personal information.',
            'success',
            '<button class="popup-button primary" id="popupProfileBtn">Go to Profile</button>'
        );

        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 2000);

    } catch (error) {
        let friendlyMessage = 'We couldn\'t log you in. ';
        if (error.code === 'auth/user-not-found') {
            friendlyMessage = 'No account found with this email. Please check your email or create a new account.';
        } else if (error.code === 'auth/wrong-password') {
            friendlyMessage = 'Incorrect password. Please try again or reset your password if you\'ve forgotten it.';
        } else if (error.code === 'auth/invalid-email') {
            friendlyMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            friendlyMessage = 'Too many failed attempts. Please wait a moment before trying again.';
        } else {
            friendlyMessage += 'Please check your credentials and try again.';
        }

        showPopup('Login Failed', friendlyMessage, 'error');
        loginButton.disabled = false;
    }
}

async function googleLoginOnly() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await signOut(auth);

            showPopup(
                "Account Not Found",
                "No account exists with this Google email. Please sign up first.",
                "error",
                `<button class="popup-button primary" id="popupSignupBtn">Sign Up</button>`
            );
            return;
        }

        window.location.href = "profile.html";

    } catch (error) {
        console.error(error);

        if (error.code !== "auth/popup-closed-by-user") {
            showPopup("Login Failed", error.message, "error");
        }
    }
}

async function googleSignupOnly() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            await signOut(auth);
            showPopup(
                "Account Exists",
                "An account with this Google email already exists. Please log in instead.",
                "info",
                `<button class="popup-button primary" id="popupLoginBtn2">Login</button>`
            );
            return;
        }

        await setDoc(userRef, {
            passenger_email: user.email,
            name: user.displayName || "",
            photo: user.photoURL || "",
            provider: "google",
            createdAt: serverTimestamp()
        });

        await sendWelcomeEmail(user.email);

        window.location.href = "profile.html";

    } catch (error) {
        console.error(error);
        showPopup("Signup Failed", error.message, "error");
    }
}

async function resetPassword() {
    const resetButton = document.querySelector('#resetForm .btn-reset');
    resetButton.disabled = true;

    const email = document.getElementById('resetEmail').value.trim();

    if (!validateEmail(email)) {
        showPopup('Invalid Email', 'Please enter a valid email address to continue.', 'warning');
        resetButton.disabled = false;
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        
        showPopup(
            '📧 Reset Link Sent!',
            'If an account with this email exists, we\'ve sent you a password reset link. Please check your inbox and follow the instructions to create a new password.',
            'success'
        );
    } catch (error) {
        let friendlyMessage = 'We couldn\'t send the reset link. ';
        if (error.code === 'auth/user-not-found') {
            friendlyMessage = 'No account found with this email address. Please check your email or create a new account.';
        } else if (error.code === 'auth/invalid-email') {
            friendlyMessage = 'Please enter a valid email address.';
        } else {
            friendlyMessage += 'Please try again or contact support if the problem persists.';
        }

        showPopup('Reset Failed', friendlyMessage, 'error');
    } finally {
        resetButton.disabled = false;
    }
}

// ===== Validation Functions =====

function checkPasswordStrength() {
    const passwordInput = document.getElementById('registerPassword');
    const passwordStrength = document.getElementById('passwordStrength');
    const password = passwordInput.value;

    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.match(/[a-z]/)) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;

    passwordStrength.classList.remove('hidden');
    if (strength < 3) {
        passwordStrength.textContent = 'Weak';
        passwordStrength.className = 'password-strength strength-weak';
    } else if (strength < 5) {
        passwordStrength.textContent = 'Medium';
        passwordStrength.className = 'password-strength strength-medium';
    } else {
        passwordStrength.textContent = 'Strong';
        passwordStrength.className = 'password-strength strength-strong';
    }
    checkPasswordMatch();
}

function checkPasswordMatch() {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const passwordMatchStatus = document.getElementById('passwordMatchStatus');

    passwordMatchStatus.classList.remove('hidden');
    if (confirmPassword === '') {
        passwordMatchStatus.classList.add('hidden');
    } else if (password === confirmPassword) {
        passwordMatchStatus.textContent = 'Passwords match!';
        passwordMatchStatus.className = 'password-strength strength-strong';
    } else {
        passwordMatchStatus.textContent = 'Passwords do not match!';
        passwordMatchStatus.className = 'password-strength strength-weak';
    }
}

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function subscribeNewsletter() {
    const emailInput = document.querySelector('.newsletter-form input');
    const email = emailInput.value.trim();
    
    if (!email) {
        showPopup('Email Required', 'Please enter your email address to subscribe to our newsletter.', 'warning');
        return;
    }
    
    showPopup(
        '🎉 Welcome to Our Newsletter!',
        'Thank you for subscribing! You\'ll now receive updates about our latest offers, travel news, and special promotions directly to your inbox.',
        'success'
    );
    emailInput.value = '';
}

// ===== Event Binding =====

document.addEventListener('DOMContentLoaded', () => {
    // --- Tab switching ---
    document.getElementById('loginTabBtn').addEventListener('click', () => showForm('login'));
    document.getElementById('registerTabBtn').addEventListener('click', () => showForm('register'));
    document.getElementById('resetTabBtn').addEventListener('click', () => showForm('reset'));

    // --- Login form ---
    document.getElementById('loginEmail').addEventListener('input', function() {
        validateInput(this, 'email');
    });
    document.querySelector('#loginForm .btn-google').addEventListener('click', googleLoginOnly);
    document.querySelector('#loginForm .btn-login').addEventListener('click', login);
    document.querySelector('#loginForm .forgot-password').addEventListener('click', function(e) {
        e.preventDefault();
        showForm('reset');
    });

    // --- Register form ---
    document.getElementById('registerEmail').addEventListener('input', function() {
        validateInput(this, 'email');
    });
    document.getElementById('registerPassword').addEventListener('input', checkPasswordStrength);
    document.getElementById('confirmPassword').addEventListener('input', checkPasswordMatch);
    document.querySelector('#registerForm .btn-google').addEventListener('click', googleSignupOnly);
    document.querySelector('#registerForm .btn-register').addEventListener('click', register);

    // --- Reset form ---
    document.getElementById('resetEmail').addEventListener('input', function() {
        validateInput(this, 'email');
    });
    document.querySelector('#resetForm .btn-reset').addEventListener('click', resetPassword);

    // --- Popup ---
    document.getElementById('popupOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closePopup();
        }
    });
    document.querySelector('.popup-close').addEventListener('click', closePopup);

    // Delegate click events for dynamically created popup buttons
    document.getElementById('popupButtons').addEventListener('click', function(e) {
        const target = e.target;
        if (target.id === 'popupDefaultBtn') {
            closePopup();
        } else if (target.id === 'popupLoginBtn') {
            closePopup();
            showForm('login');
        } else if (target.id === 'popupProfileBtn') {
            closePopup();
            window.location.href = 'profile.html';
        } else if (target.id === 'popupSignupBtn') {
            switchToRegister();
        } else if (target.id === 'popupLoginBtn2') {
            switchToLogin();
        }
    });

    // --- Newsletter ---
    document.querySelector('.newsletter-form').addEventListener('submit', function(e) {
        e.preventDefault();
        subscribeNewsletter();
    });

    // --- Hamburger menu ---
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

    // --- Check for registration success parameter ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('registered')) {
        displayMessage('loginMessage', '✅ Account created successfully! A welcome email has been sent to your inbox. Please log in.', 'success', false);
        showForm('login');
    }
});

function validateInput(inputElement, type) {
    if (type === 'email' && !validateEmail(inputElement.value)) {
        // Not setting custom validity directly
    } else {
        inputElement.setCustomValidity('');
    }
}