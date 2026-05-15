// Mock data for fallback / dev — same shape as RingIn mobile app data

export const CURRENT_USER = {
  id: 'me',
  name: 'John Chrison',
  handle: '@johnc',
  role: 'Product Designer',
  bio: 'Building things at the intersection of design + code. Always learning.',
  location: 'Bangalore, IN',
  avatar: 'https://i.pravatar.cc/150?img=68',
  cover: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
  coins: 1240,
  followers: 412,
  following: 168,
  posts: 24,
}

export const EXPERTS = [
  { id: 1, initials: 'PN', name: 'Dr. Priya Nair', role: 'General Physician', rate: 120, rating: 4.9, calls: 842, followers: '2.1k', online: true, verified: true, color: 'linear-gradient(135deg,#1D9E75,#5DCAA5)', cover: 'linear-gradient(135deg,#0a2e1f,#1D9E75)', loc: 'Dubai, UAE', bio: 'MBBS, MD. 15 years experience.', tags: ['General Medicine', 'Preventive Care'], img: 'https://i.pravatar.cc/150?img=47', cat: 'health' },
  { id: 2, initials: 'RM', name: 'Ravi Menon', role: 'Sr. Software Engineer', rate: 80, rating: 4.8, calls: 631, followers: '1.4k', online: true, verified: true, color: 'linear-gradient(135deg,#534AB7,#7C6FFF)', cover: 'linear-gradient(135deg,#0a0a2e,#534AB7)', loc: 'Remote', bio: '10+ years in full-stack. Google and Meta alum.', tags: ['System Design', 'React', 'Node.js'], img: 'https://i.pravatar.cc/150?img=12', cat: 'tech' },
  { id: 3, initials: 'SA', name: 'Sara Al Zaabi', role: 'Career Coach', rate: 60, rating: 4.7, calls: 412, followers: '3.2k', online: true, verified: true, color: 'linear-gradient(135deg,#C84B8A,#E84D9A)', cover: 'linear-gradient(135deg,#2e0a1f,#C84B8A)', loc: 'Abu Dhabi', bio: 'Certified career coach. Helped 500+ professionals.', tags: ['Career Strategy', 'LinkedIn'], img: 'https://i.pravatar.cc/150?img=23', cat: 'career' },
  { id: 4, initials: 'AK', name: 'Ahmed Al Kaabi', role: 'Legal Advisor', rate: 150, rating: 4.9, calls: 389, followers: '1.8k', online: false, verified: true, color: 'linear-gradient(135deg,#B8860B,#FFD700)', cover: 'linear-gradient(135deg,#2e2200,#B8860B)', loc: 'Dubai, UAE', bio: 'Senior lawyer 12 years UAE corporate law.', tags: ['Corporate Law', 'Contracts'], img: 'https://i.pravatar.cc/150?img=33', cat: 'legal' },
  { id: 5, initials: 'LK', name: 'Dr. Layla Khalid', role: 'Psychologist', rate: 90, rating: 4.8, calls: 521, followers: '2.7k', online: true, verified: true, color: 'linear-gradient(135deg,#9B59B6,#D98EF0)', cover: 'linear-gradient(135deg,#1a0a2e,#9B59B6)', loc: 'Abu Dhabi', bio: 'Clinical psychologist. Anxiety & stress.', tags: ['Anxiety', 'CBT'], img: 'https://i.pravatar.cc/150?img=44', cat: 'health' },
  { id: 6, initials: 'JT', name: 'James Tanner', role: 'Fitness & Nutrition Coach', rate: 50, rating: 4.7, calls: 298, followers: '4.1k', online: true, verified: false, color: 'linear-gradient(135deg,#E8401A,#FF6B35)', cover: 'linear-gradient(135deg,#2e0a00,#E8401A)', loc: 'Remote', bio: 'Certified personal trainer & nutritionist.', tags: ['Weight Loss', 'Nutrition'], img: 'https://i.pravatar.cc/150?img=15', cat: 'fitness' },
  { id: 7, initials: 'MK', name: 'Maya Kapoor', role: 'Financial Advisor', rate: 110, rating: 4.9, calls: 367, followers: '1.2k', online: true, verified: true, color: 'linear-gradient(135deg,#0F766E,#14B8A6)', cover: 'linear-gradient(135deg,#0a2e2a,#0F766E)', loc: 'Mumbai', bio: 'CFA, 9 years wealth management.', tags: ['Investments', 'Retirement'], img: 'https://i.pravatar.cc/150?img=49', cat: 'finance' },
  { id: 8, initials: 'TS', name: 'Tariq Said', role: 'UI/UX Designer', rate: 70, rating: 4.8, calls: 241, followers: '2.5k', online: false, verified: false, color: 'linear-gradient(135deg,#0EA5E9,#38BDF8)', cover: 'linear-gradient(135deg,#0a1f2e,#0EA5E9)', loc: 'Berlin', bio: 'Senior product designer. Stripe & Linear alum.', tags: ['Portfolio Review', 'Figma'], img: 'https://i.pravatar.cc/150?img=11', cat: 'design' },
  { id: 9, initials: 'NR', name: 'Nadia Rahman', role: 'Marketing Strategist', rate: 85, rating: 4.7, calls: 189, followers: '980', online: true, verified: true, color: 'linear-gradient(135deg,#DB2777,#F472B6)', cover: 'linear-gradient(135deg,#2e0a1d,#DB2777)', loc: 'Dubai', bio: 'Brand & growth strategist.', tags: ['Branding', 'Growth'], img: 'https://i.pravatar.cc/150?img=27', cat: 'business' },
]

