// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';

// Your Firebase configuration object (you'll provide these details)
const firebaseConfig = {
    apiKey: "AIzaSyCr9BR8rQpgtV9AwUL5YeeZTL5T19BknmU",
    authDomain: "pho-db-b5eb6.firebaseapp.com",
    projectId: "pho-db-b5eb6",
    storageBucket: "pho-db-b5eb6.firebasestorage.app",
    messagingSenderId: "611640964884",
    appId: "1:611640964884:web:2196660cc566c01259f401",
    measurementId: "G-3NDS09LK4Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Authentication functions
export const registerUser = async (email, password, displayName) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Update profile with display name
        await updateProfile(userCredential.user, { displayName });
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const loginUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export { auth, onAuthStateChanged };