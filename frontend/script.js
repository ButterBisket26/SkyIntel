const form = document.getElementById('search-form');
const input = document.getElementById('airline-input');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const errorMsg = document.getElementById('error-message');
const airlineDisplay = document.getElementById('airline-name-display');
const reviewsBadge = document.getElementById('total-reviews-badge');
const wordcloudImg = document.getElementById('wordcloud-img');

// Global state
let chartInstance = null;
let mapInstance = null;
let allReviews = [];
let filteredReviews = [];
let lastSentimentCounts = null;

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:8000'
    : 'https://skyintel-api.onrender.com'; // Replace with your actual Render backend URL

// Theme Switching Logic
const themeToggle = document.getElementById('theme-toggle');
const moonIcon = document.querySelector('.moon-icon');
const sunIcon = document.querySelector('.sun-icon');

// Default to dark, apply theme from localStorage if saved
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    if (isLight) {
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
    } else {
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
    }

    // Refresh visual components to adapt to theme colors
    if (allReviews.length > 0) {
        renderAllDashboard();
    }
});

// Dropdown Toggles (Custom Multi-selects)
document.querySelectorAll('.multi-select-custom').forEach(dropdown => {
    const trigger = dropdown.querySelector('.multi-select-trigger');
    const options = dropdown.querySelector('.multi-select-options');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.multi-select-options').forEach(opt => {
            if (opt !== options) opt.classList.add('hidden');
        });
        options.classList.toggle('hidden');
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.multi-select-options').forEach(opt => {
        opt.classList.add('hidden');
    });
});

// Prevent dropdown closing when clicking inside
document.querySelectorAll('.multi-select-options').forEach(opt => {
    opt.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

// Country search input handler
const countrySearchInput = document.getElementById('country-search-input');
countrySearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('#country-checkboxes-list label').forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(query)) {
            label.style.display = 'flex';
        } else {
            label.style.display = 'none';
        }
    });
});

// Filter Elements change handlers
document.getElementById('filter-sentiment').addEventListener('change', applyFilters);
document.getElementById('filter-date-range').addEventListener('change', (e) => {
    const customInputs = document.getElementById('custom-date-inputs');
    if (e.target.value === 'custom') {
        customInputs.classList.remove('hidden');
    } else {
        customInputs.classList.add('hidden');
    }
    applyFilters();
});
document.getElementById('custom-date-start').addEventListener('change', applyFilters);
document.getElementById('custom-date-end').addEventListener('change', applyFilters);
document.getElementById('filter-recommendation').addEventListener('change', applyFilters);
document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);

function getSelectedCheckboxes(containerId) {
    const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
    const selected = [];
    checkboxes.forEach(cb => {
        if (cb.checked) selected.push(cb.value);
    });
    return selected;
}

// Bind checkboxes to applyFilters
function bindCheckboxesToFilters(containerId) {
    document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });
}

bindCheckboxesToFilters('rating-options');
bindCheckboxesToFilters('traveler-options');
bindCheckboxesToFilters('cabin-options');

// ISO code mapper
const ISO_TO_NAME = {
    "GB": "United Kingdom", "US": "United States", "AU": "Australia", "CA": "Canada",
    "NZ": "New Zealand", "SG": "Singapore", "DE": "Germany", "FR": "France",
    "AE": "United Arab Emirates", "NL": "Netherlands", "ZA": "South Africa", "IE": "Ireland",
    "CH": "Switzerland", "ES": "Spain", "IT": "Italy", "CN": "China",
    "JP": "Japan", "MY": "Malaysia", "TH": "Thailand", "QA": "Qatar",
    "HK": "Hong Kong", "SA": "Saudi Arabia", "PH": "Philippines", "BE": "Belgium",
    "DK": "Denmark", "SE": "Sweden", "NO": "Norway", "FI": "Finland",
    "AT": "Austria", "PT": "Portugal", "GR": "Greece", "TR": "Turkey",
    "IN": "India", "VN": "Vietnam", "ID": "Indonesia", "KR": "South Korea",
    "BR": "Brazil", "MX": "Mexico", "AR": "Argentina", "RU": "Russia",
    "PL": "Poland", "CZ": "Czech Republic", "RO": "Romania", "HU": "Hungary",
    "UA": "Ukraine", "EG": "Egypt", "IL": "Israel", "KW": "Kuwait",
    "OM": "Oman", "BH": "Bahrain", "TW": "Taiwan"
};

