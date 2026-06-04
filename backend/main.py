from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import requests
from bs4 import BeautifulSoup
import re
import nltk
from nltk import pos_tag
from nltk.corpus import stopwords, wordnet
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from wordcloud import WordCloud, STOPWORDS
import io
import base64
import urllib.parse
from typing import List, Optional

# Download required NLTK data when the app starts.
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('wordnet', quiet=True)
nltk.download('omw-1.4', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('averaged_perceptron_tagger_eng', quiet=True)

app = FastAPI(title="SkyIntel Sentiment Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SentimentIntensityAnalyzer()
wordnet_lemmatizer = WordNetLemmatizer()
pos_dict = {'J': wordnet.ADJ, 'V': wordnet.VERB, 'N': wordnet.NOUN, 'R': wordnet.ADV}

class TopicMention(BaseModel):
    topic: str
    count: int
    snippet: str

class AspectMention(BaseModel):
    aspect: str
    sentiment: str
    snippet: str

class ComplaintMention(BaseModel):
    category: str
    snippet: str

class RawReview(BaseModel):
    text: str
    date: str
    country: str
    rating: Optional[float] = None
    sentiment: str
    recommended: Optional[str] = None
    traveler_type: Optional[str] = None
    cabin_class: Optional[str] = None
    aspects: List[AspectMention] = []
    complaints: List[ComplaintMention] = []

class AnalysisResponse(BaseModel):
    airline: str
    total_reviews: int
    sentiment_counts: dict
    wordcloud_base64: str
    average_rating: float
    rating_trend: float
    recommendation_rate: float
    recommendation_trend: float
    positive_percentage: float
    negative_percentage: float
    reviews_raw: List[RawReview]
    positive_topics: List[TopicMention]
    negative_topics: List[TopicMention]

COUNTRY_TO_ISO = {
    "united kingdom": "GB",
    "united states": "US",
    "australia": "AU",
    "canada": "CA",
    "new zealand": "NZ",
    "singapore": "SG",
    "germany": "DE",
    "france": "FR",
    "united arab emirates": "AE",
    "netherlands": "NL",
    "south africa": "ZA",
    "ireland": "IE",
    "switzerland": "CH",
    "spain": "ES",
    "italy": "IT",
    "china": "CN",
    "japan": "JP",
    "malaysia": "MY",
    "thailand": "TH",
    "qatar": "QA",
    "hong kong": "HK",
    "saudi arabia": "SA",
    "philippines": "PH",
    "belgium": "BE",
    "denmark": "DK",
    "sweden": "SE",
    "norway": "NO",
    "finland": "FI",
    "austria": "AT",
    "portugal": "PT",
    "greece": "GR",
    "turkey": "TR",
    "india": "IN",
    "vietnam": "VN",
    "indonesia": "ID",
    "south korea": "KR",
    "brazil": "BR",
    "mexico": "MX",
    "argentina": "AR",
    "russia": "RU",
    "poland": "PL",
    "czech republic": "CZ",
    "romania": "RO",
    "hungary": "HU",
    "ukraine": "UA",
    "egypt": "EG",
    "israel": "IL",
    "kuwait": "KW",
    "oman": "OM",
    "bahrain": "BH",
    "taiwan": "TW",
}

def get_country_iso(country_name: str) -> str:
    if not country_name:
        return "Unknown"
    norm = country_name.strip().lower()
    if len(norm) == 2:
        return norm.upper()
    return COUNTRY_TO_ISO.get(norm, country_name.strip())

ASPECT_KEYWORDS = {
    "Cabin Crew": ["crew", "staff", "attendant", "attendants", "steward", "stewardess", "host", "hostess", "cabin service", "flight attendant"],
    "Seats": ["seat", "seats", "seating", "legroom", "recline", "space", "pitch"],
    "Food": ["food", "meal", "meals", "beverage", "beverages", "drink", "drinks", "dinner", "lunch", "breakfast", "snack", "snacks", "catering", "menu"],
    "Check-in": ["check-in", "checkin", "check in", "desk", "counter", "bag drop"],
    "Boarding": ["boarding", "board", "gate", "priority boarding", "queue"],
    "Delays": ["delay", "delays", "delayed", "late", "punctuality", "cancellation", "cancelled", "schedule", "rescheduled"],
    "Luggage": ["luggage", "bag", "baggage", "suitcase", "carry-on", "checked bag", "bags", "lost bag"],
    "Customer Service": ["customer service", "support", "refund", "rebook", "helpline", "complaints", "customer care", "service agent"],
    "Entertainment": ["entertainment", "screen", "movie", "movies", "tv", "wifi", "wi-fi", "music", "audio", "ife"],
    "Airport Experience": ["airport", "lounge", "lounges", "security", "terminal", "transit", "transfer", "connection"]
}

COMPLAINT_KEYWORDS = {
    "Flight Delays": ["delay", "delays", "delayed", "late", "cancellation", "cancelled", "punctuality", "hours late", "behind schedule", "missed connection"],
    "Lost Baggage": ["baggage", "luggage", "lost", "missing bag", "delayed bag", "damaged bag", "carousel", "suitcases", "suitcase", "lost bag"],
    "Customer Service": ["customer service", "staff", "unprofessional", "rude", "indifferent", "unhelpful", "agent", "agents", "ignored", "poor service", "support"],
    "Refund Problems": ["refund", "refunds", "money back", "reimbursement", "charge", "charged", "compensation", "dispute", "overcharged", "voucher"],
    "Check-in Issues": ["check-in", "checkin", "counter", "desk", "queue", "queues", "kiosk", "bag drop", "waiting in line"],
    "Boarding Delays": ["boarding", "gate", "priority boarding", "bussing", "bus", "waiting at gate", "boarded late", "shuttle"],
    "Seat Comfort": ["seat", "seats", "uncomfortable", "cramped", "legroom", "recline", "hard seat", "space", "pitch", "seat comfort"],
    "Food Quality": ["food", "meal", "meals", "cold food", "tasteless", "catering", "drink", "drinks", "beverage", "beverages", "dinner", "breakfast", "lunch", "snack"],
    "Entertainment Problems": ["entertainment", "screen", "wifi", "wi-fi", "internet", "ife", "headphones", "headphone", "audio", "broken screen", "no movies"],
    "Website/App Issues": ["website", "app", "online booking", "error", "crash", "booking system", "app checkout", "mobile app", "seat selection online"]
}

def clean(text):
    return re.sub('[^A-Za-z]+', ' ', str(text))

def token_stop_pos(text):
    try:
        if not text.strip(): return []
        words = word_tokenize(text)
        tags = pos_tag(words)
        newlist = []
        stop_words = set(stopwords.words('english'))
        for word, tag in tags:
            if word.lower() not in stop_words:
                pos_tag_mapped = pos_dict.get(tag[0], wordnet.NOUN)
                newlist.append((word, pos_tag_mapped))
        return newlist
    except Exception as e:
        return []

def lemmatize(pos_data):
    lemma_rew = " "
    for word, pos in pos_data:
        if not pos:
            lemma = word
            lemma_rew = lemma_rew + " " + lemma
        else:
            lemma = wordnet_lemmatizer.lemmatize(word, pos=pos)
            lemma_rew = lemma_rew + " " + lemma
    return lemma_rew

def vadersentimentanalysis(review):
    vs = analyzer.polarity_scores(review)
    return vs['compound']

def vader_analysis(compound):
    if compound >= 0.5:
        return 'Positive'
    elif compound < 0 :
        return 'Negative'
    else:
        return 'Neutral'

@app.get("/")
def read_root():
    return {"status": "ok", "message": "SkyIntel Sentiment API is running"}

def fetch_html_with_fallback(url: str, page_num: int, airline_name: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }
    
    def validate_page(html_content: str) -> bool:
        parsed = BeautifulSoup(html_content, 'html.parser')
        # Check if there are reviews
        articles = parsed.find_all("article", {"itemprop": "review"})
        if len(articles) == 0:
            return False
        # If it's page 1, verify the title matches the airline name
        if page_num == 1:
            title_text = parsed.title.string.lower() if parsed.title else ""
            normalized_name = airline_name.lower().replace("-", " ").strip()
            name_no_spaces = normalized_name.replace(" ", "")
            title_no_spaces = title_text.replace(" ", "")
            if not ((normalized_name in title_text) or (name_no_spaces in title_no_spaces)):
                print(f"Scraper: Title validation failed. Title: '{title_text}', expected: '{normalized_name}'")
                return False
        return True

    # 1. Try Direct request
    try:
        print(f"Scraper: Attempting direct request to: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            if validate_page(response.text):
                print("Scraper: Direct request successful and validated.")
                return response.text
            else:
                print("Scraper: Direct request failed validation. Trying proxies...")
        elif response.status_code == 404:
            if page_num == 1:
                raise HTTPException(status_code=404, detail=f"Airline '{airline_name}' not found. Please try a valid name like 'Qatar Airways'.")
            return ""
        else:
            print(f"Scraper: Direct request failed with status code {response.status_code}. Trying proxies...")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Scraper: Direct request failed with exception: {e}. Trying proxies...")

    # 2. Try AllOrigins proxy
    try:
        allorigins_url = f"https://api.allorigins.win/raw?url={urllib.parse.quote(url)}"
        print(f"Scraper: Attempting proxy request via AllOrigins: {allorigins_url}")
        response = requests.get(allorigins_url, headers=headers, timeout=15)
        if response.status_code == 200:
            if validate_page(response.text):
                print("Scraper: AllOrigins proxy request successful and validated.")
                return response.text
            else:
                print("Scraper: AllOrigins proxy failed validation. Trying next proxy...")
        elif response.status_code == 404:
            if page_num == 1:
                raise HTTPException(status_code=404, detail=f"Airline '{airline_name}' not found. Please try a valid name like 'Qatar Airways'.")
            return ""
    except HTTPException:
        raise
    except Exception as e:
        print(f"Scraper: AllOrigins proxy failed: {e}")

    # 3. Try CodeTabs proxy
    try:
        codetabs_url = f"https://api.codetabs.com/v1/proxy?quest={urllib.parse.quote(url)}"
        print(f"Scraper: Attempting proxy request via CodeTabs: {codetabs_url}")
        response = requests.get(codetabs_url, headers=headers, timeout=15)
        if response.status_code == 200:
            if validate_page(response.text):
                print("Scraper: CodeTabs proxy request successful and validated.")
                return response.text
            else:
                print("Scraper: CodeTabs proxy failed validation.")
        elif response.status_code == 404:
            if page_num == 1:
                raise HTTPException(status_code=404, detail=f"Airline '{airline_name}' not found. Please try a valid name like 'Qatar Airways'.")
            return ""
    except HTTPException:
        raise
    except Exception as e:
        print(f"Scraper: CodeTabs proxy failed: {e}")

    # If we get here, everything failed.
    if page_num == 1:
        raise HTTPException(status_code=404, detail=f"Airline '{airline_name}' not found or could not be scraped. Please try a valid name like 'Qatar Airways'.")
    return ""

@app.get("/api/analyze", response_model=AnalysisResponse)
def analyze_airline(airline: str, pages: int = 3):
    # Normalize airline name format
    airline_slug = airline.lower().replace(" ", "-")
    base_url = f"https://www.airlinequality.com/airline-reviews/{airline_slug}"
    page_size = 100
    reviews = []

    for i in range(1, pages + 1):
        url = f"{base_url}/page/{i}/?sortby=post_date%3ADesc&pagesize={page_size}"
        try:
            html_content = fetch_html_with_fallback(url, i, airline)
            if not html_content:
                break
            parsed_content = BeautifulSoup(html_content, 'html.parser')
            articles = parsed_content.find_all("article", {"itemprop": "review"})
            for article in articles:
                # Text content
                review_text_div = article.find("div", {"class": "text_content"})
                review_text = review_text_div.get_text() if review_text_div else ""
                
                # Rating (out of 10)
                rating_val = None
                rating_span = article.find(attrs={"itemprop": "ratingValue"})
                if rating_span:
                    try:
                        rating_val = float(rating_span.get_text().strip())
                    except ValueError:
                        pass
                
                # Recommended (yes/no)
                recommended = None
                table = article.find("table", {"class": "review-ratings"})
                if table:
                    for row in table.find_all("tr"):
                        header = row.find("td", {"class": "review-rating-header"})
                        if header and "Recommended" in header.get_text():
                            value = row.find("td", {"class": "review-value"})
                            if value:
                                recommended = value.get_text().strip().lower()
                
                # Reviewer country extraction
                country_val = "Unknown"
                h3 = article.find("h3")
                if h3:
                    h3_text = h3.get_text()
                    match = re.search(r'\(([^)]+)\)', h3_text)
                    if match:
                        country_val = match.group(1).strip()

                # Review date extraction
                time_tag = article.find("time", {"itemprop": "datePublished"})
                date_val = time_tag.get("datetime") if time_tag else None
                if not date_val and time_tag:
                    date_val = time_tag.get_text().strip()
                if not date_val:
                    date_val = ""

                # Traveler type & cabin class extraction
                traveler_type = None
                cabin_class = None
                if table:
                    for row in table.find_all("tr"):
                        header_td = row.find("td", {"class": "review-rating-header"})
                        if header_td:
                            header_text = header_td.get_text().strip()
                            value_td = row.find("td", {"class": "review-value"})
                            if value_td:
                                val = value_td.get_text().strip()
                                if "Type Of Traveller" in header_text:
                                    traveler_type = val
                                elif "Seat Type" in header_text:
                                    cabin_class = val

                reviews.append({
                    "text": review_text,
                    "rating": rating_val,
                    "recommended": recommended,
                    "country": country_val,
                    "date": date_val,
                    "traveler_type": traveler_type,
                    "cabin_class": cabin_class
                })
        except HTTPException:
             raise
        except Exception as e:
             print(f"Scraper error on page {i}: {e}")
             continue
            
    if not reviews:
        raise HTTPException(status_code=404, detail=f"No reviews could be scraped for '{airline}'.")

    try:
        df = pd.DataFrame(reviews)
        df = df.rename(columns={"text": "reviews"})
        df['reviews'] = df['reviews'].apply(lambda x: x.split('|')[1] if '|' in x else x)
        df['Cleaned Reviews'] = df['reviews'].apply(clean)
        df['POS tagged'] = df['Cleaned Reviews'].apply(token_stop_pos)
        df['Lemma'] = df['POS tagged'].apply(lemmatize)
        df['Sentiment'] = df['Lemma'].apply(vadersentimentanalysis)
        df['Analysis'] = df['Sentiment'].apply(vader_analysis)
        
        vader_counts = df['Analysis'].value_counts().to_dict()
        
        # Calculate KPI Rating (out of 5) and Trend
        if 'rating' in df.columns and not df['rating'].isnull().all():
            df['rating_5'] = df['rating'] / 2.0
            overall_rating = float(round(df['rating_5'].mean(), 1))
            
            half_len = len(df) // 2
            if half_len > 0:
                recent_rating = df['rating_5'].iloc[:half_len].mean()
                previous_rating = df['rating_5'].iloc[half_len:].mean()
                if pd.notnull(recent_rating) and pd.notnull(previous_rating):
                    rating_trend = float(round(recent_rating - previous_rating, 2))
                else:
                    rating_trend = 0.0
            else:
                rating_trend = 0.0
        else:
            overall_rating = 0.0
            rating_trend = 0.0

        # Calculate Recommendation Rate and Trend
        if 'recommended' in df.columns and not df['recommended'].isnull().all():
            df['is_recommended'] = df['recommended'].apply(lambda x: 1 if x == 'yes' else (0 if x == 'no' else None))
            rec_rate = float(round(df['is_recommended'].mean() * 100, 1))
            
            half_len = len(df) // 2
            if half_len > 0:
                recent_rec = df['is_recommended'].iloc[:half_len].mean()
                previous_rec = df['is_recommended'].iloc[half_len:].mean()
                if pd.notnull(recent_rec) and pd.notnull(previous_rec):
                    rec_trend = float(round((recent_rec - previous_rec) * 100, 1))
                else:
                    rec_trend = 0.0
            else:
                rec_trend = 0.0
        else:
            rec_rate = 0.0
            rec_trend = 0.0

        # Sentiment Percentages
        total_rows = len(df)
        pos_percentage = float(round((vader_counts.get('Positive', 0) / total_rows) * 100, 1)) if total_rows > 0 else 0.0
        neg_percentage = float(round((vader_counts.get('Negative', 0) / total_rows) * 100, 1)) if total_rows > 0 else 0.0

        # Generate wordcloud image in memory
        stop_words_wc = set(STOPWORDS)
        wordcloud = WordCloud(
            background_color=None,
            mode='RGBA',
            stopwords=stop_words_wc,
            max_words=100,
            max_font_size=50,
            scale=3,
            random_state=1,
            colormap='viridis'
        ).generate(" ".join(df['Lemma'].astype(str)))
        
        image = wordcloud.to_image()
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        # --- Aspect & Complaint Sentence-Level Analysis ---
        reviews_aspects = []
        reviews_complaints = []
        
        for idx, row in df.iterrows():
            review_text = row['reviews']
            row_aspects = []
            row_complaints = []
            
            if isinstance(review_text, str) and review_text.strip():
                # Sentence level tokenize
                sentences = sent_tokenize(review_text)
                for sent in sentences:
                    sent_clean = sent.lower()
                    
                    # Aspect extraction
                    for aspect, keywords in ASPECT_KEYWORDS.items():
                        matches = False
                        for kw in keywords:
                            if re.search(r'\b' + re.escape(kw) + r'\b', sent_clean):
                                matches = True
                                break
                        if matches:
                            score = analyzer.polarity_scores(sent)['compound']
                            if score >= 0.05:
                                row_aspects.append({
                                    "aspect": aspect,
                                    "sentiment": "Positive",
                                    "snippet": sent.strip()
                                })
                            elif score <= -0.05:
                                row_aspects.append({
                                    "aspect": aspect,
                                    "sentiment": "Negative",
                                    "snippet": sent.strip()
                                })
                                
                    # Complaint extraction
                    for category, keywords in COMPLAINT_KEYWORDS.items():
                        matches = False
                        for kw in keywords:
                            if re.search(r'\b' + re.escape(kw) + r'\b', sent_clean):
                                matches = True
                                break
                        if matches:
                            score = analyzer.polarity_scores(sent)['compound']
                            if score <= -0.05:
                                row_complaints.append({
                                    "category": category,
                                    "snippet": sent.strip()
                                })
            
            reviews_aspects.append(row_aspects)
            reviews_complaints.append(row_complaints)
            
        df['aspects'] = reviews_aspects
        df['complaints'] = reviews_complaints

        # Compile global positive and negative topics from pre-processed aspects
        aspect_results = {}
        for aspect in ASPECT_KEYWORDS:
            aspect_results[aspect] = {
                "positive_count": 0,
                "negative_count": 0,
                "positive_snippets": [],
                "negative_snippets": []
            }
            
        for idx, row in df.iterrows():
            for aspect_item in row['aspects']:
                asp = aspect_item["aspect"]
                sent = aspect_item["sentiment"]
                snip = aspect_item["snippet"]
                score = 1.0 if sent == "Positive" else -1.0
                if sent == "Positive":
                    aspect_results[asp]["positive_count"] += 1
                    aspect_results[asp]["positive_snippets"].append((snip, score))
                else:
                    aspect_results[asp]["negative_count"] += 1
                    aspect_results[asp]["negative_snippets"].append((snip, score))

        pos_topics = []
        neg_topics = []
        for aspect, stats in aspect_results.items():
            if stats["positive_count"] > 0:
                best_snippet = ""
                if stats["positive_snippets"]:
                    sorted_snips = sorted(stats["positive_snippets"], key=lambda x: (-x[1], -len(x[0])))
                    best_snippet = sorted_snips[0][0].strip()
                pos_topics.append({
                    "topic": aspect,
                    "count": stats["positive_count"],
                    "snippet": best_snippet
                })
            
            if stats["negative_count"] > 0:
                best_snippet = ""
                if stats["negative_snippets"]:
                    sorted_snips = sorted(stats["negative_snippets"], key=lambda x: (x[1], -len(x[0])))
                    best_snippet = sorted_snips[0][0].strip()
                neg_topics.append({
                    "topic": aspect,
                    "count": stats["negative_count"],
                    "snippet": best_snippet
                })
                
        pos_topics = sorted(pos_topics, key=lambda x: x["count"], reverse=True)
        neg_topics = sorted(neg_topics, key=lambda x: x["count"], reverse=True)

        # --- Review Geography Data Processing & Raw Reviews list creation ---
        reviews_raw = []
        
        def clean_nan(val):
            if pd.isnull(val):
                return None
            return val

        for idx, row in df.iterrows():
            r_val = None
            if 'rating' in row and pd.notnull(row['rating']):
                r_val = float(round(row['rating'] / 2.0, 1))
            
            c_name = row['country'] if 'country' in row else "Unknown"
            c_iso = get_country_iso(c_name)
            
            reviews_raw.append({
                "text": row['reviews'],
                "date": clean_nan(row['date']) if 'date' in row and row['date'] else "",
                "country": c_iso,
                "rating": r_val,
                "sentiment": row['Analysis'],
                "recommended": clean_nan(row['recommended']) if 'recommended' in row else None,
                "traveler_type": clean_nan(row['traveler_type']) if 'traveler_type' in row else None,
                "cabin_class": clean_nan(row['cabin_class']) if 'cabin_class' in row else None,
                "aspects": row['aspects'],
                "complaints": row['complaints']
            })

        return {
            "airline": airline.replace("-", " ").title(),
            "total_reviews": total_rows,
            "sentiment_counts": vader_counts,
            "wordcloud_base64": img_str,
            "average_rating": overall_rating,
            "rating_trend": rating_trend,
            "recommendation_rate": rec_rate,
            "recommendation_trend": rec_trend,
            "positive_percentage": pos_percentage,
            "negative_percentage": neg_percentage,
            "reviews_raw": reviews_raw,
            "positive_topics": pos_topics,
            "negative_topics": neg_topics
        }
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to process text data: {str(e)}")
