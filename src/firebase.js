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
    uploadBytes, 
    uploadBytesResumable, 
    getDownloadURL 
} from 'firebase/storage';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp,
    getDocs,  
    query,    
    orderBy   
} from 'firebase/firestore';
import axios from 'axios';

console.log('Environment variables loaded:');
console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✓ Present' : '✗ Missing');
console.log('VITE_MATHPIX_APP_ID:', import.meta.env.VITE_MATHPIX_APP_ID ? '✓ Present' : '✗ Missing');
console.log('VITE_MATHPIX_API_KEY:', import.meta.env.VITE_MATHPIX_API_KEY ? '✓ Present' : '✗ Missing');

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
}

let app, auth, storage, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    db = getFirestore(app);
    console.log('✅ Firebase initialized successfully!');
} catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    throw error;
}

const MATHpIX_APP_ID = import.meta.env.VITE_MATHPIX_APP_ID;
const MATHpIX_API_KEY = import.meta.env.VITE_MATHPIX_API_KEY;

const isMathpixConfigured = MATHpIX_APP_ID && MATHpIX_API_KEY && 
    MATHpIX_APP_ID !== 'your_mathpix_app_id' && 
    MATHpIX_API_KEY !== 'your_mathpix_api_key';

if (!isMathpixConfigured) {
    console.warn('⚠️ Mathpix API credentials not configured.');
}

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

export const uploadFileToStorage = (file, path, onProgress) => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
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

const pollForPdfCompletion = async (pdfId, onProgress, maxAttempts = 60, delayMs = 2000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await axios.get(
                `https://api.mathpix.com/v3/pdf/${pdfId}`,
                {
                    headers: { 'app_id': MATHpIX_APP_ID, 'app_key': MATHpIX_API_KEY, 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );

            if (response.status === 200 && response.data) {
                const status = response.data.status;
                const percentDone = response.data.percent_done || 0;
                
                if (onProgress) onProgress(25 + (percentDone * 0.5));
                
                if (status === 'completed') return { completed: true, rawResponse: response.data };
                if (status === 'error' || status === 'failed') return { completed: false, error: response.data.error || 'PDF processing failed', rawResponse: response.data };
            }

            if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
            if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, delayMs));
            else return { completed: false, error: 'PDF processing timed out' };
        }
    }
    return { completed: false, error: 'PDF processing timed out' };
};

const downloadPdfResults = async (pdfId, format = 'mmd') => {
    try {
        const url = `https://api.mathpix.com/v3/pdf/${pdfId}.${format}`;
        const response = await axios.get(url, {
            headers: { 'app_id': MATHpIX_APP_ID, 'app_key': MATHpIX_API_KEY },
            timeout: 60000,
            responseType: format === 'tex.zip' ? 'arraybuffer' : 'text'
        });

        if (response.status === 200) {
            if (format === 'tex.zip') {
                return { success: true, content: '[LaTeX zip file downloaded]', rawResponse: { size: response.data.byteLength } };
            } else {
                const content = typeof response.data === 'string' ? response.data : String(response.data);
                if (content && content.length > 0) {
                    return { success: true, content: content, rawResponse: { length: content.length } };
                }
            }
        }
        return { success: false, error: `Download failed with status ${response.status}` };
    } catch (error) {
        return { success: false, error: error.message || 'Failed to download PDF results' };
    }
};

// ============================================================================
// HELPER: Fetch image via multiple CORS proxies to bypass CDN blocking
// ============================================================================
const fetchImageViaProxy = async (url) => {
    const proxies = [
        // 1. Weserv image proxy (Highly reliable for images, often bypasses WAFs)
        (u) => `https://images.weserv.nl/?url=${encodeURIComponent(u)}`,
        // 2. AllOrigins
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        // 3. Corsproxy.io
        (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    ];

    for (const getProxyUrl of proxies) {
        try {
            const proxyUrl = getProxyUrl(url);
            console.log(`[Asset Migration] Trying proxy: ${proxyUrl}`);
            
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 100 && blob.type.startsWith('image/')) {
                    console.log(`[Asset Migration] ✅ Successfully fetched via proxy. Size: ${blob.size} bytes`);
                    return blob;
                } else {
                    console.warn(`[Asset Migration] Proxy returned invalid blob (size: ${blob.size}, type: ${blob.type})`);
                }
            } else {
                console.warn(`[Asset Migration] Proxy returned ${response.status} for: ${proxyUrl}`);
            }
        } catch (error) {
            console.warn(`[Asset Migration] Proxy fetch error for ${getProxyUrl(url)}:`, error.message);
        }
    }
    
    throw new Error("All CORS proxies failed. Mathpix's CDN is actively blocking proxy IPs. You must use a backend proxy (e.g., Vite proxy or Firebase Cloud Function).");
};

