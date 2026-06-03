# SkyIntel ✈️

> **NLP-Powered Airline Review Intelligence Platform**

SkyIntel is an enterprise-grade customer experience analytics dashboard tailored for the aviation industry. It dynamically scrapes, filters, analyzes, and visualizes real-time traveler reviews from public aviation forums. By integrating statistical Natural Language Processing (NLP) with an interactive, modern user interface, SkyIntel enables airlines, analysts, and customers to uncover hidden feedback patterns, rank traveler sentiment globally, and detect customer dissatisfaction categories instantaneously.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Processing Pipeline](#data-processing-pipeline)
3. [Technical Specifications](#technical-specifications)
4. [Backend API Documentation](#backend-api-documentation)
5. [Frontend Design & Features](#frontend-design--features)
6. [Development Setup & Run Guide](#development-setup--run-guide)
7. [Hosting & Cloud Deployment Guide](#hosting--cloud-deployment-guide)

---

## 1. System Architecture

SkyIntel utilizes a decoupled client-server architecture:
- **Backend Service (FastAPI):** A high-performance Python backend responsible for web scraping, lexical cleaning, tokenization, lemmatization, and sentiment extraction.
- **Frontend Dashboard (Vanilla HTML5/CSS3/ES6 JS):** A responsive client-side SPA (Single Page Application) that manages application state, performs in-memory multi-filtering, aggregates metrics dynamically, and renders charts and maps using library wrappers (Chart.js and jsVectorMap).
- **Virtual Environment (`airenv`):** A self-contained Python execution environment containing all packages preinstalled.

---

## 2. Data Processing Pipeline

```
  [User Inputs Airline Name]
              │
              ▼
    (FastAPI Scraper Engine)
              │ (Request with Mozilla User-Agent headers)
              ▼
   (HTML Parser - BeautifulSoup)
              │
              ▼ (Extracts Review Text, Ratings, Date, Countries, Traveller & Cabin types)
    (Text Cleaning & Tokenization)
              │ (Removes non-alphabetic noise)
              ▼
    (POS Tagging & Lemmatization)
              │ (NLTK POS Tagger & WordNetLemmatizer mapping)
              ▼
  (VADER Sentiment Intensity Analyzer)
              │ (Polarity classification: Positive / Negative / Neutral)
              ▼
   (Aspect & Complaint Extraction)
              │ (Sentence-level keyword maps)
              ▼
       [Backend Returns JSON] ────► [Frontend Client Memory]
                                               │
                                               ▼
                              (Dynamic In-Memory Filter Engine)
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
     [KPI Cards & Trends]            [Chart.js Doughnut]              [jsVectorMap & Table]
```

### Detailed Pipeline Steps:
1. **Web Scraping:** The system dynamically constructs URLs pointing to `airlinequality.com` (SkyTrax) for the target airline slug. It downloads the HTML content using custom HTTP headers to avoid anti-scraping blocks.
2. **BeautifulSoup Parsing:**
   - Scrapes **Review Content** (extracting verified traveler review descriptions).
   - Scrapes **Numerical Star Ratings** (from `ratingValue` attributes).
   - Scrapes **Metadata table rows**: `Type Of Traveller` (e.g. Solo, Couple, Family, Business) and `Seat Type` (e.g. Economy, Premium Economy, Business, First).
   - Scrapes **Reviewer Country of Origin** (from header text match patterns) and translates names into standardized **ISO 3166-1 Alpha-2** country codes.
   - Scrapes **Publication Date** (from the `datePublished` metadata attribute).
3. **Lexical Normalization:**
   - Normalizes text by removing non-alphabetic characters.
   - Tokenizes reviews into individual words.
   - Applies NLTK Parts-of-Speech (POS) tagging to differentiate verbs, nouns, adjectives, and adverbs.
   - Lemmatizes tokens using NLTK `WordNetLemmatizer` to group words of common roots (e.g. "flying", "flew", "flies" -> "fly").
4. **Sentiment Polarity Scoring:**
   - Runs VADER (Valence Aware Dictionary and sEntiment Reasoner) sentiment analyzer.
   - Classifies compound scores:
     - **Positive:** $\ge 0.5$
     - **Negative:** $< 0$
     - **Neutral:** $[0, 0.5)$
5. **Aspect-Based Sentiment Extraction:**
   - Evaluates individual sentences using defined keyword maps for aspects like Cabin Crew, Seats, Food, and Boarding.
   - Classifies each sentence's polarity separately to provide sentence-level context snippets for positive and negative mentions.
6. **Common Complaints Engine:**
   - Identifies negative sentences matching complaint categories (e.g. Flight Delays, Lost Baggage, Customer Service).
   - Bundles matching snippets and passes them to the API payload.

---

## 3. Technical Specifications

### Tech Stack:
- **Backend:** Python 3.13, FastAPI, Uvicorn, Pandas, BeautifulSoup4, Requests, NLTK, vaderSentiment, WordCloud, Matplotlib.
- **Frontend:** HTML5, CSS3 (Vanilla variables, custom transitions, glassmorphism design), ES6 JavaScript (Vanilla State Management), Chart.js (Data visualization), jsVectorMap (Interactive vector mapping).

### NLP Engine Details:
- **Lexicon-Based Sentiment:** VADER Sentiment engine tuned for social media and online review datasets.
- **Lemmatizer:** WordNet Lexical database via NLTK.
- **Tokenizer/POS Tagging:** Punkt tokenizer models and averaged perceptron POS taggers.

---

## 4. Backend API Documentation

### GET `/api/analyze`
Scrapes reviews and runs the NLP pipeline on the target airline.

**Query Parameters:**
- `airline` (string, required): The name of the airline (e.g. `British Airways`).
- `pages` (integer, optional): The number of pages to scrape (default is `3`, representing ~300 reviews).

**Response Schema (`AnalysisResponse`):**
```json
{
  "airline": "British Airways",
  "total_reviews": 100,
  "sentiment_counts": {
    "Positive": 29,
    "Negative": 59,
    "Neutral": 12
  },
  "wordcloud_base64": "iVBORw0KGgoAAA...",
  "average_rating": 1.3,
  "rating_trend": 0.25,
  "recommendation_rate": 19.5,
  "recommendation_trend": 5.0,
  "positive_percentage": 29.0,
  "negative_percentage": 59.0,
  "reviews_raw": [
    {
      "text": "Flight was delayed by 4 hours...",
      "date": "2026-06-02",
      "country": "GB",
      "rating": 1.0,
      "sentiment": "Negative",
      "recommended": "no",
      "traveler_type": "Family Leisure",
      "cabin_class": "Economy Class",
      "aspects": [
        {
          "aspect": "Delays",
          "sentiment": "Negative",
          "snippet": "Flight was delayed by 4 hours..."
        }
      ],
      "complaints": [
        {
          "category": "Flight Delays",
          "snippet": "Flight was delayed by 4 hours..."
        }
      ]
    }
  ],
  "positive_topics": [
    {
      "topic": "Cabin Crew",
      "count": 12,
      "snippet": "The cabin crew was amazing..."
    }
  ],
  "negative_topics": [
    {
      "topic": "Delays",
      "count": 42,
      "snippet": "Delayed departures at Heathrow..."
    }
  ]
}
```

---

## 5. Frontend Design & Features

### Premium Aesthetics
- **Glassmorphism Layout:** Uses subtle semi-transparent background overlays (`backdrop-filter: blur(16px)`), thin border lines, and deep drop shadows to render containers floating above blurred animated background ambient light blobs.
- **Theme Switcher:** A smooth dark/light mode toggle that transitions all colors, grids, maps, and canvas charts cleanly. Persisted in `localStorage`.
  - **Dark Mode (Default):** Deep navy backgrounds, purple and blue highlights, neon-tinted sentiment colors.
  - **Light Mode:** Crisp off-white backgrounds, soft gray cards, sharp indigo icons, and dark slate headings.

### Multi-Select Filter Panel
- **Sentiment selector:** Single select option.
- **Rating filter:** Checkbox checklist for 1-5 Star ratings.
- **Date range filter:** Supports predefined ranges (Last Month, Last 3/6 Months, Last Year) relative to the newest review timestamp in the active dataset, alongside Custom Start/End date selectors.
- **Traveler Type & Cabin Class filters:** Checklist groups supporting combinations.
- **Searchable Country Origin dropdown:** Real-time search/filtering for traveler origin countries.
- **Dynamic Chips:** Shows active filters as removable chips with an instant "Reset Filters" action. All visualizations update dynamically in the client browser with zero lag.

### Common Complaints Detector
- Aggregates matching complaint items dynamically from filtered reviews.
- Computes **Severity Score** utilizing:
  $$\text{Severity} = \text{Mentions} \times (0.5 + |\text{Average Sentiment}|)$$
- Categorizes complaints into:
  - 🔴 **Critical Severity** (Score $\ge 12$)
  - 🟠 **High Severity** (Score $\ge 6$)
  - 🟡 **Medium Severity** (Score $\ge 2.5$)
  - 🟢 **Low Severity** (Score $< 2.5$)
- Allows selecting any complaint to show metrics, passenger excerpts, trend calculations, and automated summaries.

---

## 6. Development Setup & Run Guide

### Quick Commands Reference

If you are already in the project root directory, run these commands in separate terminals:

**Terminal 1 (Backend API):**
```powershell
& .\airenv\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend App):**
```powershell
& .\airenv\python.exe -m http.server 3000 --directory frontend
```

---

### Step-by-Step Running Guide

Follow these steps to run SkyIntel on your Windows computer:

### Prerequisites:
- Windows OS
- Python 3.13 (installed and preconfigured in the `airenv` directory)

### Step 1: Open PowerShell or Command Prompt
Navigate to the root directory where you cloned the project:
```powershell
d:
cd "d:\Projects\Airline British Airways"
```

### Step 2: Start the Backend FastAPI Server
Start the backend FastAPI server on port `8000`:
```powershell
& .\airenv\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Once started, you will see confirmation logs in the console:
`INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)`

### Step 3: Start the Frontend Static Web Server
Open a new PowerShell window, navigate to the same root folder, and start python's built-in HTTP server on port `3000`:
```powershell
& .\airenv\python.exe -m http.server 3000 --directory frontend
```
Once started, it will print:
`Serving HTTP on 127.0.0.1 port 3000 ...`

### Step 4: Open your Browser
Open your browser and navigate to:
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Swagger Docs (Optional):** [http://localhost:8000/docs](http://localhost:8000/docs)

Enter an airline like `British Airways` and click **Analyze**!

---

## 7. Hosting & Cloud Deployment Guide

This section explains how to deploy the decoupled SkyIntel project to production using **Render** for the backend API and **Vercel** for the frontend dashboard.

### Backend Deployment (Render)

SkyIntel comes pre-configured with a Render Blueprint definition (`render.yaml`).

#### Option A: Blueprint Deployment (Recommended)
1. Commit all files (including `render.yaml`) to your GitHub/GitLab repository.
2. Log in to [Render](https://render.com/).
3. In the Render Dashboard, click **New** -> **Blueprint**.
4. Connect your SkyIntel repository.
5. Render will automatically detect the `render.yaml` file and set up the `skyintel-backend` Python service. Click **Apply**.
6. Render will automatically build the service, install dependencies from `backend/requirements.txt`, download NLTK data on startup, and launch the web server.

#### Option B: Manual Web Service Setup
1. Log in to [Render](https://render.com/).
2. Click **New** -> **Web Service**.
3. Connect your repository.
4. Set the following configuration:
   - **Name:** `skyintel-backend`
   - **Language/Environment:** `Python`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. In **Advanced**, add the following environment variable:
   - **Key:** `PYTHON_VERSION`
   - **Value:** `3.10.13` (or similar 3.10+ version)
6. Click **Create Web Service**.

---

### Frontend Deployment (Vercel)

The SkyIntel frontend is a premium static Single Page Application. It can be hosted on Vercel for free.

#### Step 1: Link Frontend to Production Backend
1. Once your Render web service is deployed, copy its public URL (e.g., `https://skyintel-backend.onrender.com`).
2. Open `frontend/script.js` and locate line 17:
   ```javascript
   const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
       ? 'http://localhost:8000'
       : 'https://skyintel-backend.onrender.com'; // Replace with your actual Render backend URL
   ```
3. If your Render URL is different, replace `'https://skyintel-backend.onrender.com'` with your actual Render service URL.
4. Commit and push the changes to your Git repository.

#### Step 2: Deploy to Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Import your SkyIntel repository.
4. In the configuration settings:
   - **Root Directory:** Click Edit and select the `frontend` folder.
   - Leave the **Build and Output Settings** at their default values (no compile/build step is needed).
5. Click **Deploy**.
6. Vercel will build and serve your frontend static dashboard. Once deployed, open the Vercel app URL to access the platform!
