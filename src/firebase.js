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
import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from 'firebase/storage';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    getDocs,
    where,
    orderBy,
    limit
} from 'firebase/firestore';
import axios from 'axios';

// Your Firebase configuration object
const firebaseConfig = {
    apiKey: "********",
    authDomain: "********",
    projectId: "********",
    storageBucket: "********",
    messagingSenderId: "********",
    appId: "********",
    measurementId: "********"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

// Mathpix API Configuration
const MATHpIX_APP_ID = '********'; // Replace with your Mathpix App ID
const MATHpIX_API_KEY = '********'; // Replace with your Mathpix API Key

// Authentication functions
export const registerUser = async (email, password, displayName) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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

// Firestore functions
export const addProblemToFirestore = async (problemData) => {
    try {
        const docRef = await addDoc(collection(db, 'Problems'), {
            ...problemData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Storage functions
export const uploadFileToStorage = (file, path, onProgress) => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (onProgress) {
                    onProgress(progress);
                }
            },
            (error) => {
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve({ downloadURL, ref: uploadTask.snapshot.ref });
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
};

export const uploadProblemFiles = async (files, problemId, fileType, onProgress) => {
    const uploadPromises = files.map((file, index) => {
        const fileExtension = file.name.split('.').pop();
        const fileName = `${problemId}_${fileType}_${index + 1}_${Date.now()}.${fileExtension}`;
        const path = `problems/${problemId}/${fileType}/${fileName}`;
        
        return uploadFileToStorage(file, path, (progress) => {
            if (onProgress) {
                const totalProgress = (progress + (index * 100)) / files.length;
                onProgress(totalProgress);
            }
        });
    });

    try {
        const results = await Promise.all(uploadPromises);
        return results.map(result => result.downloadURL);
    } catch (error) {
        throw error;
    }
};

// Helper function to convert file to base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};

// UPLOAD TO TEMPORARY STORAGE AND GET URL
const uploadToTempStorage = async (file) => {
    try {
        const tempPath = `temp/${Date.now()}_${file.name}`;
        const result = await uploadFileToStorage(file, tempPath);
        return result.downloadURL;
    } catch (error) {
        console.error('Failed to upload to temp storage:', error);
        throw error;
    }
};

// FIXED: Mathpix API function that uses URL instead of base64
export const convertToLatex = async (file) => {
    try {
        // Validate file
        if (!file) {
            return {
                success: false,
                error: 'No file provided'
            };
        }

        // Check if Mathpix credentials are set
        if (MATHpIX_APP_ID === 'your_mathpix_app_id' || MATHpIX_API_KEY === 'your_mathpix_api_key') {
            return {
                success: false,
                error: 'Mathpix API credentials not configured. Please set your App ID and API Key.'
            };
        }

        console.log('Converting file:', file.name, 'Type:', file.type, 'Size:', file.size);

        // Step 1: Upload file to temporary Firebase Storage to get a URL
        console.log('Uploading to temporary storage to get URL...');
        const fileUrl = await uploadToTempStorage(file);
        console.log('File uploaded to:', fileUrl);

        // Step 2: Prepare the request for Mathpix API v3
        // The Mathpix v3 API expects a URL in the request body
        let requestData = {};
        let endpoint = 'https://api.mathpix.com/v3/text';

        if (file.type === 'application/pdf') {
            requestData = {
                url: fileUrl, // Use URL instead of base64
                formats: ['latex', 'text'],
                math_inline_delimiters: ['$', '$'],
                math_display_delimiters: ['$$', '$$'],
                enable_table_detection: true,
                enable_diagram_detection: true,
                ocr: {
                    pages: 'all'
                }
            };
        } else if (file.type.startsWith('image/')) {
            requestData = {
                url: fileUrl, // Use URL instead of base64
                formats: ['latex', 'text'],
                math_inline_delimiters: ['$', '$'],
                math_display_delimiters: ['$$', '$$'],
                enable_table_detection: true,
                enable_diagram_detection: true
            };
        } else {
            return {
                success: false,
                error: `Unsupported file type: ${file.type}`
            };
        }

        console.log('Sending request to Mathpix API with URL...');
        console.log('Request data:', JSON.stringify(requestData, null, 2));
        
        const response = await axios.post(
            endpoint,
            requestData,
            {
                headers: {
                    'app_id': MATHpIX_APP_ID,
                    'app_key': MATHpIX_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 second timeout for URL processing
            }
        );

        console.log('Mathpix API Response Status:', response.status);
        console.log('Full Mathpix API Response:', JSON.stringify(response.data, null, 2));

        // Check if we got a successful response
        if (response.status === 200 && response.data) {
            let latexText = '';
            let plainText = '';
            let confidence = 0;

            // Extract LaTeX from various possible response formats
            if (response.data.latex) {
                if (Array.isArray(response.data.latex)) {
                    latexText = response.data.latex.join('\n\n');
                } else if (typeof response.data.latex === 'string') {
                    latexText = response.data.latex;
                }
            }

            // Try result field
            if (!latexText && response.data.result) {
                if (Array.isArray(response.data.result)) {
                    latexText = response.data.result.join('\n\n');
                } else if (typeof response.data.result === 'string') {
                    latexText = response.data.result;
                }
            }

            // Try text field
            if (response.data.text) {
                if (Array.isArray(response.data.text)) {
                    plainText = response.data.text.join('\n\n');
                } else if (typeof response.data.text === 'string') {
                    plainText = response.data.text;
                }
            }

            // Try confidence
            if (response.data.confidence) {
                confidence = response.data.confidence;
            }

            // If we have LaTeX or text, consider it a success
            if (latexText || plainText) {
                console.log('Successfully extracted content. LaTeX length:', latexText.length);
                return {
                    success: true,
                    latex: latexText || plainText || 'No content extracted',
                    text: plainText || latexText || 'No content extracted',
                    confidence: confidence || 0,
                    rawResponse: response.data
                };
            } else {
                return {
                    success: false,
                    error: 'No LaTeX or text content found in API response',
                    rawResponse: response.data
                };
            }
        } else {
            return {
                success: false,
                error: `API returned status ${response.status}: ${response.statusText}`,
                rawResponse: response.data
            };
        }
    } catch (error) {
        console.error('Mathpix API error details:', error);
        
        let errorMessage = 'Failed to convert to LaTeX';
        let errorDetails = null;
        
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            
            errorDetails = error.response.data;
            
            if (error.response.status === 401) {
                errorMessage = 'Invalid Mathpix API credentials. Please check your App ID and API Key.';
            } else if (error.response.status === 429) {
                errorMessage = 'Mathpix API rate limit exceeded. Please try again later.';
            } else if (error.response.status === 400) {
                const errorMsg = error.response.data?.error || error.response.data?.message || 'Invalid request';
                errorMessage = `Mathpix API error: ${errorMsg}`;
            } else if (error.response.status === 413) {
                errorMessage = 'File too large for Mathpix API. Please use a smaller file (under 10MB).';
            } else {
                errorMessage = `Mathpix API error: ${error.response.status}`;
            }
        } else if (error.request) {
            errorMessage = 'No response from Mathpix API. Please check your internet connection.';
        } else {
            errorMessage = error.message || 'Unknown error occurred';
        }
        
        return {
            success: false,
            error: errorMessage,
            details: errorDetails || error.message
        };
    }
};

// Process multiple files with Mathpix API
export const processFilesWithMathpix = async (files, onProgress) => {
    const results = [];
    let processedCount = 0;

    for (const file of files) {
        try {
            console.log(`Processing file ${processedCount + 1}/${files.length}:`, file.name);
            const result = await convertToLatex(file);
            
            if (result.success) {
                console.log(`Successfully processed ${file.name}`);
            } else {
                console.warn(`Failed to process ${file.name}:`, result.error);
                if (result.details) {
                    console.warn('Error details:', result.details);
                }
            }
            
            results.push({
                fileName: file.name,
                ...result
            });
            
            processedCount++;
            if (onProgress) {
                onProgress((processedCount / files.length) * 100);
            }
        } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            results.push({
                fileName: file.name,
                success: false,
                error: error.message || 'Failed to process file'
            });
        }
    }

    return results;
};

export { auth, onAuthStateChanged, db };