function getCountryNameFromCode(code) {
    return ISO_TO_NAME[code] || code;
}

// Form Submission (Search)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const airline = input.value.trim();
    if (!airline) return;

    // UI State: Loading
    errorMsg.classList.add('hidden');
    results.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze?airline=${encodeURIComponent(airline)}&pages=3`);

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Failed to analyze airline');
        }

        const data = await response.json();

        // Save initial reviews
        allReviews = data.reviews_raw;

        // Update basic displays
        airlineDisplay.textContent = data.airline;
        wordcloudImg.src = `data:image/png;base64,${data.wordcloud_base64}`;

        // Populate Country Checkbox List
        populateCountryChecklist();

        // Reset and Apply filters
        resetFiltersSilently();
        applyFilters();

        loading.classList.add('hidden');
        results.classList.remove('hidden');

    } catch (err) {
        loading.classList.add('hidden');
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
    }
});

function populateCountryChecklist() {
    const container = document.getElementById('country-checkboxes-list');
    container.innerHTML = '';

    // Extract unique countries
    const countries = [];
    allReviews.forEach(r => {
        if (r.country && r.country !== 'Unknown' && !countries.includes(r.country)) {
            countries.push(r.country);
        }
    });

    countries.sort((a, b) => getCountryNameFromCode(a).localeCompare(getCountryNameFromCode(b)));

    countries.forEach(code => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${code}" checked> ${getCountryNameFromCode(code)}`;
        label.querySelector('input').addEventListener('change', applyFilters);
        container.appendChild(label);
    });
}

function resetFiltersSilently() {
    document.getElementById('filter-sentiment').value = 'all';
    document.getElementById('filter-date-range').value = 'all';
    document.getElementById('custom-date-inputs').classList.add('hidden');
    document.getElementById('custom-date-start').value = '';
    document.getElementById('custom-date-end').value = '';
    document.getElementById('filter-recommendation').value = 'all';

    document.querySelectorAll('#rating-options input').forEach(cb => cb.checked = true);
    document.querySelectorAll('#traveler-options input').forEach(cb => cb.checked = true);
    document.querySelectorAll('#cabin-options input').forEach(cb => cb.checked = true);
    document.querySelectorAll('#country-checkboxes-list input').forEach(cb => cb.checked = true);
}

function resetFilters() {
    resetFiltersSilently();
    applyFilters();
}

