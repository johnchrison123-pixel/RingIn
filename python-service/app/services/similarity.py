"""
Similarity utilities — text similarity, Jaccard, cosine, etc.
"""
import json
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def jaccard_similarity(set_a, set_b):
    """Jaccard similarity coefficient between two sets."""
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union if union > 0 else 0.0


def compute_text_similarity(text_a: str, text_b: str) -> float:
    """TF-IDF cosine similarity between two texts."""
    if not text_a or not text_b:
        return 0.0
    try:
        vec = TfidfVectorizer(max_features=200, stop_words="english", lowercase=True)
        tfidf = vec.fit_transform([text_a, text_b])
        sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        return float(sim)
    except Exception:
        return 0.0


def compute_user_similarity(user_a, user_b):
    """
    Compute similarity between two users.
    Can take strings (bio texts) or feature dicts.
    """
    if isinstance(user_a, str) and isinstance(user_b, str):
        return compute_text_similarity(user_a, user_b)

    # Assume both are feature dicts
    score = 0.0
    weight_sum = 0.0

    # Text similarity (bio + about)
    if user_a.get("text") and user_b.get("text"):
        text_sim = compute_text_similarity(user_a["text"], user_b["text"])
        score += text_sim * 3.0
        weight_sum += 3.0

    # Tag overlap
    if user_a.get("tags") and user_b.get("tags"):
        tag_sim = jaccard_similarity(set(user_a["tags"]), set(user_b["tags"]))
        score += tag_sim * 2.0
        weight_sum += 2.0

    # Location match
    if user_a.get("country") and user_b.get("country"):
        if user_a["country"] == user_b["country"]:
            score += 1.0
        weight_sum += 1.0

    return score / weight_sum if weight_sum > 0 else 0.0


def get_user_features(user_row):
    """Extract feature dict from a profiles row."""
    bio = {}
    try:
        bio = json.loads(user_row.get("bio") or "{}")
    except Exception:
        pass

    location = bio.get("location", {})
    text_parts = [
        bio.get("about", ""),
        bio.get("tag", ""),
        bio.get("expert_request", {}).get("bio", "") if bio.get("expert_request") else "",
    ]

    return {
        "text": " ".join(t for t in text_parts if t),
        "tags": [bio.get("tag", "").replace("#", "")] if bio.get("tag") else [],
        "country": location.get("country"),
        "state": location.get("state"),
        "city": location.get("city"),
    }


def cosine_sim_matrix(texts):
    """Compute pairwise cosine similarity for a list of texts."""
    if len(texts) < 2:
        return np.array([[1.0]])
    try:
        vec = TfidfVectorizer(max_features=500, stop_words="english", lowercase=True)
        tfidf = vec.fit_transform(texts)
        return cosine_similarity(tfidf)
    except Exception:
        return np.eye(len(texts))