export const TRENDING_TOPICS = [
  { tag: '#SystemDesign', count: '142 posts' },
  { tag: '#AnxietyTools', count: '98 posts' },
  { tag: '#CareerSwitch', count: '76 posts' },
  { tag: '#IndexFunds', count: '54 posts' },
]

export const POSTS = [
  { id: 'p1', user: EXPERTS[1], time: '2h', text: "Just wrapped a 1-on-1 on system design for a senior engineer interview at Stripe. The biggest mistake people make? Diving into databases before nailing the API contract.\n\nClarify scope first. Always.", tags: ['SystemDesign', 'Interviews'], likes: 142, comments: 23, liked: false },
  { id: 'p2', user: EXPERTS[0], time: '5h', text: "Quick reminder: hydration is not a personality trait, it's a habit. Aim for 2-3L a day, more if you're active. Your kidneys (and skin) will thank you. 💧", tags: ['HealthTips'], likes: 418, comments: 67, liked: true },
  { id: 'p3', user: EXPERTS[4], time: '8h', text: "On anxiety: most people try to think their way out of it. But anxiety lives in the body. Five slow breaths can do more than five hours of overthinking.\n\nTry box breathing: 4 in, 4 hold, 4 out, 4 hold. Repeat for 2 minutes.", tags: ['MentalHealth', 'Anxiety'], likes: 892, comments: 104, liked: false },
  { id: 'p4', user: EXPERTS[2], time: '1d', text: "Career tip: your LinkedIn headline is the most-read sentence about your career. Make it about value, not just title.", tags: ['Career', 'LinkedIn'], likes: 234, comments: 41, liked: false },
]

export const CATEGORIES = [
  { id: 'all', label: 'All Experts', icon: '⚡' },
  { id: 'health', label: 'Health & Medical', icon: '🏥' },
  { id: 'tech', label: 'Tech & Engineering', icon: '💻' },
  { id: 'career', label: 'Career Coaching', icon: '🎯' },
  { id: 'legal', label: 'Legal', icon: '⚖️' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'fitness', label: 'Fitness & Wellness', icon: '💪' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'business', label: 'Business', icon: '📈' },
]

export const WORKSHOPS = [
  { id: 'w1', title: 'System Design Live: Designing WhatsApp', host: EXPERTS[1], live: true, viewers: 1241, cover: 'linear-gradient(135deg,#0a0a2e,#534AB7)' },
  { id: 'w2', title: 'Anxiety Toolkit: 5 Techniques That Actually Work', host: EXPERTS[4], live: true, viewers: 824, cover: 'linear-gradient(135deg,#1a0a2e,#9B59B6)' },
]

export const FILTERS = ['All', 'Following', 'Trending', 'Health', 'Tech', 'Career', 'Finance']
