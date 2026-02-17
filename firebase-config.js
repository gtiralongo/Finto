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
        mainApp.style.display = 'flex'; // Use flex for the layout
        loadUserTransactions(user.uid);
    } else {
        authOverlay.style.display = 'flex';
        mainApp.style.display = 'none';
        transactions = [];
        init();
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
    const user = auth.currentUser;
    if (user) {
        // Sync with Firestore would go here
        db.collection('users').doc(user.uid).set({
            transactions: transactions
        });
    }
}

function loadUserTransactions(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            transactions = doc.data().transactions || [];
        } else {
            // First time user: load initial movements
            transactions = initialMovements.map(m => ({ ...m, id: Math.floor(Math.random() * 10000000) }));
            updateLocalStorage(); // Sync these to Firestore immediately
        }
        init();
    });
}