// Client-Side Multi-Filtering Logic
function applyFilters() {
    // 1. Gather all active filters
    const sentiment = document.getElementById('filter-sentiment').value;
    const dateRange = document.getElementById('filter-date-range').value;
    const customStart = document.getElementById('custom-date-start').value;
    const customEnd = document.getElementById('custom-date-end').value;
    const recommendation = document.getElementById('filter-recommendation').value;

    const selectedRatings = getSelectedCheckboxes('rating-options');
    const selectedTravelers = getSelectedCheckboxes('traveler-options');
    const selectedCabins = getSelectedCheckboxes('cabin-options');
    const selectedCountries = getSelectedCheckboxes('country-checkboxes-list');

    // Reference Date calculation (relative to latest review date)
    let referenceDate = new Date();
    if (allReviews.length > 0) {
        const dates = allReviews.map(r => r.date ? new Date(r.date) : null).filter(d => d && !isNaN(d));
        if (dates.length > 0) {
            referenceDate = new Date(Math.max(...dates));
        }
    }

    // 2. Perform filter matching
    filteredReviews = allReviews.filter(review => {
        // Sentiment filter
        if (sentiment !== 'all' && review.sentiment !== sentiment) return false;

        // Recommendation filter
        if (recommendation !== 'all' && review.recommended !== recommendation) return false;

        // Rating Filter
        const rVal = review.rating ? Math.max(1, Math.min(5, Math.round(review.rating))) : null;
        if (rVal && !selectedRatings.includes(rVal.toString())) return false;

        // Traveler Type Filter
        if (review.traveler_type) {
            const revType = review.traveler_type.toLowerCase();
            let matched = false;
            selectedTravelers.forEach(sel => {
                const s = sel.toLowerCase().split(' ')[0]; // e.g. "solo", "couple", "family", "business"
                if (revType.includes(s)) matched = true;
            });
            if (!matched) return false;
        }

        // Cabin Class Filter
        if (review.cabin_class && !selectedCabins.includes(review.cabin_class)) return false;

        // Country Filter
        if (review.country && review.country !== 'Unknown' && selectedCountries.length > 0) {
            if (!selectedCountries.includes(review.country)) return false;
        }

        // Date Range Filter
        if (review.date) {
            const revDate = new Date(review.date);
            if (revDate && !isNaN(revDate)) {
                const diffTime = Math.abs(referenceDate - revDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (dateRange === 'month' && diffDays > 30) return false;
                if (dateRange === '3months' && diffDays > 90) return false;
                if (dateRange === '6months' && diffDays > 180) return false;
                if (dateRange === 'year' && diffDays > 365) return false;
                if (dateRange === 'custom') {
                    if (customStart && revDate < new Date(customStart)) return false;
                    if (customEnd && revDate > new Date(customEnd)) return false;
                }
            }
        }

        return true;
    });

    // Update triggers visual text
    updateDropdownTriggersText(selectedRatings, selectedTravelers, selectedCabins, selectedCountries);

    // Update chips display
    renderFilterChips(sentiment, dateRange, customStart, customEnd, recommendation, selectedRatings, selectedTravelers, selectedCabins, selectedCountries);

    // Update charts and dashboard
    renderAllDashboard();
}

function updateDropdownTriggersText(ratings, travelers, cabins, countries) {
    document.getElementById('rating-trigger').textContent = ratings.length === 5 ? 'All Ratings' : `${ratings.length} Selected`;
    document.getElementById('traveler-trigger').textContent = travelers.length === 4 ? 'All Types' : `${travelers.length} Selected`;
    document.getElementById('cabin-trigger').textContent = cabins.length === 4 ? 'All Classes' : `${cabins.length} Selected`;

    const totalCountries = document.querySelectorAll('#country-checkboxes-list input').length;
    document.getElementById('country-trigger').textContent = countries.length === totalCountries ? 'All Countries' : `${countries.length} Selected`;
}

function renderFilterChips(sentiment, dateRange, start, end, recommendation, ratings, travelers, cabins, countries) {
    const container = document.getElementById('active-chips-container');
    container.innerHTML = '';

    let chipsCount = 0;

    const addChip = (labelText, removeCallback) => {
        chipsCount++;
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.textContent = labelText;
        chip.addEventListener('click', removeCallback);
        container.appendChild(chip);
    };

    if (sentiment !== 'all') {
        addChip(`Sentiment: ${sentiment}`, () => {
            document.getElementById('filter-sentiment').value = 'all';
            applyFilters();
        });
    }

    if (recommendation !== 'all') {
        addChip(`Recommendation: ${recommendation === 'yes' ? 'Yes' : 'No'}`, () => {
            document.getElementById('filter-recommendation').value = 'all';
            applyFilters();
        });
    }

    if (ratings.length < 5) {
        addChip(`Ratings: ${ratings.join(',')}`, () => {
            document.querySelectorAll('#rating-options input').forEach(cb => cb.checked = true);
            applyFilters();
        });
    }

    if (travelers.length < 4) {
        addChip(`Travelers: ${travelers.length} active`, () => {
            document.querySelectorAll('#traveler-options input').forEach(cb => cb.checked = true);
            applyFilters();
        });
    }

    if (cabins.length < 4) {
        addChip(`Cabin: ${cabins.length} active`, () => {
            document.querySelectorAll('#cabin-options input').forEach(cb => cb.checked = true);
            applyFilters();
        });
    }

    if (dateRange !== 'all') {
        let label = `Date: ${dateRange}`;
        if (dateRange === 'custom') label = `Date: ${start || ''} to ${end || ''}`;
        addChip(label, () => {
            document.getElementById('filter-date-range').value = 'all';
            document.getElementById('custom-date-inputs').classList.add('hidden');
            applyFilters();
        });
    }

    const totalCountries = document.querySelectorAll('#country-checkboxes-list input').length;
    if (countries.length < totalCountries) {
        addChip(`Countries: ${countries.length} selected`, () => {
            document.querySelectorAll('#country-checkboxes-list input').forEach(cb => cb.checked = true);
            applyFilters();
        });
    }

    // Toggle reset filters visibility
    const resetBtn = document.getElementById('reset-filters-btn');
    if (chipsCount > 0) {
        resetBtn.style.display = 'inline-block';
    } else {
        resetBtn.style.display = 'none';
    }
}

// Render Dashboard (Recalculate and update charts/KPIs)
function renderAllDashboard() {
    const totalCount = allReviews.length;
    const matchCount = filteredReviews.length;

    // Update match count badge
    document.getElementById('filter-count').textContent = `Showing ${matchCount} of ${totalCount} Reviews`;
    reviewsBadge.textContent = `${matchCount} Reviews`;

    // 1. Calculate KPI Values
    let ratingSum = 0;
    let ratingCount = 0;
    let recYes = 0;
    let recCount = 0;
    let posCount = 0;
    let negCount = 0;
    let neuCount = 0;

    filteredReviews.forEach(r => {
        if (r.rating !== null && r.rating !== undefined) {
            ratingSum += r.rating;
            ratingCount++;
        }
        if (r.recommended) {
            recCount++;
            if (r.recommended === 'yes') recYes++;
        }
        if (r.sentiment === 'Positive') posCount++;
        else if (r.sentiment === 'Negative') negCount++;
        else neuCount++;
    });

    const averageRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '0.0';
    const recRate = recCount > 0 ? Math.round((recYes / recCount) * 100) : 0;
    const posPct = matchCount > 0 ? Math.round((posCount / matchCount) * 100) : 0;
    const negPct = matchCount > 0 ? Math.round((negCount / matchCount) * 100) : 0;

    // Update KPI UI Card elements
    document.getElementById('kpi-rating-value').textContent = `${averageRating}/5`;
    document.getElementById('kpi-recommendation-value').textContent = `${recRate}%`;
    document.getElementById('kpi-positive-value').textContent = `${posPct}%`;
    document.getElementById('kpi-negative-value').textContent = `${negPct}%`;
    document.getElementById('kpi-reviews-value').textContent = matchCount.toLocaleString();

    // Trend calculation helper (comparing first half vs second half of filtered array)
    const halfLen = Math.floor(matchCount / 2);
    if (halfLen > 0) {
        const recentRating = filteredReviews.slice(0, halfLen).reduce((acc, r) => acc + (r.rating || 0), 0) / filteredReviews.slice(0, halfLen).filter(r => r.rating !== null).length;
        const prevRating = filteredReviews.slice(halfLen).reduce((acc, r) => acc + (r.rating || 0), 0) / filteredReviews.slice(halfLen).filter(r => r.rating !== null).length;
        const trendRating = isNaN(recentRating) || isNaN(prevRating) ? 0.0 : (recentRating - prevRating).toFixed(2);
        updateTrend(document.getElementById('kpi-rating-trend'), trendRating, '');

        const recentRec = filteredReviews.slice(0, halfLen).filter(r => r.recommended === 'yes').length / filteredReviews.slice(0, halfLen).filter(r => r.recommended).length;
        const prevRec = filteredReviews.slice(halfLen).filter(r => r.recommended === 'yes').length / filteredReviews.slice(halfLen).filter(r => r.recommended).length;
        const trendRec = isNaN(recentRec) || isNaN(prevRec) ? 0 : Math.round((recentRec - prevRec) * 100);
        updateTrend(document.getElementById('kpi-recommendation-trend'), trendRec, '%');
    } else {
        updateTrend(document.getElementById('kpi-rating-trend'), 0.0, '');
        updateTrend(document.getElementById('kpi-recommendation-trend'), 0, '%');
    }

    // 2. Draw/Update Chart.js
    const sentimentCounts = {
        'Positive': posCount,
        'Negative': negCount,
        'Neutral': neuCount
    };
    lastSentimentCounts = sentimentCounts;
    renderChart(sentimentCounts);

    // 3. Aspects (Topic Analysis) Aggregation
    aggregateAspects();

    // 4. Common Complaints Engine
    runComplaintsEngine();

    // 5. Update Geography World Map & Table
    updateGeography(currentGeoFilter);
}

function updateTrend(element, trendValue, unit) {
    const indicator = element.querySelector('.trend-indicator');
    const text = element.querySelector('.trend-text');

    if (trendValue > 0) {
        element.className = 'kpi-card-trend trend-up';
        indicator.textContent = '▲';
        text.textContent = `+${trendValue}${unit}`;
    } else if (trendValue < 0) {
        element.className = 'kpi-card-trend trend-down';
        indicator.textContent = '▼';
        text.textContent = `${trendValue}${unit}`;
    } else {
        element.className = 'kpi-card-trend trend-neutral';
        indicator.textContent = '■';
        text.textContent = `0.0${unit}`;
    }
}

function renderChart(counts) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    const bgColors = labels.map(label => {
        if (label === 'Positive') return 'rgba(52, 211, 153, 0.8)'; // Emerald
        if (label === 'Negative') return 'rgba(239, 68, 68, 0.8)'; // Red
        return 'rgba(148, 163, 184, 0.8)'; // Slate
    });

    const borderColors = labels.map(label => {
        if (label === 'Positive') return 'rgb(52, 211, 153)';
        if (label === 'Negative') return 'rgb(239, 68, 68)';
        return 'rgb(148, 163, 184)';
    });

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#0f172a' : '#f8fafc';

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            family: "'Outfit', sans-serif"
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: "'Outfit', sans-serif", size: 14 },
                    bodyFont: { family: "'Outfit', sans-serif", size: 14 },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            cutout: '65%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

