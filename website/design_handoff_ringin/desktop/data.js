/* RingIn Desktop — mock data lifted from src/screens/SearchScreen.js + observed app behavior */
/* eslint-disable */

const CURRENT_USER = {
  id: 'me',
  name: 'John Chrison',
  handle: '@johnc',
  role: 'Product Designer',
  bio: 'Building things at the intersection of design + code. Always learning.',
  location: 'Bangalore, IN',
  joined: 'Joined Jan 2025',
  avatar: 'https://i.pravatar.cc/150?img=68',
  cover: 'linear-gradient(135deg,#7B6EFF,#E84D9A)',
  coins: 1240,
  followers: 412,
  following: 168,
  posts: 24,
};

const EXPERTS = [
  {id:1,initials:'PN',name:'Dr. Priya Nair',role:'General Physician',rate:120,rating:4.9,calls:842,followers:'2.1k',online:true,verified:true,color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',cover:'linear-gradient(135deg,#0a2e1f,#1D9E75)',loc:'Dubai, UAE',bio:'MBBS, MD. 15 years experience in general medicine. Specializes in preventive care and chronic disease management.',tags:['General Medicine','Preventive Care','Chronic Disease'],img:'https://i.pravatar.cc/150?img=47',cat:'health'},
  {id:2,initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',rate:80,rating:4.8,calls:631,followers:'1.4k',online:true,verified:true,color:'linear-gradient(135deg,#534AB7,#7C6FFF)',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',loc:'Remote',bio:'10+ years in full-stack development. Google and Meta alumni. Specializes in system design and technical interviews.',tags:['System Design','React','Node.js'],img:'https://i.pravatar.cc/150?img=12',cat:'tech'},
  {id:3,initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',rate:60,rating:4.7,calls:412,followers:'3.2k',online:true,verified:true,color:'linear-gradient(135deg,#C84B8A,#E84D9A)',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',loc:'Abu Dhabi',bio:'Certified career coach with 8 years experience. Helped 500+ professionals land their dream jobs.',tags:['Career Strategy','LinkedIn','Interviews'],img:'https://i.pravatar.cc/150?img=23',cat:'career'},
  {id:4,initials:'AK',name:'Ahmed Al Kaabi',role:'Legal Advisor',rate:150,rating:4.9,calls:389,followers:'1.8k',online:false,verified:true,color:'linear-gradient(135deg,#B8860B,#FFD700)',cover:'linear-gradient(135deg,#2e2200,#B8860B)',loc:'Dubai, UAE',bio:'Senior lawyer with 12 years in UAE corporate law. Helps with contracts, compliance, and dispute resolution.',tags:['Corporate Law','Contracts','Compliance'],img:'https://i.pravatar.cc/150?img=33',cat:'legal'},
  {id:5,initials:'LK',name:'Dr. Layla Khalid',role:'Psychologist',rate:90,rating:4.8,calls:521,followers:'2.7k',online:true,verified:true,color:'linear-gradient(135deg,#9B59B6,#D98EF0)',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',loc:'Abu Dhabi',bio:'Clinical psychologist specializing in anxiety, stress, and relationship issues. Compassionate, evidence-based care.',tags:['Anxiety','CBT','Stress'],img:'https://i.pravatar.cc/150?img=44',cat:'health'},
  {id:6,initials:'JT',name:'James Tanner',role:'Fitness & Nutrition Coach',rate:50,rating:4.7,calls:298,followers:'4.1k',online:true,verified:false,color:'linear-gradient(135deg,#E8401A,#FF6B35)',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',loc:'Remote',bio:'Certified personal trainer and nutritionist. Specializes in body recomposition and sustainable habits.',tags:['Weight Loss','Nutrition','Fitness'],img:'https://i.pravatar.cc/150?img=15',cat:'fitness'},
  {id:7,initials:'MK',name:'Maya Kapoor',role:'Financial Advisor',rate:110,rating:4.9,calls:367,followers:'1.2k',online:true,verified:true,color:'linear-gradient(135deg,#0F766E,#14B8A6)',cover:'linear-gradient(135deg,#0a2e2a,#0F766E)',loc:'Mumbai',bio:'CFA, 9 years in wealth management. Helps individuals and families plan retirement and investments.',tags:['Investments','Retirement','Tax'],img:'https://i.pravatar.cc/150?img=49',cat:'finance'},
  {id:8,initials:'TS',name:'Tariq Said',role:'UI/UX Designer',rate:70,rating:4.8,calls:241,followers:'2.5k',online:false,verified:false,color:'linear-gradient(135deg,#0EA5E9,#38BDF8)',cover:'linear-gradient(135deg,#0a1f2e,#0EA5E9)',loc:'Berlin',bio:'Senior product designer. Worked at Stripe and Linear. Reviews portfolios and runs design critiques.',tags:['Portfolio Review','Figma','UX'],img:'https://i.pravatar.cc/150?img=11',cat:'design'},
  {id:9,initials:'NR',name:'Nadia Rahman',role:'Marketing Strategist',rate:85,rating:4.7,calls:189,followers:'980',online:true,verified:true,color:'linear-gradient(135deg,#DB2777,#F472B6)',cover:'linear-gradient(135deg,#2e0a1d,#DB2777)',loc:'Dubai',bio:'Brand & growth strategist. Scaled 3 D2C brands past $10M ARR.',tags:['Branding','Growth','SEO'],img:'https://i.pravatar.cc/150?img=27',cat:'business'},
];

const CATEGORIES = [
  {id:'all',label:'All Experts',icon:'⚡'},
  {id:'health',label:'Health & Medical',icon:'🏥'},
  {id:'tech',label:'Tech & Engineering',icon:'💻'},
  {id:'career',label:'Career Coaching',icon:'🎯'},
  {id:'legal',label:'Legal',icon:'⚖️'},
  {id:'finance',label:'Finance',icon:'💰'},
  {id:'fitness',label:'Fitness & Wellness',icon:'💪'},
  {id:'design',label:'Design',icon:'🎨'},
  {id:'business',label:'Business',icon:'📈'},
];

const POSTS = [
  {id:'p1',user:EXPERTS[1],time:'2h',text:"Just wrapped a 1-on-1 on system design for a senior engineer interview at Stripe. The biggest mistake people make? Diving into databases before nailing the API contract.\n\nClarify scope first. Always.",tags:['System Design','Interviews'],likes:142,comments:23,liked:false},
  {id:'p2',user:EXPERTS[0],time:'5h',text:"Quick reminder: hydration is not a personality trait, it's a habit. Aim for 2-3L a day, more if you're active. Your kidneys (and skin) will thank you. 💧",tags:['Health Tips'],likes:418,comments:67,liked:true,img:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=900&q=80'},
  {id:'p3',user:EXPERTS[4],time:'8h',text:"On anxiety: most people try to think their way out of it. But anxiety lives in the body. Five slow breaths can do more than five hours of overthinking.\n\nTry box breathing: 4 in, 4 hold, 4 out, 4 hold. Repeat for 2 minutes.",tags:['Mental Health','Anxiety'],likes:892,comments:104,liked:false},
  {id:'p4',user:EXPERTS[2],time:'1d',text:"Career tip: your LinkedIn headline is the most-read sentence about your career. Make it about value, not just title.\n\n❌ \"Software Engineer at Acme\"\n✅ \"Software Engineer | Helping fintech teams ship payments infra 3x faster\"",tags:['Career','LinkedIn'],likes:234,comments:41,liked:false},
  {id:'p5',user:EXPERTS[5],time:'1d',text:"Stop chasing the perfect workout. The best plan is the one you'll actually do for 12 weeks. Boring consistency > exciting inconsistency every single time.",tags:['Fitness'],likes:567,comments:88,liked:true},
  {id:'p6',user:EXPERTS[6],time:'2d',text:"If your salary increased 20% but your savings rate stayed the same, you got a pay cut. Lifestyle inflation is the #1 reason high earners feel broke.",tags:['Finance','Money'],likes:1203,comments:156,liked:false},
];

const COMMENTS_BY_POST = {
  p1: [
    {id:'c1',user:{name:'Aisha P.',avatar:'https://i.pravatar.cc/100?img=20'},text:'This. Underrated take. Spent 30min once on schema and forgot to define the actual API.',time:'1h',likes:12},
    {id:'c2',user:{name:'Karan B.',avatar:'https://i.pravatar.cc/100?img=53'},text:'Booking a session next week 🙌',time:'45m',likes:3},
  ],
  p3: [
    {id:'c3',user:{name:'Sam K.',avatar:'https://i.pravatar.cc/100?img=58'},text:'Box breathing literally saved my anxiety attacks. Confirmed.',time:'3h',likes:34},
  ],
};

const CONVERSATIONS = [
  {id:'cv1',user:EXPERTS[1],preview:"That's exactly the right approach 👍",time:'2m',unread:2,online:true},
  {id:'cv2',user:EXPERTS[2],preview:"I'll send you the LinkedIn template tomorrow",time:'1h',unread:0,online:true},
  {id:'cv3',user:EXPERTS[0],preview:"You: Sounds good — let's schedule for Wednesday",time:'3h',unread:0,online:true},
  {id:'cv4',user:EXPERTS[4],preview:"Try the breathing exercise tonight and let me know",time:'Yesterday',unread:1,online:true},
  {id:'cv5',user:EXPERTS[7],preview:"Loved your portfolio. Few thoughts inside…",time:'Yesterday',unread:0,online:false},
  {id:'cv6',user:EXPERTS[5],preview:"You: Thanks for the meal plan!",time:'Mon',unread:0,online:true},
  {id:'cv7',user:EXPERTS[6],preview:"Index funds are still the move for most people",time:'Sun',unread:0,online:true},
  {id:'cv8',user:EXPERTS[3],preview:"You: Got it, will send the contract draft over",time:'Apr 28',unread:0,online:false},
];

const MESSAGES_BY_CONVO = {
  cv1: [
    {id:'m1',from:'them',text:"Hey John 👋 Saw your question about React state in the post comments.",time:'10:24 AM'},
    {id:'m2',from:'me',text:"Yes! Specifically struggling with stale closures in useEffect. Have a 30-min slot today?",time:'10:26 AM'},
    {id:'m3',from:'them',text:"Yeah — easy fix usually. Either add the value to deps OR use useRef for things that should never re-trigger.",time:'10:27 AM'},
    {id:'m4',from:'them',type:'image',img:'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80',time:'10:28 AM'},
    {id:'m5',from:'me',text:"Ah this is gold. The useRef pattern is what I was missing.",time:'10:32 AM'},
    {id:'m6',from:'them',text:"That's exactly the right approach 👍",time:'10:33 AM'},
  ],
  cv2: [
    {id:'m1',from:'them',text:"Updated the LinkedIn headline draft for you — punchier this time.",time:'9:14 AM'},
    {id:'m2',from:'me',text:"Reading now…",time:'9:30 AM'},
    {id:'m3',from:'them',text:"I'll send you the LinkedIn template tomorrow",time:'9:33 AM'},
  ],
};

const WORKSHOPS = [
  {id:'w1',title:'System Design Live: Designing WhatsApp',host:EXPERTS[1],live:true,viewers:1241,price:'free',cover:'linear-gradient(135deg,#0a0a2e,#534AB7)',startsIn:'Live now',duration:'90 min',level:'Intermediate',desc:'Walk through the full architecture — load balancers, message queues, end-to-end encryption, presence systems. Bring your questions; we go deep on tradeoffs.'},
  {id:'w2',title:'Anxiety Toolkit: 5 Techniques That Actually Work',host:EXPERTS[4],live:true,viewers:824,price:'free',cover:'linear-gradient(135deg,#1a0a2e,#9B59B6)',startsIn:'Live now',duration:'60 min',level:'All levels',desc:'Five evidence-based techniques you can use today — grounding, cognitive reframing, breath work, sleep hygiene, and behavioral activation. Live Q&A at the end.'},
  {id:'w3',title:'LinkedIn That Lands Interviews',host:EXPERTS[2],live:false,viewers:0,price:'pro',cover:'linear-gradient(135deg,#2e0a1f,#C84B8A)',startsIn:'Tomorrow, 7:00 PM',duration:'75 min',level:'Beginner',desc:'Rewrite your headline, fix the about section, and learn the outreach template that gets a 40% response rate from recruiters in tech.'},
  {id:'w4',title:'Beginner Strength Training Walkthrough',host:EXPERTS[5],live:false,viewers:0,price:'free',cover:'linear-gradient(135deg,#2e0a00,#E8401A)',startsIn:'Sat, 10:00 AM',duration:'60 min',level:'Beginner',desc:'Learn the four foundational lifts — squat, hinge, press, pull. Form demos, common mistakes, and a 4-week starter program you can do anywhere.'},
  {id:'w5',title:'Index Funds vs ETFs Explained Simply',host:EXPERTS[6],live:false,viewers:0,price:'pro',cover:'linear-gradient(135deg,#0a2e2a,#0F766E)',startsIn:'Sun, 6:00 PM',duration:'45 min',level:'Beginner',desc:'Cut through the jargon. Real numbers, real portfolios, and a simple decision framework for which one fits your situation.'},
  {id:'w6',title:'Portfolio Review Hot Seat',host:EXPERTS[7],live:false,viewers:0,price:'free',cover:'linear-gradient(135deg,#0a1f2e,#0EA5E9)',startsIn:'Mon, 8:00 PM',duration:'90 min',level:'Intermediate',desc:'Five designers submit their portfolios. We critique live — what to keep, what to cut, and the single change that would most improve recruiter response.'},
];

const PACKAGES = [
  {id:1,coins:100,price:100,label:'Starter',bonus:0,popular:false},
  {id:2,coins:200,price:200,label:'Basic',bonus:0,popular:false},
  {id:3,coins:500,price:500,label:'Popular',bonus:0,popular:true},
  {id:4,coins:1000,price:900,label:'Best Value',bonus:100,popular:false},
  {id:5,coins:2000,price:1700,label:'Power',bonus:300,popular:false},
  {id:6,coins:5000,price:4000,label:'Pro',bonus:1000,popular:false},
];

const TRANSACTIONS = [
  {id:1,type:'call',label:'Call with Dr. Priya Nair',coins:-24,date:'Today, 2:15 PM'},
  {id:2,type:'purchase',label:'Purchased 500 coins',coins:500,date:'Today, 1:00 PM'},
  {id:3,type:'call',label:'Call with Ravi Menon',coins:-36,date:'Yesterday'},
  {id:4,type:'workshop',label:'Joined: System Design Live',coins:-15,date:'Yesterday'},
  {id:5,type:'purchase',label:'Purchased 100 coins',coins:100,date:'Apr 27'},
  {id:6,type:'call',label:'Call with Sara Al Zaabi',coins:-18,date:'Apr 25'},
];

const NOTIFICATIONS = [
  {id:1,type:'like',from:EXPERTS[1],text:'liked your post',time:'2m'},
  {id:2,type:'follow',from:EXPERTS[2],text:'started following you',time:'1h'},
  {id:3,type:'comment',from:EXPERTS[0],text:'commented on your post: "Great point about hydration!"',time:'4h'},
  {id:4,type:'call',from:EXPERTS[4],text:'is now available for calls',time:'Yesterday'},
];

window.RING_DATA = { CURRENT_USER, EXPERTS, CATEGORIES, POSTS, COMMENTS_BY_POST, CONVERSATIONS, MESSAGES_BY_CONVO, WORKSHOPS, PACKAGES, TRANSACTIONS, NOTIFICATIONS };
