"""
AI features — auto-tagging, summarization, trending topic detection.
"""
import re
from collections import Counter
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db import get_client

router = APIRouter()


# Topic keyword maps for auto-tagging
TOPIC_KEYWORDS = {
    "health": ["doctor", "medicine", "health", "wellness", "medical", "hospital", "symptom", "treatment", "diagnosis", "patient", "clinic"],
    "tech": ["code", "coding", "developer", "engineer", "software", "api", "system design", "database", "react", "python", "javascript", "ai", "ml"],
    "career": ["job", "career", "interview", "linkedin", "resume", "cv", "hiring", "promotion", "salary", "office"],
    "finance": ["money", "invest", "investment", "stocks", "mutual fund", "crypto", "savings", "tax", "retirement", "pension", "loan", "credit"],
    "mental_health": ["anxiety", "depression", "stress", "therapy", "psychology", "mind", "mental", "panic", "wellbeing", "meditation"],
    "fitness": ["gym", "workout", "exercise", "diet", "nutrition", "protein", "strength", "cardio", "yoga", "muscle", "weight"],
    "design": ["ui", "ux", "design", "figma", "portfolio", "typography", "color", "logo", "brand"],
    "business": ["startup", "founder", "business", "growth", "marketing", "sales", "revenue", "customer", "product market fit"],
    "education": ["learn", "study", "education", "course", "tutorial", "school", "college", "university", "teacher", "student"],
    "legal": ["law", "lawyer", "legal", "contract", "agreement", "court", "rights", "compliance"],
    "relationship": ["love", "relationship", "dating", "marriage", "partner", "breakup", "friend"],
    "anxiety": ["anxious", "worry", "fear", "scared", "panic", "nervous"],
}


class TagRequest(BaseModel):
    text: str
    max_tags: int = 5


class SummarizeRequest(BaseModel):
    text: str
    max_sentences: int = 3


@router.post("/auto-tag")
async def auto_tag(req: TagRequest):
    """
    Detect topics in a piece of text. Used for auto-tagging posts.
    Returns predicted topics with confidence scores.
    """
    text = (req.text or "").lower()
    if not text:
        return {"tags": [], "primary_topic": None}

    scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        hits = 0
        for kw in keywords:
            if kw in text:
                hits += 1
        if hits > 0:
            scores[topic] = hits

    # Sort by score
    sorted_topics = sorted(scores.items(), key=lambda x: -x[1])
    max_score = max(scores.values()) if scores else 1

    tags = [
        {
            "topic": topic,
            "confidence": round(score / max_score, 2),
            "hits": score,
        }
        for topic, score in sorted_topics[:req.max_tags]
    ]

    # Also extract hashtags from text
    hashtags = re.findall(r"#(\w+)", req.text or "")

    return {
        "tags": tags,
        "primary_topic": sorted_topics[0][0] if sorted_topics else None,
        "hashtags_found": hashtags,
    }


@router.post("/summarize")
async def summarize(req: SummarizeRequest):
    """
    Simple extractive summarization — picks most important sentences.
    For real production, use OpenAI/Claude API.
    """
    text = req.text or ""
    if not text:
        return {"summary": ""}

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) <= req.max_sentences:
        return {"summary": text, "sentence_count": len(sentences)}

    # Score sentences by:
    # 1. Length (medium length preferred)
    # 2. Position (first and last sentences weighted higher)
    # 3. Word frequency (sentences with common words score higher)

    # Count word frequencies (excluding stop words)
    stop_words = set("a an the is are was were be been being have has had do does did will would should could may might can i you he she it we they me him her us them my your his her its our their this that these those and or but so because if when where what who how".split())
    word_counts = Counter()
    for s in sentences:
        for w in re.findall(r'\b\w{4,}\b', s.lower()):
            if w not in stop_words:
                word_counts[w] += 1

    # Score each sentence
    scored = []
    for i, s in enumerate(sentences):
        words = re.findall(r'\b\w{4,}\b', s.lower())
        # Word-frequency score
        wf_score = sum(word_counts[w] for w in words if w not in stop_words)
        # Position bonus
        if i == 0:
            wf_score *= 1.5
        elif i == len(sentences) - 1:
            wf_score *= 1.2
        # Length penalty (avoid super long sentences)
        if len(words) > 30 or len(words) < 4:
            wf_score *= 0.6

        scored.append((i, s, wf_score))

    # Pick top sentences (keep original order)
    scored.sort(key=lambda x: -x[2])
    top = sorted(scored[:req.max_sentences], key=lambda x: x[0])
    summary = " ".join(t[1] for t in top)

    return {
        "summary": summary,
        "original_length": len(sentences),
        "summary_length": len(top),
    }


@router.get("/trending-topics")
async def trending_topics(hours: int = 24, limit: int = 10):
    """
    Detect trending topics from recent posts.
    Returns hashtags + auto-detected topics.
    """
    sb = get_client()
    try:
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        posts_resp = sb.table("posts").select("text, tags, created_at").gte("created_at", since).execute()
        posts = posts_resp.data or []

        hashtag_counter = Counter()
        topic_counter = Counter()

        for p in posts:
            # Hashtags from tags array
            for t in (p.get("tags") or []):
                if t:
                    hashtag_counter[t.lower()] += 1

            # Hashtags from text
            for h in re.findall(r"#(\w+)", p.get("text") or ""):
                hashtag_counter[h.lower()] += 1

            # Auto-detect topics
            text = (p.get("text") or "").lower()
            for topic, keywords in TOPIC_KEYWORDS.items():
                for kw in keywords:
                    if kw in text:
                        topic_counter[topic] += 1
                        break  # don't double-count same topic per post

        return {
            "hashtags": [
                {"tag": tag, "count": count}
                for tag, count in hashtag_counter.most_common(limit)
            ],
            "topics": [
                {"topic": topic, "count": count}
                for topic, count in topic_counter.most_common(limit)
            ],
            "post_count": len(posts),
            "hours_back": hours,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-keywords")
async def extract_keywords(req: SummarizeRequest):
    """Extract the top keywords from a piece of text."""
    text = (req.text or "").lower()
    if not text:
        return {"keywords": []}

    stop_words = set("a an the is are was were be been being have has had do does did will would should could may might can i you he she it we they me him her us them my your his her its our their this that these those and or but so because if when where what who how to in on at for with by from up about out".split())

    words = re.findall(r'\b\w{4,}\b', text)
    keywords = [w for w in words if w not in stop_words]
    counter = Counter(keywords)

    return {
        "keywords": [
            {"word": w, "count": c}
            for w, c in counter.most_common(10)
        ],
    }