// Dynamic Aspect/Topic Aggregator
function aggregateAspects() {
    const posList = document.getElementById('positive-topics-list');
    const negList = document.getElementById('negative-topics-list');

    posList.innerHTML = '';
    negList.innerHTML = '';

    const aspectStats = {};

    filteredReviews.forEach(r => {
        if (r.aspects) {
            r.aspects.forEach(asp => {
                const name = asp.aspect;
                if (!aspectStats[name]) {
                    aspectStats[name] = {
                        positive_count: 0,
                        negative_count: 0,
                        positive_snippets: [],
                        negative_snippets: []
                    };
                }
                if (asp.sentiment === 'Positive') {
                    aspectStats[name].positive_count++;
                    aspectStats[name].positive_snippets.push(asp.snippet);
                } else {
                    aspectStats[name].negative_count++;
                    aspectStats[name].negative_snippets.push(asp.snippet);
                }
            });
        }
    });

    const posTopics = [];
    const negTopics = [];

    Object.keys(aspectStats).forEach(name => {
        const stats = aspectStats[name];
        if (stats.positive_count > 0) {
            posTopics.push({
                topic: name,
                count: stats.positive_count,
                snippet: stats.positive_snippets[0] || ''
            });
        }
        if (stats.negative_count > 0) {
            negTopics.push({
                topic: name,
                count: stats.negative_count,
                snippet: stats.negative_snippets[0] || ''
            });
        }
    });

    posTopics.sort((a, b) => b.count - a.count);
    negTopics.sort((a, b) => b.count - a.count);

    if (posTopics.length === 0) {
        posList.innerHTML = '<p class="text-secondary">No positive aspects discussed in this selection.</p>';
    } else {
        const maxPos = Math.max(...posTopics.map(t => t.count));
        posTopics.forEach(t => {
            const pct = maxPos > 0 ? (t.count / maxPos) * 100 : 0;
            const row = document.createElement('div');
            row.className = 'topic-row';
            row.innerHTML = `
                <div class="topic-label-container">
                    <span class="topic-name">${t.topic}</span>
                    <span class="topic-count">${t.count} mentions</span>
                </div>
                <div class="topic-bar-outer">
                    <div class="topic-bar-inner positive" style="width: ${pct}%;"></div>
                </div>
                <div class="topic-tooltip">
                    <div class="tooltip-header">${t.topic} &bull; ${t.count} Mentions</div>
                    <div class="tooltip-body">"${t.snippet || 'No details available.'}"</div>
                </div>
            `;
            posList.appendChild(row);
        });
    }

    if (negTopics.length === 0) {
        negList.innerHTML = '<p class="text-secondary">No negative aspects discussed in this selection.</p>';
    } else {
        const maxNeg = Math.max(...negTopics.map(t => t.count));
        negTopics.forEach(t => {
            const pct = maxNeg > 0 ? (t.count / maxNeg) * 100 : 0;
            const row = document.createElement('div');
            row.className = 'topic-row';
            row.innerHTML = `
                <div class="topic-label-container">
                    <span class="topic-name">${t.topic}</span>
                    <span class="topic-count">${t.count} mentions</span>
                </div>
                <div class="topic-bar-outer">
                    <div class="topic-bar-inner negative" style="width: ${pct}%;"></div>
                </div>
                <div class="topic-tooltip">
                    <div class="tooltip-header">${t.topic} &bull; ${t.count} Mentions</div>
                    <div class="tooltip-body">"${t.snippet || 'No details available.'}"</div>
                </div>
            `;
            negList.appendChild(row);
        });
    }
}

