import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { 
    registerUser, 
    loginUser, 
    resetPassword, 
    addProblemToFirestore, 
    uploadProblemFiles,
    processFilesWithMathpix,
    convertToLatex
} from './firebase';
import './App.css';

const App = () => {
    // Navigation state
    const [currentPage, setCurrentPage] = useState('database');
    const { currentUser, loading: authLoading, logout, error: authError, setError } = useAuth();
    
    // Sample database (same as before)
    const questionsDB = [
        { id: 1, competition: "IPhO", difficulty: "Hard", topic: "Mechanics", title: "Rolling Spool on Incline", text: "A spool of mass M and moment of inertia I rolls without slipping on an inclined plane. Find acceleration of its center of mass.", year: 2019, solution: "The acceleration is a = (g sin θ) / (1 + I/(MR²)). For a solid cylinder, I = ½MR², so a = (2/3)g sin θ." },
        { id: 2, competition: "IPhO", difficulty: "Hard", topic: "Thermodynamics", title: "Carnot Cycle with Real Gas", text: "Analyze efficiency of a Carnot engine using van der Waals gas. Derive expression for work done.", year: 2020, solution: "The efficiency remains η = 1 - T_c/T_h, as it depends only on temperatures for a reversible cycle." },
        { id: 3, competition: "IPhO", difficulty: "Medium", topic: "Electromagnetism", title: "Charged Ring Oscillations", text: "A charged particle moves along axis of a uniformly charged ring. Find frequency of small oscillations.", year: 2018, solution: "ω = √(kQq/(mR³)) where Q is ring charge, q is particle charge, R is ring radius." },
        { id: 4, competition: "JPhO", difficulty: "Easy", topic: "Optics", title: "Refraction in Prism", text: "A ray enters a prism of refractive index 1.5 at grazing incidence. Find deviation angle.", year: 2021, solution: "δ = 180° - 2A, where A is prism angle. For minimum deviation, δ_min = 2 sin⁻¹(n sin(A/2)) - A." },
        { id: 5, competition: "USAPhO", difficulty: "Hard", topic: "Modern Physics", title: "Photoelectric Effect Threshold", text: "When light of wavelength 200 nm hits a metal, stopping potential is 2V. Find work function.", year: 2017, solution: "φ = hc/λ - eV_stop = (1240 eV·nm)/(200 nm) - 2 eV = 6.2 eV - 2 eV = 4.2 eV" },
        { id: 6, competition: "JPhO", difficulty: "Medium", topic: "Mechanics", title: "Pulley System Dynamics", text: "Two masses connected by string over pulley, one on rough table. Find acceleration.", year: 2020, solution: "a = (m₂g - μ m₁g)/(m₁ + m₂) for m₂ hanging vertically." },
        { id: 7, competition: "USAPhO", difficulty: "Medium", topic: "Electromagnetism", title: "RC Circuit Transient", text: "Capacitor initially charged, discharges through resistor R. Derive voltage decay.", year: 2019, solution: "V(t) = V₀ e^{-t/RC}, time constant τ = RC." },
        { id: 8, competition: "IPhO", difficulty: "Hard", topic: "Optics", title: "Diffraction Grating Resolution", text: "A grating with 600 lines/mm is used to resolve sodium doublet. Find minimum width.", year: 2016, solution: "R = λ/Δλ = Nm, so N = λ/(mΔλ). For sodium doublet, λ ≈ 589 nm, Δλ = 0.6 nm." },
        { id: 9, competition: "JPhO", difficulty: "Easy", topic: "Thermodynamics", title: "Ideal Gas Expansion", text: "One mole of ideal gas expands isothermally from V1 to V2. Compute heat absorbed.", year: 2022, solution: "Q = W = nRT ln(V₂/V₁)" },
        { id: 10, competition: "USAPhO", difficulty: "Hard", topic: "Modern Physics", title: "Bohr Model for Muonic Atom", text: "Muon replaces electron in hydrogen. Find ground state energy and radius.", year: 2021, solution: "E_n = - (μ e⁴)/(8ε₀² h² n²), r_n = (4πε₀ h² n²)/(μ e²), where μ is reduced mass." },
        { id: 11, competition: "IPhO", difficulty: "Medium", topic: "Electromagnetism", title: "Magnetic Field of Solenoid", text: "Long solenoid with n turns per meter carries current I. Find field inside and inductance per unit length.", year: 2015, solution: "B = μ₀nI, L/l = μ₀n²A" },
        { id: 12, competition: "JPhO", difficulty: "Easy", topic: "Mechanics", title: "Projectile on Incline", text: "Projectile launched from incline hits incline again. Find range along incline.", year: 2019, solution: "R = (2v₀² sin θ cos(θ-α))/(g cos²α)" },
        { id: 13, competition: "USAPhO", difficulty: "Medium", topic: "Thermodynamics", title: "Entropy Change of Mixing", text: "Two gases separated by partition, after removal find entropy change.", year: 2020, solution: "ΔS = n₁R ln((V₁+V₂)/V₁) + n₂R ln((V₁+V₂)/V₂)" },
        { id: 14, competition: "IPhO", difficulty: "Hard", topic: "Modern Physics", title: "Relativistic Doppler Shift", text: "A star moving away emits light of wavelength λ0. Observed wavelength shift formula.", year: 2017, solution: "λ_obs = λ₀ √((1+β)/(1-β)) where β = v/c" },
        { id: 15, competition: "USAPhO", difficulty: "Easy", topic: "Optics", title: "Mirror Magnification", text: "An object placed 20cm from concave mirror (f=15cm). Find image position and magnification.", year: 2018, solution: "1/f = 1/u + 1/v → v = 60 cm, m = -v/u = -3" }
    ];

    const allCompetitions = [...new Set(questionsDB.map(q => q.competition))].sort();
    const allDifficulties = [...new Set(questionsDB.map(q => q.difficulty))].sort((a,b) => {
        const order = { "Easy": 1, "Medium": 2, "Hard": 3 };
        return order[a] - order[b];
    });
    const allTopics = [...new Set(questionsDB.map(q => q.topic))].sort();

    const [selectedCompetitions, setSelectedCompetitions] = useState([]);
    const [selectedDifficulties, setSelectedDifficulties] = useState([]);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    
    const toggleFilter = useCallback((value, currentArray, setArray) => {
        if (currentArray.includes(value)) {
            setArray(currentArray.filter(v => v !== value));
        } else {
            setArray([...currentArray, value]);
        }
    }, []);
    
    const clearFilters = useCallback(() => {
        setSelectedCompetitions([]);
        setSelectedDifficulties([]);
        setSelectedTopics([]);
        setSearchQuery("");
    }, []);
    
    const filteredQuestions = useMemo(() => {
        let results = [...questionsDB];
        
        if (selectedCompetitions.length > 0) {
            results = results.filter(q => selectedCompetitions.includes(q.competition));
        }
        if (selectedDifficulties.length > 0) {
            results = results.filter(q => selectedDifficulties.includes(q.difficulty));
        }
        if (selectedTopics.length > 0) {
            results = results.filter(q => selectedTopics.includes(q.topic));
        }
        if (searchQuery.trim() !== "") {
            const lowerQuery = searchQuery.toLowerCase();
            results = results.filter(q => 
                q.title.toLowerCase().includes(lowerQuery) || 
                q.text.toLowerCase().includes(lowerQuery)
            );
        }
        return results;
    }, [selectedCompetitions, selectedDifficulties, selectedTopics, searchQuery]);
    
    const activeFiltersCount = selectedCompetitions.length + selectedDifficulties.length + selectedTopics.length + (searchQuery !== "" ? 1 : 0);
    
    const getCompetitionClass = useCallback((comp) => {
        if (comp === "IPhO") return "competition-ipho";
        if (comp === "USAPhO") return "competition-usapho";
        return "competition-jpho";
    }, []);
    
    const getDifficultyClass = useCallback((diff) => {
        if (diff === "Easy") return "difficulty-easy";
        if (diff === "Medium") return "difficulty-medium";
        return "difficulty-hard";
    }, []);
    
    // Navigation component
    const Navigation = useCallback(() => (
        <nav className="navbar">
            <div className="nav-container">
                <div className="nav-brand" onClick={() => setCurrentPage('home')}>
                    <i className="fas fa-atom"></i>
                    <span>phO-DB</span>
                </div>
                <div className="nav-menu">
                    <button 
                        className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('home')}
                    >
                        <i className="fas fa-home"></i>
                        <span>Home</span>
                    </button>
                    <button 
                        className={`nav-link ${currentPage === 'database' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('database')}
                    >
                        <i className="fas fa-database"></i>
                        <span>Database</span>
                    </button>
                    <button 
                        className={`nav-link ${currentPage === 'contribute' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('contribute')}
                    >
                        <i className="fas fa-plus-circle"></i>
                        <span>Contribute</span>
                    </button>
                    {!authLoading && (
                        !currentUser ? (
                            <button 
                                className={`nav-link ${currentPage === 'login' ? 'active' : ''}`}
                                onClick={() => setCurrentPage('login')}
                            >
                                <i className="fas fa-user"></i>
                                <span>Login</span>
                            </button>
                        ) : (
                            <div className="user-menu">
                                <button className="nav-link user-btn">
                                    <i className="fas fa-user-circle"></i>
                                    <span>{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                                </button>
                                <button onClick={handleLogout} className="nav-link logout-btn">
                                    <i className="fas fa-sign-out-alt"></i>
                                    <span>Logout</span>
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </nav>
    ), [currentPage, authLoading, currentUser]);
    
    const handleLogout = useCallback(async () => {
        await logout();
        setCurrentPage('home');
    }, [logout]);
    
    // Search component with proper focus handling
    const SearchBox = useCallback(() => (
        <div className="search-box">
            <label><i className="fas fa-search"></i> Search</label>
            <div className="search-input-wrapper">
                <i className="fas fa-search search-icon"></i>
                <input
                    type="text"
                    placeholder="Title or problem text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    autoComplete="off"
                />
            </div>
        </div>
    ), [searchQuery]);
    
    // Home Page Component
    const HomePage = useCallback(() => (
        <div className="home-page">
            <div className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">
                        The phO Database
                    </h1>
                    <p className="hero-subtitle">
                        Access a database of physics problems from olympiads and textbooks.
                        Practice and learn from questions from <b>specific topics and competitions.</b>
                    </p>
                    <div className="hero-buttons">
                        <button className="hero-btn primary" onClick={() => setCurrentPage('database')}>
                            Browse Database <i className="fas fa-arrow-right"></i>
                        </button>
                        <button className="hero-btn secondary" onClick={() => setCurrentPage('contribute')}>
                            Contribute Problems <i className="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div className="hero-stats">
                    <div className="stat-card">
                        <i className="fas fa-database"></i>
                        <div className="stat-number">{questionsDB.length}</div>
                        <div className="stat-label">Problems</div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-trophy"></i>
                        <div className="stat-number">3</div>
                        <div className="stat-label">Competitions</div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-chart-line"></i>
                        <div className="stat-number">6</div>
                        <div className="stat-label">Topics</div>
                    </div>
                </div>
            </div>
            
            <div className="features-section">
                <h2>Why Choose PhysOlympiad?</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <i className="fas fa-search"></i>
                        <h3>Advanced Filtering</h3>
                        <p>Filter problems by competition, difficulty, topic, and search by keywords</p>
                    </div>
                    <div className="feature-card">
                        <i className="fas fa-lightbulb"></i>
                        <h3>Detailed Solutions</h3>
                        <p>Each problem comes with a comprehensive solution and explanation</p>
                    </div>
                    <div className="feature-card">
                        <i className="fas fa-users"></i>
                        <h3>Community Driven</h3>
                        <p>Contribute your own problems and help others learn</p>
                    </div>
                    <div className="feature-card">
                        <i className="fas fa-mobile-alt"></i>
                        <h3>Responsive Design</h3>
                        <p>Access the database from any device, anytime</p>
                    </div>
                </div>
            </div>
        </div>
    ), [questionsDB.length]);
    
    // Database Page Component - Memoized to prevent unnecessary re-renders
    const DatabasePage = useCallback(() => {
        // Use local state for the search input to prevent losing focus
        const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
        
        // Update global search query when user stops typing (debounced)
        useEffect(() => {
            const timer = setTimeout(() => {
                setSearchQuery(localSearchQuery);
            }, 300);
            
            return () => clearTimeout(timer);
        }, [localSearchQuery, setSearchQuery]);
        
        return (
            <>
                <div className="two-column-layout">
                    <aside className="sidebar">
                        <div className="sidebar-header">
                            <h2><i className="fas fa-sliders-h"></i> Filters</h2>
                            {activeFiltersCount > 0 && (
                                <button onClick={clearFilters} className="reset-btn">
                                    <i className="fas fa-undo-alt"></i> Reset all
                                </button>
                            )}
                        </div>
                        
                        <div className="search-box">
                            <label><i className="fas fa-search"></i> Search</label>
                            <div className="search-input-wrapper">
                                <i className="fas fa-search search-icon"></i>
                                <input
                                    type="text"
                                    placeholder="Title or problem text..."
                                    value={localSearchQuery}
                                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                                    className="search-input"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        
                        <div className="filter-group">
                            <div className="filter-group-title">
                                <i className="fas fa-trophy"></i> Competition
                            </div>
                            <div className="filter-buttons">
                                {allCompetitions.map(comp => (
                                    <button
                                        key={comp}
                                        onClick={() => toggleFilter(comp, selectedCompetitions, setSelectedCompetitions)}
                                        className={`filter-btn ${selectedCompetitions.includes(comp) ? 'active' : ''}`}
                                    >
                                        {comp}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="filter-group">
                            <div className="filter-group-title">
                                <i className="fas fa-chart-line"></i> Difficulty
                            </div>
                            <div className="filter-buttons">
                                {allDifficulties.map(diff => (
                                    <button
                                        key={diff}
                                        onClick={() => toggleFilter(diff, selectedDifficulties, setSelectedDifficulties)}
                                        className={`filter-btn ${selectedDifficulties.includes(diff) ? 'active' : ''}`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="filter-group">
                            <div className="filter-group-title">
                                <i className="fas fa-atom"></i> Topic
                            </div>
                            <div className="filter-buttons">
                                {allTopics.map(topic => (
                                    <button
                                        key={topic}
                                        onClick={() => toggleFilter(topic, selectedTopics, setSelectedTopics)}
                                        className={`filter-btn ${selectedTopics.includes(topic) ? 'active' : ''}`}
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="stats-footer">
                            <span><i className="far fa-database"></i> {questionsDB.length} total</span>
                            <span><i className="far fa-filter"></i> {filteredQuestions.length} shown</span>
                        </div>
                    </aside>
                    
                    <main className="main-content">
                        <div className="results-header">
                            <div className="results-title">
                                <i className="fas fa-layer-group" style={{ color: '#4f46e5' }}></i>
                                <h2>Questions</h2>
                                <span className="results-count">{filteredQuestions.length}</span>
                            </div>
                            
                            {activeFiltersCount > 0 && (
                                <div className="active-filters">
                                    {selectedCompetitions.map(comp => (
                                        <span key={comp} className="filter-tag">
                                            {comp}
                                            <button onClick={() => toggleFilter(comp, selectedCompetitions, setSelectedCompetitions)}>
                                                <i className="fas fa-times-circle"></i>
                                            </button>
                                        </span>
                                    ))}
                                    {selectedDifficulties.map(diff => (
                                        <span key={diff} className="filter-tag">
                                            {diff}
                                            <button onClick={() => toggleFilter(diff, selectedDifficulties, setSelectedDifficulties)}>
                                                <i className="fas fa-times-circle"></i>
                                            </button>
                                        </span>
                                    ))}
                                    {selectedTopics.map(topic => (
                                        <span key={topic} className="filter-tag">
                                            {topic}
                                            <button onClick={() => toggleFilter(topic, selectedTopics, setSelectedTopics)}>
                                                <i className="fas fa-times-circle"></i>
                                            </button>
                                        </span>
                                    ))}
                                    {searchQuery && (
                                        <span className="filter-tag">
                                            “{searchQuery}”
                                            <button onClick={() => {
                                                setSearchQuery("");
                                                setLocalSearchQuery("");
                                            }}>
                                                <i className="fas fa-times-circle"></i>
                                            </button>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {filteredQuestions.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <i className="fas fa-search"></i>
                                </div>
                                <h3>No matching questions</h3>
                                <p>Try adjusting your filters or search term.</p>
                                <button onClick={clearFilters} className="clear-filters-btn">
                                    Clear all filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="question-grid">
                                    {filteredQuestions.map(question => (
                                        <div key={question.id} className="question-card" onClick={() => setSelectedQuestion(question)}>
                                            <div className="card-content">
                                                <div className="card-badges">
                                                    <div className="badges-left">
                                                        <span className={`competition-badge ${getCompetitionClass(question.competition)}`}>
                                                            {question.competition}
                                                        </span>
                                                        <span className={`difficulty-badge ${getDifficultyClass(question.difficulty)}`}>
                                                            {question.difficulty}
                                                        </span>
                                                    </div>
                                                    {question.year && (
                                                        <span className="year-badge">{question.year}</span>
                                                    )}
                                                </div>
                                                <h3 className="card-title">{question.title}</h3>
                                                <div className="card-topic">
                                                    <i className="fas fa-tag"></i>
                                                    <span>{question.topic}</span>
                                                </div>
                                                <p className="card-text">{question.text}</p>
                                            </div>
                                            <div className="card-footer">
                                                <button className="view-details-btn">
                                                    View details <i className="fas fa-arrow-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="scroll-indicator">
                                    <i className="fas fa-arrow-down"></i> Scroll for more — {filteredQuestions.length} problem{filteredQuestions.length !== 1 ? 's' : ''} loaded
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </>
        );
    }, [
        searchQuery,
        selectedCompetitions,
        selectedDifficulties,
        selectedTopics,
        filteredQuestions,
        activeFiltersCount,
        allCompetitions,
        allDifficulties,
        allTopics,
        questionsDB.length,
        toggleFilter,
        clearFilters,
        getCompetitionClass,
        getDifficultyClass
    ]);
    
    // Login Page Component
    const LoginPage = useCallback(() => {
        const [isLogin, setIsLogin] = useState(true);
        const [showResetPassword, setShowResetPassword] = useState(false);
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [confirmPassword, setConfirmPassword] = useState('');
        const [displayName, setDisplayName] = useState('');
        const [resetEmail, setResetEmail] = useState('');
        const [loading, setLoading] = useState(false);
        const [message, setMessage] = useState('');
        const { setError, error } = useAuth();
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            setMessage('');
            setError(null);
            
            if (isLogin) {
                const result = await loginUser(email, password);
                if (result.success) {
                    setCurrentPage('database');
                } else {
                    setError(result.error);
                }
            } else {
                if (password !== confirmPassword) {
                    setError("Passwords don't match");
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError("Password must be at least 6 characters");
                    setLoading(false);
                    return;
                }
                const result = await registerUser(email, password, displayName);
                if (result.success) {
                    setCurrentPage('database');
                } else {
                    setError(result.error);
                }
            }
            setLoading(false);
        };
        
        const handleResetPassword = async (e) => {
            e.preventDefault();
            setLoading(true);
            setMessage('');
            setError(null);
            
            const result = await resetPassword(resetEmail);
            if (result.success) {
                setMessage('Password reset email sent! Check your inbox.');
                setTimeout(() => {
                    setShowResetPassword(false);
                    setResetEmail('');
                }, 3000);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };
        
        if (showResetPassword) {
            return (
                <div className="auth-page">
                    <div className="auth-container">
                        <div className="auth-card">
                            <div className="auth-header">
                                <i className="fas fa-key auth-icon"></i>
                                <h2>Reset Password</h2>
                                <p>Enter your email to receive a reset link</p>
                            </div>
                            
                            {message && <div className="success-message">{message}</div>}
                            {error && <div className="error-message">{error}</div>}
                            
                            <form className="auth-form" onSubmit={handleResetPassword}>
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <button type="submit" className="auth-submit" disabled={loading}>
                                    {loading ? 'Sending...' : 'Send Reset Email'}
                                </button>
                                <button 
                                    type="button" 
                                    className="back-to-login"
                                    onClick={() => {
                                        setShowResetPassword(false);
                                        setError(null);
                                        setMessage('');
                                    }}
                                >
                                    ← Back to Login
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="auth-header">
                            <i className="fas fa-atom auth-icon"></i>
                            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                            <p>{isLogin ? 'Sign in to access your account' : 'Join the physics community'}</p>
                        </div>
                        
                        {error && <div className="error-message">{error}</div>}
                        
                        <form className="auth-form" onSubmit={handleSubmit}>
                            {!isLogin && (
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="John Doe"
                                        required={!isLogin}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                />
                            </div>
                            {!isLogin && (
                                <div className="form-group">
                                    <label>Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}
                            <button type="submit" className="auth-submit" disabled={loading}>
                                {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                            </button>
                        </form>
                        
                        <div className="auth-footer">
                            <p>
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <button onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError(null);
                                }} className="auth-switch">
                                    {isLogin ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                            {isLogin && (
                                <p>
                                    <button 
                                        onClick={() => setShowResetPassword(true)}
                                        className="forgot-password"
                                    >
                                        Forgot password?
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [loginUser, registerUser, resetPassword, setCurrentPage]);
    
    // Contribute Page Component - Updated with Mathpix integration
    const ContributePage = useCallback(() => {
        const { currentUser } = useAuth();
        const [formData, setFormData] = useState({
            title: '',
            competition: '',
            difficulty: '',
            topic: '',
            year: '',
            problemFiles: [],
            solutionFiles: []
        });
        
        const [uploadProgress, setUploadProgress] = useState({
            problem: 0,
            solution: 0,
            ocr: 0,
            overall: 0
        });
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [uploadError, setUploadError] = useState(null);
        const [uploadSuccess, setUploadSuccess] = useState(false);
        const [uploadStatus, setUploadStatus] = useState('');
        const [latexPreview, setLatexPreview] = useState({
            problem: '',
            solution: ''
        });
        const [showLatexPreview, setShowLatexPreview] = useState(false);
        
        const problemFileInputRef = useRef(null);
        const solutionFileInputRef = useRef(null);
        
        if (!currentUser) {
            return (
                <div className="contribute-page">
                    <div className="auth-required">
                        <i className="fas fa-lock"></i>
                        <h2>Authentication Required</h2>
                        <p>Please log in to contribute problems to the database.</p>
                        <button onClick={() => setCurrentPage('login')} className="hero-btn primary">
                            Go to Login
                        </button>
                    </div>
                </div>
            );
        }
        
        const handleFileUpload = (files, type) => {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            const validFiles = Array.from(files).filter(file => {
                if (!validTypes.includes(file.type)) {
                    setUploadError(`Invalid file type: ${file.name}. Only images and PDFs are allowed.`);
                    return false;
                }
                if (file.size > maxSize) {
                    setUploadError(`File too large: ${file.name}. Maximum size is 10MB.`);
                    return false;
                }
                return true;
            });
            
            if (validFiles.length === 0) return;
            
            setFormData(prev => ({
                ...prev,
                [`${type}Files`]: [...prev[`${type}Files`], ...validFiles]
            }));
            
            setUploadError(null);
        };
        
        const removeFile = (index, type) => {
            setFormData(prev => ({
                ...prev,
                [`${type}Files`]: prev[`${type}Files`].filter((_, i) => i !== index)
            }));
        };
        
        const handlePreviewLatex = async (type) => {
            const files = type === 'problem' ? formData.problemFiles : formData.solutionFiles;
            if (files.length === 0) {
                setUploadError(`No ${type} files to preview`);
                return;
            }
            
            setUploadStatus(`Processing ${type} files for LaTeX preview...`);
            setShowLatexPreview(true);
            
            try {
                // Process only the first file for preview
                const result = await convertToLatex(files[0]);
                if (result.success) {
                    setLatexPreview(prev => ({
                        ...prev,
                        [type]: result.latex
                    }));
                    setUploadError(null);
                } else {
                    setUploadError(`Failed to convert ${type} file: ${result.error}`);
                }
            } catch (error) {
                setUploadError(`Error processing ${type} file: ${error.message}`);
            } finally {
                setUploadStatus('');
            }
        };
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            setUploadError(null);
            setUploadSuccess(false);
            setUploadStatus('Validating files...');
            
            // Validate that at least one file is uploaded for problem and solution
            if (formData.problemFiles.length === 0) {
                setUploadError('Please upload at least one problem statement file.');
                setIsSubmitting(false);
                return;
            }
            
            if (formData.solutionFiles.length === 0) {
                setUploadError('Please upload at least one solution file.');
                setIsSubmitting(false);
                return;
            }
            
            try {
                // Generate a unique ID for the problem
                const problemId = `problem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Step 1: Upload files to Firebase Storage
                setUploadStatus('Uploading problem files to storage...');
                const problemUrls = await uploadProblemFiles(
                    formData.problemFiles, 
                    problemId, 
                    'problem',
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, problem: Math.round(progress) }));
                    }
                );
                
                setUploadStatus('Uploading solution files to storage...');
                const solutionUrls = await uploadProblemFiles(
                    formData.solutionFiles, 
                    problemId, 
                    'solution',
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, solution: Math.round(progress) }));
                    }
                );
                
                // Step 2: Process files with Mathpix API to extract LaTeX
                setUploadStatus('Extracting LaTeX from problem files with Mathpix...');
                const problemLatexResults = await processFilesWithMathpix(
                    formData.problemFiles,
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, ocr: Math.round(progress * 0.5) }));
                    }
                );
                
                setUploadStatus('Extracting LaTeX from solution files with Mathpix...');
                const solutionLatexResults = await processFilesWithMathpix(
                    formData.solutionFiles,
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, ocr: 50 + Math.round(progress * 0.5) }));
                    }
                );
                
                // Combine LaTeX from all files
                const combinedProblemLatex = problemLatexResults
                    .filter(result => result.success)
                    .map(result => result.latex)
                    .join('\n\n');
                    
                const combinedSolutionLatex = solutionLatexResults
                    .filter(result => result.success)
                    .map(result => result.latex)
                    .join('\n\n');
                
                // Check if any files failed to convert
                const failedProblemFiles = problemLatexResults.filter(r => !r.success);
                const failedSolutionFiles = solutionLatexResults.filter(r => !r.success);
                
                if (failedProblemFiles.length > 0) {
                    console.warn('Some problem files failed to convert:', failedProblemFiles);
                }
                if (failedSolutionFiles.length > 0) {
                    console.warn('Some solution files failed to convert:', failedSolutionFiles);
                }
                
                // Step 3: Prepare data for Firestore
                setUploadStatus('Saving to database...');
                const problemData = {
                    title: formData.title,
                    competition: formData.competition,
                    difficulty: formData.difficulty,
                    topic: formData.topic,
                    year: parseInt(formData.year) || null,
                    problemStatementUrls: problemUrls,
                    solutionUrls: solutionUrls,
                    problemLatex: combinedProblemLatex || 'No LaTeX extracted from problem files',
                    solutionLatex: combinedSolutionLatex || 'No LaTeX extracted from solution files',
                    problemText: problemLatexResults
                        .filter(result => result.success)
                        .map(result => result.text)
                        .join('\n\n'),
                    solutionText: solutionLatexResults
                        .filter(result => result.success)
                        .map(result => result.text)
                        .join('\n\n'),
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    userDisplayName: currentUser.displayName || currentUser.email?.split('@')[0],
                    status: 'pending_review',
                    fileCount: {
                        problem: problemUrls.length,
                        solution: solutionUrls.length
                    },
                    ocrConfidence: {
                        problem: problemLatexResults
                            .filter(r => r.success)
                            .reduce((acc, r) => acc + (r.confidence || 0), 0) / 
                            Math.max(problemLatexResults.filter(r => r.success).length, 1),
                        solution: solutionLatexResults
                            .filter(r => r.success)
                            .reduce((acc, r) => acc + (r.confidence || 0), 0) / 
                            Math.max(solutionLatexResults.filter(r => r.success).length, 1)
                    }
                };
                
                // Save to Firestore
                const result = await addProblemToFirestore(problemData);
                
                if (result.success) {
                    setUploadSuccess(true);
                    setUploadStatus('Success!');
                    setUploadProgress({ problem: 100, solution: 100, ocr: 100, overall: 100 });
                    
                    // Show LaTeX preview on success
                    setLatexPreview({
                        problem: combinedProblemLatex,
                        solution: combinedSolutionLatex
                    });
                    setShowLatexPreview(true);
                    
                    // Reset form after success
                    setTimeout(() => {
                        setFormData({
                            title: '',
                            competition: '',
                            difficulty: '',
                            topic: '',
                            year: '',
                            problemFiles: [],
                            solutionFiles: []
                        });
                        setUploadProgress({ problem: 0, solution: 0, ocr: 0, overall: 0 });
                        setUploadSuccess(false);
                        setUploadStatus('');
                        setShowLatexPreview(false);
                        setLatexPreview({ problem: '', solution: '' });
                    }, 5000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error submitting problem:', error);
                setUploadError(`Failed to submit problem: ${error.message}`);
            } finally {
                setIsSubmitting(false);
            }
        };
        
        const handleChange = (e) => {
            setFormData({
                ...formData,
                [e.target.name]: e.target.value
            });
        };
        
        const formatFileSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        const getFileIcon = (file) => {
            if (file.type === 'application/pdf') return 'fa-file-pdf';
            if (file.type.startsWith('image/')) return 'fa-file-image';
            return 'fa-file';
        };
        
        return (
            <div className="contribute-page">
                <div className="contribute-header">
                    <h1><i className="fas fa-upload"></i> Contribute a Problem</h1>
                    <p>Share your knowledge with the physics community. Upload problem statements and solutions as images or PDFs.</p>
                    {currentUser && (
                        <div className="user-badge">
                            <i className="fas fa-user-check"></i>
                            <span>Contributing as: {currentUser.displayName || currentUser.email}</span>
                        </div>
                    )}
                </div>
                
                {uploadError && (
                    <div className="error-message" style={{ marginBottom: '20px' }}>
                        <i className="fas fa-exclamation-circle"></i> {uploadError}
                    </div>
                )}
                
                {uploadSuccess && (
                    <div className="success-message" style={{ marginBottom: '20px' }}>
                        <i className="fas fa-check-circle"></i> Problem submitted successfully! LaTeX extracted from {formData.problemFiles.length + formData.solutionFiles.length} files.
                    </div>
                )}
                
                {uploadStatus && !uploadSuccess && !uploadError && (
                    <div className="status-message" style={{ 
                        marginBottom: '20px', 
                        padding: '12px', 
                        background: '#e0f2fe', 
                        borderRadius: '8px',
                        color: '#0369a1'
                    }}>
                        <i className="fas fa-spinner fa-spin"></i> {uploadStatus}
                    </div>
                )}
                
                {/* LaTeX Preview Modal */}
                {showLatexPreview && (
                    <div className="latex-preview-modal">
                        <div className="latex-preview-content">
                            <div className="latex-preview-header">
                                <h3><i className="fas fa-code"></i> LaTeX Preview</h3>
                                <button 
                                    className="modal-close" 
                                    onClick={() => setShowLatexPreview(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="latex-preview-body">
                                {latexPreview.problem && (
                                    <div className="latex-section">
                                        <h4>Problem Statement LaTeX</h4>
                                        <pre className="latex-code">{latexPreview.problem}</pre>
                                    </div>
                                )}
                                {latexPreview.solution && (
                                    <div className="latex-section">
                                        <h4>Solution LaTeX</h4>
                                        <pre className="latex-code">{latexPreview.solution}</pre>
                                    </div>
                                )}
                            </div>
                            <div className="latex-preview-footer">
                                <button 
                                    className="close-modal-btn"
                                    onClick={() => setShowLatexPreview(false)}
                                >
                                    Close Preview
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                <form className="contribute-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Problem Title *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g., Projectile Motion on an Incline"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Competition *</label>
                            <select name="competition" value={formData.competition} onChange={handleChange} required disabled={isSubmitting}>
                                <option value="">Select competition</option>
                                <option value="IPhO">IPhO</option>
                                <option value="USAPhO">USAPhO</option>
                                <option value="JPhO">JPhO</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Difficulty *</label>
                            <select name="difficulty" value={formData.difficulty} onChange={handleChange} required disabled={isSubmitting}>
                                <option value="">Select difficulty</option>
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Topic *</label>
                            <select name="topic" value={formData.topic} onChange={handleChange} required disabled={isSubmitting}>
                                <option value="">Select topic</option>
                                <option value="Mechanics">Mechanics</option>
                                <option value="Thermodynamics">Thermodynamics</option>
                                <option value="Electromagnetism">Electromagnetism</option>
                                <option value="Optics">Optics</option>
                                <option value="Modern Physics">Modern Physics</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Year</label>
                            <input
                                type="number"
                                name="year"
                                value={formData.year}
                                onChange={handleChange}
                                placeholder="e.g., 2023"
                                min="1900"
                                max="2025"
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        {/* File Upload for Problem Statement */}
                        <div className="form-group full-width">
                            <label>Problem Statement Files *</label>
                            <div className="file-upload-area">
                                <div className="file-drop-zone" style={{ opacity: isSubmitting ? 0.6 : 1 }}>
                                    <i className="fas fa-cloud-upload-alt"></i>
                                    <p>Drag & drop files here or click to browse</p>
                                    <p className="file-hint">Supports images (JPG, PNG, GIF, WebP) and PDFs up to 10MB</p>
                                    <input
                                        type="file"
                                        ref={problemFileInputRef}
                                        onChange={(e) => handleFileUpload(e.target.files, 'problem')}
                                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,image/*,application/pdf"
                                        multiple
                                        className="file-input-hidden"
                                        onClick={(e) => e.target.value = null}
                                        disabled={isSubmitting}
                                    />
                                    <button 
                                        type="button" 
                                        className="file-select-btn"
                                        onClick={() => problemFileInputRef.current?.click()}
                                        disabled={isSubmitting}
                                    >
                                        <i className="fas fa-folder-open"></i> Browse Files
                                    </button>
                                </div>
                                
                                {uploadProgress.problem > 0 && uploadProgress.problem < 100 && (
                                    <div className="upload-progress">
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill" 
                                                style={{ width: `${uploadProgress.problem}%` }}
                                            ></div>
                                        </div>
                                        <span className="progress-text">{uploadProgress.problem}%</span>
                                    </div>
                                )}
                                
                                {formData.problemFiles.length > 0 && (
                                    <div className="file-list">
                                        <div className="file-list-header">
                                            <h4>Uploaded Files ({formData.problemFiles.length})</h4>
                                            <button 
                                                type="button"
                                                className="preview-latex-btn"
                                                onClick={() => handlePreviewLatex('problem')}
                                                disabled={isSubmitting}
                                            >
                                                <i className="fas fa-eye"></i> Preview LaTeX
                                            </button>
                                        </div>
                                        {formData.problemFiles.map((file, index) => (
                                            <div key={index} className="file-item">
                                                <i className={`fas ${getFileIcon(file)}`}></i>
                                                <div className="file-info">
                                                    <span className="file-name">{file.name}</span>
                                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    className="file-remove"
                                                    onClick={() => removeFile(index, 'problem')}
                                                    disabled={isSubmitting}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* File Upload for Solution */}
                        <div className="form-group full-width">
                            <label>Solution Files *</label>
                            <div className="file-upload-area">
                                <div className="file-drop-zone" style={{ opacity: isSubmitting ? 0.6 : 1 }}>
                                    <i className="fas fa-cloud-upload-alt"></i>
                                    <p>Drag & drop solution files here or click to browse</p>
                                    <p className="file-hint">Supports images (JPG, PNG, GIF, WebP) and PDFs up to 10MB</p>
                                    <input
                                        type="file"
                                        ref={solutionFileInputRef}
                                        onChange={(e) => handleFileUpload(e.target.files, 'solution')}
                                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,image/*,application/pdf"
                                        multiple
                                        className="file-input-hidden"
                                        onClick={(e) => e.target.value = null}
                                        disabled={isSubmitting}
                                    />
                                    <button 
                                        type="button" 
                                        className="file-select-btn"
                                        onClick={() => solutionFileInputRef.current?.click()}
                                        disabled={isSubmitting}
                                    >
                                        <i className="fas fa-folder-open"></i> Browse Files
                                    </button>
                                </div>
                                
                                {uploadProgress.solution > 0 && uploadProgress.solution < 100 && (
                                    <div className="upload-progress">
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill" 
                                                style={{ width: `${uploadProgress.solution}%` }}
                                            ></div>
                                        </div>
                                        <span className="progress-text">{uploadProgress.solution}%</span>
                                    </div>
                                )}
                                
                                {formData.solutionFiles.length > 0 && (
                                    <div className="file-list">
                                        <div className="file-list-header">
                                            <h4>Uploaded Files ({formData.solutionFiles.length})</h4>
                                            <button 
                                                type="button"
                                                className="preview-latex-btn"
                                                onClick={() => handlePreviewLatex('solution')}
                                                disabled={isSubmitting}
                                            >
                                                <i className="fas fa-eye"></i> Preview LaTeX
                                            </button>
                                        </div>
                                        {formData.solutionFiles.map((file, index) => (
                                            <div key={index} className="file-item">
                                                <i className={`fas ${getFileIcon(file)}`}></i>
                                                <div className="file-info">
                                                    <span className="file-name">{file.name}</span>
                                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    className="file-remove"
                                                    onClick={() => removeFile(index, 'solution')}
                                                    disabled={isSubmitting}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => setCurrentPage('database')} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i> Submitting...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane"></i> Submit Problem
                                </>
                            )}
                        </button>
                    </div>
                    
                    <div className="contribute-note">
                        <i className="fas fa-info-circle"></i>
                        <p>All submissions will be processed with Mathpix OCR to extract LaTeX, then reviewed before being published.</p>
                        <p className="file-requirements">
                            <strong>File Requirements:</strong>
                            <span>Maximum 10MB per file</span>
                            <span>Supported formats: JPG, PNG, GIF, WebP, PDF</span>
                            <span>LaTeX will be automatically extracted using Mathpix API</span>
                        </p>
                    </div>
                </form>
            </div>
        );
    }, [useAuth, setCurrentPage]);
    
    // Render the appropriate page
    const renderPage = useCallback(() => {
        if (authLoading) {
            return (
                <div className="loading-screen">
                    <div className="loader"></div>
                    <p>Loading...</p>
                </div>
            );
        }
        
        switch(currentPage) {
            case 'home':
                return <HomePage />;
            case 'database':
                return <DatabasePage />;
            case 'login':
                return <LoginPage />;
            case 'contribute':
                return <ContributePage />;
            default:
                return <HomePage />;
        }
    }, [currentPage, authLoading, HomePage, DatabasePage, LoginPage, ContributePage]);
    
    return (
        <div className="container">
            <Navigation />
            {renderPage()}
            <footer className="footer">
                <i className="far fa-copyright"></i> Sample database — real olympiad problems for demonstration. Built with React, Firebase & CSS.
            </footer>
            
            {/* Modal */}
            {selectedQuestion && (
                <div className="modal-overlay" onClick={() => setSelectedQuestion(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><i className="fas fa-question-circle"></i> Problem Details</h3>
                            <button className="modal-close" onClick={() => setSelectedQuestion(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-badges">
                                <span className={`competition-badge ${getCompetitionClass(selectedQuestion.competition)}`}>
                                    {selectedQuestion.competition}
                                </span>
                                <span className={`difficulty-badge ${getDifficultyClass(selectedQuestion.difficulty)}`}>
                                    {selectedQuestion.difficulty}
                                </span>
                                <span className="competition-badge" style={{ background: '#f3e8ff', color: '#6b21a5' }}>
                                    {selectedQuestion.topic}
                                </span>
                                {selectedQuestion.year && (
                                    <span className="competition-badge" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                        {selectedQuestion.year}
                                    </span>
                                )}
                            </div>
                            <div className="modal-section">
                                <h4><i className="fas fa-question-circle" style={{ color: '#4f46e5' }}></i> Problem Statement</h4>
                                <div className="problem-text">
                                    {selectedQuestion.text}
                                </div>
                            </div>
                            <div className="modal-section">
                                <h4><i className="fas fa-lightbulb" style={{ color: '#f59e0b' }}></i> Solution / Answer</h4>
                                <div className="solution-text">
                                    {selectedQuestion.solution || "This is a sample solution. In a complete implementation, each problem would have its own detailed solution."}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="close-modal-btn" onClick={() => setSelectedQuestion(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;