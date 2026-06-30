/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import {useFollow} from './useFollow';
import {sb as sbProfile} from '../utils/supabase';
import {usePostsRealtime} from '../utils/usePostsRealtime';
import Moments from '../components/Moments';
import AvatarRing from '../components/AvatarRing';
import VerificationBadge from '../components/VerificationBadge'; /* R40 */
import {useMomentUserIds} from '../utils/momentUsers';
import {useHideLikes} from '../utils/likeDisplayPref';
import {useCloseFriends, addCloseFriend, removeCloseFriend} from '../utils/closeFriends';
import {playSound,playUnlikeSound,previewSound,saveSoundPrefs,SOUND_META,getHapticsEnabled,setHapticsEnabled,forceSound,forceHaptic,isHapticSupported} from '../utils/soundEngine';
import {toastSuccess,toastError,toastInfo,toastWarn} from '../utils/toast';
import {useCoinBalance} from '../utils/coinBalance';
import {sb as sbProfileCoin} from '../utils/supabase';
/* R18: timezone-aware date display + safe localStorage wrapper */
import {formatDate, safeSetItem} from '../utils/dateFmt';
import {acquireBodyScrollLock} from '../utils/bodyScrollLock'; /* R20 FIX #2 */
import StoreScreen from './StoreScreen';
import LeaderboardScreen from './LeaderboardScreen';
import {loadCatalog, equippedItem, TagPill, Sticker, frameOverlay, themeStyle} from '../utils/cosmetics';

// Copy a URL to the clipboard and toast ONLY on real success.
// Same helper pattern as HomeScreen — eliminates false-positive "Link
// copied!" alerts when the clipboard API silently fails.
function copyToClipboardWithToast(url, successMsg){
  function legacyCopy(t){
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch(_) { return false; }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function(){
        toastSuccess(successMsg || '🔗 Link copied!');
      }).catch(function(){
        if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
        else toastError('Couldn\'t copy — long-press the link to copy');
      });
      return;
    }
    if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
    else toastError('Couldn\'t copy — long-press the link to copy');
  } catch(e) {
    if (legacyCopy(url)) toastSuccess(successMsg || '🔗 Link copied!');
    else toastError('Couldn\'t copy — long-press the link to copy');
  }
}

var COUNTRIES=[
  ['AF','Afghanistan','+93'],['AL','Albania','+355'],['DZ','Algeria','+213'],['AD','Andorra','+376'],['AO','Angola','+244'],
  ['AG','Antigua and Barbuda','+1-268'],['AR','Argentina','+54'],['AM','Armenia','+374'],['AU','Australia','+61'],['AT','Austria','+43'],
  ['AZ','Azerbaijan','+994'],['BS','Bahamas','+1-242'],['BH','Bahrain','+973'],['BD','Bangladesh','+880'],['BB','Barbados','+1-246'],
  ['BY','Belarus','+375'],['BE','Belgium','+32'],['BZ','Belize','+501'],['BJ','Benin','+229'],['BT','Bhutan','+975'],
  ['BO','Bolivia','+591'],['BA','Bosnia and Herzegovina','+387'],['BW','Botswana','+267'],['BR','Brazil','+55'],['BN','Brunei','+673'],
  ['BG','Bulgaria','+359'],['BF','Burkina Faso','+226'],['BI','Burundi','+257'],['CV','Cabo Verde','+238'],['KH','Cambodia','+855'],
  ['CM','Cameroon','+237'],['CA','Canada','+1'],['CF','Central African Republic','+236'],['TD','Chad','+235'],['CL','Chile','+56'],
  ['CN','China','+86'],['CO','Colombia','+57'],['KM','Comoros','+269'],['CD','Congo DR','+243'],['CG','Congo Republic','+242'],
  ['CR','Costa Rica','+506'],['HR','Croatia','+385'],['CU','Cuba','+53'],['CY','Cyprus','+357'],['CZ','Czech Republic','+420'],
  ['DK','Denmark','+45'],['DJ','Djibouti','+253'],['DM','Dominica','+1-767'],['DO','Dominican Republic','+1-809'],['EC','Ecuador','+593'],
  ['EG','Egypt','+20'],['SV','El Salvador','+503'],['GQ','Equatorial Guinea','+240'],['ER','Eritrea','+291'],['EE','Estonia','+372'],
  ['SZ','Eswatini','+268'],['ET','Ethiopia','+251'],['FJ','Fiji','+679'],['FI','Finland','+358'],['FR','France','+33'],
  ['GA','Gabon','+241'],['GM','Gambia','+220'],['GE','Georgia','+995'],['DE','Germany','+49'],['GH','Ghana','+233'],
  ['GR','Greece','+30'],['GD','Grenada','+1-473'],['GT','Guatemala','+502'],['GN','Guinea','+224'],['GW','Guinea-Bissau','+245'],
  ['GY','Guyana','+592'],['HT','Haiti','+509'],['HN','Honduras','+504'],['HU','Hungary','+36'],['IS','Iceland','+354'],
  ['IN','India','+91'],['ID','Indonesia','+62'],['IR','Iran','+98'],['IQ','Iraq','+964'],['IE','Ireland','+353'],
  ['IL','Israel','+972'],['IT','Italy','+39'],['JM','Jamaica','+1-876'],['JP','Japan','+81'],['JO','Jordan','+962'],
  ['KZ','Kazakhstan','+7'],['KE','Kenya','+254'],['KI','Kiribati','+686'],['KW','Kuwait','+965'],['KG','Kyrgyzstan','+996'],
  ['LA','Laos','+856'],['LV','Latvia','+371'],['LB','Lebanon','+961'],['LS','Lesotho','+266'],['LR','Liberia','+231'],
  ['LY','Libya','+218'],['LI','Liechtenstein','+423'],['LT','Lithuania','+370'],['LU','Luxembourg','+352'],['MG','Madagascar','+261'],
  ['MW','Malawi','+265'],['MY','Malaysia','+60'],['MV','Maldives','+960'],['ML','Mali','+223'],['MT','Malta','+356'],
  ['MH','Marshall Islands','+692'],['MR','Mauritania','+222'],['MU','Mauritius','+230'],['MX','Mexico','+52'],['FM','Micronesia','+691'],
  ['MD','Moldova','+373'],['MC','Monaco','+377'],['MN','Mongolia','+976'],['ME','Montenegro','+382'],['MA','Morocco','+212'],
  ['MZ','Mozambique','+258'],['MM','Myanmar','+95'],['NA','Namibia','+264'],['NR','Nauru','+674'],['NP','Nepal','+977'],
  ['NL','Netherlands','+31'],['NZ','New Zealand','+64'],['NI','Nicaragua','+505'],['NE','Niger','+227'],['NG','Nigeria','+234'],
  ['KP','North Korea','+850'],['MK','North Macedonia','+389'],['NO','Norway','+47'],['OM','Oman','+968'],['PK','Pakistan','+92'],
  ['PW','Palau','+680'],['PS','Palestine','+970'],['PA','Panama','+507'],['PG','Papua New Guinea','+675'],['PY','Paraguay','+595'],
  ['PE','Peru','+51'],['PH','Philippines','+63'],['PL','Poland','+48'],['PT','Portugal','+351'],['QA','Qatar','+974'],
  ['RO','Romania','+40'],['RU','Russia','+7'],['RW','Rwanda','+250'],['KN','Saint Kitts and Nevis','+1-869'],['LC','Saint Lucia','+1-758'],
  ['VC','Saint Vincent and the Grenadines','+1-784'],['WS','Samoa','+685'],['SM','San Marino','+378'],['ST','Sao Tome and Principe','+239'],
  ['SA','Saudi Arabia','+966'],['SN','Senegal','+221'],['RS','Serbia','+381'],['SC','Seychelles','+248'],['SL','Sierra Leone','+232'],
  ['SG','Singapore','+65'],['SK','Slovakia','+421'],['SI','Slovenia','+386'],['SB','Solomon Islands','+677'],['SO','Somalia','+252'],
  ['ZA','South Africa','+27'],['KR','South Korea','+82'],['SS','South Sudan','+211'],['ES','Spain','+34'],['LK','Sri Lanka','+94'],
  ['SD','Sudan','+249'],['SR','Suriname','+597'],['SE','Sweden','+46'],['CH','Switzerland','+41'],['SY','Syria','+963'],
  ['TW','Taiwan','+886'],['TJ','Tajikistan','+992'],['TZ','Tanzania','+255'],['TH','Thailand','+66'],['TL','Timor-Leste','+670'],
  ['TG','Togo','+228'],['TO','Tonga','+676'],['TT','Trinidad and Tobago','+1-868'],['TN','Tunisia','+216'],['TR','Turkey','+90'],
  ['TM','Turkmenistan','+993'],['TV','Tuvalu','+688'],['UG','Uganda','+256'],['UA','Ukraine','+380'],['AE','United Arab Emirates','+971'],
  ['GB','United Kingdom','+44'],['US','United States','+1'],['UY','Uruguay','+598'],['UZ','Uzbekistan','+998'],['VU','Vanuatu','+678'],
  ['VA','Vatican City','+379'],['VE','Venezuela','+58'],['VN','Vietnam','+84'],['YE','Yemen','+967'],['ZM','Zambia','+260'],
  ['ZW','Zimbabwe','+263']
];

var TIMEZONES=[
  ['UTC','UTC (±0)','0'],
  ['America/New_York','Eastern Time (ET, -5)','-5'],
  ['America/Chicago','Central Time (CT, -6)','-6'],
  ['America/Denver','Mountain Time (MT, -7)','-7'],
  ['America/Los_Angeles','Pacific Time (PT, -8)','-8'],
  ['America/Anchorage','Alaska Time (-9)','-9'],
  ['Pacific/Honolulu','Hawaii Time (-10)','-10'],
  ['America/Sao_Paulo','Brasilia Time (-3)','-3'],
  ['America/Argentina/Buenos_Aires','Argentina (-3)','-3'],
  ['America/Halifax','Atlantic Time (-4)','-4'],
  ['America/Toronto','Toronto / Eastern (-5)','-5'],
  ['America/Vancouver','Vancouver / Pacific (-8)','-8'],
  ['America/Mexico_City','Mexico City (-6)','-6'],
  ['America/Bogota','Bogota, Lima (-5)','-5'],
  ['America/Santiago','Santiago (-4)','-4'],
  ['Atlantic/Reykjavik','Reykjavik (±0)','0'],
  ['Europe/London','London (GMT, ±0)','0'],
  ['Europe/Paris','Paris (CET, +1)','+1'],
  ['Europe/Berlin','Berlin (+1)','+1'],
  ['Europe/Rome','Rome (+1)','+1'],
  ['Europe/Madrid','Madrid (+1)','+1'],
  ['Europe/Amsterdam','Amsterdam (+1)','+1'],
  ['Europe/Stockholm','Stockholm (+1)','+1'],
  ['Europe/Helsinki','Helsinki (+2)','+2'],
  ['Europe/Athens','Athens (+2)','+2'],
  ['Europe/Istanbul','Istanbul (+3)','+3'],
  ['Europe/Moscow','Moscow (+3)','+3'],
  ['Europe/Warsaw','Warsaw (+1)','+1'],
  ['Europe/Zurich','Zurich (+1)','+1'],
  ['Africa/Cairo','Cairo (+2)','+2'],
  ['Africa/Johannesburg','Johannesburg (+2)','+2'],
  ['Africa/Lagos','Lagos (+1)','+1'],
  ['Africa/Nairobi','Nairobi (+3)','+3'],
  ['Africa/Casablanca','Casablanca (±0)','0'],
  ['Asia/Dubai','Dubai (GST, +4)','+4'],
  ['Asia/Riyadh','Riyadh (+3)','+3'],
  ['Asia/Tehran','Tehran (+3:30)','+3:30'],
  ['Asia/Karachi','Karachi (PKT, +5)','+5'],
  ['Asia/Kolkata','India (IST, +5:30)','+5:30'],
  ['Asia/Dhaka','Dhaka (+6)','+6'],
  ['Asia/Colombo','Colombo (+5:30)','+5:30'],
  ['Asia/Yangon','Yangon (+6:30)','+6:30'],
  ['Asia/Bangkok','Bangkok (ICT, +7)','+7'],
  ['Asia/Singapore','Singapore (SGT, +8)','+8'],
  ['Asia/Shanghai','China Standard Time (+8)','+8'],
  ['Asia/Hong_Kong','Hong Kong (+8)','+8'],
  ['Asia/Tokyo','Tokyo (JST, +9)','+9'],
  ['Asia/Seoul','Seoul (KST, +9)','+9'],
  ['Australia/Perth','Perth (AWST, +8)','+8'],
  ['Australia/Adelaide','Adelaide (ACST, +9:30)','+9:30'],
  ['Australia/Sydney','Sydney (AEST, +10)','+10'],
  ['Pacific/Auckland','Auckland (NZST, +12)','+12'],
  ['Pacific/Fiji','Fiji (+12)','+12'],
  ['Pacific/Guam','Guam (ChST, +10)','+10'],
];

function playProfKeyClick(){playSound('typing');}
function playProfEmojiClick(){playSound('emoji');}
function playProfPostSound(){playSound('send');}
function timeAgoProf(dateStr){
  if(!dateStr) return '';
  // R11 FIX #3: removed manual 'Z' appending — same fix Round 7 applied to
  // HomeScreen + MessagesScreen. Forcing UTC on a string that was already
  // local-ISO double-shifted the display by the TZ offset. Browser handles
  // ISO with/without 'Z' or '+HH:MM' correctly on its own.
  var now=new Date();
  var date=new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  var diff=Math.floor((now-date)/1000);
  // R11 FIX #2: clock skew (server ahead of client) → show 'Just now' instead of '-Nm ago'.
  if (diff < 0) return 'Just now';
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return date.toLocaleDateString([],{month:'short',day:'numeric',timeZone:localStorage.getItem('user_timezone')||'UTC'});
}