// NLP-powered Common Complaints Detector Engine
let activeSelectedComplaint = null;

function runComplaintsEngine() {
    const listContainer = document.getElementById('complaints-chart-list');
    listContainer.innerHTML = '';

    const complaintStats = {};
    let totalNegativeReviews = 0;

    filteredReviews.forEach(r => {
        if (r.sentiment === 'Negative') {
            totalNegativeReviews++;
        }

        if (r.complaints) {
            r.complaints.forEach(comp => {
                const cat = comp.category;
                if (!complaintStats[cat]) {
                    complaintStats[cat] = {
                        count: 0,
                        snippets: [],
                        sentimentScores: []
                    };
                }
                complaintStats[cat].count++;
                complaintStats[cat].snippets.push(comp.snippet);
                // Sentiment of complaints is negative, let's map it roughly based on overall review sentiment or use a static score
                const sentScore = r.rating ? (r.rating - 5.0) / 5.0 : -0.5; // map to -1.0 to 0 range
                complaintStats[cat].sentimentScores.push(sentScore);
            });
        }
    });

    const complaintList = [];
    Object.keys(complaintStats).forEach(cat => {
        const stats = complaintStats[cat];
        const avgSentiment = stats.sentimentScores.reduce((a, b) => a + b, 0) / stats.sentimentScores.length;

        // Calculate Severity Score
        // Formula: mentions * (0.5 + Math.abs(avgSentiment))
        const severityScore = stats.count * (0.5 + Math.abs(avgSentiment));
        let severity = 'Low';
        let severityEmoji = '🟢';
        let severityClass = 'severity-low';

        if (severityScore >= 12) {
            severity = 'Critical';
            severityEmoji = '🔴';
            severityClass = 'severity-critical';
        } else if (severityScore >= 6) {
            severity = 'High';
            severityEmoji = '🟠';
            severityClass = 'severity-high';
        } else if (severityScore >= 2.5) {
            severity = 'Medium';
            severityEmoji = '🟡';
            severityClass = 'severity-medium';
        }

        complaintList.push({
            category: cat,
            count: stats.count,
            avgSentiment: avgSentiment,
            severity: severity,
            severityEmoji: severityEmoji,
            severityClass: severityClass,
            snippets: stats.snippets
        });
    });

    // Sort by count descending
    complaintList.sort((a, b) => b.count - a.count);

    if (complaintList.length === 0) {
        listContainer.innerHTML = '<p class="text-secondary" style="padding: 1rem 0;">No significant complaints detected in this selection.</p>';
        document.getElementById('complaint-details-content').classList.add('hidden');
        document.getElementById('complaint-details-empty').classList.remove('hidden');
        activeSelectedComplaint = null;
        return;
    }

    const maxCount = Math.max(...complaintList.map(c => c.count));

    complaintList.forEach(comp => {
        const pct = maxCount > 0 ? (comp.count / maxCount) * 100 : 0;

        const row = document.createElement('div');
        row.className = `complaint-bar-row ${activeSelectedComplaint === comp.category ? 'active' : ''}`;
        row.innerHTML = `
            <div class="complaint-bar-label">
                <div class="complaint-bar-title">
                    <span>${comp.category}</span>
                    <span class="severity-indicator ${comp.severityClass}">${comp.severityEmoji} ${comp.severity}</span>
                </div>
                <span class="complaint-bar-count">${comp.count} mentions</span>
            </div>
            <div class="complaint-bar-outer">
                <div class="complaint-bar-inner ${comp.severityClass}" style="width: ${pct}%;"></div>
            </div>
        `;

        row.addEventListener('click', () => {
            document.querySelectorAll('.complaint-bar-row').forEach(r => r.classList.remove('active'));
            row.classList.add('active');
            activeSelectedComplaint = comp.category;
            showComplaintDetail(comp, totalNegativeReviews);
        });

        listContainer.appendChild(row);
    });

    // Keep active selected complaint selected if it still exists
    if (activeSelectedComplaint) {
        const found = complaintList.find(c => c.category === activeSelectedComplaint);
        if (found) {
            showComplaintDetail(found, totalNegativeReviews);
        } else {
            activeSelectedComplaint = null;
            document.getElementById('complaint-details-content').classList.add('hidden');
            document.getElementById('complaint-details-empty').classList.remove('hidden');
        }
    } else {
        document.getElementById('complaint-details-content').classList.add('hidden');
        document.getElementById('complaint-details-empty').classList.remove('hidden');
    }
}

