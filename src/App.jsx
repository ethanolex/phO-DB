import React, { useState, useMemo } from 'react';
import './App.css';

const App = () => {
    // Sample database
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
    
    const toggleFilter = (value, currentArray, setArray) => {
        if (currentArray.includes(value)) {
            setArray(currentArray.filter(v => v !== value));
        } else {
            setArray([...currentArray, value]);
        }
    };
    
    const clearFilters = () => {
        setSelectedCompetitions([]);
        setSelectedDifficulties([]);
        setSelectedTopics([]);
        setSearchQuery("");
    };
    
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
    
    const getCompetitionClass = (comp) => {
        if (comp === "IPhO") return "competition-ipho";
        if (comp === "USAPhO") return "competition-usapho";
        return "competition-jpho";
    };
    
    const getDifficultyClass = (diff) => {
        if (diff === "Easy") return "difficulty-easy";
        if (diff === "Medium") return "difficulty-medium";
        return "difficulty-hard";
    };
    
    return (
        <div className="container">
            <div className="header">
                <h1>Physics Olympiad Database</h1>
                <p>Explore challenging problems from IPhO, USAPhO, JPhO — by topic, difficulty & competition</p>
            </div>
            
            <div className="two-column-layout">
                {/* Sidebar */}
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
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
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
                
                {/* Main Content */}
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
                                        <button onClick={() => setSearchQuery("")}>
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
            
            <footer className="footer">
                <i className="far fa-copyright"></i> Sample database — real olympiad problems for demonstration. Built with React & CSS.
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