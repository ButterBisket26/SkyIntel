import pandas as pd
import requests
from bs4 import BeautifulSoup
base_url = "https://www.airlinequality.com/airline-reviews/qatar-airways"   #in case of other airlines, change the airline name in the url
pages = 10
page_size = 100

reviews = []

for i in range(1, pages + 1):
    print(f"Scraping page {i}")
  
    url = f"{base_url}/page/{i}/?sortby=post_date%3ADesc&pagesize={page_size}"

    try:
        response = requests.get(url)
        response.raise_for_status()  
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {i}: {e}")
        continue  

    
    content = response.content
    parsed_content = BeautifulSoup(content, 'html.parser')
    for para in parsed_content.find_all("div", {"class": "text_content"}):
        reviews.append(para.get_text())
    
    print(f"   ---> {len(reviews)} total reviews")
df = pd.DataFrame()
df["reviews"] = reviews
df.head()
df['reviews'] = df['reviews'].apply(lambda x: x.split('|')[1] if '|' in x else x)
df
import re

def clean(text):
    text = re.sub('[^A-Za-z]+', ' ', str(text))
    return text
 
df['Cleaned Reviews'] = df['reviews'].apply(clean)
df.head()
import nltk


nltk.download('punkt')
from nltk import pos_tag
nltk.download('stopwords')
from nltk.corpus import stopwords
nltk.download('wordnet')
from nltk.corpus import wordnet
nltk.download('omw-1.4')
nltk.download('averaged_perceptron_tagger')



from nltk.tokenize import word_tokenize

#testing
print(word_tokenize("Hello, this is a test sentence."))

pos_dict = {'J': wordnet.ADJ, 'V': wordnet.VERB, 'N': wordnet.NOUN, 'R': wordnet.ADV}
def token_stop_pos(text):
    try:
        if not text.strip(): 
            return []
        
        print(f"Processing review: {text[:50]}...")  
        
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
        print(f"Error processing review: {text[:50]}... - {e}")
        return []
df['POS tagged'] = df['reviews'].apply(token_stop_pos)
df.head()


from nltk.stem import WordNetLemmatizer
wordnet_lemmatizer = WordNetLemmatizer()
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

df['Lemma'] = df['POS tagged'].apply(lemmatize)
df.head()
df[['reviews','Lemma']]
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
analyzer = SentimentIntensityAnalyzer()


def vadersentimentanalysis(review):
    vs = analyzer.polarity_scores(review)
    return vs['compound']

df['Sentiment'] = df['Lemma'].apply(vadersentimentanalysis)

def vader_analysis(compound):
    if compound >= 0.5:
        return 'Positive'
    elif compound < 0 :
        return 'Negative'
    else:
        return 'Neutral'
df['Analysis'] = df['Sentiment'].apply(vader_analysis)
df.head()
vader_counts = df['Analysis'].value_counts()
vader_counts
airline_name = base_url.rstrip("/").split("/")[-1].replace("-", " ").title()  # Convert to title case

import matplotlib.pyplot as plt
%matplotlib inline
plt.figure(figsize=(15,7))

plt.subplot(1,3,2)
plt.title(f"Reviews Analysis for {airline_name}")
plt.pie(vader_counts.values, labels = vader_counts.index, explode = (0, 0, 0.25), autopct='%1.1f%%', shadow=False)
plt.show()

import matplotlib.pyplot as plt
from wordcloud import WordCloud, STOPWORDS


stopwords = set(STOPWORDS)

def show_wordcloud(data, airline_name):
    wordcloud = WordCloud(
        background_color='white',
        stopwords=stopwords,
        max_words=100,
        max_font_size=30,
        scale=3,
        random_state=1
    ).generate(" ".join(data.astype(str)))  

    fig = plt.figure(figsize=(12, 12)) 
    ax = fig.add_subplot(111)  
    ax.imshow(wordcloud, interpolation='bilinear')  
    ax.axis('off')  
    ax.set_title(f"Word Cloud for {airline_name}", fontsize=20, pad=20)  # Set title with airline name

    plt.show()  

show_wordcloud(df.Lemma, airline_name)

