/* Centralized workshop data — single source of truth.
 * Replace with DB lookup in production via Supabase.
 */

export const WORKSHOPS = [
  {
    id: 'w1',
    title: 'System Design Live: Designing WhatsApp',
    host: { id: 'host-ravi', name: 'Ravi Menon', img: 'https://i.pravatar.cc/150?img=12' },
    live: true,
    viewers: 1241,
    cover: 'linear-gradient(135deg,#0a0a2e,#534AB7)',
    desc: 'Walk through the full architecture — load balancers, message queues, end-to-end encryption, presence systems. Bring your questions; we go deep on tradeoffs.',
    duration: '90 min',
    level: 'Intermediate',
    startsIn: 'Live now',
    startDateISO: new Date(Date.now() - 1000 * 60 * 30).toISOString(),  // Started 30 min ago
    price: 'free',
  },
  {
    id: 'w2',
    title: 'Anxiety Toolkit: 5 Techniques That Actually Work',
    host: { id: 'host-layla', name: 'Dr. Layla Khalid', img: 'https://i.pravatar.cc/150?img=44' },
    live: true,
    viewers: 824,
    cover: 'linear-gradient(135deg,#1a0a2e,#9B59B6)',
    desc: 'Five evidence-based techniques you can use today — grounding, cognitive reframing, breath work, sleep hygiene, and behavioral activation. Live Q&A at the end.',
    duration: '60 min',
    level: 'All levels',
    startsIn: 'Live now',
    startDateISO: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    price: 'free',
  },
  {
    id: 'w3',
    title: 'LinkedIn That Lands Interviews',
    host: { id: 'host-sara', name: 'Sara Al Zaabi', img: 'https://i.pravatar.cc/150?img=23' },
    live: false,
    viewers: 0,
    cover: 'linear-gradient(135deg,#2e0a1f,#C84B8A)',
    desc: 'Rewrite your headline, fix the about section, and learn the outreach template that gets a 40% response rate from recruiters in tech.',
    duration: '75 min',
    level: 'Beginner',
    startsIn: 'Tomorrow, 7:00 PM',
    startDateISO: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    price: 'pro',
  },
  {
    id: 'w4',
    title: 'Beginner Strength Training Walkthrough',
    host: { id: 'host-james', name: 'James Tanner', img: 'https://i.pravatar.cc/150?img=15' },
    live: false,
    viewers: 0,
    cover: 'linear-gradient(135deg,#2e0a00,#E8401A)',
    desc: 'Learn the four foundational lifts — squat, hinge, press, pull. Form demos, common mistakes, and a 4-week starter program you can do anywhere.',
    duration: '60 min',
    level: 'Beginner',
    startsIn: 'Sat, 10:00 AM',
    startDateISO: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    price: 'free',
  },
  {
    id: 'w5',
    title: 'Index Funds vs ETFs Explained Simply',
    host: { id: 'host-maya', name: 'Maya Kapoor', img: 'https://i.pravatar.cc/150?img=49' },
    live: false,
    viewers: 0,
    cover: 'linear-gradient(135deg,#0a2e2a,#0F766E)',
    desc: 'Cut through the jargon. Real numbers, real portfolios, and a simple decision framework for which one fits your situation.',
    duration: '45 min',
    level: 'Beginner',
    startsIn: 'Sun, 6:00 PM',
    startDateISO: new Date(Date.now() + 1000 * 60 * 60 * 96).toISOString(),
    price: 'pro',
  },
]

export function getWorkshopIds() {
  return WORKSHOPS.map(w => w.id)
}

export function getWorkshopById(id) {
  return WORKSHOPS.find(w => w.id === id)
}
