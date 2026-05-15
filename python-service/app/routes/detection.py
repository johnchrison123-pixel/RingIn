"""
Content moderation — spam, profanity, abuse detection.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from better_profanity import profanity
import re

router = APIRouter()

profanity.load_censor_words()

# Spam indicators
SPAM_PATTERNS = [
    r"\b(buy now|click here|limited offer|act now|guaranteed)\b",
    r"\b(viagra|cialis|porn|xxx)\b",
    r"\b(crypto|bitcoin|forex|trading signals)\b.*\b(guaranteed|profit|investment)\b",
    r"\bhttps?://[^\s]{4,}\.(tk|ml|ga|cf|gq)\b",  # suspicious TLDs
    r"(.)\1{6,}",  # repeated chars (aaaaaaa)
    r"\b(whatsapp|telegram|signal)\s*\+?\d{6,}",  # phone solicitation
]

ABUSE_KEYWORDS = [
    "kill yourself", "kys", "die", "stupid idiot", "worthless", "loser",
    "racist", "sexist", "hate you all",
]


class DetectRequest(BaseModel):
    text: str
    context: str = "post"  # post | comment | message


class DetectResponse(BaseModel):
    is_spam: bool
    is_profane: bool
    is_abusive: bool
    spam_score: float  # 0..1
    profanity_score: float  # 0..1
    abuse_score: float  # 0..1
    flags: list[str]
    cleaned_text: str
    action: str  # 'allow' | 'review' | 'block'


@router.post("/", response_model=DetectResponse)
async def detect(req: DetectRequest):
    """Run all detection checks on a piece of text."""
    text = req.text or ""
    text_lower = text.lower()

    flags = []

    # 1. Profanity check
    is_profane = profanity.contains_profanity(text)
    profanity_score = 1.0 if is_profane else 0.0
    if is_profane:
        flags.append("profanity")

    # 2. Spam check
    spam_hits = 0
    for pattern in SPAM_PATTERNS:
        if re.search(pattern, text_lower):
            spam_hits += 1
            flags.append(f"spam_pattern")
    spam_score = min(spam_hits / 3.0, 1.0)
    is_spam = spam_score >= 0.34

    # Check for too many URLs (common spam indicator)
    url_count = len(re.findall(r"https?://", text_lower))
    if url_count >= 3:
        spam_score = min(spam_score + 0.4, 1.0)
        flags.append("multiple_urls")
        is_spam = True

    # 3. Abuse check
    abuse_hits = sum(1 for kw in ABUSE_KEYWORDS if kw in text_lower)
    abuse_score = min(abuse_hits / 2.0, 1.0)
    is_abusive = abuse_score >= 0.5
    if is_abusive:
        flags.append("abuse_keywords")

    # 4. ALL CAPS yelling
    if len(text) > 20 and text.isupper():
        flags.append("all_caps")

    # 5. Decide action
    if is_abusive or spam_score > 0.66:
        action = "block"
    elif is_profane or is_spam or "all_caps" in flags:
        action = "review"
    else:
        action = "allow"

    return DetectResponse(
        is_spam=is_spam,
        is_profane=is_profane,
        is_abusive=is_abusive,
        spam_score=round(spam_score, 2),
        profanity_score=profanity_score,
        abuse_score=round(abuse_score, 2),
        flags=list(set(flags)),
        cleaned_text=profanity.censor(text),
        action=action,
    )


@router.post("/batch")
async def detect_batch(items: list[DetectRequest]):
    """Bulk-check multiple texts at once (for queue moderation)."""
    results = []
    for item in items:
        r = await detect(item)
        results.append({"text": item.text[:100], "result": r})
    return {"count": len(results), "results": results}