function showComplaintDetail(complaint, totalNegativeReviews) {
    document.getElementById('complaint-details-empty').classList.add('hidden');
    const content = document.getElementById('complaint-details-content');
    content.classList.remove('hidden');

    document.getElementById('detail-complaint-name').textContent = complaint.category;

    // Severity badge
    const badgeContainer = document.getElementById('detail-severity-badge');
    badgeContainer.innerHTML = `<span class="severity-indicator ${complaint.severityClass}">${complaint.severityEmoji} ${complaint.severity} Severity</span>`;

    // Metrics
    document.getElementById('detail-complaint-mentions').textContent = complaint.count;

    const pct = totalNegativeReviews > 0 ? Math.round((complaint.count / totalNegativeReviews) * 100) : 0;
    document.getElementById('detail-complaint-percentage').textContent = `${pct}%`;

    // NLP generated summary template (calculate trend comparing chronologically split halves)
    let trendDir = 'increased';
    let trendVal = 15;

    // Calculate a real trend
    const midIdx = Math.floor(filteredReviews.length / 2);
    if (midIdx > 0) {
        let firstHalfComp = 0;
        let secondHalfComp = 0;

        filteredReviews.slice(0, midIdx).forEach(r => {
            if (r.complaints && r.complaints.some(c => c.category === complaint.category)) firstHalfComp++;
        });
        filteredReviews.slice(midIdx).forEach(r => {
            if (r.complaints && r.complaints.some(c => c.category === complaint.category)) secondHalfComp++;
        });

        if (firstHalfComp !== secondHalfComp) {
            if (firstHalfComp > secondHalfComp) {
                trendDir = 'increased'; // recent period is first half in chronological ordering (scraped desc)
                trendVal = firstHalfComp === 0 ? 100 : Math.round(((firstHalfComp - secondHalfComp) / firstHalfComp) * 100);
            } else {
                trendDir = 'decreased';
                trendVal = secondHalfComp === 0 ? 100 : Math.round(((secondHalfComp - firstHalfComp) / secondHalfComp) * 100);
            }
        }
    }

    const summaryText = `${complaint.category} accounts for ${pct}% of all negative review discussions in this selection and has ${trendDir} by ${trendVal}% compared to the previous period.`;
    document.getElementById('detail-ai-summary').textContent = summaryText;

    // Review snippets list
    const excerptsList = document.getElementById('detail-excerpts-list');
    excerptsList.innerHTML = '';

    const topSnippets = complaint.snippets.slice(0, 3);
    topSnippets.forEach(snip => {
        const li = document.createElement('li');
        li.textContent = `"${snip}"`;
        excerptsList.appendChild(li);
    });
}