export default function ProfileScreen({session, supabase, onOpenWallet, onGoToMessages, onViewUser, onSwitchTab}){
  var email = session && session.user ? session.user.email : '';
  var initials = email ? email.substring(0,2).toUpperCase() : 'ME';
  var userId = session && session.user ? session.user.id : null;
  // Shared coin balance — same hook every other screen uses, so the
  // Settings page stats card and own-profile stats card both show the
  // live balance instead of the hardcoded "1,240".
  var profileCoinBal = useCoinBalance(userId, sbProfileCoin);

  // FIX #2 + #3: real call count from call_invites. Replaces the hardcoded
  // "12 Calls" in both the own-profile stats card AND the Settings page
  // stats card. Single shared state — both views read from this one query.
  var realCallCountS = useState(0); var realCallCount = realCallCountS[0]; var setRealCallCount = realCallCountS[1];

  // Redesigned stats card: Followers (people who follow me) + Friends
  // (accepted mutual connections). Both fetched defensively in an effect
  // below; Hearts is derived from likes on the user's own posts at render.
  var followersCountS = useState(0); var followersCount = followersCountS[0]; var setFollowersCount = followersCountS[1];
  var friendsCountS = useState(0); var friendsCount = friendsCountS[0]; var setFriendsCount = friendsCountS[1];

  // ── Invite & Earn (migration 0056) ──
  // Sub-view visibility + referral data fetched lazily when the view opens.
  // Every RPC wrapped in try/catch so an unrun migration hides the UI rather
  // than crashing the profile screen.
  var showInviteS = useState(false); var showInvite = showInviteS[0]; var setShowInvite = showInviteS[1];
  var referralS = useState(null); var referral = referralS[0]; var setReferral = referralS[1]; // {code, qualified, coins_earned, giveaway_entries}
  var referralLoadingS = useState(false); var referralLoading = referralLoadingS[0]; var setReferralLoading = referralLoadingS[1];
  var referralClaimingS = useState(false); var referralClaiming = referralClaimingS[0]; var setReferralClaiming = referralClaimingS[1];

  // ── Hearts streak flame (migration 0057) ──
  // Active streak count shown beside the Hearts stat. Null = no streak / unrun.
  var heartStreakS = useState(null); var heartStreak = heartStreakS[0]; var setHeartStreak = heartStreakS[1];

  // ── Status / level crown (migration 0058) + Leaderboard sub-view ──
  var myStatusS = useState(null); var myStatus = myStatusS[0]; var setMyStatus = myStatusS[1]; // {tier, level}
  var showLeaderboardS = useState(false); var showLeaderboard = showLeaderboardS[0]; var setShowLeaderboard = showLeaderboardS[1];

  // Compact stat formatter: 1.2k / 3.4M. Used by the Followers/Friends/Hearts card.
  function fmtStatCount(n){
    n = Number(n) || 0;
    if (n >= 1000000) return (n/1000000).toFixed(n%1000000===0?0:1).replace(/\.0$/,'') + 'M';
    if (n >= 1000) return (n/1000).toFixed(n%1000===0?0:1).replace(/\.0$/,'') + 'k';
    return String(Math.round(n));
  }

  // Cosmetics (Style Store): showStore toggles the store overlay; myEquipped
  // holds this user's equipped tag/frame/sticker/theme; catReady bumps a
  // re-render once the catalog finishes loading so equipped ids resolve.
  var showStoreS = useState(false); var showStore = showStoreS[0]; var setShowStore = showStoreS[1];
  var myEquippedS = useState({}); var myEquipped = myEquippedS[0]; var setMyEquipped = myEquippedS[1];
  var catReadyS = useState(0); var catReady = catReadyS[0]; var setCatReady = catReadyS[1];

  // FIX #5: real friends list driven by the follows table. Replaces the
  // hardcoded FRIENDS mock array on the Friends tab. Empty until loaded.
  var realFriendsS = useState([]); var realFriends = realFriendsS[0]; var setRealFriends = realFriendsS[1];

  // FIX #4: human-readable "Member since…" string sourced from the auth
  // session's created_at timestamp. Empty when the session is still
  // hydrating so we don't render "Member since Invalid Date".
  var memberSince = (session && session.user && session.user.created_at)
    /* R18: timezone-aware via formatDate; pass-through to ensure month/year shown */
    ? (function(){ try { var d=new Date(session.user.created_at); return d.toLocaleDateString([],{month:'long',year:'numeric',timeZone: (localStorage.getItem('user_timezone')||undefined)}); } catch(_){ return ''; } })()
    : '';

  // Shared moments registry — drives the Instagram-style avatar ring on
  // the profile cover avatar and on each post header.
  var momentUserIds = useMomentUserIds();
  // Per-user "hide like counts" preference toggle for the privacy panel.
  var hideLikesPair = useHideLikes(); var hideLikesLocal = hideLikesPair[0]; var setHideLikesLocal = hideLikesPair[1];
  // T2.7 — Close Friends list (Set<userId>) + visibility of the manager screen.
  var closeFriendsList = useCloseFriends();
  var showCloseFriendsS = useState(false); var showCloseFriends = showCloseFriendsS[0]; var setShowCloseFriends = showCloseFriendsS[1];
  var cfSearchS = useState(''); var cfSearch = cfSearchS[0]; var setCfSearch = cfSearchS[1];
  var cfPeopleS = useState([]); var cfPeople = cfPeopleS[0]; var setCfPeople = cfPeopleS[1];
  var cfDebounceRef = useRef(null);
  // Search-as-you-type via the FTS RPC; re-uses the search_profiles function from migration 0010.
  useEffect(function(){
    if (!showCloseFriends) return;
    if (cfDebounceRef.current) clearTimeout(cfDebounceRef.current);
    var q = (cfSearch || '').trim();
    if (q.length < 2) { setCfPeople([]); return; }
    cfDebounceRef.current = setTimeout(function(){
      try {
        sbProfile.rpc('search_profiles', { q: q, lim: 12 }).then(function(r){
          if (r && !r.error && r.data) setCfPeople(r.data.filter(function(p){ return p.id !== userId; }));
        });
      } catch(_) {}
    }, 250);
    return function(){ if (cfDebounceRef.current) clearTimeout(cfDebounceRef.current); };
  }, [cfSearch, showCloseFriends]);

  var settingsS=useState(false); var showSettings=settingsS[0]; var setShowSettings=settingsS[1];
  var showPrivacyS=useState(false); var showPrivacy=showPrivacyS[0]; var setShowPrivacy=showPrivacyS[1];
  var showSupportS=useState(false); var showSupport=showSupportS[0]; var setShowSupport=showSupportS[1];
  var showAcctS=useState(false); var showAcct=showAcctS[0]; var setShowAcct=showAcctS[1];
  var showNotifS=useState(false); var showNotif=showNotifS[0]; var setShowNotif=showNotifS[1];
  var showActivityLogS=useState(false); var showActivityLog=showActivityLogS[0]; var setShowActivityLog=showActivityLogS[1];
  var activityItemsS=useState([]); var activityItems=activityItemsS[0]; var setActivityItems=activityItemsS[1];
  var activityLoadingS=useState(false); var activityLoading=activityLoadingS[0]; var setActivityLoading=activityLoadingS[1];
  // Account settings fields
  var acctNameS=useState(localStorage.getItem('acct_name')||''); var acctName=acctNameS[0]; var setAcctName=acctNameS[1];
  var acctTagS=useState(localStorage.getItem('acct_tag')||''); var acctTag=acctTagS[0]; var setAcctTag=acctTagS[1];
  var acctCountryS=useState(localStorage.getItem('acct_country')||''); var acctCountry=acctCountryS[0]; var setAcctCountry=acctCountryS[1];
  var acctPhoneCodeS=useState(localStorage.getItem('acct_phone_code')||'+1'); var acctPhoneCode=acctPhoneCodeS[0]; var setAcctPhoneCode=acctPhoneCodeS[1];
  var acctPhoneS=useState(localStorage.getItem('acct_phone')||''); var acctPhone=acctPhoneS[0]; var setAcctPhone=acctPhoneS[1];
  var acctTzS=useState(localStorage.getItem('user_timezone')||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'); var acctTz=acctTzS[0]; var setAcctTz=acctTzS[1];
  /* R65: Real Friends community fields — driven by profiles.home_language /
   * home_town / current_city. Editing them here updates the same fields
   * used by the Friends tab discovery + cards. */
  var acctHomeLangS=useState(''); var acctHomeLang=acctHomeLangS[0]; var setAcctHomeLang=acctHomeLangS[1];
  var acctHomeTownS=useState(''); var acctHomeTown=acctHomeTownS[0]; var setAcctHomeTown=acctHomeTownS[1];
  var acctCurrentCityS=useState(''); var acctCurrentCity=acctCurrentCityS[0]; var setAcctCurrentCity=acctCurrentCityS[1];
  var acctCommunitySavingS=useState(false); var acctCommunitySaving=acctCommunitySavingS[0]; var setAcctCommunitySaving=acctCommunitySavingS[1];
  var acctCommunitySavedS=useState(false); var acctCommunitySaved=acctCommunitySavedS[0]; var setAcctCommunitySaved=acctCommunitySavedS[1];
  /* R39/R40: gender on the real profile + 30-day rate-limit metadata.
   * '' = "Rather not say" (NULL in DB). The server-side set_my_gender RPC
   * enforces the 30-day cooldown atomically — client just gates the UI. */
  var acctGenderS=useState(''); var acctGender=acctGenderS[0]; var setAcctGender=acctGenderS[1];
  var acctGenderSavingS=useState(false); var acctGenderSaving=acctGenderSavingS[0]; var setAcctGenderSaving=acctGenderSavingS[1];
  var acctGenderSavedS=useState(false); var acctGenderSaved=acctGenderSavedS[0]; var setAcctGenderSaved=acctGenderSavedS[1];
  var acctGenderSavedTimerRef = useRef(null);
  /* R40: timestamp of last change. If null, never changed → first change is free.
   * If <30 days ago, lock the dropdown + show days-remaining message. */
  var acctGenderChangedAtS=useState(null); var acctGenderChangedAt=acctGenderChangedAtS[0]; var setAcctGenderChangedAt=acctGenderChangedAtS[1];
  /* R40: verification flag — controls whether the badge shows next to user's name. */
  var acctVerifiedS=useState(false); var acctVerified=acctVerifiedS[0]; var setAcctVerified=acctVerifiedS[1];
  var acctSavedS=useState(false); var acctSaved=acctSavedS[0]; var setAcctSaved=acctSavedS[1];
  /* R19 FIX #6: track the 3 setTimeout handles for acctSaved so we can clear
   * them on unmount or before re-arming. Was firing setAcctSaved(false) on a
   * dead component after the user navigated away mid-Save. */
  var acctSavedTimerRef = useRef(null);
  function _scheduleAcctSavedReset(ms){
    if (acctSavedTimerRef.current) { try { clearTimeout(acctSavedTimerRef.current); } catch(_){} }
    acctSavedTimerRef.current = setTimeout(function(){ setAcctSaved(false); acctSavedTimerRef.current = null; }, ms || 2500);
  }
  useEffect(function(){
    return function(){
      if (acctSavedTimerRef.current) { try { clearTimeout(acctSavedTimerRef.current); } catch(_){} acctSavedTimerRef.current = null; }
      /* R39 */
      if (acctGenderSavedTimerRef.current) { try { clearTimeout(acctGenderSavedTimerRef.current); } catch(_){} acctGenderSavedTimerRef.current = null; }
    };
  }, []);
  var acctCountrySearchS=useState(''); var acctCountrySearch=acctCountrySearchS[0]; var setAcctCountrySearch=acctCountrySearchS[1];
  var showCountryPickerS=useState(false); var showCountryPicker=showCountryPickerS[0]; var setShowCountryPicker=showCountryPickerS[1];
  var showPhoneCodePickerS=useState(false); var showPhoneCodePicker=showPhoneCodePickerS[0]; var setShowPhoneCodePicker=showPhoneCodePickerS[1];
  var showTzPickerS=useState(false); var showTzPicker=showTzPickerS[0]; var setShowTzPicker=showTzPickerS[1];
  var tzSearchS=useState(''); var tzSearch=tzSearchS[0]; var setTzSearch=tzSearchS[1];
  // Password change
  var pwModeS=useState('reset'); var pwMode=pwModeS[0]; var setPwMode=pwModeS[1];
  var pwCurrentS=useState(''); var pwCurrent=pwCurrentS[0]; var setPwCurrent=pwCurrentS[1];
  var pwNewS=useState(''); var pwNew=pwNewS[0]; var setPwNew=pwNewS[1];
  var pwConfirmS=useState(''); var pwConfirm=pwConfirmS[0]; var setPwConfirm=pwConfirmS[1];
  var pwChangeErrS=useState(''); var pwChangeErr=pwChangeErrS[0]; var setPwChangeErr=pwChangeErrS[1];
  var pwChangeDoneS=useState(false); var pwChangeDone=pwChangeDoneS[0]; var setPwChangeDone=pwChangeDoneS[1];
  var pwChangeLoadS=useState(false); var pwChangeLoad=pwChangeLoadS[0]; var setPwChangeLoad=pwChangeLoadS[1];
  // Notification settings
  var notifLikesS=useState(localStorage.getItem('notif_likes')!=='0'); var notifLikes=notifLikesS[0]; var setNotifLikes=notifLikesS[1];
  var notifCommentsS=useState(localStorage.getItem('notif_comments')!=='0'); var notifComments=notifCommentsS[0]; var setNotifComments=notifCommentsS[1];
  var notifFollowsS=useState(localStorage.getItem('notif_follows')!=='0'); var notifFollows=notifFollowsS[0]; var setNotifFollows=notifFollowsS[1];
  var notifCallsS=useState(localStorage.getItem('notif_calls')!=='0'); var notifCalls=notifCallsS[0]; var setNotifCalls=notifCallsS[1];
  var notifMsgsS=useState(localStorage.getItem('notif_msgs')!=='0'); var notifMsgs=notifMsgsS[0]; var setNotifMsgs=notifMsgsS[1];
  var notifWorkshopsS=useState(localStorage.getItem('notif_workshops')!=='0'); var notifWorkshops=notifWorkshopsS[0]; var setNotifWorkshops=notifWorkshopsS[1];
  var notifPromoS=useState(localStorage.getItem('notif_promo')!=='0'); var notifPromo=notifPromoS[0]; var setNotifPromo=notifPromoS[1];
  var notifEmailS=useState(localStorage.getItem('notif_email')!=='0'); var notifEmail=notifEmailS[0]; var setNotifEmail=notifEmailS[1];
  // Privacy state
  var profileVisS=useState(localStorage.getItem('profile_vis')||'public'); var profileVis=profileVisS[0]; var setProfileVis=profileVisS[1];
  var lockedS=useState(localStorage.getItem('profile_locked')==='1'); var profileLocked=lockedS[0]; var setProfileLocked=lockedS[1];
  var pwResetEmailS=useState(''); var pwResetEmail=pwResetEmailS[0]; var setPwResetEmail=pwResetEmailS[1];
  var pwResetSentS=useState(false); var pwResetSent=pwResetSentS[0]; var setPwResetSent=pwResetSentS[1];
  var pwResetLoadS=useState(false); var pwResetLoad=pwResetLoadS[0]; var setPwResetLoad=pwResetLoadS[1];
  var pwResetErrS=useState(''); var pwResetErr=pwResetErrS[0]; var setPwResetErr=pwResetErrS[1];
  // FIX #16: wrap initial localStorage reads in try/catch (Safari private
  // mode + corrupted storage both throw on getItem). Defaults match the
  // unguarded behavior so users see no change on the happy path.
  var muteStoryS=useState(function(){ try { return localStorage.getItem('mute_activity')==='1'; } catch(_){ return false; } }); var muteActivity=muteStoryS[0]; var setMuteActivity=muteStoryS[1];
  var showActivityS=useState(function(){ try { return localStorage.getItem('show_online')!=='0'; } catch(_){ return true; } }); var showOnline=showActivityS[0]; var setShowOnline=showActivityS[1];
  // Sound settings state
  var showSoundS=useState(false); var showSound=showSoundS[0]; var setShowSound=showSoundS[1];
  // Blocked users state
  var showBlockedS=useState(false); var showBlocked=showBlockedS[0]; var setShowBlocked=showBlockedS[1];
  var blockedListS=useState(function(){try{var s=localStorage.getItem('ringin_blocked');return s?JSON.parse(s):[];}catch(e){return [];}}); var blockedList=blockedListS[0]; var setBlockedList=blockedListS[1];
  // Muted words state
  var showMutedS=useState(false); var showMuted=showMutedS[0]; var setShowMuted=showMutedS[1];
  var mutedWordsS=useState(function(){try{var s=localStorage.getItem('ringin_muted_words');return s?JSON.parse(s):[];}catch(e){return [];}}); var mutedWords=mutedWordsS[0]; var setMutedWords=mutedWordsS[1];
  var mutedInputS=useState(''); var mutedInput=mutedInputS[0]; var setMutedInput=mutedInputS[1];
  // Expert application state
  var showExpertAppS=useState(false); var showExpertApp=showExpertAppS[0]; var setShowExpertApp=showExpertAppS[1];
  var expertAppNameS=useState(''); var expertAppName=expertAppNameS[0]; var setExpertAppName=expertAppNameS[1];
  var expertAppAreaS=useState('Medical'); var expertAppArea=expertAppAreaS[0]; var setExpertAppArea=expertAppAreaS[1];
  var expertAppBioS=useState(''); var expertAppBio=expertAppBioS[0]; var setExpertAppBio=expertAppBioS[1];
  var expertAppExpS=useState(''); var expertAppExp=expertAppExpS[0]; var setExpertAppExp=expertAppExpS[1];
  var expertAppRateS=useState(''); var expertAppRate=expertAppRateS[0]; var setExpertAppRate=expertAppRateS[1];
  var expertAppSubmittedS=useState(false); var expertAppSubmitted=expertAppSubmittedS[0]; var setExpertAppSubmitted=expertAppSubmittedS[1];
  /* R25: Creator Subscriptions feature. Only shown to verified experts
   * (users who have submitted the Expert Application — their profile bio
   * JSON contains an `expert_request` key). Server-side enforcement lives
   * in supabase/migrations/0017_creator_subscriptions.sql RLS policies. */
  var isExpertS=useState(false); var isExpert=isExpertS[0]; var setIsExpert=isExpertS[1];
  var showSubsMgrS=useState(false); var showSubsMgr=showSubsMgrS[0]; var setShowSubsMgr=showSubsMgrS[1];
  /* R50: Creator Studio — neon balance + earnings preview screen.
   * R51: extended summary shape with `by_source` breakdown:
   *   { subscriptions, anon_calls, anon_chat_gifts, ads }
   *   each is { lifetime, last_30_days }. */
  var showCreatorStudioS=useState(false); var showCreatorStudio=showCreatorStudioS[0]; var setShowCreatorStudio=showCreatorStudioS[1];
  var neonSummaryS=useState({
    balance:0, lifetime_earned:0, last_30_days:0,
    by_source:{
      subscriptions:{lifetime:0,last_30_days:0},
      anon_calls:{lifetime:0,last_30_days:0},
      anon_chat_gifts:{lifetime:0,last_30_days:0},
      ads:{lifetime:0,last_30_days:0}
    }
  });
  var neonSummary=neonSummaryS[0]; var setNeonSummary=neonSummaryS[1];
  var neonLoadingS=useState(false); var neonLoading=neonLoadingS[0]; var setNeonLoading=neonLoadingS[1];
  var subOfferS=useState(null); var subOffer=subOfferS[0]; var setSubOffer=subOfferS[1];
  var subOfferLoadingS=useState(false); var subOfferLoading=subOfferLoadingS[0]; var setSubOfferLoading=subOfferLoadingS[1];
  /* Form state — mirrors creator_subscriptions_offered columns. Defaults
   * are sensible "first-time enable" values that the creator tweaks. */
  var subEnabledFormS=useState(false); var subEnabledForm=subEnabledFormS[0]; var setSubEnabledForm=subEnabledFormS[1];
  var subPriceCentsS=useState(499); var subPriceCents=subPriceCentsS[0]; var setSubPriceCents=subPriceCentsS[1];
  var subCurrencyS=useState('USD'); var subCurrency=subCurrencyS[0]; var setSubCurrency=subCurrencyS[1];
  var subCoinGiftPriceS=useState(500); var subCoinGiftPrice=subCoinGiftPriceS[0]; var setSubCoinGiftPrice=subCoinGiftPriceS[1];
  var subTrialDaysS=useState(0); var subTrialDays=subTrialDaysS[0]; var setSubTrialDays=subTrialDaysS[1];
  var subDescriptionS=useState(''); var subDescription=subDescriptionS[0]; var setSubDescription=subDescriptionS[1];
  var subPerksS=useState(['sub_badge','priority_queue']); var subPerks=subPerksS[0]; var setSubPerks=subPerksS[1];
  var subSavingS=useState(false); var subSaving=subSavingS[0]; var setSubSaving=subSavingS[1];
  var subActiveCountS=useState(0); var subActiveCount=subActiveCountS[0]; var setSubActiveCount=subActiveCountS[1];
  /* R26: Verification system. Subscriptions are now gated on is_verified
   * (any user can apply for a verified badge — not just experts). Manual
   * admin review + yearly coin fee. See 0018_verification.sql. */
  var isVerifiedS=useState(false); var isVerified=isVerifiedS[0]; var setIsVerified=isVerifiedS[1];
  var verifiedUntilS=useState(null); var verifiedUntil=verifiedUntilS[0]; var setVerifiedUntil=verifiedUntilS[1];
  var isAdminS=useState(false); var isAdmin=isAdminS[0]; var setIsAdmin=isAdminS[1];
  // verifStatus: 'none' | 'pending' | 'approved' | 'rejected'
  var verifStatusS=useState('none'); var verifStatus=verifStatusS[0]; var setVerifStatus=verifStatusS[1];
  var showVerifyAppS=useState(false); var showVerifyApp=showVerifyAppS[0]; var setShowVerifyApp=showVerifyAppS[1];
  var showAdminReviewS=useState(false); var showAdminReview=showAdminReviewS[0]; var setShowAdminReview=showAdminReviewS[1];
  // Verification application form fields
  var vfNameS=useState(''); var vfName=vfNameS[0]; var setVfName=vfNameS[1];
  var vfCategoryS=useState('influencer'); var vfCategory=vfCategoryS[0]; var setVfCategory=vfCategoryS[1];
  var vfInstaS=useState(''); var vfInsta=vfInstaS[0]; var setVfInsta=vfInstaS[1];
  var vfYoutubeS=useState(''); var vfYoutube=vfYoutubeS[0]; var setVfYoutube=vfYoutubeS[1];
  var vfTiktokS=useState(''); var vfTiktok=vfTiktokS[0]; var setVfTiktok=vfTiktokS[1];
  var vfTwitterS=useState(''); var vfTwitter=vfTwitterS[0]; var setVfTwitter=vfTwitterS[1];
  var vfFollowersS=useState(''); var vfFollowers=vfFollowersS[0]; var setVfFollowers=vfFollowersS[1];
  var vfFollowerPlatformS=useState('Instagram'); var vfFollowerPlatform=vfFollowerPlatformS[0]; var setVfFollowerPlatform=vfFollowerPlatformS[1];
  var vfReasonS=useState(''); var vfReason=vfReasonS[0]; var setVfReason=vfReasonS[1];
  var vfSubmittingS=useState(false); var vfSubmitting=vfSubmittingS[0]; var setVfSubmitting=vfSubmittingS[1];
  var vfPayingS=useState(false); var vfPaying=vfPayingS[0]; var setVfPaying=vfPayingS[1];
  // Admin review queue
  var adminQueueS=useState([]); var adminQueue=adminQueueS[0]; var setAdminQueue=adminQueueS[1];
  var adminQueueLoadingS=useState(false); var adminQueueLoading=adminQueueLoadingS[0]; var setAdminQueueLoading=adminQueueLoadingS[1];
  var VERIF_FEE_COINS = 1000; // yearly fee — must match pay_verification_fee() in 0018
  var soundPrefsS=useState(function(){try{var s=localStorage.getItem('ringin_sound_prefs');if(s)return Object.assign({typing:{variant:0,volume:0.55,enabled:true},emoji:{variant:0,volume:0.55,enabled:true},send:{variant:0,volume:0.55,enabled:true},like:{variant:0,volume:0.55,enabled:true},likeThumb:{variant:0,volume:0.55,enabled:true},notification:{variant:0,volume:0.55,enabled:true}},JSON.parse(s));}catch(e){}return {typing:{variant:0,volume:0.55,enabled:true},emoji:{variant:0,volume:0.55,enabled:true},send:{variant:0,volume:0.55,enabled:true},like:{variant:0,volume:0.55,enabled:true},likeThumb:{variant:0,volume:0.55,enabled:true},notification:{variant:0,volume:0.55,enabled:true}};}); var soundPrefs=soundPrefsS[0]; var setSoundPrefs=soundPrefsS[1];
  var hapticsOnS=useState(getHapticsEnabled); var hapticsOn=hapticsOnS[0]; var setHapticsOn=hapticsOnS[1];
  // Support state
  var supportEmailS=useState(email||''); var supportEmail=supportEmailS[0]; var setSupportEmail=supportEmailS[1];
  var supportMsgS=useState(''); var supportMsg=supportMsgS[0]; var setSupportMsg=supportMsgS[1];
  var supportCatS=useState('general'); var supportCat=supportCatS[0]; var setSupportCat=supportCatS[1];
  var supportSentS=useState(false); var supportSent=supportSentS[0]; var setSupportSent=supportSentS[1];
  var tabS=useState('posts'); var activeTab=tabS[0]; var setActiveTab=tabS[1];
  var rateS=useState(0); var rateVal=rateS[0]; var setRateVal=rateS[1];
  var rateDoneS=useState(false); var rateDone=rateDoneS[0]; var setRateDone=rateDoneS[1];
  var showRateS=useState(false); var showRate=showRateS[0]; var setShowRate=showRateS[1];
  // Auto-update toggle — persists in localStorage. When on, OTA bundles
  // download + apply silently. When off (default), the neon-green popup
  // appears every 5 min while online.
  var autoUpdateS = useState(function(){
    try { return localStorage.getItem('ringin_ota_auto_update') === '1'; } catch(_){ return false; }
  });
  var autoUpdate = autoUpdateS[0]; var setAutoUpdate = autoUpdateS[1];
  var avatarS=useState(null); var avatarUrl=avatarS[0]; var setAvatarUrl=avatarS[1];
  var coverS=useState(null); var coverUrl=coverS[0]; var setCoverUrl=coverS[1];
  var uploadingS=useState(false); var uploading=uploadingS[0]; var setUploading=uploadingS[1];
  var followHook = useFollow(sbProfile, userId);
  var following = followHook.following;
  var toggleFollow = followHook.toggleFollow;
  var avatarMenuS=useState(false); var showAvatarMenu=avatarMenuS[0]; var setShowAvatarMenu=avatarMenuS[1];
  var avatarViewS=useState(false); var showAvatarView=avatarViewS[0]; var setShowAvatarView=avatarViewS[1];
  var adjustS=useState(false); var showAdjust=adjustS[0]; var setShowAdjust=adjustS[1];
  var adjustImgS=useState(null); var adjustImg=adjustImgS[0]; var setAdjustImg=adjustImgS[1];
  var offsetS=useState({x:0,y:0}); var offset=offsetS[0]; var setOffset=offsetS[1];
  var draggingS=useState(false); var dragging=draggingS[0]; var setDragging=draggingS[1];
  var dragStartS=useState({x:0,y:0}); var dragStart=dragStartS[0]; var setDragStart=dragStartS[1];
  var showCoverAdjustS=useState(false); var showCoverAdjust=showCoverAdjustS[0]; var setShowCoverAdjust=showCoverAdjustS[1];
  var coverAdjustImgS=useState(null); var coverAdjustImg=coverAdjustImgS[0]; var setCoverAdjustImg=coverAdjustImgS[1];
  var coverOffsetS=useState({x:0,y:0}); var coverOffset=coverOffsetS[0]; var setCoverOffset=coverOffsetS[1];
  var coverDraggingS=useState(false); var coverDragging=coverDraggingS[0]; var setCoverDragging=coverDraggingS[1];
  var coverDragStartS=useState({x:0,y:0}); var coverDragStart=coverDragStartS[0]; var setCoverDragStart=coverDragStartS[1];
  var coverImgNatS=useState({w:1,h:1}); var coverImgNat=coverImgNatS[0]; var setCoverImgNat=coverImgNatS[1];
  var coverUserScaleS=useState(1); var coverUserScale=coverUserScaleS[0]; var setCoverUserScale=coverUserScaleS[1];
  var coverPinchDistS=useState(0); var coverPinchDist=coverPinchDistS[0]; var setCoverPinchDist=coverPinchDistS[1];
  var coverPinchScaleStartS=useState(1); var coverPinchScaleStart=coverPinchScaleStartS[0]; var setCoverPinchScaleStart=coverPinchScaleStartS[1];
  var postTextS=useState(''); var postText=postTextS[0]; var setPostText=postTextS[1];
  var showEmojiS=useState(false); var showEmoji=showEmojiS[0]; var setShowEmoji=showEmojiS[1];
  var showEditProfileS=useState(false); var showEditProfile=showEditProfileS[0]; var setShowEditProfile=showEditProfileS[1];
  // R23: in-app confirm modals replacing window.confirm() (banned per CLAUDE.md).
  // showDeleteConfirm gates the Delete Account flow; deletePostId carries the
  // id of the post being deleted (null = no modal). Both close on backdrop
  // click and on the Cancel button.
  var showDeleteConfirmS=useState(false); var showDeleteConfirm=showDeleteConfirmS[0]; var setShowDeleteConfirm=showDeleteConfirmS[1];
  var deletePostIdS=useState(null); var deletePostId=deletePostIdS[0]; var setDeletePostId=deletePostIdS[1];
  var editNameS=useState(''); var editName=editNameS[0]; var setEditName=editNameS[1];
  var editTagS=useState(''); var editTag=editTagS[0]; var setEditTag=editTagS[1];
  var editAboutS=useState(''); var editAbout=editAboutS[0]; var setEditAbout=editAboutS[1];
  var editWebsiteNameS=useState(''); var editWebsiteName=editWebsiteNameS[0]; var setEditWebsiteName=editWebsiteNameS[1];
  var editWebsiteUrlS=useState(''); var editWebsiteUrl=editWebsiteUrlS[0]; var setEditWebsiteUrl=editWebsiteUrlS[1];
  var _cachedPInfo={}; try{var _cp=localStorage.getItem('profile_info_'+(session&&session.user?session.user.id:''));if(_cp)_cachedPInfo=JSON.parse(_cp);}catch(e){}
  var profileInfoS=useState(_cachedPInfo.name?_cachedPInfo:{name:'',tag:'',about:'',website_name:'',website_url:''}); var profileInfo=profileInfoS[0]; var setProfileInfo=profileInfoS[1];
  var savingEditS=useState(false); var savingEdit=savingEditS[0]; var setSavingEdit=savingEditS[1];
  var _cachedMyPosts=[];try{var _cmp=localStorage.getItem('my_posts_cache_'+(session&&session.user?session.user.id:''));if(_cmp){var _raw=JSON.parse(_cmp);var _uid2=session&&session.user?session.user.id:null;_cachedMyPosts=_raw.map(function(p){var la=Array.isArray(p.likes)?p.likes:(Array.isArray(p.likedByIds)?p.likedByIds:[]);return Object.assign({},p,{liked:_uid2?la.includes(_uid2):false,likes:la,likedByIds:la});});}}catch(e){}
  var postsS=useState(_cachedMyPosts); var myPosts=postsS[0]; var setMyPosts=postsS[1];
  var showLikersProfS=useState(null); var showLikersProf=showLikersProfS[0]; var setShowLikersProf=showLikersProfS[1];
  var likersNamesProfS=useState({}); var likersNamesProf=likersNamesProfS[0]; var setLikersNamesProf=likersNamesProfS[1];
  var openCommentsProfS=useState(null); var openCommentsProf=openCommentsProfS[0]; var setOpenCommentsProf=openCommentsProfS[1];
  var commentsCacheProfS=useState({}); var commentsCacheProf=commentsCacheProfS[0]; var setCommentsCacheProf=commentsCacheProfS[1];
  var commentInputProfS=useState(''); var commentInputProf=commentInputProfS[0]; var setCommentInputProf=commentInputProfS[1];
  var commentLikesProfS=useState(function(){try{var s=localStorage.getItem('ringin_clikes');return s?JSON.parse(s):{}}catch(e){return {};}}); var commentLikesProf=commentLikesProfS[0]; var _setCommentLikesProf=commentLikesProfS[1];
  function setCommentLikesProf(updater){_setCommentLikesProf(function(prev){var next=typeof updater==='function'?updater(prev):updater;try{localStorage.setItem('ringin_clikes',JSON.stringify(next));}catch(e){}return next;});}
  var postMenuProfS=useState(null); var postMenuProf=postMenuProfS[0]; var setPostMenuProf=postMenuProfS[1];
  // FIX #4: local edit-post modal state for own-profile post grid.
  // Mirrors the UserProfileView pattern from HomeScreen.js so we don't
  // reach into HomeScreen's scope. {id, content} shape.
  var editPostProfDataS=useState(null); var editPostProfData=editPostProfDataS[0]; var setEditPostProfData=editPostProfDataS[1];
  // FIX #5: local muted-posts list — toggling persists to ringin_muted_posts
  // (same key HomeScreen uses) so a post muted here is also muted there.
  var mutedPostsProfS=useState(function(){try{var s=localStorage.getItem('ringin_muted_posts');return s?JSON.parse(s):[];}catch(e){return [];}});
  var mutedPostsProf=mutedPostsProfS[0]; var setMutedPostsProf=mutedPostsProfS[1];
  /* R19 FIX #5: re-sync when HomeScreen toggles mute (cross-screen sync) */
  useEffect(function(){
    function onMutedChanged(){
      try {
        var s = localStorage.getItem('ringin_muted_posts');
        setMutedPostsProf(s ? JSON.parse(s) : []);
      } catch(_){}
    }
    function onStorage(e){ if (e && e.key === 'ringin_muted_posts') onMutedChanged(); }
    try { window.addEventListener('ringin-muted-posts-changed', onMutedChanged); } catch(_){}
    try { window.addEventListener('storage', onStorage); } catch(_){}
    return function(){
      try { window.removeEventListener('ringin-muted-posts-changed', onMutedChanged); } catch(_){}
      try { window.removeEventListener('storage', onStorage); } catch(_){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveEditPostProf(){
    if(!editPostProfData||!editPostProfData.content||!editPostProfData.content.trim()) return;
    var newText = editPostProfData.content;
    var pid = editPostProfData.id;
    var snap = myPosts.slice();
    setMyPosts(function(prev){return prev.map(function(x){return x.id===pid?Object.assign({},x,{text:newText}):x;});});
    setEditPostProfData(null);
    sbProfile.from('posts').update({text:newText}).eq('id',pid).then(function(r){
      if(r.error){
        console.error('RingIn Error [saveEditPostProf]:', r.error && r.error.message ? r.error.message : 'Unknown error');
        setMyPosts(snap);
        try{ toastError('Failed to edit. Try again.'); }catch(e){}
        return;
      }
      try{ toastSuccess('✏️ Post updated'); }catch(e){}
    }).catch(function(e){
      // R11 FIX #7: Round 7 added .catch to saveEditProfile but this sibling
      // was missed. Mirror the same pattern: rollback + toast + log.
      console.warn('[ringin] saveEditPostProf reject:', e);
      setMyPosts(snap);
      setEditPostProfData(null);
      try{ toastError('Failed to edit post'); }catch(_){}
    });
  }

  function toggleMutePostProf(pid){
    var cur = mutedPostsProf || [];
    var muted = cur.indexOf(pid) >= 0;
    var next = muted ? cur.filter(function(x){return x!==pid;}) : cur.concat([pid]);
    setMutedPostsProf(next);
    try{ localStorage.setItem('ringin_muted_posts', JSON.stringify(next)); }catch(_){}
    /* R19 FIX #5: broadcast so HomeScreen + UserProfileView menu label re-render */
    try { window.dispatchEvent(new CustomEvent('ringin-muted-posts-changed', { detail: { pid: pid, muted: !muted } })); } catch(_){}
    try{ toastSuccess(muted ? '🔔 Notifications on' : '🔕 Notifications off'); }catch(_){}
  }

  function prefetchLikerNamesProf(postsArr, existingNames){
    var allIds=[];
    postsArr.forEach(function(p){
      (p.likes||[]).forEach(function(id){
        if(typeof id==='string'&&id.length>10&&!existingNames[id]&&allIds.indexOf(id)<0) allIds.push(id);
      });
    });
    if(allIds.length===0) return;
    sbProfile.from('profiles').select('id,full_name,email,avatar_url').in('id',allIds).then(function(res){
      if(res.data&&res.data.length>0){
        var map={};
        res.data.forEach(function(u){map[u.id]={name:u.full_name||(u.email||'').split('@')[0],avatar:u.avatar_url};});
        setLikersNamesProf(function(prev){return Object.assign({},prev,map);});
      }
    });
  }

  function openLikersPopupProf(e,p){
    e.stopPropagation();
    if(!p||!p.likes||p.likes.length===0) return;
    if(showLikersProf===p.id){setShowLikersProf(null);return;}
    setShowLikersProf(p.id);
  }

  function loadCommentsProf(postId){
    var cached=null;
    try{var c=localStorage.getItem('comments_'+postId);if(c)cached=JSON.parse(c);}catch(e){}
    if(cached) setCommentsCacheProf(function(prev){return Object.assign({},prev,{[postId]:cached});});
    sbProfile.from('comments').select('*').eq('post_id',postId).order('created_at',{ascending:true}).then(function(res){
      if(res.data){
        setCommentsCacheProf(function(prev){return Object.assign({},prev,{[postId]:res.data});});
        try{localStorage.setItem('comments_'+postId,JSON.stringify(res.data));}catch(e){}
      }
    });
  }

  function submitCommentProf(postId,text){
    if(!text.trim()||!userId) return;
    var userName=email.split('@')[0];
    var userAvatar=avatarUrl||null;
    var newComment={
      id:Date.now()+'_local',
      post_id:postId,
      user_id:userId,
      user_name:userName,
      user_avatar:userAvatar,
      text:text.trim(),
      created_at:new Date().toISOString(),
      likes:[]
    };
    var snapCommentsProf=null;
    setCommentsCacheProf(function(prev){
      snapCommentsProf=prev[postId]||[];
      var cur=snapCommentsProf.concat([newComment]);
      try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
      return Object.assign({},prev,{[postId]:cur});
    });
    setCommentInputProf('');
    setMyPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:(p.comments||0)+1}):p;});});
    sbProfile.from('comments').insert({
      post_id:postId,
      user_id:userId,
      user_name:userName,
      user_avatar:userAvatar,
      text:text.trim()
    }).select().then(function(res){
      if(res.error){
        console.error('RingIn Error [submitCommentProf]:', res.error);
        setCommentsCacheProf(function(prev){
          try{localStorage.setItem('comments_'+postId,JSON.stringify(snapCommentsProf));}catch(e){}
          return Object.assign({},prev,{[postId]:snapCommentsProf});
        });
        setMyPosts(function(prev){return prev.map(function(p){return p.id===postId?Object.assign({},p,{comments:Math.max(0,(p.comments||1)-1)}):p;});});
        return;
      }
      if(res.data&&res.data[0]){
        setCommentsCacheProf(function(prev){
          var cur=(prev[postId]||[]).map(function(c){return c.id===newComment.id?res.data[0]:c;});
          try{localStorage.setItem('comments_'+postId,JSON.stringify(cur));}catch(e){}
          return Object.assign({},prev,{[postId]:cur});
        });
        // Persist count to DB
        sbProfile.from('comments').select('id',{count:'exact',head:true}).eq('post_id',postId).then(function(r){
          if(r.count!==null) sbProfile.from('posts').update({comments_count:r.count}).eq('id',postId).then(function(){});
        });
      }
    });
  }

  var EMOJIS=['😊','😂','❤️','🔥','👏','🎉','💪','🙌','😍','🤔','👍','✨','🚀','💡','🎯'];
  // FIX #5: removed FRIENDS / SKILLS / REVIEWS mock arrays. The Friends tab
  // now renders from `realFriends` (live follows query), the Skills tab from
  // the user's bio.skills field, and the Reviews tab shows an empty-state
  // until a reviews schema exists. See the tab-content section below.

  useEffect(function(){
    if(!userId) return;
    // Record login event (once per session)
    try{
      var loginLog=JSON.parse(localStorage.getItem('login_log_'+userId)||'[]');
      // FIX #13: if corruption wrote a non-array (e.g. {} or null), .push
      // would throw and the whole login record would be lost. Coerce back.
      if (!Array.isArray(loginLog)) loginLog = [];
      var lastLogin=loginLog.length?new Date(loginLog[loginLog.length-1].t):null;
      var now=new Date();
      if(!lastLogin||now-lastLogin>3600000){// more than 1 hour gap = new session
        loginLog.push({t:now.toISOString()});
        localStorage.setItem('login_log_'+userId,JSON.stringify(loginLog.slice(-90)));
      }
    }catch(e){}
  },[userId]);

  // FIX #2 + #3: count the user's accepted/ended call_invites so the stats
  // cards show a real number instead of the hardcoded "12 Calls". Defensive:
  // if the table or columns don't exist yet, falls back to 0.
  useEffect(function(){
    if(!userId) return;
    var cancelled = false;
    try {
      sbProfile.from('call_invites')
        .select('id', { count: 'exact', head: true })
        .eq('caller_id', userId)
        .in('status', ['ended','accepted'])
        .then(function(r){
          if (cancelled) return;
          if (r && !r.error && typeof r.count === 'number') {
            setRealCallCount(r.count);
          }
        }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  }, [userId]);

  // Followers count (people who follow ME = follows.following_id) + Friends
  // count (accepted mutual connections via list_anon_connections, the same
  // source FriendsScreen uses). Defensive: failure leaves the count at 0.
  useEffect(function(){
    if(!userId) return;
    var cancelled = false;
    try {
      sbProfile.from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId)
        .then(function(r){
          if (cancelled) return;
          if (r && !r.error && typeof r.count === 'number') setFollowersCount(r.count);
        }).catch(function(){});
    } catch(_){}
    try {
      sbProfile.rpc('list_anon_connections').then(function(r){
        if (cancelled) return;
        if (r && !r.error && Array.isArray(r.data)) setFriendsCount(r.data.length);
      }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  }, [userId]);

  // Hearts streak (0057) + Status/level (0058). Both fully defensive: if the
  // migration hasn't run the RPC errors with "function does not exist" and we
  // simply leave the state null so the flame / crown render nothing.
  useEffect(function(){
    if(!userId) return;
    var cancelled = false;
    try {
      sbProfile.rpc('get_my_streak').then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data != null) {
          var d = r.data;
          // Accept either a scalar count or a {streak, active} shape.
          var count = (typeof d === 'number') ? d : (d && (d.streak != null ? d.streak : d.count));
          var active = (typeof d === 'object' && d) ? (d.active !== false) : (count > 0);
          if (active && Number(count) > 0) setHeartStreak(Number(count));
        }
      }).catch(function(){});
    } catch(_){}
    try {
      sbProfile.rpc('my_status').then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          var s = Array.isArray(r.data) ? r.data[0] : r.data;
          // Accept either {tier,level} or the {host_tier,host_level} shape the
        // Leaderboard's my_status RPC returns.
        if (s && (s.tier || s.level != null || s.host_tier || s.host_level != null)) setMyStatus(s);
        }
      }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  }, [userId]);

  // Load referral data lazily the first time the Invite & Earn view opens.
  useEffect(function(){
    if(!showInvite) return;
    var cancelled = false;
    setReferralLoading(true);
    try {
      sbProfile.rpc('get_my_referral_code').then(function(r){
        if (cancelled) return;
        setReferralLoading(false);
        if (r && !r.error && r.data) {
          var d = Array.isArray(r.data) ? r.data[0] : r.data;
          // d may be a bare string code or a row with stats.
          if (typeof d === 'string') setReferral({ code: d });
          else if (d) setReferral(d);
        }
      }).catch(function(){ if(!cancelled) setReferralLoading(false); });
    } catch(_){ setReferralLoading(false); }
    return function(){ cancelled = true; };
  }, [showInvite]);

  // Cosmetics: load the catalog (so equipped ids resolve to visuals) + this
  // user's equipped selection. Refresh on the 'ringin-cosmetics-changed' event
  // the Style Store fires after an equip. Defensive: no catalog / no columns
  // → nothing rendered (forward-compatible with the 0049 migration).
  useEffect(function(){
    if(!userId) return;
    var cancelled = false;
    function loadCat(){ loadCatalog(sbProfile).then(function(){ if(!cancelled) setCatReady(function(x){return x+1;}); }); }
    function pull(){
      try {
        sbProfile.from('profiles').select('equipped').eq('id', userId).maybeSingle().then(function(r){
          if (cancelled) return;
          if (r && !r.error && r.data && r.data.equipped && typeof r.data.equipped === 'object') setMyEquipped(r.data.equipped);
        }).catch(function(){});
      } catch(_){}
    }
    loadCat(); pull();
    function onChange(){ loadCat(); pull(); }
    window.addEventListener('ringin-cosmetics-changed', onChange);
    return function(){ cancelled = true; window.removeEventListener('ringin-cosmetics-changed', onChange); };
  }, [userId]);

  // Resolve equipped cosmetics → catalog items (re-resolves when myEquipped or
  // catReady change). Used in the own-profile render below.
  var eqTag = equippedItem(myEquipped, 'tag');
  var eqFrame = equippedItem(myEquipped, 'frame');
  var eqSticker = equippedItem(myEquipped, 'sticker');
  var eqTheme = equippedItem(myEquipped, 'theme');
  void catReady;

  // FIX #5: load the people the current user follows for the Friends tab.
  // Try the FK-join syntax first; on failure (e.g. column rename or no FK
  // metadata), fall back to two queries: follows → ids → profiles.
  useEffect(function(){
    if(!userId) return;
    var cancelled = false;
    function applyRows(rows){
      if (cancelled) return;
      var list = (rows || []).map(function(p){
        var name = p.full_name || (p.email ? p.email.split('@')[0] : 'User');
        return {
          id: p.id,
          name: name,
          role: 'RingIn Member',
          initials: (name || '?').substring(0,2).toUpperCase(),
          img: p.avatar_url || null,
          color: 'linear-gradient(135deg,#7B6EFF,#E84D9A)'
        };
      });
      setRealFriends(list);
    }
    try {
      // Two-query fallback path — works without relying on FK introspection.
      sbProfile.from('follows').select('following_id').eq('follower_id', userId).limit(50).then(function(fr){
        if (cancelled) return;
        if (!fr || fr.error || !fr.data || fr.data.length === 0) { setRealFriends([]); return; }
        var ids = fr.data.map(function(x){ return x.following_id; }).filter(Boolean);
        if (ids.length === 0) { setRealFriends([]); return; }
        sbProfile.from('profiles').select('id,full_name,avatar_url,email').in('id', ids).then(function(pr){
          if (cancelled) return;
          if (pr && !pr.error && pr.data) applyRows(pr.data);
          else setRealFriends([]);
        }).catch(function(){ if (!cancelled) setRealFriends([]); });
      }).catch(function(){ if (!cancelled) setRealFriends([]); });
    } catch(_){
      if (!cancelled) setRealFriends([]);
    }
    return function(){ cancelled = true; };
  }, [userId]);

  // Android back / edge-swipe handler — walks UP the settings hierarchy
  // one step at a time. Order is innermost overlay → outermost:
  //   sub-picker (country/phone/timezone) → sub-page (Account/Privacy/…)
  //   → Settings panel itself → Profile tab (then App.js takes over).
  // Each press closes ONE level so the user can navigate back up the
  // same path they came down. Consumes the cancelable 'ringin:back'
  // event so App.js's tab-level fallback doesn't fire prematurely.
  useEffect(function(){
    function onBack(ev){
      function consume(close){
        if (ev && ev.preventDefault) ev.preventDefault();
        close();
      }
      // Style Store is a full-screen overlay over the profile — close it FIRST so
      // Android hardware back returns to the profile instead of App.js's goBack
      // ladder falling through to the Home tab.
      if (showStore) return consume(function(){ setShowStore(false); });
      // ─── Modals (highest priority — always-on-top overlays) ───
      // FIX #8: edit-post modal (Batch 1 added the state but the back-handler
      // never closed it). Put it AT THE TOP of the priority chain — most
      // innermost overlay first — and added editPostProfData to the dep array
      // so the handler re-binds when the modal opens.
      if (editPostProfData) return consume(function(){ setEditPostProfData(null); });
      if (showEditProfile) return consume(function(){ setShowEditProfile(false); });
      if (showAvatarView) return consume(function(){ setShowAvatarView(false); });
      if (showAvatarMenu) return consume(function(){ setShowAvatarMenu(false); });
      if (showCoverAdjust) return consume(function(){ setShowCoverAdjust(false); });
      if (showAdjust) return consume(function(){ setShowAdjust(false); });
      if (showEmoji) return consume(function(){ setShowEmoji(false); });
      // Likers list popup from Profile post grid
      if (showLikersProf) return consume(function(){ setShowLikersProf(null); });
      // ─── Sub-pickers INSIDE Account Settings (innermost) ───
      if (showCountryPicker) return consume(function(){ setShowCountryPicker(false); });
      if (showPhoneCodePicker) return consume(function(){ setShowPhoneCodePicker(false); });
      if (showTzPicker) return consume(function(){ setShowTzPicker(false); });
      // ─── Settings sub-pages — each closes back to the main Settings panel ───
      if (showCloseFriends) return consume(function(){ setShowCloseFriends(false); });
      if (showAcct) return consume(function(){ setShowAcct(false); });
      if (showPrivacy) return consume(function(){ setShowPrivacy(false); });
      if (showSupport) return consume(function(){ setShowSupport(false); });
      if (showNotif) return consume(function(){ setShowNotif(false); });
      if (showActivityLog) return consume(function(){ setShowActivityLog(false); });
      if (showSound) return consume(function(){ setShowSound(false); });
      if (showBlocked) return consume(function(){ setShowBlocked(false); });
      if (showMuted) return consume(function(){ setShowMuted(false); });
      if (showExpertApp) return consume(function(){ setShowExpertApp(false); });
      if (showSubsMgr) return consume(function(){ setShowSubsMgr(false); }); /* R25 */
      if (showCreatorStudio) return consume(function(){ setShowCreatorStudio(false); }); /* R50 */
      if (showVerifyApp) return consume(function(){ setShowVerifyApp(false); }); /* R26 */
      if (showAdminReview) return consume(function(){ setShowAdminReview(false); }); /* R26 */
      if (showRate) return consume(function(){ setShowRate(false); });
      if (showLeaderboard) return consume(function(){ setShowLeaderboard(false); });
      if (showInvite) return consume(function(){ setShowInvite(false); });
      // ─── Settings panel itself — closes back to the Profile screen ───
      if (showSettings) return consume(function(){ setShowSettings(false); });
    }
    window.addEventListener('ringin:back', onBack);
    return function(){ window.removeEventListener('ringin:back', onBack); };
  }, [
    // FIX #8: editPostProfData added to dep array so the handler re-binds when
    // the edit-post modal opens/closes — previously the back press was ignored.
    editPostProfData,
    showEditProfile, showAvatarView, showAvatarMenu, showCoverAdjust, showAdjust, showEmoji, showLikersProf,
    showCountryPicker, showPhoneCodePicker, showTzPicker,
    showCloseFriends, showAcct, showPrivacy, showSupport, showNotif, showActivityLog, showSound, showBlocked, showMuted, showExpertApp, showSubsMgr, showVerifyApp, showAdminReview, showRate,
    showInvite, showLeaderboard,
    showSettings, showStore,
  ]);

  /* R18: ESC closes phone-code picker + body-scroll-lock while open */
  useEffect(function(){
    if (!showPhoneCodePicker) return;
    /* R20 FIX #2: ref-counted lock (was per-effect snapshot which leaked when 2 modals stacked) */
    var releaseLock = acquireBodyScrollLock();
    function onKey(e){ if (e.key === 'Escape' || e.keyCode === 27) { setShowPhoneCodePicker(false); setAcctCountrySearch(''); } }
    try { document.addEventListener('keydown', onKey); } catch(_){}
    return function(){
      try { document.removeEventListener('keydown', onKey); } catch(_){}
      releaseLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPhoneCodePicker]);

  /* R18: ESC closes timezone picker + body-scroll-lock while open */
  useEffect(function(){
    if (!showTzPicker) return;
    /* R20 FIX #2: ref-counted lock */
    var releaseLock = acquireBodyScrollLock();
    function onKey(e){ if (e.key === 'Escape' || e.keyCode === 27) { setShowTzPicker(false); setTzSearch(''); } }
    try { document.addEventListener('keydown', onKey); } catch(_){}
    return function(){
      try { document.removeEventListener('keydown', onKey); } catch(_){}
      releaseLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTzPicker]);

  useEffect(function(){
    if(!userId) return;
    sbProfile.from('profiles').select('full_name,bio').eq('id',userId).single().then(function(res){
      if(res.data){
        var name = res.data.full_name || email.split('@')[0];
        var bio = res.data.bio || '';
        var parsed = {name:name,tag:'',about:'',website_name:'',website_url:''};
        try{ var j=JSON.parse(bio); if(j&&typeof j==='object'){parsed.about=j.about||'';parsed.tag=j.tag||'';parsed.website_name=j.website_name||j.website||'';parsed.website_url=j.website_url||'';} }catch(e){ parsed.about=bio; }
        setProfileInfo(parsed);
        try{localStorage.setItem('profile_info_'+userId,JSON.stringify(parsed));}catch(e){}
      }
    });
  },[userId]);

  /* R26: load verification status + admin flag + subscription offer.
   * Subscriptions are now gated on profiles.is_verified (anyone can apply
   * for a verified badge — not just experts). We read is_verified,
   * verified_until, is_admin from profiles, and the user's own
   * verification_requests row to know whether they're pending/approved. */
  useEffect(function(){
    if (!userId) return;
    var cancelled = false;
    // 1) Verification + admin flags from profiles
    try {
      sbProfile.from('profiles').select('is_verified,verified_until,is_admin').eq('id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) {
          setIsVerified(!!r.data.is_verified);
          setVerifiedUntil(r.data.verified_until || null);
          setIsAdmin(!!r.data.is_admin);
        }
      }).catch(function(){ /* columns may not exist if 0018 not applied — keep defaults */ });
    } catch(_){}
    // 1b) The user's own verification request status (pending/approved/rejected)
    try {
      sbProfile.from('verification_requests').select('status').eq('user_id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data && r.data.status) setVerifStatus(r.data.status);
        else setVerifStatus('none');
      }).catch(function(){});
    } catch(_){}
    // 2) Load current subscription offer (if any)
    try {
      setSubOfferLoading(true);
      sbProfile.from('creator_subscriptions_offered').select('*').eq('creator_id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        setSubOfferLoading(false);
        if (r && !r.error && r.data) {
          setSubOffer(r.data);
          setSubEnabledForm(!!r.data.enabled);
          setSubPriceCents(r.data.price_cents || 499);
          setSubCurrency(r.data.currency || 'USD');
          setSubCoinGiftPrice(r.data.coin_gift_price || 500);
          setSubTrialDays(r.data.trial_days || 0);
          setSubDescription(r.data.description || '');
          var p = r.data.perks;
          if (Array.isArray(p)) setSubPerks(p);
          else if (typeof p === 'string') { try { var parsed = JSON.parse(p); if (Array.isArray(parsed)) setSubPerks(parsed); } catch(_){} }
        }
      }).catch(function(e){ setSubOfferLoading(false); console.warn('[ringin] sub offer fetch reject:', e && e.message); });
    } catch(e){ setSubOfferLoading(false); console.warn('[ringin] sub offer fetch throw:', e && e.message); }
    // 3) Load active subscriber count for the creator dashboard
    try {
      sbProfile.from('creator_subscriber_count').select('active_count').eq('creator_id', userId).maybeSingle().then(function(r){
        if (cancelled) return;
        if (r && !r.error && r.data) setSubActiveCount(r.data.active_count || 0);
      }).catch(function(){});
    } catch(_){}
    return function(){ cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* R23: Privacy settings — fetch from the server so the user's settings
   * travel across devices. Wrapped in try/catch + a separate query so an
   * older DB without the privacy columns (migration 0016 not yet applied)
   * doesn't break the profile load. Falls back to whatever localStorage
   * had on prior versions. */
  useEffect(function(){
    if(!userId) return;
    try {
      sbProfile.from('profiles')
        .select('profile_visibility,is_locked,hide_likes_in_feed')
        .eq('id', userId)
        .single()
        .then(function(res){
          if (!res || res.error || !res.data) {
            // Column doesn't exist (migration not yet applied) or row missing
            // — keep local state from localStorage, do nothing.
            if (res && res.error) console.warn('[ringin] privacy fetch:', res.error.message);
            return;
          }
          var vis = res.data.profile_visibility || 'public';
          var locked = !!res.data.is_locked;
          // Update local state + localStorage so any same-session reads stay
          // consistent with the server. (hide_likes lives in its own hook;
          // we just sync it to LS via the setHideLikes setter pattern.)
          setProfileVis(vis);
          setProfileLocked(locked);
          try { localStorage.setItem('profile_vis', vis); } catch(_){}
          try { localStorage.setItem('profile_locked', locked ? '1' : '0'); } catch(_){}
        })
        .catch(function(e){ console.warn('[ringin] privacy fetch reject:', e && e.message); });
    } catch(_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // FIX #3: prefill Account Settings form from server on first open, so blank
  // localStorage doesn't trick the user into saving an empty profile. Only
  // populates fields the user hasn't already typed into.
  useEffect(function(){
    if(!showAcct||!userId) return;
    /* R39/R40: also fetch `gender`, `gender_changed_at`, `is_verified`.
     * Forward-compatible — falls back to narrow select if any column is missing. */
    /* R65: also fetch Real Friends fields (home_language, home_town,
     * current_city). Forward-compatible — falls back if columns
     * don't exist yet (pre-0044 deploys). */
    sbProfile.from('profiles').select('full_name,bio,gender,gender_changed_at,is_verified,home_language,home_town,current_city').eq('id',userId).single().then(function(res){
      if (res && res.error && /column .* does not exist/i.test(res.error.message||'')) {
        return sbProfile.from('profiles').select('full_name,bio,gender').eq('id',userId).single();
      }
      return res;
    }).then(function(res){
      if(!res||!res.data) return;
      /* R65: prefill community fields from server. */
      if (typeof res.data.home_language === 'string') setAcctHomeLang(res.data.home_language || '');
      if (typeof res.data.home_town === 'string') setAcctHomeTown(res.data.home_town || '');
      if (typeof res.data.current_city === 'string') setAcctCurrentCity(res.data.current_city || '');
      var fullName = res.data.full_name || '';
      var dbGender = res.data.gender || '';
      /* R40 metadata */
      if (res.data.gender_changed_at) setAcctGenderChangedAt(res.data.gender_changed_at);
      if (typeof res.data.is_verified === 'boolean') setAcctVerified(!!res.data.is_verified);
      /* Only overwrite local state if user hasn't actively picked something. */
      setAcctGender(function(prev){ return prev ? prev : dbGender; });
      var bioJson = {};
      try{ if(res.data.bio){ var b=(typeof res.data.bio==='string')?JSON.parse(res.data.bio):res.data.bio; if(b&&typeof b==='object') bioJson=b; } }catch(_){}
      var loc = bioJson.location || {};
      // Only set fields the user hasn't already typed into. Check the
      // current state via setX(prev => ...) so we don't depend on stale
      // closures, and only overwrite when prev is empty/whitespace.
      if(fullName){ setAcctName(function(prev){ return (prev && prev.trim()) ? prev : fullName; }); }
      if(bioJson.tag){ setAcctTag(function(prev){ return (prev && prev.trim()) ? prev : (bioJson.tag||''); }); }
      var country = loc.country_name || loc.country || '';
      if(country){ setAcctCountry(function(prev){ return (prev && prev.trim()) ? prev : country; }); }
      var dial = loc.dial || loc.phone_code || '';
      if(dial){ setAcctPhoneCode(function(prev){ return (prev && prev!=='+1') ? prev : dial; }); }
      var phone = loc.phone || '';
      if(phone){ setAcctPhone(function(prev){ return (prev && prev.trim()) ? prev : phone; }); }
      var tz = loc.timezone || '';
      if(tz){ setAcctTz(function(prev){ return (prev && prev.trim() && prev!=='UTC') ? prev : tz; }); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showAcct,userId]);

  /* R39/R40: auto-save the gender column via set_my_gender RPC.
   * Enforces 30-day cooldown server-side (returns status='rate_limited'
   * + days_remaining). Client also gates the dropdown to avoid the
   * round-trip when we know it'll fail. */
  function saveGender(g){
    if (!userId) { setAcctGender(g); return; }
    /* Client-side gate — server still authoritative, but spare the round-trip. */
    if (acctGenderChangedAt) {
      var msSince = Date.now() - new Date(acctGenderChangedAt).getTime();
      var daysSince = msSince / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        var daysLeft = Math.ceil(30 - daysSince);
        try { toastError('You can change your gender again in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '.'); } catch(_){}
        return;
      }
    }
    /* No-op if unchanged. */
    if (acctGender === g) return;
    var prev = acctGender;
    setAcctGender(g); /* optimistic */
    setAcctGenderSaving(true);
    var dbValue = (g === 'm' || g === 'f' || g === 'other') ? g : null;
    sbProfile.rpc('set_my_gender', { p_gender: dbValue }).then(function(r){
      setAcctGenderSaving(false);
      if (r && r.error) {
        setAcctGender(prev); /* rollback */
        try { toastError('Could not save gender — try again'); } catch(_){}
        return;
      }
      var status = r && r.data && r.data.status;
      if (status === 'rate_limited') {
        setAcctGender(prev); /* rollback */
        var d = (r.data.days_remaining) || 30;
        try { toastError('You can change your gender again in ' + d + ' day' + (d === 1 ? '' : 's') + '.'); } catch(_){}
        return;
      }
      if (status === 'noop') { /* nothing to do */ return; }
      /* ok */
      setAcctGenderChangedAt(new Date().toISOString());
      setAcctGenderSaved(true);
      if (acctGenderSavedTimerRef.current) { try { clearTimeout(acctGenderSavedTimerRef.current); } catch(_){} }
      acctGenderSavedTimerRef.current = setTimeout(function(){ setAcctGenderSaved(false); acctGenderSavedTimerRef.current = null; }, 1800);
    }).catch(function(){
      setAcctGenderSaving(false);
      setAcctGender(prev); /* rollback */
      try { toastError('Network error'); } catch(_){}
    });
  }

  function openEditProfile(){
    setEditName(profileInfo.name||email.split('@')[0]);
    setEditTag(profileInfo.tag||'');
    setEditAbout(profileInfo.about||'');
    setEditWebsiteName(profileInfo.website_name||'');
    setEditWebsiteUrl(profileInfo.website_url||'');
    setShowEditProfile(true);
  }

  function saveEditProfile(){
    if(!userId) return;
    setSavingEdit(true);
    // FIX #1 (P0 data-loss): fetch + deep-merge the bio JSON so we don't wipe
    // notif_prefs, sound_prefs, location, cover_url, expert_request, etc.
    // SAME pattern as Save All (~line 1330) and Expert App (~line 2103).
    sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r0){
      var existing={};
      try{
        if(r0 && r0.data && r0.data.bio){
          var b=(typeof r0.data.bio==='string')?JSON.parse(r0.data.bio):r0.data.bio;
          if(b && typeof b==='object') existing=b;
        }
      }catch(_){}
      var merged=Object.assign({},existing,{
        about: editAbout || '',
        tag: editTag || '',
        website_name: editWebsiteName || '',
        website_url: editWebsiteUrl || '',
      });
      sbProfile.from('profiles').update({full_name:editName,bio:JSON.stringify(merged)}).eq('id',userId).then(function(res){
        setSavingEdit(false);
        if(res.error){
          console.error('RingIn Error [saveEditProfile]:', res.error && res.error.message ? res.error.message : 'Unknown error');
          /* R21 FIX #5: alert → toastError */
          try { toastError('Something went wrong. Please try again.'); } catch(_){}
          return;
        }
        var updated={name:editName,tag:editTag,about:editAbout,website_name:editWebsiteName,website_url:editWebsiteUrl};
        setProfileInfo(updated);
        try{localStorage.setItem('profile_info_'+userId,JSON.stringify(updated));}catch(e){}
        // R15 FIX #7: broadcast the new display name so TopBarAvatar (and any
        // other listener mirroring the avatar-changed pattern) can refresh
        // without a remount. Mirrors the existing 'ringin-avatar-changed'.
        try { window.dispatchEvent(new CustomEvent('ringin-name-changed', {detail: {userId: userId, name: editName}})); } catch(_){}
        setShowEditProfile(false);
      });
    }).catch(function(e){
      // ROUND 8 FIX #2: outer SELECT (or downstream promise) reject left UI stuck
      // on "Saving..." with no feedback. Surface error + clear loading.
      setSavingEdit(false);
      try{ toastError('Save failed — try again'); }catch(_){}
      console.warn('[ringin] saveEditProfile failed', e);
    });
  }

  function renderAbout(text){
    if(!text) return null;
    var parts = text.split(/(#\w+|https?:\/\/\S+)/g);
    return React.createElement('span',null,parts.map(function(part,i){
      if(/^#\w+$/.test(part)) return React.createElement('span',{key:i,style:{color:'#7B6EFF',fontWeight:600}},part);
      if(/^https?:\/\//.test(part)) return React.createElement('a',{key:i,href:part,target:'_blank',rel:'noreferrer',style:{color:'#7B6EFF',textDecoration:'underline'}},part);
      return React.createElement('span',{key:i},part);
    }));
  }

  useEffect(function(){
    if(!userId) return;
    // Load user posts from Supabase
    sbProfile.from('posts').select('*').eq('user_id',userId).order('created_at',{ascending:false}).then(function(res){
      if(res.data&&res.data.length>0){
        var dbPosts = res.data.map(function(p){
          var likesArr = Array.isArray(p.likes)?p.likes:[];
          return {
            id:p.id,
            text:p.text||'',
            likes:likesArr,
            liked:likesArr.includes(userId),
            likedByIds:likesArr,
            time:timeAgoProf(p.created_at),
            createdAt:p.created_at,
            img:p.images&&p.images[0]?p.images[0]:null,
            tags:p.tags||[],
            comments:p.comments_count||0
          };
        });
        setMyPosts(dbPosts);
        prefetchLikerNamesProf(dbPosts, {});
        try{localStorage.setItem('my_posts_cache_'+userId,JSON.stringify(dbPosts));}catch(e){}
        // Preload comment counts from localStorage cache
        var cmap={};
        dbPosts.forEach(function(p){try{var c=localStorage.getItem('comments_'+p.id);if(c)cmap[p.id]=JSON.parse(c);}catch(e){} });
        if(Object.keys(cmap).length) setCommentsCacheProf(cmap);
      }
    });
  },[userId]);
  // Realtime: sync likes + comment counts on profile posts (shared hook)
  // likesAsArray:true because ProfileScreen stores likes as array of IDs (not a count)
  usePostsRealtime(sbProfile,'profile-posts-rt-'+userId,userId,setMyPosts,setCommentsCacheProf,{likesAsArray:true});

  useEffect(function(){
    if(!userId) return;
    var saved = localStorage.getItem('avatar_'+userId);
    var savedCover = localStorage.getItem('cover_'+userId);
    if(saved){
      setAvatarUrl(saved);
    } else {
      // Load from Supabase if not in localStorage
      supabase.from('profiles').select('avatar_url').eq('id',userId).single().then(function(res){
        if(res.data&&res.data.avatar_url){
          setAvatarUrl(res.data.avatar_url);
          /* R18: safeSetItem — never crashes in private/full storage */
          safeSetItem('avatar_'+userId,res.data.avatar_url);
        }
      });
    }
    if(savedCover) setCoverUrl(savedCover);

    // Fall back to DB for cover_url if localStorage is empty (other device, cleared cache)
    // Try column first, then bio.cover_url JSON (in case the cover_url column doesn't exist yet)
    if(!savedCover){
      supabase.from('profiles').select('cover_url, bio').eq('id',userId).single().then(function(res){
        var url = (res.data && res.data.cover_url) || null;
        if(!url && res.data && res.data.bio){
          try{ var bj = JSON.parse(res.data.bio); if(bj && bj.cover_url) url = bj.cover_url; }catch(e){}
        }
        if(url){
          setCoverUrl(url);
          try{localStorage.setItem('cover_'+userId, url);}catch(e){}
        }
      });
    }

    // Sync notif/sound prefs from profile.bio.notif_prefs (cross-device)
    sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r){
      if(!r.data||!r.data.bio) return;
      var bioJson={};
      try{bioJson=JSON.parse(r.data.bio);}catch(e){}
      if(bioJson.notif_prefs){
        var p=bioJson.notif_prefs;
        // Support both unified (website) and legacy (mobile) key names
        function pick(unified, legacy){
          if(p[unified]!==undefined) return p[unified];
          if(p[legacy]!==undefined) return p[legacy];
          return undefined;
        }
        var v;
        v=pick('likes','notif_likes'); if(v!==undefined){setNotifLikes(v); try{localStorage.setItem('notif_likes',v?'1':'0');}catch(e){}}
        v=pick('comments','notif_comments'); if(v!==undefined){setNotifComments(v); try{localStorage.setItem('notif_comments',v?'1':'0');}catch(e){}}
        v=pick('follows','notif_follows'); if(v!==undefined){setNotifFollows(v); try{localStorage.setItem('notif_follows',v?'1':'0');}catch(e){}}
        v=pick('calls','notif_calls'); if(v!==undefined){setNotifCalls(v); try{localStorage.setItem('notif_calls',v?'1':'0');}catch(e){}}
        v=pick('messages','notif_msgs'); if(v!==undefined){setNotifMsgs(v); try{localStorage.setItem('notif_msgs',v?'1':'0');}catch(e){}}
        v=pick('workshops','notif_workshops'); if(v!==undefined){setNotifWorkshops(v); try{localStorage.setItem('notif_workshops',v?'1':'0');}catch(e){}}
        v=pick('promotions','notif_promo'); if(v!==undefined){setNotifPromo(v); try{localStorage.setItem('notif_promo',v?'1':'0');}catch(e){}}
      }
      if(bioJson.sound_prefs && typeof bioJson.sound_prefs === 'object'){
        // DEEP-MERGE: don't wholesale replace. If the server has partial data (e.g. only
        // {like:{enabled:false}}), shallow-replace would lose all other keys' defaults and
        // disable every sound. Merge per-key on top of current local prefs.
        setSoundPrefs(function(prev){
          var merged = Object.assign({}, prev || {});
          Object.keys(bioJson.sound_prefs).forEach(function(k){
            var v = bioJson.sound_prefs[k];
            if(v && typeof v === 'object'){
              merged[k] = Object.assign({}, merged[k] || {}, v);
            }
          });
          try{localStorage.setItem('ringin_sound_prefs', JSON.stringify(merged));}catch(e){}
          return merged;
        });
      }
    });
  },[userId]);

  // Activity log: fetch + realtime
  useEffect(function(){
    if(!userId||!showActivityLog) return;
    setActivityLoading(true);

    function buildItems(posts,comments,follows,messages){
      var items=[];
      // Login events from localStorage
      var logins=[];try{logins=JSON.parse(localStorage.getItem('login_log_'+userId)||'[]');}catch(e){}
      logins.forEach(function(l){items.push({id:'login_'+l.t,type:'login',icon:'🔑',text:'Signed in to RingIn',created_at:l.t});});
      // Posts
      (posts||[]).forEach(function(p){items.push({id:'post_'+p.id,type:'post',icon:'📝',text:'Shared a post with everyone',created_at:p.created_at});});
      // Comments
      (comments||[]).forEach(function(c){items.push({id:'comment_'+c.id,type:'comment',icon:'💬',text:'Commented on a post',created_at:c.created_at});});
      // Follows
      (follows||[]).forEach(function(f){items.push({id:'follow_'+f.id,type:'follow',icon:'👤',text:'Followed '+(f.following_name||'someone'),created_at:f.created_at});});
      // Messages
      (messages||[]).forEach(function(m){items.push({id:'msg_'+m.id,type:'message',icon:'✉️',text:'Sent a message'+(m.receiver_name?' to '+m.receiver_name:''),created_at:m.created_at});});
      // Sort newest first
      items.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
      setActivityItems(items);
      setActivityLoading(false);
    }

    // Record current login if not already logged today
    var today=new Date().toDateString();
    var logins=[];try{logins=JSON.parse(localStorage.getItem('login_log_'+userId)||'[]');}catch(e){}
    if(!logins.length||new Date(logins[logins.length-1].t).toDateString()!==today){
      logins.push({t:new Date().toISOString()});
      try{localStorage.setItem('login_log_'+userId,JSON.stringify(logins.slice(-90)));}catch(e){}
    }

    var posts=[],comments=[],follows=[],messages=[];
    var done=0;
    function check(){done++;if(done===4)buildItems(posts,comments,follows,messages);}
    sbProfile.from('posts').select('id,text,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50).then(function(r){posts=r.data||[];check();});
    sbProfile.from('comments').select('id,text,post_id,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50).then(function(r){comments=r.data||[];check();});
    sbProfile.from('follows').select('id,following_name,created_at').eq('follower_id',userId).order('created_at',{ascending:false}).limit(50).then(function(r){follows=r.data||[];check();});
    // FIX R10-1: messages table column is `text`, not `content`. Selecting
    // `content` returned undefined for every row → Download My Data + activity
    // log were effectively empty. Other call sites correctly use `text`.
    sbProfile.from('messages').select('id,text,created_at').eq('sender_id',userId).order('created_at',{ascending:false}).limit(50).then(function(r){messages=r.data||[];check();});

    // Realtime: re-fetch on any new post, comment, follow, message
    var ch=sbProfile.channel('activity-log-'+userId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'posts',filter:'user_id=eq.'+userId},function(p){
        setActivityItems(function(prev){return [{id:'post_'+p.new.id,type:'post',icon:'📝',text:'Shared a post with everyone',created_at:p.new.created_at}].concat(prev);});
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'comments',filter:'user_id=eq.'+userId},function(p){
        setActivityItems(function(prev){return [{id:'comment_'+p.new.id,type:'comment',icon:'💬',text:'Commented on a post',created_at:p.new.created_at}].concat(prev);});
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'follows',filter:'follower_id=eq.'+userId},function(p){
        setActivityItems(function(prev){return [{id:'follow_'+p.new.id,type:'follow',icon:'👤',text:'Followed '+(p.new.following_name||'someone'),created_at:p.new.created_at}].concat(prev);});
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'sender_id=eq.'+userId},function(p){
        setActivityItems(function(prev){return [{id:'msg_'+p.new.id,type:'message',icon:'✉️',text:'Sent a message'+(p.new.receiver_name?' to '+p.new.receiver_name:''),created_at:p.new.created_at}].concat(prev);});
      })
      .subscribe();
    return function(){sbProfile.removeChannel(ch);};
  },[userId,showActivityLog]);

  function uploadAvatar(file){
    if(!file||!userId) return;
    // Validate file type
    var allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
    if(!allowed.includes(file.type)){
      /* R21 FIX #5: alert → toast */
      try { toastError('Only images allowed (JPG, PNG, GIF, WebP)'); } catch(_){}
      return;
    }
    // Validate file size (max 5MB)
    if(file.size > 5 * 1024 * 1024){
      try { toastError('Image must be under 5MB'); } catch(_){}
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      setAdjustImg(e.target.result);
      setOffset({x:0,y:0});
      setShowAdjust(true);
    };
    reader.readAsDataURL(file);
  }

  function saveAvatar(){
    if(!adjustImg||!userId) return;
    // Use canvas to capture the adjusted position
    var canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 280;
    var ctx = canvas.getContext('2d');
    // Draw circle clip
    ctx.beginPath();
    ctx.arc(140,140,140,0,Math.PI*2);
    ctx.clip();
    var img = new Image();
    img.onload = function(){
      // Calculate size to fit full image
      var scale = Math.min(500/img.width, 500/img.height);
      var w = img.width * scale;
      var h = img.height * scale;
      var x = 140 - w/2 + offset.x;
      var y = 140 - h/2 + offset.y;
      ctx.drawImage(img, x, y, w, h);
      canvas.toBlob(function(blob){
        setUploading(true);
        setShowAdjust(false);
        var fileName = userId+'.jpg';
        supabase.storage.from('avatars').upload(fileName,blob,{upsert:true,contentType:'image/jpeg'}).then(function(res){
          if(res.error){try{toastError('Avatar upload failed. Please try again.');}catch(_){}setUploading(false);return;}
          var pub = supabase.storage.from('avatars').getPublicUrl(fileName);
          var url = pub.data.publicUrl+'?t='+Date.now();
          setAvatarUrl(url);
          /* R18: safeSetItem — never crashes if storage quota is full */
          safeSetItem('avatar_'+userId,url);
          var userEmail = (session&&session.user)?session.user.email:email;
          // CRITICAL: do NOT include full_name here — that would clobber the user's chosen name
          // whenever they update their avatar. Use UPDATE so we don't accidentally create a row
          // with missing fields; the row was already created by App.js auth listener.
          supabase.from('profiles').update({avatar_url:url}).eq('id',userId).then(function(r){
            if(r && r.error){ console.error('avatar save failed:', r.error.message); }
          });
          // Broadcast so other screens (topbars) refresh their avatar from localStorage
          try{ window.dispatchEvent(new CustomEvent('ringin-avatar-changed', {detail:{userId:userId, url:url}})); }catch(e){}
          setUploading(false);
        });
      },'image/jpeg',0.9);
    };
    img.src = adjustImg;
  }

  function uploadCover(file){
    if(!file||!userId) return;
    // Validate file type
    var allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
    if(!allowed.includes(file.type)){
      /* R21 FIX #5: alert → toast */
      try { toastError('Only images allowed (JPG, PNG, GIF, WebP)'); } catch(_){}
      return;
    }
    // Validate file size (max 5MB)
    if(file.size > 5 * 1024 * 1024){
      try { toastError('Image must be under 5MB'); } catch(_){}
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      var tmp = new Image();
      tmp.onload = function(){
        setCoverImgNat({w:tmp.naturalWidth, h:tmp.naturalHeight});
        setCoverAdjustImg(e.target.result);
        setCoverOffset({x:0,y:0});
        setCoverUserScale(1);
        setShowCoverAdjust(true);
      };
      tmp.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function saveCover(){
    if(!coverAdjustImg||!userId) return;
    var CANVAS_W = 800;
    var CANVAS_H = 260;
    var PREV_H = 160;
    var prevW = (window.innerWidth||375);
    var canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function(){
      var natW = img.naturalWidth||img.width;
      var natH = img.naturalHeight||img.height;
      // Base scale: cover-fill (same as preview)
      var previewBaseScale = Math.max(prevW / natW, PREV_H / natH);
      var canvasBaseScale = Math.max(CANVAS_W / natW, CANVAS_H / natH);
      // Apply user zoom on top of base
      var previewTotalScale = previewBaseScale * coverUserScale;
      var canvasTotalScale = canvasBaseScale * coverUserScale;
      var imgCW = natW * canvasTotalScale;
      var imgCH = natH * canvasTotalScale;
      var baseX = (CANVAS_W - imgCW) / 2;
      var baseY = (CANVAS_H - imgCH) / 2;
      // Scale the screen-pixel offset to canvas-pixel offset
      var offsetRatio = canvasTotalScale / previewTotalScale;
      ctx.fillStyle = '#1a1040';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, baseX + coverOffset.x * offsetRatio, baseY + coverOffset.y * offsetRatio, imgCW, imgCH);
      canvas.toBlob(function(blob){
        setUploading(true);
        setShowCoverAdjust(false);
        var fileName = userId+'_cover.jpg';
        supabase.storage.from('covers').upload(fileName, blob, {upsert:true, contentType:'image/jpeg'}).then(function(res){
          if(res.error){try{toastError('Cover upload failed: '+(res.error.message||'storage error'));}catch(_){}setUploading(false);return;}
          var pub = supabase.storage.from('covers').getPublicUrl(fileName);
          var url = pub.data.publicUrl+'?t='+Date.now();
          setCoverUrl(url);
          try{localStorage.setItem('cover_'+userId, url);}catch(e){}

          // Write to both: the cover_url column AND bio.cover_url JSON. This way the cover
          // persists across devices even if the cover_url column doesn't exist yet (the
          // JSON merge always works because bio is a TEXT column).
          // 1) Try column update (no-op if column missing)
          supabase.from('profiles').update({cover_url:url}).eq('id',userId).then(function(r1){
            if(r1.error){ console.error('cover_url column update failed:', r1.error.message); }
          });
          // 2) Merge into bio JSON — re-read latest bio first so we don't clobber other fields
          supabase.from('profiles').select('bio').eq('id',userId).single().then(function(rb){
            /* R20 FIX #1: if the read failed (session expiry → RLS rejects, or
             * network reject), DO NOT proceed with the merge — synthesizing
             * `existing = {}` would wipe every other field in the user's bio
             * JSON (bio text, social links, cover_url, location, notif_prefs,
             * sound_prefs, etc.). Bail out and surface a toast so the user knows
             * the cover-image-itself succeeded (it's in cover_url column and
             * localStorage) but the bio-JSON mirror didn't. */
            if (rb.error || !rb.data) {
              try { toastError('Cover saved, but session may have expired — please re-login if it doesn\'t sync.'); } catch(_){}
              return;
            }
            var existing = {};
            try{ if(rb.data && rb.data.bio) existing = JSON.parse(rb.data.bio); }catch(e){ existing = {}; }
            existing.cover_url = url;
            supabase.from('profiles').update({bio: JSON.stringify(existing)}).eq('id',userId).then(function(r2){
              if(r2.error){ console.error('bio cover_url merge failed:', r2.error.message); try{ toastError('Cover saved locally — could not sync to account'); }catch(_){} }
            }).catch(function(e){
              console.warn('[ringin] bio cover_url merge reject:', e && e.message ? e.message : e);
            });
          }).catch(function(e){
            /* R20 FIX #1: also handle the raw network reject path on the select */
            console.warn('[ringin] bio read reject for cover-save:', e && e.message ? e.message : e);
            try { toastError('Cover saved, but couldn\'t sync — check your connection.'); } catch(_){}
          });
          setUploading(false);
        });
      }, 'image/jpeg', 0.92);
    };
    img.src = coverAdjustImg;
  }

  function toggleLike(id){
    if(!userId) return;
    if(typeof id !== 'string') return;
    // Play sound — compute direction from current state
    var currentPost=myPosts.find(function(p){return p.id===id;});
    if(currentPost){if(!currentPost.liked)playSound('like');else playUnlikeSound();}
    // Instant UI update
    setMyPosts(function(prev){return prev.map(function(p){
      if(p.id!==id) return p;
      var newLiked = !p.liked;
      var curIds = Array.isArray(p.likedByIds)?p.likedByIds:(Array.isArray(p.likes)?p.likes:[]);
      var newIds = newLiked ? [userId].concat(curIds.filter(function(x){return x!==userId;})) : curIds.filter(function(x){return x!==userId;});
      return Object.assign({},p,{liked:newLiked,likes:newIds,likedByIds:newIds});
    });});
    // Save to Supabase in background
    sbProfile.rpc('toggle_like',{post_id:id,user_id:userId}).then(function(r){
      if(r.error){
        console.log('like error:',r.error);
        // Revert on error
        setMyPosts(function(prev){return prev.map(function(p){
          if(p.id!==id) return p;
          var rev=!p.liked;
          var curIds=Array.isArray(p.likedByIds)?p.likedByIds:[];
          var revIds=rev?[userId].concat(curIds.filter(function(x){return x!==userId;})):curIds.filter(function(x){return x!==userId;});
          return Object.assign({},p,{liked:rev,likes:revIds,likedByIds:revIds});
        });});
      }
    });
  }

  function submitPost(){
    if(!postText.trim()){try{toastWarn('Write something first!');}catch(_){}return;}
    if(!userId){try{toastWarn('Please log in to post');}catch(_){}return;}
    playProfPostSound();
    var postData = {
      user_id: userId,
      user_name: email.split('@')[0],
      user_avatar: avatarUrl||null,
      text: postText,
      images: [],
      tags: [],
      likes: [],
      comments_count: 0
    };
    sbProfile.from('posts').insert([postData]).select().then(function(res){
      if(res.error){try{toastError('Failed to post. Please try again.');}catch(_){}return;}
      if(res.data&&res.data[0]){
        var newPost={
          id:res.data[0].id,
          text:postText,
          likes:[],
          liked:false,
          time:'Just now',
          img:null,
          comments:[]
        };
        setMyPosts(function(prev){return [newPost].concat(prev);});
        setPostText('');
      }
    });
  }

  // SETTINGS SCREEN
  // ── ACTIVITY LOG SCREEN ──
  if(showActivityLog){
    // Group items by date label
    var tz=localStorage.getItem('user_timezone')||'UTC';
    // R11 FIX #9: previously "Today"/"Yesterday" compared d.toDateString()
    // (browser local TZ) but the long-form fallback used `timeZone: tz`.
    // If browser TZ and stored TZ diverged, a row could be tagged "Today"
    // by toDateString but show a different long-form date elsewhere.
    // Compare ALL day strings under the same stored timeZone.
    function dayLabel(iso){
      var d=new Date(iso);
      if (isNaN(d.getTime())) return '';
      var dayOpts={timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'};
      var todayStr = new Date().toLocaleDateString([],dayOpts);
      var yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString([],dayOpts);
      var rowStr = d.toLocaleDateString([],dayOpts);
      if (rowStr === todayStr) return 'Today';
      if (rowStr === yesterdayStr) return 'Yesterday';
      return d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',timeZone:tz});
    }
    function fmtTime(iso){return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZone:tz});}
    var grouped=[];
    var seenDays={};
    activityItems.forEach(function(item){
      var label=dayLabel(item.created_at);
      if(!seenDays[label]){seenDays[label]=true;grouped.push({type:'day',label:label});}
      grouped.push(item);
    });
    var typeColors={login:'rgba(39,201,106,0.15)',post:'rgba(123,110,255,0.15)',comment:'rgba(232,77,154,0.15)',follow:'rgba(245,166,35,0.15)',message:'rgba(91,79,212,0.15)'};
    var typeBorder={login:'#27C96A',post:'#7B6EFF',comment:'#E84D9A',follow:'#F5A623',message:'#5B4FD4'};
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowActivityLog(false);setActivityItems([]);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Activity Log'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)'}},'Your recent actions in real time')
        ),
        activityLoading?React.createElement('div',{style:{fontSize:'12px',color:'var(--t3)'}},'Loading…'):null
      ),
      React.createElement('div',{style:{overflowY:'auto',flex:1,padding:'12px 18px 32px'}},
        activityItems.length===0&&!activityLoading
          ? React.createElement('div',{style:{textAlign:'center',padding:'60px 24px'}},
              React.createElement('div',{style:{fontSize:'40px',marginBottom:'12px'}},'📋'),
              React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)',marginBottom:'6px'}},'No activity yet'),
              React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},'Your posts, likes, comments and follows will appear here.')
            )
          : grouped.map(function(item,i){
              if(item.type==='day'){
                return React.createElement('div',{key:'day_'+i,style:{display:'flex',alignItems:'center',gap:'10px',margin:'18px 0 10px'}},
                  React.createElement('div',{style:{flex:1,height:'1px',background:'var(--border)'}}),
                  React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',whiteSpace:'nowrap',padding:'3px 10px',background:'var(--bg3)',borderRadius:'20px',border:'1px solid var(--border)'}},item.label),
                  React.createElement('div',{style:{flex:1,height:'1px',background:'var(--border)'}})
                );
              }
              return React.createElement('div',{key:item.id,style:{display:'flex',gap:'12px',marginBottom:'8px',alignItems:'flex-start'}},
                React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'10px',background:typeColors[item.type]||'var(--bg3)',border:'1.5px solid '+(typeBorder[item.type]||'var(--border)'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0,marginTop:'2px'}},item.icon),
                React.createElement('div',{style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px 12px'}},
                  React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4,marginBottom:'4px'}},item.text),
                  React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},fmtTime(item.created_at))
                )
              );
            })
      )
    );
  }

  // ── SUPPORT SCREEN ──
  if(showSupport) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowSupport(false);setSupportSent(false);setSupportMsg('');},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Help & Support')
    ),
    supportSent
      ? React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,padding:'40px 24px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'56px',marginBottom:'16px'}},'✅'),
          React.createElement('div',{style:{fontSize:'20px',fontWeight:700,color:'var(--text)',marginBottom:'8px'}},'Message Sent!'),
          React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',marginBottom:'28px'}},'We\'ll get back to you within 24 hours.'),
          React.createElement('button',{onClick:function(){setShowSupport(false);setSupportSent(false);setSupportMsg('');},style:{padding:'12px 32px',background:'var(--ac)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer'}},'Back to Settings')
        )
      : React.createElement('div',{style:{padding:'20px 18px',flex:1}},
          // Category chips
          React.createElement('div',{style:{marginBottom:'20px'}},
            React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.5px'}},'What do you need help with?'),
            React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'8px'}},
              [['general','General Inquiry'],['bug','Report a Bug'],['account','Account Issue'],['payment','Payment / Coins'],['call','Call Quality'],['safety','Safety Concern']].map(function(c){
                return React.createElement('button',{key:c[0],onClick:function(){setSupportCat(c[0]);},style:{padding:'7px 14px',borderRadius:'20px',border:'1px solid '+(supportCat===c[0]?'var(--ac)':'var(--border)'),background:supportCat===c[0]?'var(--acg)':'transparent',color:supportCat===c[0]?'var(--ac)':'var(--t2)',fontSize:'12px',fontWeight:600,cursor:'pointer'}},c[1]);
              })
            )
          ),
          // Email
          React.createElement('div',{style:{marginBottom:'14px'}},
            React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Your Email'),
            React.createElement('input',{type:'email',value:supportEmail,onChange:function(e){setSupportEmail(e.target.value);},placeholder:'your@email.com',style:{width:'100%',padding:'13px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}})
          ),
          // Message
          React.createElement('div',{style:{marginBottom:'20px'}},
            React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Describe your issue'),
            React.createElement('textarea',{value:supportMsg,onChange:function(e){setSupportMsg(e.target.value);},placeholder:'Tell us what happened, as much detail as possible...',rows:5,style:{width:'100%',padding:'13px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',outline:'none',resize:'none',fontFamily:'inherit',lineHeight:1.6}})
          ),
          React.createElement('button',{
            // FIX #11: actually persist the support message to localStorage
            // so the user has a record of what they submitted. Server-side
            // schema isn't ready, so localStorage is the safer fallback.
            onClick:function(){
              if(!supportEmail.trim()||!supportMsg.trim()){try{toastWarn('Please fill in your email and describe your issue.');}catch(_){}return;}
              try {
                var key = 'ringin_support_msgs';
                var cur = [];
                try { var s = localStorage.getItem(key); if (s) cur = JSON.parse(s); if (!Array.isArray(cur)) cur = []; } catch(_){ cur = []; }
                cur.push({
                  category: supportCat,
                  email: supportEmail.trim(),
                  message: supportMsg.trim(),
                  at: new Date().toISOString(),
                  user_id: userId || null,
                });
                // Keep the last 50 only — bound the growth.
                if (cur.length > 50) cur = cur.slice(-50);
                localStorage.setItem(key, JSON.stringify(cur));
              } catch(_) { /* don't fail the user action over a storage error */ }
              setSupportSent(true);
              try { toastSuccess('📨 Message sent'); } catch(_){}
            },
            style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}
          },'Send Message'),
          // FAQ section
          React.createElement('div',{style:{marginTop:'28px'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'12px'}},'Common Questions'),
            [
              ['How do I top up coins?','Go to your wallet (coin icon in the top bar) and choose a coin package.'],
              ['How do calls work?','Tap an expert\'s profile, press Call. Coins are deducted per minute. Balance runs out = call ends.'],
              ['Can I get a refund?','Unused coins can be refunded within 7 days of purchase. Contact us with your order details.'],
              ['How do I become an expert?','Go to Settings → Become an Expert and fill in the form. We review in 2–3 business days.'],
            ].map(function(faq,i){
              return React.createElement('div',{key:i,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'13px 14px',marginBottom:'8px'}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'4px'}},faq[0]),
                React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5}},faq[1])
              );
            })
          )
        )
  );

  // ── ACCOUNT SETTINGS SCREEN ──
  if(showAcct) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    // Header
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowAcct(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Account Settings')
    ),
    React.createElement('div',{style:{padding:'16px 18px',flex:1,overflowY:'auto'}},
      // Profile Info section
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Profile Info'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{marginBottom:'14px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Display Name'),
          React.createElement('input',{type:'text',value:acctName,onChange:function(e){setAcctName(e.target.value);},placeholder:'Your display name',style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}})
        ),
        React.createElement('div',{style:{marginBottom:'14px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Tag / Title'),
          React.createElement('input',{type:'text',value:acctTag,onChange:function(e){setAcctTag(e.target.value);},placeholder:'e.g. Software Engineer',style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}})
        ),
        React.createElement('button',{
          onClick:function(){
            try{localStorage.setItem('acct_name',acctName);localStorage.setItem('acct_tag',acctTag);}catch(e){}
            if(userId){
              // FIX #1 (P0 data-loss): re-fetch latest bio JSON, DEEP-MERGE only
              // the fields this button owns onto it, then write back. Previously
              // we built a fresh object with 4 keys which clobbered notif_prefs,
              // sound_prefs, cover_url, expert_request, location, etc.
              sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r){
                var existing={};
                try{
                  if(r && r.data && r.data.bio){
                    var b=(typeof r.data.bio==='string')?JSON.parse(r.data.bio):r.data.bio;
                    if(b && typeof b==='object') existing=b;
                  }
                }catch(_){}
                var merged=Object.assign({},existing,{
                  about: (profileInfo.about!==undefined?profileInfo.about:existing.about)||'',
                  tag: acctTag,
                  website_name: (profileInfo.website_name!==undefined?profileInfo.website_name:existing.website_name)||'',
                  website_url: (profileInfo.website_url!==undefined?profileInfo.website_url:existing.website_url)||''
                });
                sbProfile.from('profiles').update({full_name:acctName,bio:JSON.stringify(merged)}).eq('id',userId).then(function(r2){if(r2.error)console.error('RingIn Error [saveProfileInfo]:', r2.error);});
              });
            }
            setAcctSaved(true); _scheduleAcctSavedReset(2000); /* R19 FIX #6: ref-tracked timer */
          },
          style:{width:'100%',padding:'11px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer'}
        },acctSaved?'Saved ✓':'Save Profile Info')
      ),
      // R40: Gender section — DROPDOWN with 30-day cooldown.
      (function(){
        /* Compute lock state for the inline lock hint. */
        var locked = false; var daysLeft = 0;
        if (acctGenderChangedAt) {
          var msSince = Date.now() - new Date(acctGenderChangedAt).getTime();
          var daysSince = msSince / (1000 * 60 * 60 * 24);
          if (daysSince < 30) { locked = true; daysLeft = Math.ceil(30 - daysSince); }
        }
        return React.createElement(React.Fragment, null,
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px',display:'flex',alignItems:'center',gap:'6px'}},
            React.createElement('span',null,'Gender'),
            acctGenderSaving ? React.createElement('span',{style:{fontSize:'9px',color:'var(--t3)',textTransform:'none',letterSpacing:0}},'Saving…') : null,
            acctGenderSaved ? React.createElement('span',{style:{fontSize:'9px',color:'#27C96A',textTransform:'none',letterSpacing:0,fontWeight:700}},'Saved ✓') : null
          ),
          React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px',marginBottom:'20px'}},
            React.createElement('select',{
              value: acctGender,
              disabled: locked || acctGenderSaving,
              onChange: function(e){ saveGender(e.target.value); },
              style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid '+(locked?'var(--border)':'var(--border)'),borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',cursor:locked?'not-allowed':(acctGenderSaving?'wait':'pointer'),opacity:locked?0.6:1,appearance:'none',WebkitAppearance:'none',backgroundImage:'linear-gradient(45deg, transparent 50%, var(--t2) 50%), linear-gradient(135deg, var(--t2) 50%, transparent 50%)',backgroundPosition:'calc(100% - 18px) 50%, calc(100% - 13px) 50%',backgroundSize:'5px 5px, 5px 5px',backgroundRepeat:'no-repeat'}
            },
              React.createElement('option', {value:''},     '🤫 Rather not say'),
              React.createElement('option', {value:'f'},    '👧 Girl'),
              React.createElement('option', {value:'m'},    '👦 Boy'),
              React.createElement('option', {value:'other'},'🌈 Other')
            ),
            locked
              ? React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginTop:'10px',lineHeight:1.5}},
                  '🔒 You can change your gender again in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '. Limit: one change per 30 days.'
                )
              : React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginTop:'10px',lineHeight:1.5}},
                  acctGenderChangedAt
                    ? 'You can change this once. Next change unlocks after 30 days.'
                    : 'You can change this once free, then one change per 30 days after.'
                )
          )
        );
      })(),
      // Contact section
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Contact'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Phone Number'),
        React.createElement('div',{style:{display:'flex',gap:'8px'}},
          React.createElement('button',{
            onClick:function(){setShowPhoneCodePicker(true);setAcctCountrySearch('');},
            style:{padding:'12px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}
          },acctPhoneCode),
          React.createElement('input',{type:'tel',value:acctPhone,onChange:function(e){setAcctPhone(e.target.value); /* R18: safeSetItem on every keystroke */ safeSetItem('acct_phone',e.target.value);},placeholder:'Phone number',style:{flex:1,padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}})
        )
      ),
      // Location section
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Location'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Country'),
        React.createElement('div',{style:{position:'relative'}},
          React.createElement('input',{
            type:'text',
            value:acctCountrySearch!=null&&showCountryPicker?acctCountrySearch:acctCountry,
            placeholder:'Type to search country...',
            onChange:function(e){setAcctCountrySearch(e.target.value);setShowCountryPicker(true);},
            onFocus:function(){setAcctCountrySearch('');setShowCountryPicker(true);},
            onBlur:function(){setTimeout(function(){setShowCountryPicker(false);},150);},
            style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid '+(showCountryPicker?'var(--ac)':'var(--border)'),borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
          }),
          showCountryPicker ? React.createElement('div',{
            style:{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'12px',zIndex:999,maxHeight:'220px',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}
          },
            (function(){
              var filtered=COUNTRIES.filter(function(c){return !acctCountrySearch||c[1].toLowerCase().includes(acctCountrySearch.toLowerCase());});
              if(!filtered.length) return React.createElement('div',{style:{padding:'14px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'No countries found');
              return filtered.map(function(c){
                var sel=acctCountry===c[1];
                return React.createElement('div',{
                  key:c[0],
                  onMouseDown:function(){setAcctCountry(c[1]); /* R18: safeSetItem */ safeSetItem('acct_country',c[1]);setShowCountryPicker(false);setAcctCountrySearch('');},
                  style:{padding:'11px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:sel?'rgba(123,110,255,0.12)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}
                },
                  React.createElement('span',{style:{fontSize:'14px',color:'var(--text)',fontWeight:sel?600:400}},c[1]),
                  sel?React.createElement('span',{style:{color:'var(--ac)',fontSize:'14px',fontWeight:700}},'✓'):null
                );
              });
            })()
          ) : null
        )
      ),
      // Timezone section
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Time Zone'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Your Timezone'),
        React.createElement('button',{
          onClick:function(){setShowTzPicker(true);setTzSearch('');},
          style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}
        },
          React.createElement('span',null,(function(){var tz=TIMEZONES.find(function(t){return t[0]===acctTz;});return tz?tz[1]:acctTz;})()),
          React.createElement('span',{style:{color:'var(--t3)',fontSize:'12px'}},'▼')
        ),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',fontStyle:'italic'}},'This setting controls how times appear across the app')
      ),
      /* R65: Real Friends Community section ─ home language, hometown,
       * current city. These are the fields the Friends tab + discovery
       * cards use. Writing goes through update_friends_profile RPC
       * (the same RPC the Friends setup modal uses) so we never hit
       * R58's column-level REVOKE wall. */
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px',display:'flex',alignItems:'center',gap:'6px'}},
        React.createElement('span',null,'Community · Real Friends'),
        acctCommunitySaving ? React.createElement('span',{style:{fontSize:'9px',color:'var(--t3)',textTransform:'none',letterSpacing:0}},'Saving…') : null,
        acctCommunitySaved ? React.createElement('span',{style:{fontSize:'9px',color:'#27C96A',textTransform:'none',letterSpacing:0,fontWeight:700}},'Saved ✓') : null
      ),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginBottom:'12px',lineHeight:1.5}}, 'Used on the Friends tab to find people from your community in your city.'),
        /* Home Language dropdown */
        React.createElement('div',{style:{marginBottom:'14px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Home Language'),
          React.createElement('select',{
            value: acctHomeLang,
            onChange: function(e){ setAcctHomeLang(e.target.value); },
            style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',appearance:'none',WebkitAppearance:'none',backgroundImage:'linear-gradient(45deg, transparent 50%, var(--t2) 50%), linear-gradient(135deg, var(--t2) 50%, transparent 50%)',backgroundPosition:'calc(100% - 18px) 50%, calc(100% - 13px) 50%',backgroundSize:'5px 5px, 5px 5px',backgroundRepeat:'no-repeat'}
          },
            React.createElement('option',{value:''},'Select…'),
            React.createElement('option',{value:'malayalam'},'Malayalam'),
            React.createElement('option',{value:'tamil'},'Tamil'),
            React.createElement('option',{value:'telugu'},'Telugu'),
            React.createElement('option',{value:'kannada'},'Kannada'),
            React.createElement('option',{value:'hindi'},'Hindi'),
            React.createElement('option',{value:'punjabi'},'Punjabi'),
            React.createElement('option',{value:'bengali'},'Bengali'),
            React.createElement('option',{value:'marathi'},'Marathi'),
            React.createElement('option',{value:'gujarati'},'Gujarati'),
            React.createElement('option',{value:'arabic'},'Arabic'),
            React.createElement('option',{value:'urdu'},'Urdu'),
            React.createElement('option',{value:'english'},'English')
          )
        ),
        /* Hometown text input */
        React.createElement('div',{style:{marginBottom:'14px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Hometown'),
          React.createElement('input',{
            type:'text',
            value: acctHomeTown,
            onChange: function(e){ setAcctHomeTown(e.target.value); },
            placeholder: 'e.g. Kochi, Chennai, Lahore',
            style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
          })
        ),
        /* Current City text input */
        React.createElement('div',{style:{marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Current City'),
          React.createElement('input',{
            type:'text',
            value: acctCurrentCity,
            onChange: function(e){ setAcctCurrentCity(e.target.value); },
            placeholder: 'e.g. Dubai, Bangalore, London',
            style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
          })
        ),
        /* Save button */
        React.createElement('button',{
          onClick: function(){
            if (acctCommunitySaving) return;
            setAcctCommunitySaving(true);
            setAcctCommunitySaved(false);
            sbProfile.rpc('update_friends_profile', {
              p_home_language: (acctHomeLang || '').trim() || null,
              p_home_town:     (acctHomeTown || '').trim() || null,
              p_current_city:  (acctCurrentCity || '').trim() || null,
              p_occupation:    null,
              p_interests:     null,
              p_gender:        null
            }).then(function(r){
              setAcctCommunitySaving(false);
              if (r && r.error) {
                console.error('RingIn Error [saveCommunity]:', r.error);
                return;
              }
              setAcctCommunitySaved(true);
              setTimeout(function(){ setAcctCommunitySaved(false); }, 2000);
            }).catch(function(e){
              setAcctCommunitySaving(false);
              console.error('RingIn Error [saveCommunity]:', e);
            });
          },
          disabled: acctCommunitySaving,
          style:{width:'100%',padding:'11px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor: acctCommunitySaving ? 'wait' : 'pointer',opacity: acctCommunitySaving ? 0.6 : 1}
        }, acctCommunitySaved ? 'Saved ✓' : (acctCommunitySaving ? 'Saving…' : 'Save Community Info'))
      ),
      // Save All button
      React.createElement('button',{
        onClick:function(){
          try{localStorage.setItem('acct_name',acctName);localStorage.setItem('acct_tag',acctTag);localStorage.setItem('acct_country',acctCountry);localStorage.setItem('acct_phone_code',acctPhoneCode);localStorage.setItem('acct_phone',acctPhone);}catch(e){}
          if(userId){
            // Re-fetch latest bio first, MERGE, then write — prevents clobbering other settings
            sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r){
              var bioJson={};
              try{bioJson=JSON.parse((r.data&&r.data.bio)||'{}');}catch(e){}
              // Merge existing fields with new account settings
              bioJson.about = profileInfo.about || bioJson.about || '';
              bioJson.tag = acctTag;
              bioJson.website_name = profileInfo.website_name || bioJson.website_name || '';
              bioJson.website_url = profileInfo.website_url || bioJson.website_url || '';
              // ALSO persist country / phone / timezone to location JSON (cross-device sync)
              // FIX #4: timezone was missing — prefill at line ~650 reads loc.timezone
              // so we must include it on write or cross-device sync breaks.
              bioJson.location = Object.assign({}, bioJson.location || {}, {
                country_name: acctCountry,
                dial: acctPhoneCode,
                phone: acctPhone,
                timezone: acctTz,
              });
              sbProfile.from('profiles').update({full_name:acctName,bio:JSON.stringify(bioJson)}).eq('id',userId).then(function(r2){
                if(r2.error){
                  console.error('RingIn Error [saveAll]:', r2.error);
                  // ROUND 8 FIX #1: only acknowledge save on confirmed success
                  try{ toastError('Failed to save — try again'); }catch(_){ }
                  return;
                }
                // ROUND 8 FIX #1: ack moved INSIDE success branch (was firing before write)
                setAcctSaved(true); _scheduleAcctSavedReset(2500); /* R19 FIX #6: ref-tracked timer */
              });
            });
          } else {
            // No userId — local-only save still acknowledges
            setAcctSaved(true); _scheduleAcctSavedReset(2500); /* R19 FIX #6: ref-tracked timer */
          }
        },
        style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer',marginBottom:'30px'}
      },acctSaved?'All Saved ✓':'Save All'),
    ),
    // Country Picker Modal
    // Phone Code Picker Modal
    showPhoneCodePicker ? React.createElement('div',{
      onClick:function(){setShowPhoneCodePicker(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.55)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:'480px',maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 -8px 32px rgba(0,0,0,0.4)'}},
        React.createElement('div',{style:{padding:'16px 16px 10px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'10px'}},
          React.createElement('input',{autoFocus:true,type:'text',value:acctCountrySearch,onChange:function(e){setAcctCountrySearch(e.target.value);},placeholder:'Search country code...',style:{flex:1,padding:'10px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}}),
          React.createElement('button',{onClick:function(){setShowPhoneCodePicker(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'14px',fontWeight:600,cursor:'pointer',padding:'4px 8px'}},'Done')
        ),
        React.createElement('div',{key:'plist-'+acctCountrySearch,style:{overflowY:'auto',flex:1}},
          // R17 FIX #4: empty-state mirrors inline country picker pattern at ~line 1345.
          (function(){
            var filtered=COUNTRIES.filter(function(c){return !acctCountrySearch||c[1].toLowerCase().includes(acctCountrySearch.toLowerCase())||c[2].includes(acctCountrySearch);});
            if(!filtered.length) return React.createElement('div',{style:{padding:'14px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'No matches');
            return filtered.map(function(c){
              var sel=acctPhoneCode===c[2];
              return React.createElement('div',{key:c[0],onClick:function(){setAcctPhoneCode(c[2]); /* R18: safeSetItem */ safeSetItem('acct_phone_code',c[2]);setShowPhoneCodePicker(false);setAcctCountrySearch('');},
                style:{padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:sel?'rgba(123,110,255,0.1)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}},
                React.createElement('span',{style:{fontSize:'14px',color:'var(--text)',fontWeight:sel?600:400}},c[1]),
                React.createElement('span',{style:{fontSize:'13px',color:sel?'var(--ac)':'var(--t2)',fontWeight:sel?700:400}},c[2])
              );
            });
          })()
        )
      )
    ) : null,
    // Timezone Picker Modal
    showTzPicker ? React.createElement('div',{
      onClick:function(){setShowTzPicker(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.55)',zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:'480px',maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 -8px 32px rgba(0,0,0,0.4)'}},
        React.createElement('div',{style:{padding:'16px 16px 10px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'10px'}},
          React.createElement('input',{autoFocus:true,type:'text',value:tzSearch,onChange:function(e){setTzSearch(e.target.value);},placeholder:'Search timezone...',style:{flex:1,padding:'10px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}}),
          React.createElement('button',{onClick:function(){setShowTzPicker(false);},style:{background:'none',border:'none',color:'var(--t2)',fontSize:'14px',fontWeight:600,cursor:'pointer',padding:'4px 8px'}},'Done')
        ),
        React.createElement('div',{key:'tzlist-'+tzSearch,style:{overflowY:'auto',flex:1}},
          // R17 FIX #4: empty-state mirrors inline country picker pattern at ~line 1345.
          (function(){
            var filtered=TIMEZONES.filter(function(t){return !tzSearch||t[1].toLowerCase().includes(tzSearch.toLowerCase())||t[0].toLowerCase().includes(tzSearch.toLowerCase());});
            if(!filtered.length) return React.createElement('div',{style:{padding:'14px',textAlign:'center',color:'var(--t3)',fontSize:'13px'}},'No matches');
            return filtered.map(function(t){
              var sel=acctTz===t[0];
              return React.createElement('div',{key:t[0],onClick:function(){setAcctTz(t[0]);try{localStorage.setItem('user_timezone',t[0]);}catch(e){}setShowTzPicker(false);setTzSearch('');},
                style:{padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:sel?'rgba(123,110,255,0.1)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}},
                React.createElement('span',{style:{fontSize:'13px',color:'var(--text)',fontWeight:sel?600:400}},t[1]),
                sel?React.createElement('span',{style:{color:'var(--ac)',fontSize:'16px'}},'✓'):null
              );
            });
          })()
        )
      )
    ) : null
  );

  // ── NOTIFICATION SETTINGS SCREEN ──
  if(showNotif) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowNotif(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Notification Settings')
    ),
    React.createElement('div',{style:{padding:'16px 18px'}},
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Push Notifications'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'20px'}},
        [
          {label:'Likes on your posts',sub:'When someone likes your post',val:notifLikes,key:'notif_likes',set:setNotifLikes},
          {label:'Comments on your posts',sub:'When someone comments on your post',val:notifComments,key:'notif_comments',set:setNotifComments},
          {label:'New followers',sub:'When someone follows you',val:notifFollows,key:'notif_follows',set:setNotifFollows},
          {label:'Call requests',sub:'When an expert calls you',val:notifCalls,key:'notif_calls',set:setNotifCalls},
          {label:'New messages',sub:'When you receive a message',val:notifMsgs,key:'notif_msgs',set:setNotifMsgs},
          {label:'Upcoming workshops',sub:'Reminders for workshops you joined',val:notifWorkshops,key:'notif_workshops',set:setNotifWorkshops},
          {label:'Promotions & offers',sub:'Special deals and app updates',val:notifPromo,key:'notif_promo',set:setNotifPromo},
        ].map(function(row,i,arr){
          return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}},
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'2px'}},row.label),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},row.sub)
            ),
            React.createElement('button',{
              onClick:function(){
                var n=!row.val;
                row.set(n);
                try{localStorage.setItem(row.key,n?'1':'0');}catch(e){}
                // Persist to profiles.bio.notif_prefs JSON — MERGE not replace, and use unified key naming
                if(userId){
                  // Map mobile keys (notif_likes) to unified key (likes) to match website
                  var unifiedKey = row.key.replace(/^notif_/,'');
                  sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r){
                    var bioJson={};
                    try{bioJson=JSON.parse((r.data&&r.data.bio)||'{}');}catch(e){}
                    if(!bioJson.notif_prefs) bioJson.notif_prefs={};
                    // Write both unified and legacy keys for backward compatibility
                    bioJson.notif_prefs[unifiedKey]=n;
                    bioJson.notif_prefs[row.key]=n;
                    sbProfile.from('profiles').update({bio:JSON.stringify(bioJson)}).eq('id',userId).then(function(){});
                  });
                  // T2.13 — also write to the proper notification_prefs table
                  // (migration 0015). Column name follows notify_<key> convention.
                  // Falls back silently if migration isn't applied.
                  try {
                    var col = 'notify_' + unifiedKey;
                    var patch = { user_id: userId };
                    patch[col] = n;
                    sbProfile.from('notification_prefs').upsert([patch], { onConflict: 'user_id' }).then(function(){});
                  } catch(_) {}
                }
              },
              style:{width:'46px',height:'26px',borderRadius:'13px',background:row.val?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
            },
              React.createElement('div',{style:{position:'absolute',top:'3px',left:row.val?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
            )
          );
        })
      ),
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Email Notifications'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'20px'}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px'}},
          React.createElement('div',{style:{flex:1}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'2px'}},'Email me updates'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Receive important updates and newsletters by email')
          ),
          React.createElement('button',{
            onClick:function(){var n=!notifEmail;setNotifEmail(n);try{localStorage.setItem('notif_email',n?'1':'0');}catch(e){}},
            style:{width:'46px',height:'26px',borderRadius:'13px',background:notifEmail?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
          },
            React.createElement('div',{style:{position:'absolute',top:'3px',left:notifEmail?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
          )
        )
      )
    )
  );

  // ── T2.7: CLOSE FRIENDS MANAGER SCREEN ──
  if(showCloseFriends) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{
        onClick:function(){setShowCloseFriends(false);setCfSearch('');},
        style:{background:'none',border:'none',color:'var(--text)',fontSize:'18px',cursor:'pointer'}
      },'←'),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Close Friends')
    ),
    React.createElement('div',{style:{padding:'14px 18px',color:'var(--t2)',fontSize:'12px',lineHeight:1.5,borderBottom:'1px solid var(--border)'}},
      'People on this list see your Close-Friends-only moments. They are NOT notified when you add or remove them.'
    ),
    // Current list
    closeFriendsList.size > 0 ? React.createElement('div',null,
      React.createElement('div',{style:{padding:'12px 18px 6px',fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px'}},
        'On your list · ' + closeFriendsList.size
      ),
      Array.from(closeFriendsList).map(function(fid){
        return React.createElement('div',{
          key:fid,
          style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px 18px',borderBottom:'1px solid var(--border)'}
        },
          React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#27C96A,#1FA858)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'12px',flexShrink:0}}, '★'),
          React.createElement('div',{style:{flex:1,fontSize:'12px',color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, fid.substring(0, 16) + '…'),
          React.createElement('button',{
            onClick:function(){ removeCloseFriend(fid).catch(function(e){ try{toastError('Failed to remove: '+(e&&e.message));}catch(_){} }); },
            style:{padding:'5px 10px',background:'rgba(239,71,71,0.12)',border:'1px solid rgba(239,71,71,0.3)',borderRadius:'8px',color:'#ef4747',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          },'Remove')
        );
      })
    ) : React.createElement('div',{style:{textAlign:'center',padding:'30px 18px',color:'var(--t3)',fontSize:'12px'}},'Your list is empty. Search below to add people.'),
    // Search to add
    React.createElement('div',{style:{padding:'14px 18px 8px',borderTop:'1px solid var(--border)'}},
      React.createElement('div',{style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}, 'Add people'),
      React.createElement('input',{
        value:cfSearch,
        onChange:function(e){setCfSearch(e.target.value);},
        placeholder:'Search by name or email…',
        style:{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'9px 12px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
      })
    ),
    React.createElement('div',{style:{padding:'4px 18px 80px'}},
      cfPeople.map(function(p){
        var alreadyOn = closeFriendsList.has(p.id);
        var name = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split('@')[0] : 'User');
        return React.createElement('div',{
          key:p.id,
          style:{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid var(--border)'}
        },
          React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'12px',flexShrink:0}},
            p.avatar_url ? React.createElement('img',{src:p.avatar_url,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : name.substring(0,2).toUpperCase()
          ),
          React.createElement('div',{style:{flex:1,fontSize:'13px',color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, name),
          React.createElement('button',{
            onClick:function(){
              if (alreadyOn) {
                removeCloseFriend(p.id).catch(function(e){ try{toastError('Failed: '+(e&&e.message));}catch(_){} });
              } else {
                addCloseFriend(p.id).catch(function(e){ try{toastError('Failed: '+(e&&e.message));}catch(_){} });
              }
            },
            style:{padding:'6px 12px',background:alreadyOn?'rgba(239,71,71,0.12)':'rgba(39,201,106,0.12)',border:'1px solid '+(alreadyOn?'rgba(239,71,71,0.3)':'rgba(39,201,106,0.4)'),borderRadius:'8px',color:alreadyOn?'#ef4747':'#27C96A',fontSize:'11px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, alreadyOn ? 'Remove' : '+ Add')
        );
      })
    )
  );

  // ── PRIVACY SCREEN ──
  if(showPrivacy) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowPrivacy(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Privacy & Security')
    ),
    React.createElement('div',{style:{padding:'16px 18px'}},

      // ── Password Section (two-tab) ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Account Security'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        // Tab switcher
        React.createElement('div',{style:{display:'flex',background:'var(--bg4)',borderRadius:'10px',padding:'3px',marginBottom:'14px'}},
          React.createElement('button',{onClick:function(){setPwMode('reset');setPwChangeErr('');setPwChangeDone(false);},style:{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:pwMode==='reset'?'var(--bg3)':'transparent',color:pwMode==='reset'?'var(--text)':'var(--t2)',fontSize:'12px',fontWeight:pwMode==='reset'?700:500,cursor:'pointer',transition:'all 0.15s'}},'Reset via Email'),
          React.createElement('button',{onClick:function(){setPwMode('change');setPwResetErr('');setPwResetSent(false);},style:{flex:1,padding:'8px',borderRadius:'8px',border:'none',background:pwMode==='change'?'var(--bg3)':'transparent',color:pwMode==='change'?'var(--text)':'var(--t2)',fontSize:'12px',fontWeight:pwMode==='change'?700:500,cursor:'pointer',transition:'all 0.15s'}},'Change Password')
        ),
        pwMode==='reset'
          ? React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',marginBottom:'10px'}},'We\'ll send a reset link to your email address.'),
              pwResetSent
                ? React.createElement('div',{style:{textAlign:'center',padding:'8px'}},
                    React.createElement('div',{style:{fontSize:'28px',marginBottom:'6px'}},'📧'),
                    React.createElement('div',{style:{fontSize:'13px',color:'#27C96A',fontWeight:600}},'Reset link sent! Check your inbox.')
                  )
                : React.createElement('div',null,
                    React.createElement('input',{type:'email',value:pwResetEmail||email,onChange:function(e){setPwResetEmail(e.target.value);},placeholder:'Email address',style:{width:'100%',padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',marginBottom:'10px',fontFamily:'inherit',boxSizing:'border-box'}}),
                    React.createElement('button',{
                      disabled:pwResetLoad,
                      onClick:function(){
                        var addr=(pwResetEmail||email).trim();
                        if(!addr){setPwResetErr('Enter your email');return;}
                        setPwResetLoad(true); setPwResetErr('');
                        // R16 FIX #6: resetPasswordForEmail had no .catch — if
                        // the network rejected, setPwResetLoad(true) was never
                        // cleared and the "Sending…" button stayed disabled.
                        /* R23: use the live origin instead of hardcoded production URL.
                         * On the deployed website this resolves to the website itself
                         * (correct). On the Capacitor APK the WebView runs at
                         * https://localhost so we explicitly fall back to the prod URL
                         * — the appUrlOpen listener in App.js handles the round-trip
                         * back into the native app via Android App Links / custom scheme. */
                        var _resetRedirect = (function(){
                          try{
                            var loc = (typeof window !== 'undefined') ? window.location : null;
                            var host = loc && loc.hostname;
                            // Inside Capacitor WebView the hostname is 'localhost' — use the prod URL.
                            if (!host || host === 'localhost' || host === '') return 'https://ring-in.vercel.app/reset-password';
                            return loc.origin + '/reset-password';
                          }catch(_){ return 'https://ring-in.vercel.app/reset-password'; }
                        })();
                        sbProfile.auth.resetPasswordForEmail(addr,{redirectTo:_resetRedirect}).then(function(res){
                          setPwResetLoad(false);
                          if(res.error) setPwResetErr(res.error.message);
                          else setPwResetSent(true);
                        }).catch(function(e){
                          setPwResetLoad(false);
                          console.warn('[ringin] resetPasswordForEmail reject:', e);
                          try{ toastError('Failed to send reset email — check connection'); }catch(_){}
                        });
                      },
                      style:{width:'100%',padding:'12px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:pwResetLoad?0.6:1}
                    },pwResetLoad?'Sending…':'Send Reset Link'),
                    pwResetErr?React.createElement('div',{style:{fontSize:'12px',color:'#ef4747',marginTop:'8px',textAlign:'center'}},pwResetErr):null
                  )
            )
          : React.createElement('div',null,
              pwChangeDone
                ? React.createElement('div',{style:{textAlign:'center',padding:'12px'}},
                    React.createElement('div',{style:{fontSize:'36px',marginBottom:'8px'}},'✅'),
                    React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},'Password changed!'),
                    React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},'Your password has been updated successfully.'),
                    React.createElement('button',{onClick:function(){setPwChangeDone(false);setPwCurrent('');setPwNew('');setPwConfirm('');setPwChangeErr('');},style:{marginTop:'12px',padding:'8px 20px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer'}},'Done')
                  )
                : React.createElement('div',null,
                    React.createElement('div',{style:{marginBottom:'10px'}},
                      React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'5px'}},'Current Password'),
                      React.createElement('input',{type:'password',value:pwCurrent,onChange:function(e){setPwCurrent(e.target.value);},placeholder:'Enter current password',style:{width:'100%',padding:'11px 13px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}})
                    ),
                    React.createElement('div',{style:{marginBottom:'10px'}},
                      React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'5px'}},'New Password'),
                      React.createElement('input',{type:'password',value:pwNew,onChange:function(e){setPwNew(e.target.value);},placeholder:'Min 8 characters',style:{width:'100%',padding:'11px 13px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}),
                      pwNew.length>0?React.createElement('div',{style:{marginTop:'5px',fontSize:'11px',fontWeight:600,color:pwNew.length>=12?'#27C96A':pwNew.length>=8?'#f5a623':'#ef4747'}},pwNew.length>=12?'Strong password':pwNew.length>=8?'Medium — add more characters':'Weak — needs at least 8 characters'):null
                    ),
                    React.createElement('div',{style:{marginBottom:'14px'}},
                      React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'5px'}},'Confirm New Password'),
                      React.createElement('input',{type:'password',value:pwConfirm,onChange:function(e){setPwConfirm(e.target.value);},placeholder:'Repeat new password',style:{width:'100%',padding:'11px 13px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}})
                    ),
                    pwChangeErr?React.createElement('div',{style:{fontSize:'12px',color:'#ef4747',marginBottom:'10px',textAlign:'center'}},pwChangeErr):null,
                    React.createElement('button',{
                      disabled:pwChangeLoad,
                      onClick:function(){
                        setPwChangeErr('');
                        if(!pwCurrent||!pwNew||!pwConfirm){setPwChangeErr('Please fill in all fields.');return;}
                        if(pwNew===pwCurrent){setPwChangeErr('New password must be different from current.');return;}
                        if(pwNew!==pwConfirm){setPwChangeErr('Passwords do not match.');return;}
                        if(pwNew.length<8){setPwChangeErr('New password must be at least 8 characters.');return;}
                        setPwChangeLoad(true);
                        // R16 FIX #7: nested .then() chain had no .catch — a
                        // rejected signInWithPassword (network drop) left
                        // pwChangeLoad=true and the user stuck on "Changing…".
                        sbProfile.auth.signInWithPassword({email:email,password:pwCurrent}).then(function(res){
                          if(res.error){setPwChangeErr('Current password is incorrect.');setPwChangeLoad(false);return;}
                          sbProfile.auth.updateUser({password:pwNew}).then(function(r){
                            setPwChangeLoad(false);
                            if(r.error){setPwChangeErr(r.error.message);return;}
                            setPwChangeDone(true);
                          }).catch(function(e){
                            setPwChangeLoad(false);
                            console.warn('[ringin] updateUser reject:', e);
                            try{ toastError('Failed to change password — try again'); }catch(_){}
                          });
                        }).catch(function(e){
                          setPwChangeLoad(false);
                          console.warn('[ringin] pwChange signIn reject:', e);
                          try{ toastError('Failed to change password — try again'); }catch(_){}
                        });
                      },
                      style:{width:'100%',padding:'12px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:pwChangeLoad?0.6:1}
                    },pwChangeLoad?'Changing…':'Change Password')
                  )
            )
      ),

      // ── Profile Visibility ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Profile Visibility'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'20px'}},
        [['public','🌐','Public','Anyone can see your profile and posts'],['followers','👥','Followers Only','Only people you follow back can see your posts'],['private','🔒','Private','Only you can see your posts']].map(function(opt,i,arr){
          var isSelected=profileVis===opt[0];
          return React.createElement('div',{key:opt[0],onClick:function(){
            var newVis = opt[0];
            setProfileVis(newVis);
            try{ localStorage.setItem('profile_vis', newVis); }catch(e){}
            /* R23: persist server-side so the privacy setting is real
             * (previously it was localStorage-only and RLS ignored it).
             * Migration 0016_privacy.sql adds the column + restrictive RLS.
             * Wrapped in try/catch so old envs without the migration still
             * work — the localStorage update above is the fallback. */
            if(userId){
              try{
                sbProfile.from('profiles').update({profile_visibility:newVis}).eq('id',userId).then(function(r){
                  if(r && r.error){
                    console.warn('[ringin] profile_visibility write failed:', r.error.message);
                    try{ toastWarn('Privacy setting saved locally only — DB update failed.'); }catch(_){}
                  }
                }).catch(function(e){ console.warn('[ringin] profile_visibility reject:', e && e.message); });
              }catch(_){}
            }
          },style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',cursor:'pointer',background:isSelected?'rgba(123,110,255,0.08)':'transparent'}},
            React.createElement('span',{style:{fontSize:'20px'}},opt[1]),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},opt[2]),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px'}},opt[3])
            ),
            React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',border:'2px solid '+(isSelected?'var(--ac)':'var(--border)'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
              isSelected?React.createElement('div',{style:{width:'10px',height:'10px',borderRadius:'50%',background:'var(--ac)'}}):null
            )
          );
        })
      ),

      // ── Hide Like Counts (Instagram-style toggle) ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Like Counts'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div',{style:{flex:1,paddingRight:'12px'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},'❤️ Hide Like Counts'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',lineHeight:1.5}},'Hides numeric like counts on posts in your feed. The total stays visible to the post author.')
          ),
          React.createElement('button',{
            onClick:function(){setHideLikesLocal(!hideLikesLocal);},
            style:{width:'46px',height:'26px',borderRadius:'13px',background:hideLikesLocal?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
          },
            React.createElement('div',{style:{position:'absolute',top:'3px',left:hideLikesLocal?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
          )
        )
      ),

      // ── T2.7: Close Friends list manager ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Close Friends'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5,marginBottom:'10px'}},
          'When you post a moment with the ★ Close Friends toggle on, only people on this list will see it. Your moment tile shows a green ring instead of pink.'
        ),
        React.createElement('button',{
          onClick:function(){ setShowCloseFriends(true); },
          style:{padding:'8px 14px',background:'rgba(39,201,106,0.15)',border:'1px solid rgba(39,201,106,0.4)',borderRadius:'10px',color:'#27C96A',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:'6px'}
        },
          React.createElement('span',null,'★ '),
          'Manage Close Friends · ' + closeFriendsList.size
        )
      ),

      // ── Lock Profile ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Follow Requests'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},'🔏 Lock My Profile'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',lineHeight:1.5,maxWidth:'230px'}},'People must send a follow request and you must approve it before they can see your posts and full profile.')
          ),
          React.createElement('button',{
            onClick:function(){
              var n=!profileLocked;
              setProfileLocked(n);
              try{ localStorage.setItem('profile_locked',n?'1':'0'); }catch(e){}
              /* R23: persist server-side. Was localStorage-only; the column
               * was added by migration 0016_privacy.sql. is_locked is a
               * follow-request gate (Instagram-style); the request-approval
               * flow itself is future work but the column is live now. */
              if(userId){
                try{
                  sbProfile.from('profiles').update({is_locked:n}).eq('id',userId).then(function(r){
                    if(r && r.error){
                      console.warn('[ringin] is_locked write failed:', r.error.message);
                      try{ toastWarn('Lock setting saved locally only — DB update failed.'); }catch(_){}
                    }
                  }).catch(function(e){ console.warn('[ringin] is_locked reject:', e && e.message); });
                }catch(_){}
              }
            },
            style:{width:'46px',height:'26px',borderRadius:'13px',background:profileLocked?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
          },
            React.createElement('div',{style:{position:'absolute',top:'3px',left:profileLocked?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
          )
        ),
        profileLocked?React.createElement('div',{style:{marginTop:'8px',padding:'8px 10px',background:'rgba(123,110,255,0.1)',borderRadius:'8px',fontSize:'11px',color:'var(--ac)'}},'✓ Profile is locked — new followers need your approval')
          :React.createElement('div',{style:{marginTop:'8px',padding:'8px 10px',background:'var(--bg4)',borderRadius:'8px',fontSize:'11px',color:'var(--t3)'}},'Profile is open — anyone can follow without approval')
      ),

      // ── Activity Status ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Activity'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'20px'}},
        [
          // FIX #16: guard the server write — without a userId the update
          // would target .eq('id', null) and either fail silently or
          // accidentally hit the wrong row. localStorage write stays.
          {label:'Show Online Status',sub:'Others can see when you\'re active',val:showOnline,toggle:function(){var n=!showOnline;setShowOnline(n);try{localStorage.setItem('show_online',n?'1':'0');}catch(e){}if(!userId) return;sbProfile.from('profiles').update({is_online:n}).eq('id',userId).then(function(r){if(r.error)console.error('RingIn Error [setOnlineStatus]:', r.error);});}},
          {label:'Mute Activity Feed',sub:'Your likes and comments won\'t appear in others\' feeds',val:muteActivity,toggle:function(){var n=!muteActivity;setMuteActivity(n);try{localStorage.setItem('mute_activity',n?'1':'0');}catch(e){}}},
        ].map(function(row,i,arr){
          return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}},
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'2px'}},row.label),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},row.sub)
            ),
            React.createElement('button',{
              onClick:row.toggle,
              style:{width:'46px',height:'26px',borderRadius:'13px',background:row.val?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
            },
              React.createElement('div',{style:{position:'absolute',top:'3px',left:row.val?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
            )
          );
        })
      ),

      // ── Blocked users (placeholder) ──
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Content Controls'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'20px'}},
        [
          {icon:'🚫',label:'Blocked Users',sub:'Manage people you\'ve blocked',fn:function(){setShowBlocked(true);}},
          {icon:'🔇',label:'Muted Words',sub:'Hide posts containing specific words',fn:function(){setShowMuted(true);}},
          {icon:'📥',label:'Download My Data',sub:'Get a copy of your RingIn data',fn:function(){var uid=userId;if(!uid){try{toastWarn('Please log in first');}catch(_){}return;}Promise.all([sbProfile.from('posts').select('*').eq('user_id',uid),sbProfile.from('comments').select('*').eq('user_id',uid)]).then(function(results){var data={exported_at:new Date().toISOString(),user_id:uid,email:email,posts:results[0].data||[],comments:results[1].data||[]};var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='ringin-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);});}},
          {icon:'🗑️',label:'Delete Account',sub:'30-day cooling-off — sign back in to cancel',fn:function(){
            // R23: replaced window.confirm with in-app modal.
            // Just flip the state; modal renders below in showSettings return
            // and runs the RPC on confirm.
            setShowDeleteConfirm(true);
          },red:true},
        ].map(function(item,i,arr){
          return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',cursor:'pointer'}},
            React.createElement('span',{style:{fontSize:'17px',width:'24px',textAlign:'center'}},item.icon),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:item.red?'#ef4747':'var(--text)',marginBottom:'1px'}},item.label),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},item.sub)
            ),
            React.createElement('span',{style:{color:'var(--t3)',fontSize:'14px'}},'>')
          );
        })
      )
    ),
    /* R23: in-app Delete Account confirmation modal — replaces window.confirm
     * which was banned per CLAUDE.md (renders as "ring-in.vercel.app says..."
     * on native shell, breaking the brand). Backdrop click and Cancel both
     * close without deleting; Delete runs the request_account_deletion RPC. */
    showDeleteConfirm ? React.createElement(React.Fragment, null,
      React.createElement('div',{
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:500,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'},
        onClick:function(){ setShowDeleteConfirm(false); }
      }),
      React.createElement('div',{
        onClick:function(e){ e.stopPropagation(); },
        style:{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:501,background:'var(--bg2,#161028)',border:'1px solid var(--border)',borderRadius:'16px',padding:'20px 22px 16px',minWidth:'280px',maxWidth:'340px',boxShadow:'0 16px 48px rgba(0,0,0,0.6)',color:'var(--text)',fontFamily:'inherit'}
      },
        React.createElement('div',{style:{fontSize:'17px',fontWeight:700,marginBottom:'8px',color:'#ef4747'}}, 'Delete your account?'),
        React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5,marginBottom:'16px'}},
          'You will be signed out immediately. You have 30 days to cancel by signing back in. After 30 days your name, email and avatar are permanently scrubbed. Your posts and comments stay, anonymised.'),
        React.createElement('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end'}},
          React.createElement('button',{
            onClick:function(){ setShowDeleteConfirm(false); },
            style:{padding:'10px 16px',borderRadius:'10px',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Cancel'),
          React.createElement('button',{
            onClick:function(){
              setShowDeleteConfirm(false);
              sbProfile.rpc('request_account_deletion').then(function(r){
                if(r.error){
                  console.warn('[ringin] delete account RPC error', r.error);
                  try { toastError('Could not start deletion. Please email support@ringin.app to process manually.', 5500); } catch(_){}
                  return;
                }
                try { sbProfile.auth.signOut(); } catch(_){}
                try { toastSuccess('Account scheduled for deletion. Sign back in within 30 days to cancel.', 5500); } catch(_){}
              }).catch(function(e){
                console.warn('[ringin] delete account RPC reject', e);
                try { toastError('Network error — please email support@ringin.app to delete manually.', 5500); } catch(_){}
              });
            },
            style:{padding:'10px 16px',borderRadius:'10px',background:'#ef4747',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
          }, 'Delete')
        )
      )
    ) : null
  );

  if(showSound){
    var SOUND_ORDER=['typing','emoji','send','like','likeThumb','notification'];
    function updateSoundPref(type,key,val){
      setSoundPrefs(function(prev){
        var next=Object.assign({},prev);
        next[type]=Object.assign({},prev[type],{[key]:val});
        saveSoundPrefs(next);
        // Also persist to profiles.bio.sound_prefs for cross-device sync (merge, not replace)
        if(userId){
          sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r){
            var bioJson={};
            try{bioJson=JSON.parse((r.data&&r.data.bio)||'{}');}catch(e){}
            bioJson.sound_prefs = next;
            sbProfile.from('profiles').update({bio:JSON.stringify(bioJson)}).eq('id',userId).then(function(){});
          });
        }
        return next;
      });
    }
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowSound(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Sound & Haptics'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Customize sounds for every action')
        )
      ),
      React.createElement('div',{style:{padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}},
        // ── Haptics global toggle card ──────────────────────────────────────
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'16px',padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},
            React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'12px',background:hapticsOn?'linear-gradient(135deg,#7B6EFF22,#E84D9A22)':'var(--bg4)',border:'1px solid '+(hapticsOn?'var(--ac)':'var(--border)'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',transition:'all 0.2s'}},'📳'),
            React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}},'Haptics'),
              React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px'}},hapticsOn?'Vibration on for likes, messages & alerts':'Vibration is off')
            )
          ),
          React.createElement('div',{
            onClick:function(){
              var next=!hapticsOn;
              setHapticsOn(next);
              setHapticsEnabled(next);
              // Confirmation pulse when turning on
              if(next){try{navigator.vibrate&&navigator.vibrate([15,8,25]);}catch(e){}}
            },
            style:{width:'50px',height:'28px',borderRadius:'14px',background:hapticsOn?'linear-gradient(135deg,#7B6EFF,#E84D9A)':'var(--border)',cursor:'pointer',position:'relative',transition:'background 0.25s',flexShrink:0}
          },
            React.createElement('div',{style:{position:'absolute',top:'3px',left:hapticsOn?'24px':'3px',width:'22px',height:'22px',borderRadius:'50%',background:'#fff',transition:'left 0.25s',boxShadow:'0 2px 6px rgba(0,0,0,0.35)'}})
          )
        ),
        // ── Test row (always-fire, bypasses prefs so user can verify hardware) ───
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'16px',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px'}},
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}},'Test'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px'}}, isHapticSupported() ? 'Tap to verify your device' : 'Vibration is not supported on iOS browsers — sound only')
          ),
          React.createElement('button',{
            // FIX #15: use the user's actually-selected notification variant
            // instead of always forcing variant 0. Previously the Test button
            // never matched what the user heard from real notifications.
            onClick:function(){
              var notifPref = (soundPrefs && soundPrefs.notification) || {variant:0};
              forceSound('notification', notifPref.variant || 0);
            },
            style:{padding:'9px 14px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
          },'🔊 Sound'),
          React.createElement('button',{
            onClick:function(){
              var ok = forceHaptic([40, 30, 80]);
              if(!ok){
                // Fall back to a quick visual nudge — alert is acceptable here since the
                // user explicitly asked to test and we have no other channel to report.
                try { toastInfo('Vibration is not supported on this device/browser.'); } catch(e){}
              }
            },
            disabled: !isHapticSupported(),
            style:{padding:'9px 14px',background: isHapticSupported() ? 'var(--bg4)' : 'var(--bg2)',border:'1px solid '+(isHapticSupported()?'var(--border)':'var(--bg4)'),borderRadius:'10px',color: isHapticSupported() ? 'var(--text)' : 'var(--t3)',fontSize:'12px',fontWeight:700,cursor: isHapticSupported() ? 'pointer' : 'not-allowed',flexShrink:0,opacity: isHapticSupported() ? 1 : 0.55}
          },'📳 Haptic')
        ),
        // ── Per-sound cards ─────────────────────────────────────────────────
        SOUND_ORDER.map(function(type){
          var meta=SOUND_META[type];
          var pref=soundPrefs[type]||{variant:0,volume:0.55,enabled:true};
          return React.createElement('div',{key:type,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'16px',padding:'14px',opacity:pref.enabled?1:0.5,transition:'opacity 0.2s'}},
            // Header row
            React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}},
              React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px'}},
                React.createElement('span',{style:{fontSize:'20px'}},meta.icon),
                React.createElement('div',null,
                  React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}},meta.label),
                  React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},meta.variants[pref.variant])
                )
              ),
              // Enable toggle
              React.createElement('div',{
                onClick:function(){updateSoundPref(type,'enabled',!pref.enabled);},
                style:{width:'42px',height:'24px',borderRadius:'12px',background:pref.enabled?'linear-gradient(135deg,#7B6EFF,#E84D9A)':'var(--border)',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}
              },
                React.createElement('div',{style:{position:'absolute',top:'2px',left:pref.enabled?'20px':'2px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
              )
            ),
            // Variant buttons
            React.createElement('div',{style:{display:'flex',gap:'6px',marginBottom:'12px'}},
              meta.variants.map(function(name,idx){
                var active=pref.variant===idx;
                return React.createElement('button',{key:idx,
                  onClick:function(){
                    updateSoundPref(type,'variant',idx);
                    previewSound(type,idx,pref.volume);
                  },
                  style:{flex:1,padding:'7px 4px',borderRadius:'10px',border:'1px solid '+(active?'transparent':'var(--border)'),background:active?'linear-gradient(135deg,#7B6EFF,#E84D9A)':'var(--bg4)',color:active?'#fff':'var(--t2)',fontSize:'11px',fontWeight:active?700:500,cursor:'pointer',transition:'all 0.18s'}
                },name);
              })
            ),
            // Volume slider
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px'}},
              React.createElement('span',{style:{fontSize:'13px',minWidth:'16px'}},pref.volume<0.1?'🔇':pref.volume<0.5?'🔉':'🔊'),
              React.createElement('input',{
                type:'range',min:'0',max:'1',step:'0.01',
                value:pref.volume,
                onChange:function(e){
                  var v=parseFloat(e.target.value);
                  updateSoundPref(type,'volume',v);
                },
                onMouseUp:function(e){previewSound(type,pref.variant,parseFloat(e.target.value));},
                // FIX #14: was reading stale closure pref.volume — should
                // match onMouseUp and read the slider's actual final value.
                onTouchEnd:function(e){previewSound(type,pref.variant,parseFloat(e.target.value));},
                style:{flex:1,accentColor:'#7B6EFF',height:'4px',cursor:'pointer'}
              }),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)',minWidth:'30px',textAlign:'right'}},Math.round(pref.volume*100)+'%')
            )
          );
        })
      )
    );
  }

  // Leaderboard sub-view — renders the parallel LeaderboardScreen component,
  // which owns its own header (incl. a back button via the onBack prop).
  if(showLeaderboard) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement(LeaderboardScreen,{onBack:function(){setShowLeaderboard(false);}})
  );

  // Invite & Earn sub-view (migration 0056). All RPCs already wrapped above /
  // in the claim handler — if the migration is unrun the stats simply read as 0
  // and Claim toasts a friendly error rather than crashing.
  if(showInvite) {
    var refCode = (referral && referral.code) ? String(referral.code) : '';
    var refLink = 'https://ring-in.vercel.app/?ref=' + encodeURIComponent(refCode);
    var waText = 'Join me on RingIn! Use my code ' + refCode + ' to get started. ' + refLink;
    var statRows = [
      {l:'Referrals qualified', v:(referral && referral.qualified != null) ? referral.qualified : 0},
      {l:'Coins earned', v:(referral && referral.coins_earned != null) ? referral.coins_earned : 0},
      {l:'Giveaway entries', v:(referral && referral.giveaway_entries != null) ? referral.giveaway_entries : 0}
    ];
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowInvite(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Invite & Earn'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Invite friends & win a great giveaway 🎁')
        )
      ),
      React.createElement('div',{style:{padding:'16px',display:'flex',flexDirection:'column',gap:'16px'}},
        referralLoading && !referral
          ? React.createElement('div',{style:{textAlign:'center',padding:'40px 24px',color:'var(--t2)',fontSize:'14px'}},'Loading…')
          : !refCode
            ? React.createElement('div',{style:{textAlign:'center',padding:'40px 24px',color:'var(--t2)',fontSize:'14px'}},
                React.createElement('div',{style:{fontSize:'40px',marginBottom:'12px'}},'🎁'),
                React.createElement('div',{style:{fontWeight:600,marginBottom:'6px',color:'var(--text)'}},'Invites coming soon'),
                React.createElement('div',null,'Check back shortly to grab your invite code.')
              )
            : React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'16px'}},
                // Code card
                React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'18px',textAlign:'center'}},
                  React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Your invite code'),
                  React.createElement('div',{style:{fontSize:'26px',fontWeight:800,color:'var(--text)',letterSpacing:'2px'}},refCode)
                ),
                // Share on WhatsApp
                React.createElement('button',{
                  onClick:function(){ try{ window.open('https://wa.me/?text=' + encodeURIComponent(waText), '_blank'); }catch(_){} },
                  style:{width:'100%',padding:'14px',background:'#25D366',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}
                },'💬 Share on WhatsApp'),
                // Copy link
                React.createElement('button',{
                  onClick:function(){ copyToClipboardWithToast(refLink, 'Invite link copied!'); },
                  style:{width:'100%',padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer'}
                },'🔗 Copy link'),
                // Stats
                React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden'}},
                  statRows.map(function(r,i){
                    return React.createElement('div',{key:r.l,style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',borderBottom:i<statRows.length-1?'1px solid var(--border)':'none'}},
                      React.createElement('span',{style:{fontSize:'13px',color:'var(--t2)'}},r.l),
                      React.createElement('span',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}},fmtStatCount(r.v))
                    );
                  })
                ),
                // Claim rewards
                React.createElement('button',{
                  disabled: referralClaiming,
                  onClick:function(){
                    if (referralClaiming) return;
                    setReferralClaiming(true);
                    try {
                      sbProfile.rpc('claim_referral_reward').then(function(r){
                        setReferralClaiming(false);
                        if (r && r.error) { try{ toastError('Nothing to claim yet'); }catch(_){} return; }
                        try{ toastSuccess('Rewards claimed! 🎉'); }catch(_){}
                        // Refresh stats after a successful claim.
                        try { sbProfile.rpc('get_my_referral_code').then(function(rr){
                          if (rr && !rr.error && rr.data) { var d2 = Array.isArray(rr.data)?rr.data[0]:rr.data; if (typeof d2==='string') setReferral({code:d2}); else if (d2) setReferral(d2); }
                        }).catch(function(){}); } catch(_){}
                      }).catch(function(){ setReferralClaiming(false); try{ toastError('Could not claim right now'); }catch(_){} });
                    } catch(_){ setReferralClaiming(false); }
                  },
                  style:{width:'100%',padding:'14px',background:'var(--ac)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:referralClaiming?'default':'pointer',opacity:referralClaiming?0.6:1}
                }, referralClaiming ? 'Claiming…' : 'Claim rewards'),
                React.createElement('div',{style:{textAlign:'center',fontSize:'12px',color:'var(--t2)',lineHeight:1.5}},'Invite friends & win a great giveaway 🎁')
              )
      )
    );
  }

  if(showBlocked) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowBlocked(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Blocked Users'),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'People you have blocked')
      )
    ),
    React.createElement('div',{style:{padding:'16px'}},
      blockedList.length===0
        ? React.createElement('div',{style:{textAlign:'center',padding:'48px 24px',color:'var(--t2)',fontSize:'14px'}},
            React.createElement('div',{style:{fontSize:'40px',marginBottom:'12px'}},'🚫'),
            React.createElement('div',{style:{fontWeight:600,marginBottom:'6px',color:'var(--text)'}},'No blocked users'),
            React.createElement('div',null,'You haven\'t blocked anyone.')
          )
        : React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden'}},
            // BUG FIX (was: blockedList iterated as objects with .id and .name,
            // but MessagesScreen.js stores plain user-ID strings via blocked.push(otherId).
            // Result: name shows undefined and Unblock button removed ALL entries
            // because u.id !== user.id was undefined !== undefined === false.)
            // Normalise each entry to a {id, name} shape regardless of how it was stored.
            blockedList.map(function(rawEntry, i){
              var entry = (typeof rawEntry === 'string')
                ? { id: rawEntry, name: null }
                : { id: (rawEntry && (rawEntry.id || rawEntry.user_id)) || ('row-' + i), name: (rawEntry && rawEntry.name) || null };
              var displayName = entry.name || (entry.id ? (entry.id.length > 12 ? entry.id.slice(0,8) + '…' : entry.id) : 'Unknown user');
              var initStr = entry.name ? entry.name.substring(0,2).toUpperCase() : (entry.id ? entry.id.substring(0,2).toUpperCase() : '??');
              return React.createElement('div',{key:entry.id+'_'+i,style:{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:i<blockedList.length-1?'1px solid var(--border)':'none'}},
                React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff'}},initStr),
                React.createElement('div',{style:{flex:1,minWidth:0}},
                  React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},displayName)
                ),
                React.createElement('button',{
                  onClick:function(){
                    // Compare against THIS row's normalised id, AND keep both
                    // string and object entries that don't match.
                    var newList = blockedList.filter(function(u){
                      var uid = (typeof u === 'string') ? u : (u && (u.id || u.user_id));
                      return uid !== entry.id;
                    });
                    setBlockedList(newList);
                    try{ localStorage.setItem('ringin_blocked', JSON.stringify(newList)); }catch(e){}
                    /* R19 FIX #2: broadcast so HomeScreen feed + Moments + MessagesScreen send-guard re-read */
                    try { window.dispatchEvent(new CustomEvent('ringin-blocks-changed', { detail: { source: 'profile-unblock' } })); } catch(_){}
                  },
                  style:{padding:'7px 14px',background:'rgba(239,71,71,0.12)',border:'1px solid rgba(239,71,71,0.3)',borderRadius:'8px',color:'#ef4747',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0}
                },'Unblock')
              );
            })
          )
    )
  );

  if(showMuted) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowMuted(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Muted Words'),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Hide posts containing these words')
      )
    ),
    React.createElement('div',{style:{padding:'16px',display:'flex',flexDirection:'column',gap:'16px'}},
      React.createElement('div',{style:{display:'flex',gap:'10px'}},
        React.createElement('input',{
          type:'text',
          value:mutedInput,
          onChange:function(e){setMutedInput(e.target.value);},
          onKeyDown:function(e){
            /* FIX #2: IME composition guard */
            if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && mutedInput.trim()){
              var word=mutedInput.trim().toLowerCase();
              if(!mutedWords.includes(word)){
                var newList=mutedWords.concat([word]);
                setMutedWords(newList);
                try{localStorage.setItem('ringin_muted_words',JSON.stringify(newList));}catch(e){}
              }
              setMutedInput('');
            }
          },
          placeholder:'Add a word to mute...',
          style:{flex:1,padding:'11px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}
        }),
        React.createElement('button',{
          onClick:function(){
            var word=mutedInput.trim().toLowerCase();
            if(!word) return;
            if(!mutedWords.includes(word)){
              var newList=mutedWords.concat([word]);
              setMutedWords(newList);
              try{localStorage.setItem('ringin_muted_words',JSON.stringify(newList));}catch(e){}
            }
            setMutedInput('');
          },
          style:{padding:'11px 18px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',flexShrink:0}
        },'Add')
      ),
      mutedWords.length===0
        ? React.createElement('div',{style:{textAlign:'center',padding:'32px 24px',color:'var(--t2)',fontSize:'13px'}},
            React.createElement('div',{style:{fontSize:'36px',marginBottom:'10px'}},'🔇'),
            React.createElement('div',{style:{fontWeight:600,marginBottom:'4px',color:'var(--text)'}},'No muted words'),
            React.createElement('div',null,'Add words to hide posts containing them.')
          )
        : React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'8px'}},
            mutedWords.map(function(word,i){
              return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'6px',padding:'7px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px'}},
                React.createElement('span',{style:{fontSize:'13px',fontWeight:500,color:'var(--text)'}},'🔇 '+word),
                React.createElement('button',{
                  onClick:function(){
                    var newList=mutedWords.filter(function(w){return w!==word;});
                    setMutedWords(newList);
                    try{localStorage.setItem('ringin_muted_words',JSON.stringify(newList));}catch(e){}
                  },
                  style:{background:'none',border:'none',color:'var(--t2)',fontSize:'15px',cursor:'pointer',padding:'0',lineHeight:1,display:'flex',alignItems:'center'}
                },'✕')
              );
            })
          )
    )
  );

  /* R26: load the admin verification queue (pending requests). Called when
   * the admin opens the review screen. Reads the verification_pending_queue
   * view which joins request + applicant profile. */
  function loadAdminQueue(){
    setAdminQueueLoading(true);
    sbProfile.from('verification_pending_queue').select('*').then(function(r){
      setAdminQueueLoading(false);
      if (r && !r.error && Array.isArray(r.data)) setAdminQueue(r.data);
      else { setAdminQueue([]); if (r && r.error) console.warn('[ringin] admin queue error:', r.error.message); }
    }).catch(function(e){ setAdminQueueLoading(false); console.warn('[ringin] admin queue reject:', e && e.message); });
  }

  /* R26: VERIFICATION APPLICATION screen. Any user applies for a verified
   * badge here. Captures the details the admin uses to vet genuineness:
   * Instagram + other socials, follower count, category, and a reason.
   * On submit → upsert verification_requests (status defaults to 'pending').
   * If the request is already 'approved', this screen shows the PAY step
   * (yearly fee in coins) instead of the form. */
  if(showVerifyApp){
    var VERIF_CATEGORIES = [
      {key:'influencer',     label:'Influencer'},
      {key:'creator',        label:'Content Creator'},
      {key:'expert',         label:'Expert / Professional'},
      {key:'business',       label:'Business / Brand'},
      {key:'public_figure',  label:'Public Figure'},
      {key:'other',          label:'Other'},
    ];
    function submitVerification(){
      if (!userId) { try { toastWarn('Please log in first'); } catch(_){} return; }
      if (!vfInsta.trim() && !vfYoutube.trim() && !vfTiktok.trim() && !vfTwitter.trim()) {
        try { toastWarn('Add at least one social link so we can verify you'); } catch(_){} return;
      }
      if (!vfReason.trim()) { try { toastWarn('Tell us why you want to be verified'); } catch(_){} return; }
      setVfSubmitting(true);
      var payload = {
        user_id: userId,
        status: 'pending',
        full_name: (vfName || (profileInfo && profileInfo.name) || '').slice(0,120),
        category: vfCategory,
        instagram_url: vfInsta.trim() || null,
        youtube_url: vfYoutube.trim() || null,
        tiktok_url: vfTiktok.trim() || null,
        twitter_url: vfTwitter.trim() || null,
        follower_count: parseInt(vfFollowers, 10) || null,
        follower_platform: vfFollowerPlatform,
        reason: vfReason.trim().slice(0,500),
        submitted_at: new Date().toISOString(),
      };
      sbProfile.from('verification_requests').upsert(payload, { onConflict: 'user_id' }).then(function(r){
        setVfSubmitting(false);
        if (r && r.error) { console.error('[ringin] verif submit error:', r.error); try { toastError('Could not submit: ' + (r.error.message||'unknown')); } catch(_){} return; }
        setVerifStatus('pending');
        try { toastSuccess('Application submitted! We\'ll review it shortly.'); } catch(_){}
      }).catch(function(e){ setVfSubmitting(false); console.warn('[ringin] verif submit reject:', e&&e.message); try { toastError('Network error — try again'); } catch(_){} });
    }
    function payVerificationFee(){
      setVfPaying(true);
      sbProfile.rpc('pay_verification_fee').then(function(r){
        setVfPaying(false);
        if (r && r.error) { console.error('[ringin] pay verif error:', r.error); try { toastError(r.error.message && r.error.message.indexOf('insufficient')>=0 ? 'Not enough coins — top up your wallet first' : ('Payment failed: ' + (r.error.message||'unknown'))); } catch(_){} return; }
        setIsVerified(true);
        if (r && r.data && r.data.verified_until) setVerifiedUntil(r.data.verified_until);
        setShowVerifyApp(false);
        try { toastSuccess('🎉 You\'re verified! Your badge is live for 1 year. You can now offer subscriptions.'); } catch(_){}
      }).catch(function(e){ setVfPaying(false); console.warn('[ringin] pay verif reject:', e&&e.message); try { toastError('Network error — try again'); } catch(_){} });
    }
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowVerifyApp(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Get Verified'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, verifStatus==='pending'?'Under review':verifStatus==='approved'?'Approved — payment pending':'Apply for a verified badge')
        )
      ),
      React.createElement('div',{style:{padding:'16px 18px 80px'}},
        // ── APPROVED → PAY step ──
        verifStatus === 'approved' ? React.createElement('div',null,
          React.createElement('div',{style:{textAlign:'center',padding:'24px 16px',background:'linear-gradient(135deg,rgba(29,158,117,0.15),rgba(39,201,106,0.08))',border:'1px solid rgba(39,201,106,0.4)',borderRadius:'16px',marginBottom:'18px'}},
            React.createElement('div',{style:{fontSize:'42px',marginBottom:'8px'}},'✅'),
            React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},'You\'re approved!'),
            React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5}},'Pay the yearly verification fee to activate your blue badge. It stays live for 12 months.')
          ),
          React.createElement('div',{style:{textAlign:'center',padding:'18px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'26px',fontWeight:800,color:'var(--text)'}}, VERIF_FEE_COINS + ' coins'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'2px'}},'per year · ≈ ₹999 / SAR 49')
          ),
          React.createElement('button',{
            onClick:payVerificationFee, disabled:vfPaying,
            style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#1D9E75,#27C96A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:vfPaying?'wait':'pointer',opacity:vfPaying?0.7:1,fontFamily:'inherit'}
          }, vfPaying ? 'Processing…' : ('Pay ' + VERIF_FEE_COINS + ' coins & activate badge')),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textAlign:'center',marginTop:'8px'}},'Real-money yearly billing wires up in v1.5. For now the fee is paid in coins.')
        ) :
        // ── PENDING state ──
        verifStatus === 'pending' ? React.createElement('div',{style:{textAlign:'center',padding:'40px 20px'}},
          React.createElement('div',{style:{fontSize:'42px',marginBottom:'12px'}},'⏳'),
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}},'Application under review'),
          React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.55,maxWidth:'280px',margin:'0 auto'}},'We\'re reviewing your verification request. You\'ll be able to pay the yearly fee and activate your badge once it\'s approved.')
        ) :
        // ── APPLICATION FORM (none / rejected) ──
        React.createElement('div',null,
          verifStatus === 'rejected' ? React.createElement('div',{style:{padding:'12px 14px',background:'rgba(239,71,71,0.1)',border:'1px solid rgba(239,71,71,0.3)',borderRadius:'10px',marginBottom:'16px',fontSize:'12px',color:'#ef4747'}},'Your previous application wasn\'t approved. You can update your details and re-apply below.') : null,
          React.createElement('div',{style:{background:'linear-gradient(135deg,rgba(24,119,242,0.12),rgba(66,179,255,0.08))',border:'1px solid rgba(24,119,242,0.3)',borderRadius:'14px',padding:'14px 16px',marginBottom:'18px'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}},'✔️  Why get verified?'),
            React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.55}},'A blue verified badge builds trust and unlocks Creator Subscriptions so your fans can subscribe to you monthly. Yearly fee applies once approved.')
          ),
          // Full name
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Full Name'),
          React.createElement('input',{value:vfName||((profileInfo&&profileInfo.name)||''),onChange:function(e){setVfName(e.target.value);},placeholder:'Your real name',style:{width:'100%',padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'16px'}}),
          // Category
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Category'),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'16px'}},
            VERIF_CATEGORIES.map(function(c){
              var sel = vfCategory === c.key;
              return React.createElement('button',{key:c.key,onClick:function(){setVfCategory(c.key);},style:{padding:'8px 12px',border:sel?'2px solid var(--ac)':'1px solid var(--border)',background:sel?'rgba(123,110,255,0.12)':'var(--bg3)',color:sel?'var(--ac)':'var(--text)',borderRadius:'20px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}, c.label);
            })
          ),
          // Instagram (primary)
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Instagram Profile Link'),
          React.createElement('input',{value:vfInsta,onChange:function(e){setVfInsta(e.target.value);},placeholder:'https://instagram.com/yourhandle',style:{width:'100%',padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'16px'}}),
          // Other socials
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Other Links (optional)'),
          React.createElement('input',{value:vfYoutube,onChange:function(e){setVfYoutube(e.target.value);},placeholder:'YouTube channel link',style:{width:'100%',padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'8px'}}),
          React.createElement('input',{value:vfTiktok,onChange:function(e){setVfTiktok(e.target.value);},placeholder:'TikTok profile link',style:{width:'100%',padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'8px'}}),
          React.createElement('input',{value:vfTwitter,onChange:function(e){setVfTwitter(e.target.value);},placeholder:'X / Twitter profile link',style:{width:'100%',padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'16px'}}),
          // Follower count + platform
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Follower Count'),
          React.createElement('div',{style:{display:'flex',gap:'8px',marginBottom:'16px'}},
            React.createElement('input',{type:'number',value:vfFollowers,onChange:function(e){setVfFollowers(e.target.value);},placeholder:'e.g. 25000',style:{flex:1,padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}),
            React.createElement('select',{value:vfFollowerPlatform,onChange:function(e){setVfFollowerPlatform(e.target.value);},style:{padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',fontFamily:'inherit'}},
              ['Instagram','YouTube','TikTok','X/Twitter','Facebook','Other'].map(function(p){return React.createElement('option',{key:p,value:p},p);})
            )
          ),
          // Reason
          React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px'}},'Why do you want to be verified?'),
          React.createElement('textarea',{value:vfReason,onChange:function(e){setVfReason(e.target.value.slice(0,500));},placeholder:'Tell us about yourself and why you should get a verified badge.',maxLength:500,style:{width:'100%',minHeight:'90px',padding:'12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'4px'}}),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textAlign:'right',marginBottom:'18px'}}, vfReason.length + ' / 500'),
          // Submit
          React.createElement('button',{
            onClick:submitVerification, disabled:vfSubmitting,
            style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#1877F2,#42B3FF)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:vfSubmitting?'wait':'pointer',opacity:vfSubmitting?0.7:1,fontFamily:'inherit',boxShadow:'0 4px 16px rgba(24,119,242,0.3)'}
          }, vfSubmitting ? 'Submitting…' : (verifStatus==='rejected'?'Re-apply for Verification':'Submit Application'))
        )
      )
    );
  }

  /* R26: ADMIN VERIFICATION REVIEW screen. Only reachable by is_admin users
   * (the tile is gated, and the RPCs re-check admin server-side). Lists
   * pending requests with applicant profile + social links + reason +
   * follower count, and Approve / Reject buttons. */
  if(showAdminReview){
    function reviewAction(reqId, action){
      var rpc = action === 'approve' ? 'approve_verification' : 'reject_verification';
      var args = action === 'approve' ? { req_id: reqId } : { req_id: reqId, notes: 'Rejected by admin' };
      sbProfile.rpc(rpc, args).then(function(r){
        if (r && r.error) { console.error('[ringin] review error:', r.error); try { toastError('Action failed: ' + (r.error.message||'unknown')); } catch(_){} return; }
        try { toastSuccess(action === 'approve' ? 'Approved — user can now pay & activate' : 'Rejected'); } catch(_){}
        // Remove from local queue
        setAdminQueue(function(prev){ return (prev||[]).filter(function(x){ return x.id !== reqId; }); });
      }).catch(function(e){ console.warn('[ringin] review reject:', e&&e.message); try { toastError('Network error'); } catch(_){} });
    }
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowAdminReview(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Verification Review'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, adminQueueLoading ? 'Loading…' : ((adminQueue&&adminQueue.length||0) + ' pending'))
        ),
        React.createElement('button',{onClick:loadAdminQueue,style:{marginLeft:'auto',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'12px',padding:'6px 12px',cursor:'pointer',fontFamily:'inherit'}},'↻ Refresh')
      ),
      React.createElement('div',{style:{padding:'14px 16px 80px'}},
        adminQueueLoading ? React.createElement('div',{style:{textAlign:'center',padding:'40px',color:'var(--t3)',fontSize:'13px'}},'Loading requests…') :
        (!adminQueue || adminQueue.length === 0) ? React.createElement('div',{style:{textAlign:'center',padding:'50px 20px'}},
          React.createElement('div',{style:{fontSize:'40px',marginBottom:'10px'}},'✅'),
          React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'var(--text)',marginBottom:'4px'}},'No pending requests'),
          React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},'New verification applications will appear here.')
        ) :
        adminQueue.map(function(req){
          return React.createElement('div',{key:req.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px',marginBottom:'12px'}},
            // Applicant header
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}},
              React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:'14px',overflow:'hidden',flexShrink:0}},
                req.profile_avatar ? React.createElement('img',{src:req.profile_avatar,alt:'',style:{width:'100%',height:'100%',objectFit:'cover'}}) : ((req.full_name||req.profile_name||'?').substring(0,2).toUpperCase())
              ),
              React.createElement('div',{style:{flex:1,minWidth:0}},
                React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)'}}, req.full_name || req.profile_name || 'Unknown'),
                React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, (req.category||'—') + ' · ' + (req.follower_count ? (Number(req.follower_count).toLocaleString() + ' followers on ' + (req.follower_platform||'?')) : 'no follower count'))
              )
            ),
            // Reason
            req.reason ? React.createElement('div',{style:{fontSize:'12px',color:'var(--text)',lineHeight:1.5,padding:'10px 12px',background:'var(--bg4)',borderRadius:'8px',marginBottom:'10px',fontStyle:'italic'}}, '"' + req.reason + '"') : null,
            // Links
            React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'12px'}},
              [['Instagram',req.instagram_url],['YouTube',req.youtube_url],['TikTok',req.tiktok_url],['X',req.twitter_url]].filter(function(l){return l[1];}).map(function(l){
                return React.createElement('a',{key:l[0],href:l[1],target:'_blank',rel:'noreferrer noopener',style:{fontSize:'11px',padding:'5px 10px',background:'rgba(24,119,242,0.12)',border:'1px solid rgba(24,119,242,0.3)',borderRadius:'8px',color:'#42B3FF',textDecoration:'none',fontWeight:600}}, '↗ ' + l[0]);
              })
            ),
            // Actions
            React.createElement('div',{style:{display:'flex',gap:'8px'}},
              React.createElement('button',{onClick:function(){reviewAction(req.id,'reject');},style:{flex:1,padding:'10px',background:'rgba(239,71,71,0.12)',border:'1px solid rgba(239,71,71,0.4)',borderRadius:'10px',color:'#ef4747',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}},'Reject'),
              React.createElement('button',{onClick:function(){reviewAction(req.id,'approve');},style:{flex:1,padding:'10px',background:'linear-gradient(135deg,#1D9E75,#27C96A)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}},'Approve')
            )
          );
        })
      )
    );
  }

  /* R25: Creator Subscriptions Manager screen — verified experts only.
   * Lets the creator enable/disable subscriptions, pick a price tier from
   * a fixed picklist (Instagram pattern), choose perks, set a trial period,
   * and add a public description shown on the Subscribe modal.
   *
   * Price picklist is currency-aware: INR shows ₹99/₹199/₹499/₹999/₹1,999;
   * SAR shows SAR 5/19/49/99/199; USD shows $0.99/$1.99/$4.99/$9.99/$19.99.
   * The stored value is always integer cents (price_cents) + currency code.
   *
   * Save flow: UPSERT to creator_subscriptions_offered. RLS enforces that
   * the creator_id matches auth.uid() AND the user is a verified expert.
   * Client + server both gate this — defence in depth. */
  /* ════════ R50: Creator Studio screen ════════ */
  if (showCreatorStudio) {
    /* The catalog used in the "earnings per gift" preview. Mirrors the
     * gift catalog in AnonymousConnect.js + CallScreen.js so the rates
     * shown to the creator match what the server actually credits. */
    var STUDIO_CATALOG = [
      { emoji:'🍵', name:'Chai',        tier:'sticker', coins:5 },
      { emoji:'☕', name:'Coffee',      tier:'sticker', coins:10 },
      { emoji:'👋', name:'Wave',        tier:'sticker', coins:10 },
      { emoji:'❤️', name:'Heart',       tier:'sticker', coins:15 },
      { emoji:'🥤', name:'Shake',       tier:'sticker', coins:20 },
      { emoji:'🌹', name:'Rose',        tier:'sticker', coins:25 },
      { emoji:'🍦', name:'Ice Cream',   tier:'sticker', coins:30 },
      { emoji:'🍭', name:'Lollipop',    tier:'premium', coins:40 },
      { emoji:'🎂', name:'Cake',        tier:'premium', coins:50 },
      { emoji:'💋', name:'Kiss',        tier:'premium', coins:100 },
      { emoji:'👑', name:'Crown',       tier:'premium', coins:200 },
      { emoji:'🏎',  name:'Sports Car',  tier:'mega', coins:500 },
      { emoji:'🏰', name:'Castle',      tier:'mega', coins:1000 },
      { emoji:'💎', name:'Diamond',     tier:'mega', coins:2000 },
    ];
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      /* Header */
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowCreatorStudio(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}},
          React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
            React.createElement('polyline',{points:'15 18 9 12 15 6'})
          )
        ),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}}, 'Creator Studio'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, 'Your earnings + how the splits work')
        )
      ),
      React.createElement('div',{style:{padding:'18px',flex:1,overflowY:'auto'}},
        /* Big balance card */
        React.createElement('div',{style:{padding:'22px 20px',background:'linear-gradient(135deg,rgba(123,110,255,0.18),rgba(232,77,154,0.12))',border:'1px solid rgba(123,110,255,0.4)',borderRadius:'16px',marginBottom:'18px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'10px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'4px'}}, 'Your Neon Balance'),
          React.createElement('div',{style:{fontSize:'44px',fontWeight:800,color:'var(--text)',fontFamily:'Syne, sans-serif',lineHeight:1.1,letterSpacing:'-1px'}}, neonLoading ? '…' : ('✨ ' + (neonSummary.balance||0).toLocaleString())),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',marginTop:'6px'}}, '1 Neon = ₹1 at cashout'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginTop:'4px',fontStyle:'italic'}}, 'Withdrawal opens at 5,000 Neons')
        ),
        /* Two-stat row: lifetime + last 30 days */
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'22px'}},
          React.createElement('div',{style:{padding:'14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px',fontWeight:700}}, 'Last 30 days'),
            React.createElement('div',{style:{fontSize:'18px',fontWeight:800,color:'var(--text)'}}, '✨ ' + (neonSummary.last_30_days||0).toLocaleString())
          ),
          React.createElement('div',{style:{padding:'14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',textAlign:'center'}},
            React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px',fontWeight:700}}, 'Lifetime earned'),
            React.createElement('div',{style:{fontSize:'18px',fontWeight:800,color:'var(--text)'}}, '✨ ' + (neonSummary.lifetime_earned||0).toLocaleString())
          )
        ),
        /* R51: Per-source earnings breakdown. Shows actual numbers per bucket
         * so the creator sees WHERE their money came from. */
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}, 'Earnings by source'),
        (function(){
          var sources = [
            { key:'subscriptions',   icon:'💜', label:'Subscriptions',  sub:'Monthly subs + post gifts (45%)', accent:'#7B6EFF' },
            { key:'anon_calls',      icon:'📞', label:'Anonymous calls', sub:'In-call gift drawer (40%)',      accent:'#27C96A' },
            { key:'anon_chat_gifts', icon:'💬', label:'Anonymous chat',  sub:'Connection gifts + reactions (40%)', accent:'#E84D9A' },
            { key:'ads',             icon:'📺', label:'Ads revenue',     sub:'Coming soon (10% pool)',         accent:'#FDCB6E' },
          ];
          return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'22px'}},
            sources.map(function(s){
              var src = (neonSummary.by_source && neonSummary.by_source[s.key]) || {lifetime:0, last_30_days:0};
              var dim = s.key === 'ads';
              return React.createElement('div',{
                key:s.key,
                style:{padding:'14px 16px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',display:'flex',alignItems:'center',gap:'12px',opacity: dim ? 0.55 : 1}
              },
                React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'10px',background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}, s.icon),
                React.createElement('div',{style:{flex:1,minWidth:0}},
                  React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, s.label),
                  React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginTop:'1px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, s.sub)
                ),
                React.createElement('div',{style:{textAlign:'right',flexShrink:0}},
                  React.createElement('div',{style:{fontSize:'15px',fontWeight:800,color:s.accent}}, '✨ ' + (src.lifetime||0).toLocaleString()),
                  React.createElement('div',{style:{fontSize:'9px',color:'var(--t3)',marginTop:'2px'}}, (src.last_30_days||0).toLocaleString() + ' last 30d')
                )
              );
            })
          );
        })(),

        /* Split-rate explainer */
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}, 'How earnings work'),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'14px 16px',marginBottom:'20px'}},
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}},
            React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, '💜 Subscriptions'),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, 'Monthly subs + post gifts')
            ),
            React.createElement('div',{style:{fontSize:'14px',fontWeight:800,color:'var(--ac)'}}, '45%')
          ),
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}},
            React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, '🎁 Anonymous gifts'),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, 'Call gifts + chat gifts')
            ),
            React.createElement('div',{style:{fontSize:'14px',fontWeight:800,color:'var(--ac)'}}, '40%')
          ),
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',padding:'8px 0'}},
            React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, '📺 Ad revenue'),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginTop:'2px'}}, 'Coming soon')
            ),
            React.createElement('div',{style:{fontSize:'14px',fontWeight:800,color:'var(--t3)'}}, '10%')
          )
        ),
        /* Per-gift preview — anon rate (40%) since these are the main gift contexts */
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}, 'What you earn per gift (40% on anon)'),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'8px 0',marginBottom:'20px'}},
          STUDIO_CATALOG.map(function(g, i){
            var neonsEarned = Math.floor((g.coins * 40) / 100);
            return React.createElement('div',{key:g.name,style:{display:'flex',alignItems:'center',gap:'12px',padding:'10px 16px',borderBottom: i < STUDIO_CATALOG.length-1 ? '1px solid var(--border)' : 'none'}},
              React.createElement('div',{style:{fontSize:'20px',width:'28px',textAlign:'center'}}, g.emoji),
              React.createElement('div',{style:{flex:1,minWidth:0}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)'}}, g.name),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',marginTop:'1px'}}, 'Fan pays ' + g.coins + ' 🪙')
              ),
              React.createElement('div',{style:{fontSize:'13px',fontWeight:800,color:'var(--ac)'}}, '+' + neonsEarned + ' ✨')
            );
          })
        ),
        /* Withdrawal callout (handled outside this build per user direction) */
        React.createElement('div',{style:{padding:'14px 16px',background:'var(--bg3)',border:'1px dashed var(--border)',borderRadius:'12px'}},
          React.createElement('div',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}}, '💸 Cashout'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',lineHeight:1.5}},
            'When you reach ✨ 5,000 Neons (₹5,000), you can request a UPI payout. The cashout form will open soon — meanwhile your neons accrue safely.'
          )
        )
      )
    );
  }

  if(showSubsMgr) {
    var SUB_TIERS_BY_CURRENCY = {
      'INR': [
        {label:'₹99 / month',  price_cents: 9900,   coins: 99},
        {label:'₹199 / month', price_cents: 19900,  coins: 199},
        {label:'₹499 / month', price_cents: 49900,  coins: 499},
        {label:'₹999 / month', price_cents: 99900,  coins: 999},
        {label:'₹1,999 / month', price_cents: 199900, coins: 1999},
      ],
      'SAR': [
        {label:'SAR 5 / month',  price_cents: 500,   coins: 50},
        {label:'SAR 19 / month', price_cents: 1900,  coins: 190},
        {label:'SAR 49 / month', price_cents: 4900,  coins: 490},
        {label:'SAR 99 / month', price_cents: 9900,  coins: 990},
        {label:'SAR 199 / month',price_cents: 19900, coins: 1990},
      ],
      'USD': [
        {label:'$0.99 / month',  price_cents: 99,    coins: 100},
        {label:'$1.99 / month',  price_cents: 199,   coins: 200},
        {label:'$4.99 / month',  price_cents: 499,   coins: 500},
        {label:'$9.99 / month',  price_cents: 999,   coins: 1000},
        {label:'$19.99 / month', price_cents: 1999,  coins: 2000},
      ],
    };
    var SUB_PERKS = [
      {key:'sub_badge',        icon:'💜', label:'Subscriber badge',         sub:'Purple badge with tenure months next to subscriber\'s name in your rooms + DMs'},
      {key:'priority_queue',   icon:'⚡',       label:'Priority call queue',      sub:'Subs jump the queue + get 10% off your per-minute rate'},
      {key:'sub_only_rooms',   icon:'🎤', label:'Sub-only voice rooms',     sub:'Host private rooms only your subscribers can enter'},
      {key:'sub_only_dms',     icon:'✉',       label:'Sub-only DMs',             sub:'You can reply privately only to subscribers'},
      {key:'sub_only_drops',   icon:'🎧', label:'Sub-only voice drops',     sub:'Recorded voice messages on your profile only subs can play'},
      {key:'entrance_sting',   icon:'🔔', label:'Voice entrance sting',     sub:'A short sound plays when a sub enters your room'},
    ];
    var currentTiers = SUB_TIERS_BY_CURRENCY[subCurrency] || SUB_TIERS_BY_CURRENCY['USD'];
    function togglePerk(key){
      setSubPerks(function(prev){
        if (!Array.isArray(prev)) prev = [];
        if (prev.indexOf(key) >= 0) return prev.filter(function(k){ return k !== key; });
        return prev.concat([key]);
      });
    }
    function saveSubscriptionOffer(){
      if (!userId) { try { toastWarn('Please log in first'); } catch(_){} return; }
      setSubSaving(true);
      var payload = {
        creator_id: userId,
        enabled: !!subEnabledForm,
        price_cents: parseInt(subPriceCents, 10) || 499,
        currency: subCurrency || 'USD',
        coin_gift_price: parseInt(subCoinGiftPrice, 10) || 500,
        trial_days: parseInt(subTrialDays, 10) || 0,
        description: (subDescription || '').slice(0, 280),
        perks: Array.isArray(subPerks) ? subPerks : [],
      };
      sbProfile.from('creator_subscriptions_offered').upsert(payload, { onConflict: 'creator_id' }).then(function(r){
        setSubSaving(false);
        if (r && r.error) {
          console.error('[ringin] sub offer save error:', r.error);
          try { toastError('Could not save: ' + (r.error.message || 'unknown error')); } catch(_){}
          return;
        }
        setSubOffer(Object.assign({}, subOffer || {}, payload));
        try { toastSuccess(subEnabledForm ? 'Subscriptions enabled — your profile now shows a Subscribe button' : 'Subscription offer saved'); } catch(_){}
      }).catch(function(e){
        setSubSaving(false);
        console.warn('[ringin] sub offer save reject:', e && e.message);
        try { toastError('Network error — please try again'); } catch(_){}
      });
    }
    return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
      // Header
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
        React.createElement('button',{onClick:function(){setShowSubsMgr(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
        React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Creator Subscriptions'),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},subOffer && subOffer.enabled ? ('Live · ' + subActiveCount + ' active subscriber' + (subActiveCount===1?'':'s')) : 'Not enabled yet')
        )
      ),
      React.createElement('div',{style:{padding:'16px 18px 80px'}},
        // Top explainer card
        React.createElement('div',{style:{background:'linear-gradient(135deg,rgba(123,110,255,0.12),rgba(232,77,154,0.08))',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'14px',padding:'14px 16px',marginBottom:'16px'}},
          React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'6px'}},'💜  Subscriptions, Instagram-style'),
          React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.55}},
            /* R55-C3: was "You keep 70%" — server actually credits 45% in
             * neons per the dual-token economy launched in R50. Fixed to
             * match reality so creators aren't surprised at cashout. */
            'Pick a monthly price. Subscribers unlock the perks you choose below. You earn 45% of every subscription as ✨ Neons (1 Neon = ₹1 at cashout). Subscribers can cancel anytime; they keep access until the end of the month.')
        ),

        // ── Enable toggle ──
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'14px 16px',marginBottom:'14px',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div',{style:{flex:1,paddingRight:'12px'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},'Enable Subscriptions'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',lineHeight:1.5}},'Show a Subscribe button on your profile so people can subscribe to you')
          ),
          React.createElement('button',{
            onClick:function(){ setSubEnabledForm(!subEnabledForm); },
            style:{width:'46px',height:'26px',borderRadius:'13px',background:subEnabledForm?'var(--ac)':'var(--border)',border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}
          },
            React.createElement('div',{style:{position:'absolute',top:'3px',left:subEnabledForm?'23px':'3px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}})
          )
        ),

        // ── Currency picker ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Currency'),
        React.createElement('div',{style:{display:'flex',gap:'6px',marginBottom:'18px'}},
          ['INR','SAR','USD'].map(function(cur){
            var isSel = subCurrency === cur;
            return React.createElement('button',{
              key:cur,
              onClick:function(){ setSubCurrency(cur); /* reset price to the first tier of new currency */ var tiers = SUB_TIERS_BY_CURRENCY[cur]; if (tiers && tiers.length) { setSubPriceCents(tiers[2].price_cents); setSubCoinGiftPrice(tiers[2].coins); } },
              style:{flex:1,padding:'10px 0',border:isSel?'2px solid var(--ac)':'1px solid var(--border)',background:isSel?'rgba(123,110,255,0.12)':'var(--bg3)',color:isSel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
            }, cur);
          })
        ),

        // ── Price tier picker ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Monthly Subscription Price'),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'18px'}},
          currentTiers.map(function(t, i){
            var isSel = subPriceCents === t.price_cents;
            return React.createElement('div',{
              key:t.label,
              onClick:function(){ setSubPriceCents(t.price_cents); setSubCoinGiftPrice(t.coins); },
              style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',borderBottom:i<currentTiers.length-1?'1px solid var(--border)':'none',cursor:'pointer',background:isSel?'rgba(123,110,255,0.08)':'transparent'}
            },
              React.createElement('div',null,
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}}, t.label),
                /* R55-C3: was 0.70 multiplier ("You receive 70%"); actual
                 * server-side split is 45% neons → 1:1 INR cashout.
                 * Subscription is paid in coins so the displayed math reflects
                 * the coin price × 45% = neons (≈ ₹ at 1:1). */
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',marginTop:'1px'}}, 'You earn ~' + Math.round((t.coins * 0.45)) + ' ✨ Neons per subscriber (' + Math.round(t.coins * 0.45) + ' INR at cashout)')
              ),
              React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'50%',border:'2px solid '+(isSel?'var(--ac)':'var(--border)'),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
                isSel ? React.createElement('div',{style:{width:'10px',height:'10px',borderRadius:'50%',background:'var(--ac)'}}) : null
              )
            );
          })
        ),

        // ── Gift-a-sub coin price (auto-set but editable) ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Gift-a-Sub Price (coins)'),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'14px 16px',marginBottom:'18px'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px'}},
            React.createElement('span',{style:{fontSize:'18px'}},'🪙'),
            React.createElement('input',{
              type:'number',
              value:subCoinGiftPrice,
              onChange:function(e){ setSubCoinGiftPrice(parseInt(e.target.value, 10) || 0); },
              min:1,
              max:1000000,
              style:{flex:1,padding:'8px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}
            }),
            React.createElement('span',{style:{fontSize:'12px',color:'var(--t2)'}},'coins / month')
          ),
          React.createElement('div',{style:{fontSize:'11px',color:'var(--t3)',marginTop:'6px',lineHeight:1.5}},'Friends can gift a 1-month subscription to others using coins. Defaults to match your monthly price.')
        ),

        // ── Perks multi-select ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Subscriber Perks'),
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'18px'}},
          SUB_PERKS.map(function(p, i){
            var isOn = Array.isArray(subPerks) && subPerks.indexOf(p.key) >= 0;
            return React.createElement('div',{
              key:p.key,
              onClick:function(){ togglePerk(p.key); },
              style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px',borderBottom:i<SUB_PERKS.length-1?'1px solid var(--border)':'none',cursor:'pointer'}
            },
              React.createElement('span',{style:{fontSize:'18px',width:'24px',textAlign:'center'}},p.icon),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'2px'}},p.label),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)',lineHeight:1.45}},p.sub)
              ),
              React.createElement('div',{style:{width:'20px',height:'20px',borderRadius:'5px',border:'2px solid '+(isOn?'var(--ac)':'var(--border)'),background:isOn?'var(--ac)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'11px',fontWeight:800,color:'#fff'}}, isOn ? '✓' : '')
            );
          })
        ),

        // ── Trial days ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Free Trial Period'),
        React.createElement('div',{style:{display:'flex',gap:'6px',marginBottom:'18px'}},
          [0,3,7,14].map(function(d){
            var isSel = subTrialDays === d;
            return React.createElement('button',{
              key:d,
              onClick:function(){ setSubTrialDays(d); },
              style:{flex:1,padding:'10px 0',border:isSel?'2px solid var(--ac)':'1px solid var(--border)',background:isSel?'rgba(123,110,255,0.12)':'var(--bg3)',color:isSel?'var(--ac)':'var(--text)',borderRadius:'10px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
            }, d === 0 ? 'None' : (d + ' days'));
          })
        ),

        // ── Description ──
        React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}},'Description (shown on Subscribe button)'),
        React.createElement('textarea',{
          value:subDescription,
          onChange:function(e){ setSubDescription(e.target.value.slice(0, 280)); },
          placeholder:'Tell potential subscribers what they get. e.g., "Weekly voice drops, monthly Q&A rooms, priority on my expert calls."',
          maxLength:280,
          style:{width:'100%',minHeight:'80px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',fontSize:'13px',color:'var(--text)',resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'4px'}
        }),
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)',textAlign:'right',marginBottom:'20px'}}, (subDescription || '').length + ' / 280'),

        // ── Save button ──
        React.createElement('button',{
          onClick:saveSubscriptionOffer,
          disabled:subSaving,
          style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#534AB7,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:subSaving?'wait':'pointer',marginTop:'4px',boxShadow:'0 4px 16px rgba(123,110,255,0.3)',opacity:subSaving?0.7:1,fontFamily:'inherit'}
        }, subSaving ? 'Saving…' : (subOffer ? 'Save Changes' : 'Save & Enable'))
      )
    );
  }

  if(showExpertApp) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button',{onClick:function(){setShowExpertApp(false);setExpertAppSubmitted(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Apply to be an Expert'),
        React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Share your knowledge and earn')
      )
    ),
    expertAppSubmitted
      ? React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,padding:'48px 24px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'56px',marginBottom:'16px'}},'🎉'),
          React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'10px'}},'Application Submitted!'),
          React.createElement('div',{style:{fontSize:'14px',color:'var(--t2)',lineHeight:1.6,maxWidth:'280px'}},'We\'ll review and contact you within 3-5 days.')
        )
      : React.createElement('div',{style:{padding:'16px',display:'flex',flexDirection:'column',gap:'14px'}},
          React.createElement('div',null,
            React.createElement('label',{style:{fontSize:'11px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'6px'}},'Display Name'),
            React.createElement('input',{
              type:'text',value:expertAppName,
              onChange:function(e){setExpertAppName(e.target.value);},
              placeholder:'Your full name',
              style:{width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{style:{fontSize:'11px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'6px'}},'Expertise Area'),
            React.createElement('select',{
              value:expertAppArea,
              onChange:function(e){setExpertAppArea(e.target.value);},
              style:{width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',cursor:'pointer'}
            },
              ['Medical','Legal','Tech','Finance','Mental Health','Fitness','Other'].map(function(opt){
                return React.createElement('option',{key:opt,value:opt},opt);
              })
            )
          ),
          React.createElement('div',null,
            React.createElement('label',{style:{fontSize:'11px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'6px'}},'Short Bio'),
            React.createElement('textarea',{
              value:expertAppBio,
              onChange:function(e){setExpertAppBio(e.target.value);},
              placeholder:'Tell us about your expertise...',
              rows:4,
              style:{width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none',resize:'vertical',fontFamily:'inherit'}
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{style:{fontSize:'11px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'6px'}},'Years of Experience'),
            React.createElement('input',{
              type:'number',value:expertAppExp,min:'0',
              onChange:function(e){setExpertAppExp(e.target.value);},
              placeholder:'e.g. 5',
              style:{width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{style:{fontSize:'11px',fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'6px'}},'Hourly Rate (coins/min)'),
            React.createElement('input',{
              type:'number',value:expertAppRate,min:'0',
              onChange:function(e){setExpertAppRate(e.target.value);},
              placeholder:'e.g. 10',
              style:{width:'100%',boxSizing:'border-box',padding:'12px 14px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'13px',outline:'none'}
            })
          ),
          React.createElement('button',{
            onClick:function(){
              if(!userId){try{toastWarn('Please log in first');}catch(_){}return;}
              // FIX #18: validate all required fields (was: name+bio only)
              if(!expertAppName.trim()||!expertAppBio.trim()||!String(expertAppExp).trim()||!String(expertAppRate).trim()){
                toastError('Please fill in all required fields (name, bio, experience, rate).');
                return;
              }
              // FIX #2 (P0 data-loss): fetch + deep-merge the bio JSON so we
              // don't wipe notif_prefs, sound_prefs, cover_url, location etc.
              // Previously did Object.assign({},profileInfo,{expert_request:...})
              // which used the LOCAL profileInfo (small 4-key object) — dropped
              // every server-only field on the floor.
              sbProfile.from('profiles').select('bio').eq('id',userId).single().then(function(r0){
                var existing={};
                try{
                  if(r0 && r0.data && r0.data.bio){
                    var b=(typeof r0.data.bio==='string')?JSON.parse(r0.data.bio):r0.data.bio;
                    if(b && typeof b==='object') existing=b;
                  }
                }catch(_){}
                var merged=Object.assign({},existing,{
                  expert_request:{name:expertAppName,area:expertAppArea,bio:expertAppBio,exp:expertAppExp,rate:expertAppRate,applied_at:new Date().toISOString()}
                });
                sbProfile.from('profiles').update({bio:JSON.stringify(merged)}).eq('id',userId).then(function(r){
                  if(r.error){console.error('RingIn Error [expertAppSubmit]:', r.error && r.error.message ? r.error.message : 'Unknown error');try{toastError('Something went wrong. Please try again.');}catch(_){}return;}
                  setExpertAppSubmitted(true);
                });
              });
            },
            style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#534AB7,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',marginTop:'4px',boxShadow:'0 4px 16px rgba(123,110,255,0.3)'}
          },'Submit Application')
        )
  );

  if(showStore) return React.createElement(StoreScreen, { sb: sbProfile, userId: userId, onClose: function(){ setShowStore(false); }, onOpenWallet: onOpenWallet });

  if(showSettings) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)'}},
      React.createElement('button',{onClick:function(){setShowSettings(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Settings')
    ),
    React.createElement('div',{style:{padding:'14px 18px'}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        // FIX #3: Settings page stats card now uses the real call count from
        // call_invites (was hardcoded "12"). Rating is shown as em-dash since
        // RingIn doesn't have a review system yet — better than lying with
        // "4.8★". Both values come from the same realCallCount state so we
        // don't double-query.
        [{v:String(realCallCount||0),l:'Calls Made',icon:'📞'},{v:(Number(profileCoinBal)||0).toLocaleString(),l:'Coins',icon:'🪙'},{v:'—',l:'Rating',icon:'⭐'}].map(function(s){
          return React.createElement('div',{key:s.l,
            onClick:function(){if(s.l==='Coins'&&onOpenWallet){setShowSettings(false);onOpenWallet();}},
            style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',textAlign:'center',cursor:s.l==='Coins'?'pointer':'default'}},
            React.createElement('div',{style:{fontSize:'20px',marginBottom:'4px'}},s.icon),
            React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)',marginBottom:'2px'}},s.v),
            React.createElement('div',{style:{fontSize:'9px',color:'var(--t2)'}},s.l)
          );
        })
      ),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}},
        /* R25: Creator Subscriptions tile is dynamically prepended for
         * verified experts. Non-experts don't see the row at all. The
         * Filter pattern below keeps the array literal clean. */
        [
          /* R26: Get Verified tile — shown to everyone who isn't verified yet.
           * Label reflects their current state in the apply→approve→pay flow. */
          !isVerified ? {icon:'✔️',label:'Get Verified',sub:(
            verifStatus === 'pending' ? 'Application under review' :
            verifStatus === 'approved' ? 'Approved! Pay the yearly fee to activate' :
            verifStatus === 'rejected' ? 'Not approved — tap to re-apply' :
            'Apply for a verified badge to unlock subscriptions'
          ),fn:function(){setShowVerifyApp(true);}} : null,
          /* R26: Creator Subscriptions — now gated on is_verified (was expert-only). */
          isVerified ? {icon:'💜',label:'Creator Subscriptions',sub:(subOffer && subOffer.enabled ? ('Active · ' + subActiveCount + ' subscriber' + (subActiveCount===1?'':'s')) : 'Set your monthly price + perks'),fn:function(){setShowSubsMgr(true);}} : null,
          /* R50: Creator Studio — neon balance + earnings preview. Verified only. */
          isVerified ? {icon:'✨',label:'Creator Studio',sub:'Neons earned + earnings breakdown',fn:function(){
            setShowCreatorStudio(true);
            setNeonLoading(true);
            sbProfile.rpc('my_neon_summary').then(function(r){
              setNeonLoading(false);
              if (r && !r.error && r.data) {
                /* R51: extend with by_source breakdown. Fallback to zeros if
                 * migration 0034 hasn't been pasted yet. */
                var bs = (r.data && r.data.by_source) || {};
                setNeonSummary({
                  balance: r.data.balance||0,
                  lifetime_earned: r.data.lifetime_earned||0,
                  last_30_days: r.data.last_30_days||0,
                  by_source: {
                    subscriptions:   (bs.subscriptions    || {lifetime:0,last_30_days:0}),
                    anon_calls:      (bs.anon_calls       || {lifetime:0,last_30_days:0}),
                    anon_chat_gifts: (bs.anon_chat_gifts  || {lifetime:0,last_30_days:0}),
                    ads:             (bs.ads              || {lifetime:0,last_30_days:0})
                  }
                });
              }
            }).catch(function(){ setNeonLoading(false); });
          }} : null,
          /* R26: Admin tile — only for is_admin. Review pending verification requests. */
          isAdmin ? {icon:'🛡️',label:'Verification Review (Admin)',sub:'Approve or reject pending verification requests',fn:function(){setShowAdminReview(true);loadAdminQueue();}} : null,
          {icon:'🎁',label:'Invite & Earn',sub:'Invite friends & win a great giveaway',fn:function(){setShowInvite(true);}},
          {icon:'👤',label:'Account Settings',sub:'Name, phone, country, timezone',fn:function(){setShowAcct(true);}},
          {icon:'🔒',label:'Privacy & Security',sub:'Password, visibility, locked profile',fn:function(){setShowPrivacy(true);}},
          {icon:'🔔',label:'Notification Settings',sub:'Manage your alerts',fn:function(){setShowNotif(true);}},
          {icon:'🔊',label:'Sound & Haptics',sub:'Typing, emoji, send, like, notification sounds',fn:function(){setShowSound(true);}},
          {icon:'📋',label:'Activity Log',sub:'Your logins, posts, likes & more',fn:function(){setShowActivityLog(true);}},
          {icon:'💬',label:'Help & Support',sub:'FAQs and contact us',fn:function(){setShowSupport(true);}},
          {icon:'⭐',label:'Rate the App',sub:'Enjoying RingIn? Let us know!',fn:function(){setShowRate(true);}},
        ].filter(Boolean).map(function(item,i,arr){
          return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 14px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',cursor:'pointer'}},
            React.createElement('span',{style:{fontSize:'18px',width:'28px',textAlign:'center'}},item.icon),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},item.label),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},item.sub)
            ),
            React.createElement('span',{style:{color:'var(--t3)',fontSize:'16px'}},'>')
          );
        })
      ),
      // ── App / version section — sits ABOVE Become an Expert + Sign Out
      // per user request. Two rows: App Version (read-only), Check for
      // Updates (tap to manually check, toggle for auto-update).
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',overflow:'hidden',marginBottom:'16px'}},
        // Row 1: App version (read-only)
        React.createElement('div',{
          style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px',borderBottom:'1px solid var(--border)'}
        },
          React.createElement('span',{style:{fontSize:'17px',width:'24px',textAlign:'center'}},'📦'),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},'App Version'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)',fontFamily:'ui-monospace, monospace'}}, (function(){
              var APK_VERSION = 'v4.39';
              var bundle = '';
              try {
                var v = localStorage.getItem('ringin_ota_current_version');
                if (v && v !== '0.0.0') bundle = v;
              } catch(_){}
              return bundle ? (APK_VERSION + ' · bundle ' + bundle) : (APK_VERSION + ' · built-in');
            })())
          )
        ),
        // Row 2: Check for Updates (tappable) + Automatic Update (toggle)
        React.createElement('div',{
          onClick:function(){
            import('../utils/otaUpdater').then(function(mod){
              if (!mod || typeof mod.checkOnly !== 'function') { try{toastError('Update checker not available.');}catch(_){} return; }
              mod.checkOnly().then(function(r){
                if (r && r.available) {
                  // If auto-update is ON, apply silently. Otherwise show popup.
                  if (mod.getAutoUpdate && mod.getAutoUpdate()) {
                    if (mod.downloadAndApply) {
                      try { window.__ringinPendingOtaUpdate = r; } catch(_){}
                      // Surface the same neon green popup so user sees the
                      // updating overlay flow (even with auto on).
                      try {
                        var ev = new CustomEvent('ringin-sw-update-available', {
                          detail: { source:'ota', version:r.version, title:r.title, notes:r.notes }
                        });
                        window.dispatchEvent(ev);
                      } catch(_){}
                    }
                  } else {
                    try { window.__ringinPendingOtaUpdate = r; } catch(_){}
                    try {
                      var ev2 = new CustomEvent('ringin-sw-update-available', {
                        detail: { source:'ota', version:r.version, title:r.title, notes:r.notes }
                      });
                      window.dispatchEvent(ev2);
                    } catch(_){}
                  }
                } else if (r && r.reason === 'already-current') {
                  /* R21 FIX #5: alert → toast */
                  try { toastSuccess('You are on the latest version (' + (r.current || 'current') + ')'); } catch(_){}
                } else if (r && r.reason === 'web') {
                  try { toastSuccess('PWA: updates apply automatically'); } catch(_){}
                } else {
                  try { toastError('Update check: ' + (r && r.reason ? r.reason : 'unknown')); } catch(_){}
                }
              }).catch(function(err){
                /* R21 FIX #5: alert → toast */
                try { toastError('Update check failed: ' + (err && err.message ? err.message : err)); } catch(_){}
              });
            });
          },
          style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer'}
        },
          React.createElement('span',{style:{fontSize:'17px',width:'24px',textAlign:'center'}},'🔄'),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},'Check for Updates'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}},'Tap to check now')
          ),
          React.createElement('div',{style:{fontSize:'11px',color:'#39FF14',fontWeight:700,textShadow:'0 0 6px rgba(57,255,20,0.5)'}},'CHECK')
        ),
        // Row 3: Automatic Update toggle
        React.createElement('div',{
          style:{display:'flex',alignItems:'center',gap:'12px',padding:'13px 16px'}
        },
          React.createElement('span',{style:{fontSize:'17px',width:'24px',textAlign:'center'}},'⚙️'),
          React.createElement('div',{style:{flex:1,minWidth:0}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',marginBottom:'1px'}},'Automatic Update'),
            React.createElement('div',{style:{fontSize:'11px',color:'var(--t2)'}}, autoUpdate ? 'Updates download in background' : 'Shows a popup when updates are ready')
          ),
          // iOS-style toggle switch
          React.createElement('div',{
            onClick:function(e){
              e.stopPropagation();
              var next = !autoUpdate;
              setAutoUpdate(next);
              try { localStorage.setItem('ringin_ota_auto_update', next ? '1' : '0'); } catch(_){}
            },
            style:{
              width:'46px', height:'26px', borderRadius:'13px',
              background: autoUpdate ? 'linear-gradient(135deg,#39FF14,#00FF7F)' : 'rgba(255,255,255,0.15)',
              position:'relative', cursor:'pointer',
              transition:'background 200ms',
              boxShadow: autoUpdate ? '0 0 10px rgba(57,255,20,0.4)' : 'none',
            }
          },
            React.createElement('div',{
              style:{
                position:'absolute', top:'2px',
                left: autoUpdate ? '22px' : '2px',
                width:'22px', height:'22px', borderRadius:'50%',
                background:'#fff',
                boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                transition:'left 200ms',
              }
            })
          )
        )
      ),
      // Become an Expert card
      React.createElement('div',{
        onClick:function(){setShowExpertApp(true);},
        style:{background:'linear-gradient(135deg,#534AB7,#E84D9A)',borderRadius:'14px',padding:'18px 16px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',boxShadow:'0 4px 20px rgba(123,110,255,0.3)'}
      },
        React.createElement('div',{style:{fontSize:'32px'}},'🎓'),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:'15px',fontWeight:700,color:'#fff',marginBottom:'3px'}},'Become an Expert'),
          React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,0.8)'}},'Share your knowledge and start earning')
        ),
        React.createElement('span',{style:{color:'rgba(255,255,255,0.7)',fontSize:'18px'}},'>')
      ),
      showRate ? React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}},
        rateDone
          ? React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'32px',marginBottom:'8px'}},'🎉'),
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'4px'}},'Thanks for rating us!'),
              React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)'}},rateVal+' stars — we appreciate it!')
            )
          : React.createElement('div',null,
              React.createElement('div',{style:{fontSize:'14px',fontWeight:700,color:'var(--text)',marginBottom:'12px'}},'Rate RingIn'),
              React.createElement('div',{style:{display:'flex',justifyContent:'center',gap:'8px',marginBottom:'16px'}},
                [1,2,3,4,5].map(function(s){
                  return React.createElement('span',{key:s,onClick:function(){setRateVal(s);},style:{fontSize:'32px',cursor:'pointer',opacity:s<=rateVal?1:0.3}},s<=rateVal?'⭐':'☆');
                })
              ),
              rateVal>0 ? React.createElement('button',{onClick:function(){setRateDone(true);},style:{padding:'10px 24px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer'}},'Submit') : null
            )
      ) : null,
      React.createElement('button',{
        onClick:function(){supabase.auth.signOut();},
        style:{width:'100%',padding:'13px',background:'rgba(239,71,71,.1)',border:'1px solid rgba(239,71,71,.3)',borderRadius:'12px',color:'#ef4747',fontSize:'14px',fontWeight:600,cursor:'pointer'}
      },'Sign Out'),
      // Small company-name footer under Sign Out.
      React.createElement('div',{
        style:{textAlign:'center',marginTop:'14px',marginBottom:'8px',fontSize:'10px',color:'var(--t3)',letterSpacing:'0.4px',fontFamily:'inherit'}
      }, 'Webstreax Technologies Pvt Ltd')
    )
  );

  // MAIN PROFILE
  // Equipped THEME re-tints the profile accent (--ac/--acg) across the whole
  // own-profile subtree — tab underline, links, accents inherit it. themeStyle
  // returns null when no theme is equipped, so the merge is a no-op by default.
  return React.createElement('div',{style:Object.assign({display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}, themeStyle(eqTheme)||{})},
    showLikersProf ? React.createElement('div',{
      onClick:function(){setShowLikersProf(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}
    },
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{background:'rgba(22,16,44,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'20px',width:'100%',maxWidth:'360px',maxHeight:'70vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}
      },
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff',marginBottom:'2px'}},
              (function(){
                var p=myPosts.find(function(x){return x.id===showLikersProf;});
                if(!p) return 'Liked by';
                var ids=p.likes.filter(function(l){return typeof l==='string'&&l.length>10;});
                var names=ids.map(function(id){return likersNamesProf[id]?likersNamesProf[id].name:null;}).filter(Boolean);
                var staticNames=p.likeNames||[];
                var allNames=names.length>0?names:staticNames;
                if(p.likes.length===0) return 'Liked by';
                if(allNames.length===0) return p.likes.length+' '+(p.likes.length===1?'like':'likes');
                if(p.likes.length===1) return allNames[0]+' liked this';
                if(p.likes.length===2) return (allNames[0]||'Someone')+' and '+(allNames[1]||'someone')+' liked';
                return (allNames[0]||'Someone')+' and '+(p.likes.length-1)+' others liked';
              })()
            ),
            React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,0.45)'}},
              (function(){var p=myPosts.find(function(x){return x.id===showLikersProf;});return p?p.likes.length+' likes total':'';})()
            )
          ),
          React.createElement('button',{onClick:function(){setShowLikersProf(null);},style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},'×')
        ),
        React.createElement('div',{style:{overflowY:'auto',padding:'8px 0'}},
          (function(){
            var p=myPosts.find(function(x){return x.id===showLikersProf;});
            if(!p) return null;
            var ids=p.likes.filter(function(l){return typeof l==='string'&&l.length>10;});
            var staticNames=p.likeNames||[];
            if(p.likes.length===0) return React.createElement('div',{style:{padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}},'No likes yet');
            if(ids.length===0&&staticNames.length>0){
              return staticNames.map(function(name,i){
                return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
                  React.createElement('div',{style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff'}},name.substring(0,2).toUpperCase()),
                  React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff'}},name),React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member'))
                );
              });
            }
            return ids.map(function(uid){
              var info=likersNamesProf[uid]||{};
              var name=info.name||'Loading...';
              var av=info.avatar||null;
              function goToLiker(){
                if(uid===userId) return;
                setShowLikersProf(null);
                if(onViewUser) onViewUser({id:uid,full_name:name,avatar_url:av,email:''});
              }
              return React.createElement('div',{key:uid,style:{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.05)'}},
                React.createElement('div',{onClick:goToLiker,style:{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:700,color:'#fff',cursor:uid!==userId?'pointer':'default'}},
                  av?React.createElement('img',{src:av,alt:name,style:{width:'100%',height:'100%',objectFit:'cover'}}):name.substring(0,2).toUpperCase()
                ),
                React.createElement('div',{onClick:goToLiker,style:{flex:1,minWidth:0,cursor:uid!==userId?'pointer':'default'}},
                  React.createElement('div',{style:{fontSize:'14px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},name),
                  React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,0.4)'}},'RingIn Member')
                ),
                uid!==userId?React.createElement('button',{
                  onClick:function(e){e.stopPropagation();toggleFollow(uid,name,av,'RingIn Member');},
                  style:{padding:'6px 14px',background:following[uid]?'transparent':'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:following[uid]?'1px solid rgba(123,110,255,0.5)':'none',borderRadius:'20px',color:following[uid]?'#7B6EFF':'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}
                },following[uid]?'Following':'+Follow'):null
              );
            });
          })()
        )
      )
    ) : null,
    // Avatar view modal
    showAvatarView ? React.createElement('div',{
      onClick:function(){setShowAvatarView(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.9)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}},
      React.createElement('div',{style:{width:'280px',height:'280px',borderRadius:'50%',overflow:'hidden',border:'4px solid #fff'}},
        avatarUrl
          ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}})
          : React.createElement('div',{style:{width:'100%',height:'100%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'72px',fontWeight:700,color:'#fff'}},initials)
      )
    ) : null,
    // Adjust/crop screen
    showAdjust ? React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#000',zIndex:10000,display:'flex',flexDirection:'column'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px',color:'#fff'}},
        React.createElement('button',{onClick:function(){setShowAdjust(false);},style:{background:'none',border:'none',color:'#fff',fontSize:'14px',cursor:'pointer'}},'Cancel'),
        React.createElement('div',{style:{fontSize:'15px',fontWeight:600}},'Adjust Photo'),
        React.createElement('button',{onClick:saveAvatar,style:{background:'var(--ac)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,padding:'6px 14px',borderRadius:'20px',cursor:'pointer'}},'Save')
      ),
      React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}},
        React.createElement('div',{style:{width:'280px',height:'280px',borderRadius:'50%',overflow:'hidden',border:'3px solid #fff',position:'relative',cursor:'grab'},
          onMouseDown:function(e){setDragging(true);setDragStart({x:e.clientX-offset.x,y:e.clientY-offset.y});},
          onMouseMove:function(e){if(!dragging)return;setOffset({x:e.clientX-dragStart.x,y:e.clientY-dragStart.y});},
          onMouseUp:function(){setDragging(false);},
          // R13 FIX #7: preventDefault on touchstart so iOS Safari doesn't
          // trigger a long-press image menu / context callout while the
          // user is starting an avatar reposition drag. Mirrors the
          // existing onTouchMove preventDefault.
          onTouchStart:function(e){e.preventDefault();setDragging(true);setDragStart({x:e.touches[0].clientX-offset.x,y:e.touches[0].clientY-offset.y});},
          onTouchMove:function(e){if(!dragging)return;e.preventDefault();setOffset({x:e.touches[0].clientX-dragStart.x,y:e.touches[0].clientY-dragStart.y});},
          onTouchEnd:function(){setDragging(false);}
        },
          React.createElement('img',{src:adjustImg,style:{maxWidth:'500px',maxHeight:'500px',width:'auto',height:'auto',position:'absolute',top:'50%',left:'50%',transform:'translate(calc(-50% + '+offset.x+'px), calc(-50% + '+offset.y+'px))',transition:dragging?'none':'transform 0.1s',userSelect:'none',pointerEvents:'none',display:'block'}})
        )
      ),
      React.createElement('div',{style:{padding:'16px',textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'12px'}},'Drag to reposition your photo')
    ) : null,
    // Cover adjust/reposition screen
    showCoverAdjust ? (function(){
      var PREV_H = 160;
      var prevW = window.innerWidth||375;
      var natW = coverImgNat.w||1; var natH = coverImgNat.h||1;
      // Base scale = cover-fill: image fills the strip completely (like object-fit:cover)
      var baseScale = Math.max(prevW / natW, PREV_H / natH);
      var totalScale = baseScale * coverUserScale;
      var imgDW = Math.round(natW * totalScale);
      var imgDH = Math.round(natH * totalScale);
      return React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#111',zIndex:10001,display:'flex',flexDirection:'column'}},
        // Header
        React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',color:'#fff',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          React.createElement('button',{onClick:function(){setShowCoverAdjust(false);},style:{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:'15px',cursor:'pointer',padding:'4px 0'}},'Cancel'),
          React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'#fff'}},'Adjust Cover'),
          React.createElement('button',{onClick:saveCover,style:{background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',color:'#fff',fontSize:'14px',fontWeight:700,padding:'8px 20px',borderRadius:'20px',cursor:'pointer'}},'Save')
        ),
        // Instruction
        React.createElement('div',{style:{textAlign:'center',padding:'20px 20px 16px',color:'rgba(255,255,255,0.45)',fontSize:'13px'}},'Drag to move  •  Pinch to zoom'),
        // Cover preview strip — full width, exact cover height
        React.createElement('div',{
          style:{width:'100%',height:PREV_H+'px',overflow:'hidden',position:'relative',cursor:'grab',flexShrink:0,background:'#1a1040'},
          onMouseDown:function(e){setCoverDragging(true);setCoverDragStart({x:e.clientX-coverOffset.x,y:e.clientY-coverOffset.y});},
          onMouseMove:function(e){if(!coverDragging)return;setCoverOffset({x:e.clientX-coverDragStart.x,y:e.clientY-coverDragStart.y});},
          onMouseUp:function(){setCoverDragging(false);},
          onWheel:function(e){e.preventDefault();var delta=e.deltaY>0?0.92:1.08;setCoverUserScale(function(s){return Math.max(0.5,Math.min(6,s*delta));});},
          onTouchStart:function(e){
            if(e.touches.length===2){
              var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
              setCoverPinchDist(d); setCoverPinchScaleStart(coverUserScale);
            } else {
              setCoverDragging(true);
              setCoverDragStart({x:e.touches[0].clientX-coverOffset.x,y:e.touches[0].clientY-coverOffset.y});
            }
          },
          onTouchMove:function(e){
            e.preventDefault();
            if(e.touches.length===2){
              var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
              if(coverPinchDist>0) setCoverUserScale(Math.max(0.5,Math.min(6,coverPinchScaleStart*(d/coverPinchDist))));
            } else if(coverDragging){
              setCoverOffset({x:e.touches[0].clientX-coverDragStart.x,y:e.touches[0].clientY-coverDragStart.y});
            }
          },
          onTouchEnd:function(e){
            if(e.touches.length<2){setCoverPinchDist(0);}
            if(e.touches.length===0){setCoverDragging(false);}
          }
        },
          coverAdjustImg ? React.createElement('img',{
            src:coverAdjustImg,
            style:{position:'absolute',top:'50%',left:'50%',width:imgDW+'px',height:imgDH+'px',transform:'translate(calc(-50% + '+coverOffset.x+'px), calc(-50% + '+coverOffset.y+'px))',transition:'none',userSelect:'none',pointerEvents:'none',display:'block'}
          }) : null
        ),
        // Profile preview label
        React.createElement('div',{style:{textAlign:'center',padding:'16px 20px',color:'rgba(255,255,255,0.3)',fontSize:'12px'}},'↑  This is exactly how your cover looks on your profile  ↑'),
        // Zoom buttons for easier control
        React.createElement('div',{style:{display:'flex',justifyContent:'center',gap:'16px',padding:'8px 20px'}},
          React.createElement('button',{onClick:function(){setCoverUserScale(function(s){return Math.max(0.5,s*0.85);});},style:{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'50%',width:'44px',height:'44px',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'−'),
          React.createElement('button',{onClick:function(){setCoverUserScale(1);setCoverOffset({x:0,y:0});},style:{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'20px',padding:'0 16px',height:'44px',color:'rgba(255,255,255,0.6)',fontSize:'12px',cursor:'pointer'}},'Reset'),
          React.createElement('button',{onClick:function(){setCoverUserScale(function(s){return Math.min(6,s*1.15);});},style:{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'50%',width:'44px',height:'44px',color:'#fff',fontSize:'22px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+')
        )
      );
    })() : null,
    // iOS frosted glass avatar menu
    showAvatarMenu ? React.createElement('div',{
      onClick:function(){setShowAvatarMenu(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9998,backdropFilter:'blur(2px)'}},
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{position:'absolute',top:'155px',left:'14px',background:'rgba(30,30,40,0.85)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderRadius:'14px',minWidth:'220px',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.1)'}},
        // "View My Moments" — top option, ONLY when the user has an
        // active moment posted in the last 24h. Dispatches a window event
        // that the home-feed Moments instance listens for; that instance
        // owns the MomentViewer and will pop it open with the user's slides.
        momentUserIds.has(userId) ? React.createElement('div',{onClick:function(){
            setShowAvatarMenu(false);
            try { window.dispatchEvent(new Event('ringin-open-own-moment')); } catch(_){}
            // Switch to the Home tab so the viewer is visible. Without
            // this, the event fires but the Moments instance on Home is
            // mounted offscreen and the user just sees their own profile.
            try { if (onSwitchTab) onSwitchTab('home'); } catch(_){}
          },
          style:{padding:'13px 16px',fontSize:'14px',fontWeight:600,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'10px',background:'linear-gradient(90deg, rgba(232,77,154,0.15), rgba(123,110,255,0.08))'}},
          React.createElement('span',{style:{display:'inline-flex',width:'22px',height:'22px',borderRadius:'50%',background:'linear-gradient(135deg,#FF6B6B,#E84D9A,#7B6EFF)',alignItems:'center',justifyContent:'center',fontSize:'11px'}}, '✨'),
          'View My Moment'
        ) : null,
        React.createElement('div',{onClick:function(){setShowAvatarMenu(false);setShowAvatarView(true);},
          style:{padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},'View Photo'),
        React.createElement('label',{style:{display:'block',padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          'Take Photo',
          React.createElement('input',{type:'file',accept:'image/*',capture:'user',style:{display:'none'},onChange:function(e){if(e.target.files[0]){setShowAvatarMenu(false);uploadAvatar(e.target.files[0]);}}})
        ),
        React.createElement('label',{style:{display:'block',padding:'13px 16px',fontSize:'14px',fontWeight:500,color:'#fff',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,0.08)'}},
          'Upload from Gallery',
          React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0]){setShowAvatarMenu(false);uploadAvatar(e.target.files[0]);}}})
        ),
        React.createElement('div',{onClick:function(){setShowAvatarMenu(false);},
          style:{padding:'13px 16px',fontSize:'14px',fontWeight:600,color:'#ff453a',cursor:'pointer'}},'Cancel')
      )
    ) : null,
    // Edit Profile Modal
    showEditProfile ? React.createElement('div',{
      onClick:function(){setShowEditProfile(false);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10000,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}
    },
      React.createElement('div',{
        onClick:function(e){e.stopPropagation();},
        style:{background:'rgba(18,12,36,0.65)',backdropFilter:'blur(30px)',WebkitBackdropFilter:'blur(30px)',border:'1px solid rgba(123,110,255,0.25)',borderRadius:'20px',width:'100%',maxWidth:'380px',maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}
      },
        React.createElement('div',{style:{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('span',{style:{fontSize:'17px',fontWeight:700,color:'#fff'}},'Edit Profile'),
          React.createElement('button',{onClick:function(){setShowEditProfile(false);},title:'Close',style:{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}},
            React.createElement('svg',{viewBox:'0 0 24 24',width:'16',height:'16',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},
              React.createElement('polyline',{points:'15 18 9 12 15 6'})
            )
          )
        ),
        React.createElement('div',{style:{padding:'18px'}},
          // Display Name
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Display Name'),
            React.createElement('input',{value:editName,onChange:function(e){setEditName(e.target.value);},placeholder:'Your name',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box'}})
          ),
          // Tag
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Tag / Handle'),
            React.createElement('input',{value:editTag,onChange:function(e){setEditTag(e.target.value.startsWith('#')?e.target.value:'#'+e.target.value);},placeholder:'#yourtag',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#7B6EFF',outline:'none',boxSizing:'border-box'}})
          ),
          // About Me
          React.createElement('div',{style:{marginBottom:'16px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'About Me'),
            React.createElement('textarea',{value:editAbout,onChange:function(e){setEditAbout(e.target.value);},placeholder:'Tell people about yourself...',rows:3,style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',resize:'none',boxSizing:'border-box',fontFamily:'DM Sans,sans-serif',lineHeight:1.5}})
          ),
          // Website / Social Links
          React.createElement('div',{style:{marginBottom:'24px'}},
            React.createElement('div',{style:{fontSize:'11px',fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}},'Website / Social Link'),
            React.createElement('input',{value:editWebsiteName,onChange:function(e){setEditWebsiteName(e.target.value);},placeholder:'Display name (e.g. www.google.com)',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box',marginBottom:'8px'}}),
            React.createElement('input',{value:editWebsiteUrl,onChange:function(e){setEditWebsiteUrl(e.target.value);},placeholder:'URL (e.g. https://google.com)',style:{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(123,110,255,0.3)',borderRadius:'10px',padding:'11px 13px',fontSize:'14px',color:'#fff',outline:'none',boxSizing:'border-box'}})
          ),
          React.createElement('button',{
            onClick:saveEditProfile,
            style:{width:'100%',padding:'13px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer'}
          },savingEdit?'Saving...':'Save Profile')
        )
      )
    ) : null,
    // Cover
    React.createElement('div',{style:{height:'130px',background:coverUrl?'none':(eqTheme&&eqTheme.payload?('linear-gradient(135deg,'+(eqTheme.payload.accent2||'#534AB7')+','+(eqTheme.payload.accent||'#7C6FFF')+')'):'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)'),position:'relative',flexShrink:0,overflow:'visible'}},
      coverUrl ? React.createElement('img',{src:coverUrl,alt:'cover',style:{width:'100%',height:'100%',objectFit:'cover'}}) : null,
      // Theme tint stays visible even when a cover photo is uploaded — otherwise
      // the purchased theme would be silently hidden behind the image.
      (coverUrl && eqTheme && eqTheme.payload) ? React.createElement('div',{style:{position:'absolute',top:0,left:0,right:0,bottom:0,background:'linear-gradient(135deg,'+(eqTheme.payload.accent2||'#534AB7')+','+(eqTheme.payload.accent||'#7C6FFF')+')',opacity:0.32,mixBlendMode:'overlay',pointerEvents:'none',zIndex:1}}) : null,
      eqSticker ? React.createElement('div',{style:{position:'absolute',right:'14px',bottom:'12px',zIndex:3}}, React.createElement(Sticker,{item:eqSticker,size:40})) : null,
      React.createElement('label',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'5px 10px',fontSize:'10px',color:'#fff',cursor:'pointer'}},
        uploading?'Uploading...':'✏️ Edit Cover',
        React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadCover(e.target.files[0]);}})
      ),
      // Avatar — wrapped in AvatarRing so the user gets the gradient halo
      // on their profile cover whenever they have an active moment posted.
      // The ring ALSO renders even outside the cover area for the user's
      // own avatar (post headers below, etc.).
      React.createElement('div',{style:{position:'absolute',bottom:'-40px',left:eqFrame?'50%':'18px',transform:eqFrame?'translateX(-50%)':'none',zIndex:2}},
        React.createElement(AvatarRing,{ show: momentUserIds.has(userId), thickness: 4 },
          React.createElement('div',{onClick:function(){setShowAvatarMenu(true);},style:{width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',overflow:'hidden',cursor:'pointer'}},
            avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
          )
        ),
        eqFrame ? frameOverlay(eqFrame, 80) : null
      )
    ),
    // Name row
    React.createElement('div',{style:{padding:(eqFrame?'104px':'50px')+' 18px 8px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',{style:{flex:1,minWidth:0,paddingRight:'10px'}},
        /* R40: profile name + 12-point pink-purple star verification badge. */
        React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'2px',display:'inline-flex',alignItems:'center',gap:'6px'}},
          profileInfo.name||email.split('@')[0],
          isVerified ? React.createElement(VerificationBadge, {size:18, style:{marginLeft:2}}) : null
        ),
        eqTag ? React.createElement('div',{style:{marginTop:'1px',marginBottom:'5px'}}, React.createElement(TagPill,{item:eqTag})) : null,
        profileInfo.tag ? React.createElement('div',{style:{fontSize:'12px',color:'#7B6EFF',fontWeight:600,marginBottom:'4px'}},profileInfo.tag) : null,
        profileInfo.about ? React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5,marginBottom:'4px',whiteSpace:'pre-wrap'}},renderAbout(profileInfo.about)) : null,
        (profileInfo.website_name||profileInfo.website_url) ? React.createElement('a',{href:profileInfo.website_url||(profileInfo.website_name&&profileInfo.website_name.startsWith('http')?profileInfo.website_name:'https://'+profileInfo.website_name),target:'_blank',rel:'noreferrer',style:{fontSize:'12px',color:'#7B6EFF',display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px',textDecoration:'none'}},'🔗 '+(profileInfo.website_name||profileInfo.website_url)) : null,
        // FIX #4: real member-since from session.user.created_at. Was hardcoded
        // "April 2026" for every user. Hidden if the session is still hydrating.
        memberSince ? React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},'Member since '+memberSince) : null
      ),
      React.createElement('div',{style:{display:'flex',gap:'8px',flexShrink:0}},
        React.createElement('button',{onClick:openEditProfile,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',display:'flex',alignItems:'center',gap:'4px',cursor:'pointer',fontSize:'12px',color:'var(--text)',fontWeight:600}},'✏️ Edit'),
        React.createElement('button',{onClick:function(){setShowStore(true);},title:'Style Store',style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'✨'),
        React.createElement('button',{onClick:function(){setShowSettings(true);},style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'⚙️')
      )
    ),
    // Stats
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'0 18px 12px'}},
      // Redesigned identity stats: Followers / Friends / Hearts (replaces the
      // old Calls/Coins/Reviews). Followers + Friends come from the effect
      // above; Hearts = total likes received across the user's own posts
      // (v1 — the full hearts earn-ledger lands next). Hearts shown in brand pink.
      [{v:fmtStatCount(followersCount),l:'Followers'},
       {v:fmtStatCount(friendsCount),l:'Friends'},
       {v:fmtStatCount((myPosts||[]).reduce(function(n,p){return n+(Array.isArray(p.likes)?p.likes.length:0);},0)),l:'Hearts'}].map(function(s){
        return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center',position:'relative'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',gap:'4px'}},
            React.createElement('span',{style:{fontSize:'16px',fontWeight:800,color:s.l==='Hearts'?'#E84D9A':'var(--text)'}},s.v),
            // Hearts streak flame (0057) — only on the Hearts tile, only when active.
            (s.l==='Hearts' && heartStreak)
              ? React.createElement('span',{style:{fontSize:'12px',fontWeight:800,color:'#FF6A00'},title:heartStreak+'-day hearts streak'},'🔥'+heartStreak)
              : null
          ),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},s.l)
        );
      })
    ),
    // Status / level crown badge (0058) + Leaderboard link. Hidden entirely
    // until my_status returns a tier/level (migration unrun → nothing shown).
    myStatus ? React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',padding:'0 18px 12px'}},
      React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'5px 12px',fontSize:'12px',fontWeight:700,color:'var(--text)'}},
        React.createElement('span',null,'👑'),
        React.createElement('span',null, (function(){ var t=myStatus.tier||myStatus.host_tier; var lv=(myStatus.level!=null)?myStatus.level:myStatus.host_level; return (t?String(t):'Host') + (lv!=null?(' · Lv '+lv):''); })())
      ),
      React.createElement('button',{
        onClick:function(){ setShowLeaderboard(true); },
        style:{background:'none',border:'none',color:'var(--ac)',fontSize:'12px',fontWeight:600,cursor:'pointer',padding:'4px'}
      },'Leaderboard ›')
    ) : null,
    // Tabs
    React.createElement('div',{style:{display:'flex',borderBottom:'1px solid var(--border)',padding:'0 18px',marginBottom:'12px'}},
      ['posts','friends','skills','reviews'].map(function(t){
        return React.createElement('div',{key:t,onClick:function(){setActiveTab(t);},style:{flex:1,padding:'8px 4px',textAlign:'center',fontSize:'11px',fontWeight:activeTab===t?700:500,color:activeTab===t?'var(--ac)':'var(--t2)',cursor:'pointer',borderBottom:activeTab===t?'2px solid var(--ac)':'2px solid transparent',textTransform:'capitalize'}},t);
      })
    ),
    // Tab content
    React.createElement('div',{style:{padding:'0 18px 80px'}},
      // POSTS TAB
      activeTab==='posts' ? React.createElement('div',null,
        // Moments — own profile, "+" slot for adding (UI-only for now)
        React.createElement('div',{style:{margin:'-2px -18px 8px'}},
          React.createElement(Moments,{
            ownAvatar: avatarUrl || null,
            ownName: 'Your Moment',
            showAdd: true,
            moments: [],
          })
        ),
        // Composer
        React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'12px',marginBottom:'14px'}},
          React.createElement('div',{style:{display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'10px'}},
            React.createElement(AvatarRing,{ show: momentUserIds.has(userId) },
              React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
                avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'me',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
              )
            ),
            React.createElement('textarea',{value:postText,onChange:function(e){playProfKeyClick();setPostText(e.target.value);},placeholder:"What's on your mind?",style:{flex:1,background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',padding:'9px 11px',fontSize:'13px',color:'var(--text)',outline:'none',resize:'none',minHeight:'70px',fontFamily:'DM Sans,sans-serif',lineHeight:1.5}})
          ),
          showEmoji ? React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px',padding:'8px',background:'var(--bg4)',borderRadius:'10px',marginBottom:'8px'}},
            EMOJIS.map(function(em){return React.createElement('span',{key:em,onClick:function(){playProfEmojiClick();setPostText(function(t){return t+em;});},style:{fontSize:'22px',cursor:'pointer',padding:'2px'}},em);})
          ) : null,
          React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            React.createElement('div',{style:{display:'flex',gap:'6px'}},
              // FIX #6: removed dummy 🖼️ Photo + 🎞️ GIF buttons (composer
              // doesn't support media). Honest UI > "coming soon" alerts.
              React.createElement('button',{onClick:function(){setShowEmoji(!showEmoji);},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:showEmoji?'var(--acg)':'var(--bg4)',border:'1px solid '+(showEmoji?'var(--ac)':'var(--border)'),borderRadius:'20px',color:showEmoji?'var(--ac)':'var(--t2)',fontSize:'11px',cursor:'pointer'}},'😊 Emoji')
            ),
            React.createElement('button',{onClick:submitPost,style:{padding:'7px 18px',background:'var(--ac)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}},'Post')
          )
        ),
        // 3-dot menu popup for ProfileScreen
        postMenuProf ? React.createElement('div',{
          onClick:function(){setPostMenuProf(null);},
          style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9500,background:'rgba(0,0,0,0.2)'}
        },
          React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(28,24,40,0.45)',backdropFilter:'blur(48px)',WebkitBackdropFilter:'blur(48px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'20px',width:'280px',boxShadow:'0 8px 40px rgba(0,0,0,0.35)',overflow:'hidden'}},
            (function(){
              var p=myPosts.find(function(x){return x.id===postMenuProf;});
              if(!p) return null;
              var isMutedProf = mutedPostsProf.indexOf(p.id) >= 0;
              var items=[
                // FIX R10-5: mirror HomeScreen Delete-Post rollback pattern.
                // Previous code optimistically removed from myPosts but never
                // checked the result — a failure left the post live in DB yet
                // gone from UI until refresh.
                {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenuProf(null);setDeletePostId(p.id);}},
                {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;copyToClipboardWithToast(url,'🔗 Link copied!');setPostMenuProf(null);}},
                // FIX #4: open real edit modal instead of "coming soon" alert
                {icon:'✏️',label:'Edit Post',fn:function(){setEditPostProfData({id:p.id,content:p.text||''});setPostMenuProf(null);}},
                // FIX #5: real mute toggle, persisted to ringin_muted_posts
                {icon:'🔕',label:isMutedProf?'Turn on notifications':'Turn off notifications',fn:function(){toggleMutePostProf(p.id);setPostMenuProf(null);}}
              ];
              return items.map(function(item,i){
                return React.createElement('div',{key:i,onClick:item.fn,style:{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.07)':'none',cursor:'pointer'}},
                  React.createElement('span',{style:{fontSize:'14px',fontWeight:500,color:item.red?'#ff453a':'rgba(255,255,255,0.9)'}},item.label)
                );
              });
            })()
          )
        ) : null,
        // Posts list
        myPosts.map(function(p){
          var commentsArr=commentsCacheProf[p.id]||[];
          return React.createElement('div',{key:p.id,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',marginBottom:'12px',overflow:'hidden'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px 8px',position:'relative'}},
              React.createElement(AvatarRing,{ show: momentUserIds.has(userId) },
                React.createElement('div',{style:{width:'36px',height:'36px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
                  avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'me',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
                )
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},email.split('@')[0]),
                React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},p.time)
              ),
              React.createElement('button',{
                onClick:function(e){e.stopPropagation();setPostMenuProf(postMenuProf===p.id?null:p.id);},
                style:{background:'none',border:'none',color:'var(--t2)',fontSize:'20px',cursor:'pointer',padding:'4px 8px',position:'absolute',right:'4px',top:'6px'}
              },'⋯')
            ),
            React.createElement('div',{style:{padding:'0 12px 8px',fontSize:'13px',color:'var(--text)',lineHeight:1.6}},p.text),
            p.img ? React.createElement('div',{style:{width:'100%',aspectRatio:'4/5',overflow:'hidden',background:'#111'}},
  React.createElement('img',{src:p.img,alt:'post',style:{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',display:'block'}})
) : null,
            React.createElement('div',{style:{display:'flex',borderTop:'1px solid var(--border)'}},
              React.createElement('div',{style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}},
                React.createElement('button',{onClick:function(){toggleLike(p.id);},style:{display:'flex',alignItems:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:p.liked?'#E84D9A':'var(--t2)',fontWeight:p.liked?700:400}},
                  React.createElement('svg',{viewBox:'0 0 24 24',width:'18',height:'18'},
                    p.liked?React.createElement('defs',null,React.createElement('linearGradient',{id:'plg'+p.id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'},React.createElement('stop',{offset:'0%',stopColor:'#5B4FD4'}),React.createElement('stop',{offset:'100%',stopColor:'#C4347A'}))):null,
                    React.createElement('path',{d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',fill:p.liked?'url(#plg'+p.id+')':'none',stroke:p.liked?'none':'var(--t2)',strokeWidth:'2'})
                  ),
                  React.createElement('span',{onClick:function(e){openLikersPopupProf(e,p);},style:{cursor:p.likes.length>0?'pointer':'default'}},p.likes.length,' Like')
                )
              ),
              React.createElement('button',{
                onClick:function(){
                  var newOpen=openCommentsProf===p.id?null:p.id;
                  setOpenCommentsProf(newOpen);
                  if(newOpen) loadCommentsProf(newOpen);
                },
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
              },'💬 '+(commentsCacheProf[p.id]?commentsCacheProf[p.id].length:p.comments||0)),
              React.createElement('button',{
                onClick:function(){
                  var url='https://ring-in.vercel.app/post/'+p.id;
                  if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url}).catch(function(){});}
                  else{copyToClipboardWithToast(url,'🔗 Link copied to clipboard');}
                },
                style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',color:'var(--t2)'}
              },'↗ Share')
            ),
            // Comment section
            openCommentsProf===p.id?React.createElement('div',{style:{borderTop:'1px solid var(--border)',background:'var(--bg4)'}},
              React.createElement('div',{style:{maxHeight:'360px',overflowY:'auto',padding:'8px 12px'}},
                commentsArr.length===0?React.createElement('div',{style:{textAlign:'center',padding:'12px',color:'var(--t3)',fontSize:'12px'}},'No comments yet. Be the first!'):
                commentsArr.map(function(c){
                  var cLiked=(commentLikesProf[c.id]||0)>0;
                  return React.createElement('div',{key:c.id,style:{display:'flex',gap:'8px',marginBottom:'12px'}},
                    React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                      c.user_avatar?React.createElement('img',{src:c.user_avatar,alt:c.user_name,style:{width:'100%',height:'100%',objectFit:'cover'}}):(c.user_name||'?').substring(0,2).toUpperCase()
                    ),
                    React.createElement('div',{style:{flex:1}},
                      React.createElement('div',{style:{background:'var(--bg3)',borderRadius:'12px',padding:'7px 10px',marginBottom:'4px'}},
                        React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'2px'}},
                          React.createElement('span',{style:{fontSize:'12px',fontWeight:700,color:'var(--text)'}},(c.user_name||'User')),
                          React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},c.created_at?timeAgoProf(c.created_at):'')
                        ),
                        React.createElement('div',{style:{fontSize:'13px',color:'var(--text)',lineHeight:1.4}},c.text)
                      ),
                      React.createElement('div',{style:{display:'flex',gap:'14px',paddingLeft:'4px'}},
                        React.createElement('button',{onClick:function(){setCommentLikesProf(function(prev){var m=Object.assign({},prev);m[c.id]=(m[c.id]||0)===0?1:0;return m;});},style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:cLiked?'#E84D9A':'var(--t3)',display:'flex',alignItems:'center',gap:'3px',padding:'0',fontFamily:'DM Sans,sans-serif'}},
                          React.createElement('span',{style:{fontSize:'13px'}},cLiked?'❤️':'🤍'),cLiked?'Liked':'Like'
                        ),
                        React.createElement('button',{onClick:function(){setCommentInputProf('@'+(c.user_name||'User')+' ');},style:{background:'none',border:'none',cursor:'pointer',fontSize:'11px',color:'var(--t3)',padding:'0',fontFamily:'DM Sans,sans-serif'}},'Reply')
                      )
                    )
                  );
                })
              ),
              React.createElement('div',{style:{display:'flex',gap:'8px',padding:'8px 12px',borderTop:'1px solid var(--border)'}},
                React.createElement('div',{style:{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'#fff'}},
                  avatarUrl?React.createElement('img',{src:avatarUrl,style:{width:'100%',height:'100%',objectFit:'cover'}}):initials.substring(0,2)
                ),
                React.createElement('input',{
                  value:commentInputProf,
                  onChange:function(e){playProfKeyClick();setCommentInputProf(e.target.value);},
                  onKeyDown:function(e){if(e.key==='Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && commentInputProf.trim()){submitCommentProf(p.id,commentInputProf);}}, /* FIX #2: IME composition guard */
                  placeholder:'Write a comment...',
                  style:{flex:1,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',fontSize:'13px',color:'var(--text)',outline:'none',fontFamily:'DM Sans,sans-serif'}
                }),
                React.createElement('button',{
                  onClick:function(){if(commentInputProf.trim()){playProfPostSound();submitCommentProf(p.id,commentInputProf);}},
                  style:{padding:'6px 14px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
                },'Send')
              )
            ):null
          );
        })
      ) : null,
      // FRIENDS TAB
      // FIX #5: was hardcoded FRIENDS array. Now reads from `realFriends`,
      // which is populated from the `follows` table for the current user.
      // Empty state explains how to add followers.
      activeTab==='friends' ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'People You Follow'),
        realFriends.length === 0
          ? React.createElement('div',{style:{padding:'24px 12px',textAlign:'center',color:'var(--t3)',fontSize:'12px',background:'var(--bg3)',border:'1px dashed var(--border)',borderRadius:'12px'}},'Not following anyone yet — head to Search to find experts and people you know.')
          : realFriends.map(function(f,i){
              var fk = String(f.id);
              var isFollowing = !!(following && following[fk]);
              return React.createElement('div',{key:fk,style:{display:'flex',alignItems:'center',gap:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px',marginBottom:'8px'}},
                React.createElement('div',{
                  onClick:function(){ if(onViewUser) onViewUser({id:f.id,name:f.name,img:f.img,role:f.role}); },
                  style:{width:'40px',height:'40px',borderRadius:'50%',background:f.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0,cursor:'pointer'}
                },
                  f.img ? React.createElement('img',{src:f.img,alt:f.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : f.initials
                ),
                React.createElement('div',{style:{flex:1,minWidth:0,cursor:'pointer'},onClick:function(){ if(onViewUser) onViewUser({id:f.id,name:f.name,img:f.img,role:f.role}); }},
                  React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},f.name),
                  React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},f.role)
                ),
                React.createElement('button',{onClick:function(){toggleFollow(fk,f.name,f.img,f.role);},style:{fontSize:'10px',color:isFollowing?'var(--ac)':'#fff',background:isFollowing?'var(--acg)':'var(--ac)',border:isFollowing?'1px solid var(--ac)':'none',padding:'5px 10px',borderRadius:'20px',cursor:'pointer',fontWeight:600}},isFollowing?'Following':'+Follow')
              );
            })
      ) : null,
      // SKILLS TAB
      // FIX #5: was hardcoded SKILLS array. Now reads `skills` (array of
      // strings) off the user's profile bio JSON. If not present, an empty
      // state nudges them to add skills via Edit Profile.
      activeTab==='skills' ? (function(){
        var skillsArr = [];
        try {
          // profileInfo is the parsed bio object. We look for a `skills`
          // field — older bios won't have it, that's fine.
          var b = profileInfo || {};
          if (Array.isArray(b.skills)) skillsArr = b.skills.filter(function(x){ return x && typeof x === 'string'; });
        } catch(_){}
        return React.createElement('div',null,
          React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'Skills'),
          skillsArr.length === 0
            ? React.createElement('div',{style:{padding:'24px 12px',textAlign:'center',color:'var(--t3)',fontSize:'12px',background:'var(--bg3)',border:'1px dashed var(--border)',borderRadius:'12px'}},'No skills added yet — edit your profile to add some.')
            : React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'6px'}},
                skillsArr.map(function(s,i){
                  return React.createElement('span',{key:i,style:{fontSize:'11px',padding:'5px 10px',borderRadius:'20px',background:'var(--acg)',color:'var(--ac)',fontWeight:600}}, s);
                })
              )
        );
      })() : null,
      // REVIEWS TAB
      // FIX #5: was hardcoded REVIEWS array. No reviews system exists yet —
      // honest empty state instead of fake testimonials.
      activeTab==='reviews' ? React.createElement('div',null,
        React.createElement('div',{style:{padding:'24px 12px',textAlign:'center',color:'var(--t3)',fontSize:'12px',background:'var(--bg3)',border:'1px dashed var(--border)',borderRadius:'12px'}},'Reviews coming soon.')
      ) : null
    ),
    // FIX #4: Edit Post modal — own-profile post grid. Same shape as the
    // one in HomeScreen's UserProfileView so they look identical to the user.
    editPostProfData ? React.createElement('div',{
      onClick:function(){setEditPostProfData(null);},
      style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:10000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}
    },
      React.createElement('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'16px',width:'320px',padding:'20px',boxShadow:'0 8px 40px rgba(0,0,0,0.4)'}},
        React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)',marginBottom:'14px'}},'Edit Post'),
        React.createElement('textarea',{
          value:editPostProfData.content,
          onChange:function(ev){setEditPostProfData(function(prev){return Object.assign({},prev,{content:ev.target.value});});},
          style:{width:'100%',minHeight:'100px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',fontSize:'14px',color:'var(--text)',resize:'vertical',outline:'none',fontFamily:'DM Sans,sans-serif',boxSizing:'border-box'}
        }),
        React.createElement('div',{style:{display:'flex',gap:'10px',marginTop:'14px',justifyContent:'flex-end'}},
          React.createElement('button',{onClick:function(){setEditPostProfData(null);},style:{padding:'8px 18px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'13px',cursor:'pointer',fontWeight:500}},'Cancel'),
          React.createElement('button',{onClick:saveEditPostProf,style:{padding:'8px 18px',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',border:'none',borderRadius:'20px',color:'#fff',fontSize:'13px',cursor:'pointer',fontWeight:600}},'Save')
        )
      )
    ) : null,
    /* R23: in-app Delete Post confirmation modal — replaces window.confirm. */
    deletePostId ? React.createElement(React.Fragment, null,
      React.createElement('div',{
        style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:500,backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'},
        onClick:function(){ setDeletePostId(null); }
      }),
      React.createElement('div',{
        onClick:function(e){ e.stopPropagation(); },
        style:{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:501,background:'var(--bg2,#161028)',border:'1px solid var(--border)',borderRadius:'16px',padding:'18px 20px 14px',minWidth:'260px',maxWidth:'320px',boxShadow:'0 16px 48px rgba(0,0,0,0.6)',color:'var(--text)',fontFamily:'inherit'}
      },
        React.createElement('div',{style:{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}, 'Delete this post?'),
        React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.4,marginBottom:'14px'}},
          'This will permanently remove the post from your profile and feed. This cannot be undone.'),
        React.createElement('div',{style:{display:'flex',gap:'8px',justifyContent:'flex-end'}},
          React.createElement('button',{
            onClick:function(){ setDeletePostId(null); },
            style:{padding:'8px 14px',borderRadius:'8px',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
          }, 'Cancel'),
          React.createElement('button',{
            onClick:function(){
              var pid = deletePostId;
              setDeletePostId(null);
              /* Snapshot + optimistic + rollback (same as the prior window.confirm
               * path — just without the native dialog). FIX R10-5 retained. */
              var snap = myPosts.slice();
              setMyPosts(function(prev){ return prev.filter(function(x){ return x.id !== pid; }); });
              sbProfile.from('posts').delete().eq('id', pid).then(function(r){
                if (r && r.error) {
                  console.error('[ringin] delete post (profile) failed:', r.error);
                  setMyPosts(snap);
                  try { toastError('Failed to delete post'); } catch(_){}
                }
              }).catch(function(e){
                console.warn('[ringin] delete post (profile) reject:', e);
                setMyPosts(snap);
                try { toastError('Failed to delete post'); } catch(_){}
              });
            },
            style:{padding:'8px 14px',borderRadius:'8px',background:'#FF4757',border:'none',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
          }, 'Delete')
        )
      )
    ) : null
  );
}
