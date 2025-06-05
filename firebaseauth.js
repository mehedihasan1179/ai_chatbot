// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword ,signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBWEQFv2XiHMY9xRtOaieX_GllV0lCQYZ8",
    authDomain: "chatbot-ai-18fc7.firebaseapp.com",
    projectId: "chatbot-ai-18fc7",
    storageBucket: "chatbot-ai-18fc7.firebasestorage.app",
    messagingSenderId: "760212290201",
    appId: "1:760212290201:web:82ac26ce5ed617f50d9608"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

function showMessage(message, divId) {
  let messageDiv = document.getElementById(divId);
    messageDiv.innerHTML = message;
    messageDiv.style.display = "block";
    messageDiv.style.opacity = 1;
    setTimeout(() => {
        messageDiv.style.opacity = "0";
    }, 3000);  
    // messageDiv.style.opacity = "1";
}

const signUp = document.getElementById("submitSignUp");

signUp.addEventListener("click", (event) => {
    event.preventDefault();
    const email = document.getElementById("rEmail").value;
    const password = document.getElementById("rPassword").value;
    const firstName = document.getElementById("fName").value;
    const lastName = document.getElementById("lName").value;

    const auth = getAuth();
    const db = getFirestore();

    createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        const user = userCredential.user;

        const userData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
        };
        showMessage('Account created successfully!', 'signUpMessage');
        const userDocRef = doc(db, "users", user.uid);
        setDoc(userDocRef, userData)
        .then(() => {
            window.location.href = "login.html";
        })
        .catch((error) => {
            console.error("Error writing document: ", error);
            showMessage('Error creating account!', 'signUpMessage');
        });
    })
    .catch((error) => {
        const errorCode = error.code;
        if(errorCode === 'auth/email-already-in-use') {
            showMessage('Email already in use!', 'signUpMessage');
        } else {
            showMessage('Error creating account!', 'signUpMessage');
        }
    });
});

const signIn = document.getElementById("submitSignIn");
signIn.addEventListener("click", (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const auth = getAuth();

    signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        const user = userCredential.user;
        showMessage('Login successful!', 'signInMessage');
        localStorage.setItem("loggedInUserId", user.uid);
        window.location.href = "index.html";
    })
    .catch((error) => {
        const errorCode = error.code;
        if(errorCode === 'auth/invalid-credential') {
            showMessage('Wrong email or password!', 'signInMessage');
        } else {
            showMessage("Account doesn't found. Please create a new account", "signInMessage");
        }
    });
});