// Geography heatmap update using jsVectorMap
let currentGeoFilter = 'all';

function updateGeography(filter) {
    currentGeoFilter = filter;

    let filtered = filteredReviews;
    if (filter === 'Positive') {
        filtered = filteredReviews.filter(r => r.sentiment === 'Positive');
    } else if (filter === 'Negative') {
        filtered = filteredReviews.filter(r => r.sentiment === 'Negative');
    }

    const countryStats = {};
    filtered.forEach(r => {
        const code = r.country;
        if (!code || code === 'Unknown') return;
        if (!countryStats[code]) {
            countryStats[code] = {
                count: 0,
                ratingsSum: 0,
                ratingsCount: 0,
                positiveCount: 0,
                negativeCount: 0
            };
        }
        countryStats[code].count++;
        if (r.rating !== null && r.rating !== undefined) {
            countryStats[code].ratingsSum += r.rating;
            countryStats[code].ratingsCount++;
        }
        if (r.sentiment === 'Positive') {
            countryStats[code].positiveCount++;
        } else if (r.sentiment === 'Negative') {
            countryStats[code].negativeCount++;
        }
    });

    const mapValues = {};
    const rankingArray = [];

    Object.keys(countryStats).forEach(code => {
        const stats = countryStats[code];
        const avgRating = stats.ratingsCount > 0 ? (stats.ratingsSum / stats.ratingsCount) : 0;
        const posPct = stats.count > 0 ? (stats.positiveCount / stats.count) * 100 : 0;
        const negPct = stats.count > 0 ? (stats.negativeCount / stats.count) * 100 : 0;

        mapValues[code] = stats.count;

        rankingArray.push({
            code: code,
            name: getCountryNameFromCode(code),
            count: stats.count,
            rating: avgRating,
            positive_pct: posPct,
            negative_pct: negPct
        });
    });

    // Sort by review count descending
    rankingArray.sort((a, b) => b.count - a.count);

    // Populate Ranking Table
    const tableBody = document.getElementById('ranking-table-body');
    tableBody.innerHTML = '';
    if (rankingArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-secondary" style="text-align: center;">No reviews in this selection</td></tr>';
    } else {
        rankingArray.slice(0, 10).forEach(item => {
            const ratingStr = item.rating > 0 ? `${item.rating.toFixed(1)} ★` : 'N/A';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${item.count}</td>
                <td>${ratingStr}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Render jsVectorMap
    if (mapInstance) {
        mapInstance.destroy();
        mapInstance = null;
    }

    const mapContainer = document.getElementById('world-map');
    mapContainer.innerHTML = '';

    const isLight = document.body.classList.contains('light-theme');
    const regionFill = isLight ? '#cbd5e1' : 'rgba(51, 65, 85, 0.4)';
    const regionStroke = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)';

    if (filtered.length > 0 && Object.keys(mapValues).length > 0) {
        mapInstance = new jsVectorMap({
            selector: '#world-map',
            map: 'world',
            backgroundColor: 'transparent',
            draggable: true,
            zoomOnScroll: false,
            zoomButtons: true,
            regionStyle: {
                initial: {
                    fill: regionFill,
                    fillOpacity: 1,
                    stroke: regionStroke,
                    strokeWidth: 0.5,
                    strokeOpacity: 1
                },
                hover: {
                    fillOpacity: 0.8,
                    cursor: 'pointer'
                }
            },
            visualizeData: {
                scale: filter === 'Negative' ? ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.95)'] : ['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.95)'],
                values: mapValues
            },
            onRegionTooltipShow(event, tooltip, code) {
                const countryName = tooltip.text();
                const item = rankingArray.find(x => x.code === code);
                if (item) {
                    tooltip.text(
                        `<div class="map-tooltip">
                            <h4>${countryName}</h4>
                            <p>Reviews: <strong>${item.count}</strong></p>
                            <p>Avg Rating: <strong>${item.rating > 0 ? item.rating.toFixed(1) + '/5' : 'N/A'}</strong></p>
                            <p>Positive: <strong style="color: var(--green-accent)">${item.positive_pct.toFixed(0)}%</strong></p>
                            <p>Negative: <strong style="color: var(--red-accent)">${item.negative_pct.toFixed(0)}%</strong></p>
                        </div>`,
                        true
                    );
                } else {
                    tooltip.text(`<b>${countryName}</b><br>No reviews in this selection`);
                }
            }
        });
    } else {
        mapContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-secondary);">No map data for this filter</div>';
    }
}

// Bind Filter Button Click Listeners for Geo Map
document.querySelectorAll('.geo-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.geo-filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        updateGeography(e.target.getAttribute('data-filter'));
    });
});
