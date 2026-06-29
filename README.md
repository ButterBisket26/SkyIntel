# SkyIntel ✈️

> **NLP-Powered Airline Review Intelligence Platform**

SkyIntel is an enterprise-grade customer experience analytics dashboard tailored for the aviation industry. It dynamically scrapes, filters, analyzes, and visualizes real-time traveler reviews from public aviation forums. By integrating statistical Natural Language Processing (NLP) with an interactive, modern user interface, SkyIntel enables airlines, analysts, and customers to uncover hidden feedback patterns, rank traveler sentiment globally, and detect customer dissatisfaction categories instantaneously.

---

## 🔗 Publicly Deployed URLs

- **Frontend Dashboard (Vercel):** [https://sky-intel.vercel.app](https://sky-intel.vercel.app)
- **Backend Sentiment API (Render):** [https://skyintel-api.onrender.com](https://skyintel-api.onrender.com)

---

## Table of Contents
1. System Architecture
2. Data Processing Pipeline
3. Technical Specifications
4. Backend API Documentation
5. Frontend Design & Features
6. Development Setup & Run Guide

---

## 1. System Architecture

SkyIntel utilizes a decoupled client-server architecture:
- **Backend Service (FastAPI):** A high-performance Python backend responsible for concurrent web scraping, lexical cleaning, tokenization, lemmatization, and sentiment extraction.
- **Frontend Dashboard (Vanilla HTML5/CSS3/ES6 JS):** A responsive client-side SPA (Single Page Application) that manages application state, performs in-memory multi-filtering, aggregates metrics dynamically, and renders charts and maps using library wrappers (Chart.js and jsVectorMap).
- **Virtual Environment (`airenv`):** A self-contained Python execution environment containing all packages preinstalled.

---

## 2. Data Processing Pipeline

```
  [User Inputs Airline Name]
              │
              ▼
     (FastAPI Scraper Engine)
              │ (Tries Direct -> CodeTabs -> AllOrigins)
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
1. **Web Scraping:** The system dynamically constructs URLs pointing to `airlinequality.com` (SkyTrax) for the target airline slug. It implements fallback scraping proxies to avoid anti-scraping blocks.
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
- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pandas, BeautifulSoup4, Requests, NLTK, vaderSentiment, WordCloud, Matplotlib.
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

---

## 5. Frontend Design & Features

### Premium Aesthetics
- **Glassmorphism Layout:** Uses subtle semi-transparent background overlays (`backdrop-filter: blur(16px)`), thin border lines, and deep drop shadows to render containers floating above blurred animated background ambient light blobs.
- **Theme Switcher:** A smooth dark/light mode toggle that transitions all colors, grids, maps, and canvas charts cleanly. Persisted in `localStorage`.
- **Multi-Select Filter Panel:** Supports filtering in client memory by Sentiment, Rating, Date Range, Traveler Type, Cabin Class, and Searchable Country Origin.

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

Once started, open [http://localhost:3000](http://localhost:3000) in your browser.


## 7. Hosting & Cloud Deployment Guide

### Backend Deployment (Render)
1. Commit all files (including `render.yaml`) to your GitHub repository.
2. In the Render Dashboard, click **New** -> **Blueprint**.
3. Connect your SkyIntel repository.
4. Render will automatically detect `render.yaml` and set up the `skyintel-backend` service. Click **Apply**.

### Frontend Deployment (Vercel)
1. In the Vercel Dashboard, click **Add New** -> **Project**.
2. Import your SkyIntel repository.
3. Configure the **Root Directory** as `frontend`.
4. Click **Deploy**.
