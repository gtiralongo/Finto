// Firebase Configuration (Placeholder - User needs to fill this)
const firebaseConfig = {
    apiKey: "AIzaSyDFGCyd8F-Q6HR03YRpfPQHJ8G1LnTN5RI",
    authDomain: "finto-543a9.firebaseapp.com",
    projectId: "finto-543a9",
    storageBucket: "finto-543a9.firebasestorage.app",
    messagingSenderId: "632895492462",
    appId: "1:632895492462:web:e8d1a6cd3ec3fe4b16317f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth Elements
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const logoutBtnSide = document.getElementById('logout-btn-side');
const mainApp = document.querySelector('.main-app');
const googleLoginBtn = document.getElementById('google-login');

// Listen for Auth State Changes
auth.onAuthStateChanged(user => {
    if (user) {
        authOverlay.style.display = 'none';
        mainApp.style.display = 'flex';
        loadUserTransactions(user.uid);

        // Update sidebar user info
        const sidebarEmail = document.getElementById('sidebar-email');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        if (sidebarEmail) {
            const displayName = user.displayName || user.email || 'Usuario';
            sidebarEmail.innerText = displayName.length > 20 ? displayName.substring(0, 20) + '…' : displayName;
        }
        if (sidebarAvatar) {
            const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
            sidebarAvatar.innerText = initial;
        }
    } else {
        authOverlay.style.display = 'flex';
        mainApp.style.display = 'none';
        window.transactions = [];
        window.savings = [];
        window.closedTrades = [];
        if (typeof window.init === 'function') window.init();
    }
});

// Login with Email/Password
loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
});

// Login with Google
googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => alert(error.message));
});

// Logout
const logoutHandler = () => {
    auth.signOut();
};

if (logoutBtn) logoutBtn.addEventListener('click', logoutHandler);
if (logoutBtnSide) logoutBtnSide.addEventListener('click', logoutHandler);

// Replace LocalStorage with Firestore Logic
function updateLocalStorage() {
    // Save locally for instant persistence
    localStorage.setItem('transactions', JSON.stringify(window.transactions || []));
    localStorage.setItem('savings', JSON.stringify(window.savings || []));
    localStorage.setItem('closedTrades', JSON.stringify(window.closedTrades || []));

    const user = auth.currentUser;
    if (user) {
        db.collection('users').doc(user.uid).set({
            transactions: window.transactions || [],
            savings: window.savings || [],
            closedTrades: window.closedTrades || []
        }).catch(err => console.error("Error saving to Firebase: ", err));
    }
}

function loadUserTransactions(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        // Load cloud data or default
        const data = doc.exists ? doc.data() : {};
        window.transactions = data.transactions || [];
        window.savings = data.savings || [];
        window.closedTrades = data.closedTrades || [];
        
        // Caching locally so it shows immediately on next reload
        localStorage.setItem('transactions', JSON.stringify(window.transactions));
        localStorage.setItem('savings', JSON.stringify(window.savings));
        localStorage.setItem('closedTrades', JSON.stringify(window.closedTrades));

        if (typeof window.init === 'function') window.init();
    }).catch(err => {
        console.error("Error fetching data from Firebase: ", err);
        // Fallback to local storage if cloud fails
        if (typeof window.init === 'function') window.init();
    });
}