// ============================================================================
// HELPER: Migrate Mathpix CDN assets to Firebase Storage
// ============================================================================
export const extractAndUploadMathpixAssets = async (contents, problemId, fileType) => {
    const isArray = Array.isArray(contents);
    const stringsToProcess = isArray ? contents : [contents];
    
    const mathpixUrlRegex = /https?:\/\/[a-zA-Z0-9.-]*mathpix\.com\/[^\s\)"'\}>]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s\)"'\}>]*)?/gi;
    const allMatches = new Set();
    
    stringsToProcess.forEach((str, index) => {
        if (typeof str === 'string') {
            const matches = str.match(mathpixUrlRegex);
            if (matches) {
                const cleanMatches = matches.map(url => url.replace(/[}\]>]+$/, ''));
                console.log(`[Asset Migration] ✅ Found ${cleanMatches.length} Mathpix URLs in block ${index}`);
                cleanMatches.forEach(match => allMatches.add(match));
            }
        }
    });
    
    const uniqueUrls = Array.from(allMatches);
    console.log(`[Asset Migration] Total unique Mathpix URLs to migrate: ${uniqueUrls.length}`);
    
    if (uniqueUrls.length === 0) {
        return contents; 
    }

    const urlMapping = new Map();
    const storage = getStorage();

    for (const url of uniqueUrls) {
        try {
            console.log(`[Asset Migration] Downloading Mathpix asset: ${url}`);
            
            const blob = await fetchImageViaProxy(url);
            
            const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
            
            const fileName = `assets/${problemId}_${fileType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
            const storageRef = ref(storage, `problems/${problemId}/${fileName}`);
            
            console.log(`[Asset Migration] Uploading asset to Firebase Storage: ${fileName}`);
            await uploadBytes(storageRef, blob);
            
            const downloadURL = await getDownloadURL(storageRef);
            console.log(`[Asset Migration] ✅ Successfully uploaded asset. New URL: ${downloadURL}`);
            
            urlMapping.set(url, downloadURL);
            
        } catch (error) {
            console.error(`[Asset Migration] ❌ Error processing Mathpix asset ${url}:`, error.message);
            // We continue to the next URL instead of failing the whole submission
        }
    }

    const replaceInString = (str) => {
        if (typeof str !== 'string') return str;
        let updated = str;
        for (const [oldUrl, newUrl] of urlMapping.entries()) {
            const escapedUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const replaceRegex = new RegExp(escapedUrl, 'g');
            updated = updated.replace(replaceRegex, newUrl);
        }
        return updated;
    };

    const updatedStrings = stringsToProcess.map(replaceInString);
    console.log('[Asset Migration] ✅ URL replacement complete. Mapping:', Object.fromEntries(urlMapping));
    
    return isArray ? updatedStrings : updatedStrings[0];
};

export const convertToLatex = async (file, onProgress) => {
    try {
        if (!file) return { success: false, error: 'No file provided' };
        if (!isMathpixConfigured) return { success: false, error: 'Mathpix API credentials not configured.' };

        if (file.type === 'application/pdf') {
            const fileUrl = await uploadToTempStorage(file);
            const response = await axios.post(
                'https://api.mathpix.com/v3/pdf',
                {
                    url: fileUrl,
                    conversion_formats: { "tex.zip": true },
                    options: { formats: ['latex', 'text'], math_inline_delimiters: ['$', '$'], math_display_delimiters: ['$$', '$$'] }
                },
                { headers: { 'app_id': MATHpIX_APP_ID, 'app_key': MATHpIX_API_KEY, 'Content-Type': 'application/json' }, timeout: 60000 }
            );

            if (response.status === 200 && response.data && response.data.pdf_id) {
                const pdfId = response.data.pdf_id;
                if (onProgress) onProgress(25);
                
                const statusResult = await pollForPdfCompletion(pdfId, onProgress);
                if (!statusResult.completed) return { success: false, error: statusResult.error || 'PDF processing failed' };
                
                if (onProgress) onProgress(75);
                
                const mmdResult = await downloadPdfResults(pdfId, 'mmd');
                if (onProgress) onProgress(100);
                
                if (mmdResult.success) {
                    return { success: true, latex: mmdResult.content, text: mmdResult.content, confidence: 100, rawResponse: { pdf_id: pdfId, format: 'mmd' } };
                }
                
                const texResult = await downloadPdfResults(pdfId, 'tex.zip');
                if (texResult.success) {
                    return { success: true, latex: texResult.content, text: texResult.content, confidence: 100 };
                }
                
                return { success: false, error: mmdResult.error || 'Failed to download PDF results' };
            }
            return { success: false, error: 'Failed to upload PDF to Mathpix' };
        }

        const fileUrl = await uploadToTempStorage(file);
        const response = await axios.post(
            'https://api.mathpix.com/v3/text',
            {
                url: fileUrl,
                formats: ['latex', 'text'],
                math_inline_delimiters: ['$', '$'],
                math_display_delimiters: ['$$', '$$'],
                enable_table_detection: true,
                enable_diagram_detection: true
            },
            { headers: { 'app_id': MATHpIX_APP_ID, 'app_key': MATHpIX_API_KEY, 'Content-Type': 'application/json' }, timeout: 60000 }
        );

        if (response.status === 200 && response.data) {
            let latexText = '';
            let plainText = '';
            let confidence = 0;

            if (response.data.latex) latexText = Array.isArray(response.data.latex) ? response.data.latex.join('\n\n') : response.data.latex;
            if (response.data.text) plainText = Array.isArray(response.data.text) ? response.data.text.join('\n\n') : response.data.text;
            if (response.data.confidence) confidence = response.data.confidence;

            if (latexText || plainText) {
                return { success: true, latex: latexText || plainText || 'No content extracted', text: plainText || latexText || 'No content extracted', confidence: confidence || 0, rawResponse: response.data };
            }
        }

        return { success: false, error: 'No LaTeX or text content found in API response', rawResponse: response.data };
    } catch (error) {
        let errorMessage = 'Failed to convert to LaTeX';
        if (error.response) {
            if (error.response.status === 401) errorMessage = 'Invalid Mathpix API credentials.';
            else if (error.response.status === 429) errorMessage = 'Mathpix API rate limit exceeded.';
            else if (error.response.status === 413) errorMessage = 'File too large for Mathpix API.';
            else errorMessage = `Mathpix API error: ${error.response.status}`;
        } else if (error.request) {
            errorMessage = 'No response from Mathpix API. Check internet connection.';
        } else {
            errorMessage = error.message || 'Unknown error occurred';
        }
        return { success: false, error: errorMessage, details: error.response?.data || error.message };
    }
};

export const processFilesWithMathpix = async (files, onProgress) => {
    const results = [];
    let processedCount = 0;

    for (const file of files) {
        try {
            const fileProgressCallback = (progress) => {
                const overallProgress = ((processedCount / files.length) * 100) + (progress / files.length);
                if (onProgress) onProgress(overallProgress);
            };
            
            const result = await convertToLatex(file, fileProgressCallback);
            results.push({ fileName: file.name, ...result });
            processedCount++;
            
            if (onProgress) onProgress((processedCount / files.length) * 100);
        } catch (error) {
            results.push({ fileName: file.name, success: false, error: error.message || 'Failed to process file' });
            processedCount++;
            if (onProgress) onProgress((processedCount / files.length) * 100);
        }
    }
    return results;
};

export const fetchProblemsFromFirestore = async () => {
    try {
        const problemsCollection = collection(db, 'Problems');
        const problemsQuery = query(problemsCollection, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(problemsQuery);
        
        const problems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            problems.push({
                id: doc.id,
                competition: data.competition || '',
                difficulty: data.difficulty || '',
                topic: data.topic || '',
                title: data.title || '',
                text: data.problemLatex || data.problemText || 'No problem statement available',
                year: data.year || null,
                solution: data.solutionLatex || data.solutionText || 'No solution available',
                problemSource: data.problemSource || '',
                subtags: data.subtags || [],
                problemLatex: data.problemLatex || '',
                solutionLatex: data.solutionLatex || '',
                problemStatementUrls: data.problemStatementUrls || [],
                solutionUrls: data.solutionUrls || [],
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            });
        });
        
        return { success: true, problems };
    } catch (error) {
        console.error('Error fetching problems:', error);
        return { success: false, error: error.message };
    }
};

export { auth, onAuthStateChanged, db };