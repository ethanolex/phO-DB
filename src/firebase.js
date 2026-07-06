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

// DEBUG: Log all environment variables (remove this in production)
console.log('Environment variables loaded:');
console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✓ Present' : '✗ Missing');
console.log('VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✓ Present' : '✗ Missing');
console.log('VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✓ Present' : '✗ Missing');
console.log('VITE_FIREBASE_STORAGE_BUCKET:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '✓ Present' : '✗ Missing');
console.log('VITE_FIREBASE_MESSAGING_SENDER_ID:', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '✓ Present' : '✗ Missing');
console.log('VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✓ Present' : '✗ Missing');
console.log('VITE_MATHPIX_APP_ID:', import.meta.env.VITE_MATHPIX_APP_ID ? '✓ Present' : '✗ Missing');
console.log('VITE_MATHPIX_API_KEY:', import.meta.env.VITE_MATHPIX_API_KEY ? '✓ Present' : '✗ Missing');

// Your Firebase configuration object - USING VITE ENVIRONMENT VARIABLES
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('Firebase Config loaded');

// Validate that all required environment variables are set
const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('Make sure your .env file is in the root directory of your project.');
    console.error('And remember to restart the dev server after creating/updating .env');
}

// Initialize Firebase
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

// Mathpix API Configuration - USING VITE ENVIRONMENT VARIABLES
const MATHpIX_APP_ID = import.meta.env.VITE_MATHPIX_APP_ID;
const MATHpIX_API_KEY = import.meta.env.VITE_MATHPIX_API_KEY;

// Check if Mathpix credentials are configured
const isMathpixConfigured = MATHpIX_APP_ID && MATHpIX_API_KEY && 
    MATHpIX_APP_ID !== 'your_mathpix_app_id' && 
    MATHpIX_API_KEY !== 'your_mathpix_api_key';

if (!isMathpixConfigured) {
    console.warn('⚠️ Mathpix API credentials not configured. Please add VITE_MATHPIX_APP_ID and VITE_MATHPIX_API_KEY to your .env file.');
}

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

// Poll for PDF completion status only (no result extraction)
const pollForPdfCompletion = async (pdfId, onProgress, maxAttempts = 60, delayMs = 2000) => {
    console.log(`Polling for PDF completion with ID: ${pdfId}`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Polling attempt ${attempt}/${maxAttempts}...`);
            
            const response = await axios.get(
                `https://api.mathpix.com/v3/pdf/${pdfId}`,
                {
                    headers: {
                        'app_id': MATHpIX_APP_ID,
                        'app_key': MATHpIX_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log(`Status response:`, JSON.stringify(response.data, null, 2));

            if (response.status === 200 && response.data) {
                const status = response.data.status;
                const percentDone = response.data.percent_done || 0;
                
                // Update progress (25% to 75% range for polling)
                if (onProgress) {
                    onProgress(25 + (percentDone * 0.5));
                }
                
                if (status === 'completed') {
                    console.log('✅ PDF processing completed!');
                    return { completed: true, rawResponse: response.data };
                } else if (status === 'error' || status === 'failed') {
                    console.error('❌ PDF processing failed:', response.data.error || 'Unknown error');
                    return { 
                        completed: false, 
                        error: response.data.error || 'PDF processing failed',
                        rawResponse: response.data 
                    };
                } else {
                    console.log(`⏳ PDF still processing (status: ${status}, progress: ${percentDone}%)`);
                }
            }

            // Wait before next attempt
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        } catch (error) {
            console.error(`Polling attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                return {
                    completed: false,
                    error: 'PDF processing timed out after ' + maxAttempts + ' attempts'
                };
            }
        }
    }

    return {
        completed: false,
        error: 'PDF processing timed out after ' + maxAttempts + ' attempts'
    };
};

// Download PDF results from the format-specific endpoint
const downloadPdfResults = async (pdfId, format = 'mmd') => {
    try {
        const url = `https://api.mathpix.com/v3/pdf/${pdfId}.${format}`;
        console.log(`Downloading results from: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'app_id': MATHpIX_APP_ID,
                'app_key': MATHpIX_API_KEY
            },
            timeout: 60000,
            // For text formats like .mmd, we want the response as text
            responseType: format === 'tex.zip' ? 'arraybuffer' : 'text'
        });

        console.log(`Download response status: ${response.status}`);

        if (response.status === 200) {
            if (format === 'tex.zip') {
                // For zip files, we'd need to extract - but let's try to get text content
                // For now, return a message that zip was downloaded
                return {
                    success: true,
                    content: '[LaTeX zip file downloaded - contains .tex files]',
                    rawResponse: { size: response.data.byteLength }
                };
            } else {
                // For text formats like .mmd, .md
                const content = typeof response.data === 'string' ? response.data : String(response.data);
                
                if (content && content.length > 0) {
                    return {
                        success: true,
                        content: content,
                        rawResponse: { length: content.length }
                    };
                } else {
                    return {
                        success: false,
                        error: 'Empty response from download endpoint',
                        rawResponse: response.data
                    };
                }
            }
        } else {
            return {
                success: false,
                error: `Download failed with status ${response.status}`,
                rawResponse: response.data
            };
        }
    } catch (error) {
        console.error(`❌ Failed to download PDF results:`, error);
        
        let errorMessage = 'Failed to download PDF results';
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            
            if (error.response.status === 404) {
                errorMessage = `Format '${format}' not available for this PDF. The conversion may still be processing.`;
            } else if (error.response.status === 401) {
                errorMessage = 'Invalid Mathpix API credentials.';
            } else {
                errorMessage = `Download failed: ${error.response.status}`;
            }
        } else if (error.request) {
            errorMessage = 'No response from server. Please check your internet connection.';
        } else {
            errorMessage = error.message || 'Unknown error occurred';
        }
        
        return {
            success: false,
            error: errorMessage,
            rawResponse: error.response?.data || null
        };
    }
};

// FIXED: Main conversion function
export const convertToLatex = async (file, onProgress) => {
    try {
        if (!file) {
            return {
                success: false,
                error: 'No file provided'
            };
        }

        if (!isMathpixConfigured) {
            return {
                success: false,
                error: 'Mathpix API credentials not configured. Please check your environment variables.'
            };
        }

        console.log('Converting file:', file.name, 'Type:', file.type, 'Size:', file.size);

        // For PDFs - FIXED VERSION
        if (file.type === 'application/pdf') {
            console.log('Processing PDF file...');
            
            try {
                // Upload PDF to get a public URL
                const fileUrl = await uploadToTempStorage(file);
                console.log('PDF uploaded to:', fileUrl);
                
                // FIXED: Only request formats that need conversion (mmd is always available)
                const response = await axios.post(
                    'https://api.mathpix.com/v3/pdf',
                    {
                        url: fileUrl,
                        // FIXED: Only include formats that need explicit conversion
                        // mmd is always generated automatically, so don't include it here
                        conversion_formats: {
                            "tex.zip": true   // Request LaTeX zip format
                        },
                        options: {
                            formats: ['latex', 'text'],
                            math_inline_delimiters: ['$', '$'],
                            math_display_delimiters: ['$$', '$$']
                        }
                    },
                    {
                        headers: {
                            'app_id': MATHpIX_APP_ID,
                            'app_key': MATHpIX_API_KEY,
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
                    }
                );

                console.log('Upload Response:', JSON.stringify(response.data, null, 2));

                if (response.status === 200 && response.data && response.data.pdf_id) {
                    const pdfId = response.data.pdf_id;
                    console.log(`✅ PDF uploaded successfully with ID: ${pdfId}`);
                    
                    if (onProgress) {
                        onProgress(25);
                    }
                    
                    // Poll for completion status
                    console.log('Polling for PDF completion...');
                    const statusResult = await pollForPdfCompletion(pdfId, onProgress);
                    
                    if (!statusResult.completed) {
                        return {
                            success: false,
                            error: statusResult.error || 'PDF processing failed or timed out',
                            rawResponse: statusResult.rawResponse
                        };
                    }
                    
                    if (onProgress) {
                        onProgress(75);
                    }
                    
                    // FIXED: Download the .mmd file (always available, no need to request it)
                    console.log('Downloading Mathpix Markdown results...');
                    const mmdResult = await downloadPdfResults(pdfId, 'mmd');
                    
                    if (onProgress) {
                        onProgress(100);
                    }
                    
                    if (mmdResult.success) {
                        console.log(`✅ Successfully extracted ${mmdResult.content.length} characters from PDF`);
                        return {
                            success: true,
                            latex: mmdResult.content,
                            text: mmdResult.content,
                            confidence: 100,
                            rawResponse: { pdf_id: pdfId, format: 'mmd' }
                        };
                    } else {
                        // Fallback: try tex.zip if mmd fails
                        console.log('MMD failed, trying tex.zip fallback...');
                        const texResult = await downloadPdfResults(pdfId, 'tex.zip');
                        
                        if (texResult.success) {
                            console.log(`✅ Successfully extracted LaTeX from PDF (tex.zip)`);
                            return {
                                success: true,
                                latex: texResult.content,
                                text: texResult.content,
                                confidence: 100,
                                rawResponse: { pdf_id: pdfId, format: 'tex.zip' }
                            };
                        }
                        
                        return {
                            success: false,
                            error: mmdResult.error || 'Failed to download PDF results',
                            rawResponse: mmdResult.rawResponse
                        };
                    }
                } else {
                    return {
                        success: false,
                        error: 'Failed to upload PDF to Mathpix',
                        rawResponse: response.data
                    };
                }
            } catch (pdfError) {
                console.error('❌ PDF processing error:', pdfError);
                
                if (pdfError.response) {
                    console.error('Response status:', pdfError.response.status);
                    console.error('Response data:', pdfError.response.data);
                    
                    if (pdfError.response.status === 413) {
                        return {
                            success: false,
                            error: 'PDF file is too large. Please try a smaller file (under 10MB).'
                        };
                    }
                }
                
                return {
                    success: false,
                    error: pdfError.message || 'Failed to process PDF',
                    details: pdfError.response?.data || null
                };
            }
        }

        // For images - use the existing method (unchanged)
        console.log('Processing image file...');
        const fileUrl = await uploadToTempStorage(file);
        console.log('Image uploaded to:', fileUrl);

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
            {
                headers: {
                    'app_id': MATHpIX_APP_ID,
                    'app_key': MATHpIX_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        console.log('Image Response Status:', response.status);

        if (response.status === 200 && response.data) {
            let latexText = '';
            let plainText = '';
            let confidence = 0;

            if (response.data.latex) {
                if (Array.isArray(response.data.latex)) {
                    latexText = response.data.latex.join('\n\n');
                } else if (typeof response.data.latex === 'string') {
                    latexText = response.data.latex;
                }
            }

            if (response.data.text) {
                if (Array.isArray(response.data.text)) {
                    plainText = response.data.text.join('\n\n');
                } else if (typeof response.data.text === 'string') {
                    plainText = response.data.text;
                }
            }

            if (response.data.confidence) {
                confidence = response.data.confidence;
            }

            if (latexText || plainText) {
                console.log('✅ Successfully extracted content from image. Length:', (latexText || plainText).length);
                return {
                    success: true,
                    latex: latexText || plainText || 'No content extracted',
                    text: plainText || latexText || 'No content extracted',
                    confidence: confidence || 0,
                    rawResponse: response.data
                };
            } else {
                const fullResponse = JSON.stringify(response.data);
                if (fullResponse.length > 10) {
                    console.log('No specific fields found, using full response as text');
                    return {
                        success: true,
                        latex: fullResponse,
                        text: fullResponse,
                        confidence: 0,
                        rawResponse: response.data
                    };
                }
            }
        }

        return {
            success: false,
            error: 'No LaTeX or text content found in API response',
            rawResponse: response.data
        };
    } catch (error) {
        console.error('❌ Mathpix API error details:', error);
        
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
            } else if (error.response.status === 404) {
                errorMessage = 'Mathpix API endpoint not found. Please check the API URL.';
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
            
            const fileProgressCallback = (progress) => {
                const overallProgress = ((processedCount / files.length) * 100) + (progress / files.length);
                if (onProgress) {
                    onProgress(overallProgress);
                }
            };
            
            const result = await convertToLatex(file, fileProgressCallback);
            
            if (result.success) {
                console.log(`✅ Successfully processed ${file.name}`);
                console.log(`Extracted ${result.latex.length} characters of content`);
            } else {
                console.warn(`❌ Failed to process ${file.name}:`, result.error);
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
            console.error(`❌ Error processing file ${file.name}:`, error);
            results.push({
                fileName: file.name,
                success: false,
                error: error.message || 'Failed to process file'
            });
            
            processedCount++;
            if (onProgress) {
                onProgress((processedCount / files.length) * 100);
            }
        }
    }

    return results;
};

export { auth, onAuthStateChanged, db };