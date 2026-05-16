/* eslint-disable */
import React,{useState,useEffect,useRef} from 'react';
import {useFollow} from './useFollow';
import {sb as sbProfile} from '../utils/supabase';
import {usePostsRealtime} from '../utils/usePostsRealtime';
import Moments from '../components/Moments';
import AvatarRing from '../components/AvatarRing';
import {useMomentUserIds} from '../utils/momentUsers';
import {useHideLikes} from '../utils/likeDisplayPref';
import {useCloseFriends, addCloseFriend, removeCloseFriend} from '../utils/closeFriends';
import {playSound,playUnlikeSound,previewSound,saveSoundPrefs,SOUND_META,getHapticsEnabled,setHapticsEnabled,forceSound,forceHaptic,isHapticSupported} from '../utils/soundEngine';

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
  var now=new Date();
  var str=dateStr.toString();
  if(!str.includes('Z')&&!str.includes('+')) str=str+'Z';
  var date=new Date(str);
  var diff=Math.floor((now-date)/1000);
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<172800) return 'Yesterday';
  return date.toLocaleDateString([],{month:'short',day:'numeric',timeZone:localStorage.getItem('user_timezone')||'UTC'});
}

export default function ProfileScreen({session, supabase, onOpenWallet}){
  var email = session && session.user ? session.user.email : '';
  var initials = email ? email.substring(0,2).toUpperCase() : 'ME';
  var userId = session && session.user ? session.user.id : null;

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
  var acctSavedS=useState(false); var acctSaved=acctSavedS[0]; var setAcctSaved=acctSavedS[1];
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
  var muteStoryS=useState(localStorage.getItem('mute_activity')==='1'); var muteActivity=muteStoryS[0]; var setMuteActivity=muteStoryS[1];
  var showActivityS=useState(localStorage.getItem('show_online')!=='0'); var showOnline=showActivityS[0]; var setShowOnline=showActivityS[1];
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
  var FRIENDS=[
    {initials:'PN',name:'Dr. Priya Nair',role:'General Physician',color:'linear-gradient(135deg,#1D9E75,#5DCAA5)',img:'https://i.pravatar.cc/150?img=47'},
    {initials:'RM',name:'Ravi Menon',role:'Sr. Software Engineer',color:'linear-gradient(135deg,#534AB7,#7C6FFF)',img:'https://i.pravatar.cc/150?img=12'},
    {initials:'SA',name:'Sara Al Zaabi',role:'Career Coach',color:'linear-gradient(135deg,#C84B8A,#E84D9A)',img:'https://i.pravatar.cc/150?img=23'},
  ];
  var SKILLS=[
    {label:'React Development',level:80},
    {label:'System Design',level:65},
    {label:'Career Planning',level:90},
    {label:'Public Speaking',level:55},
  ];
  var REVIEWS=[
    {name:'Ahmed K.',text:'Great session, very helpful!',rating:5,time:'2 days ago',img:'https://i.pravatar.cc/150?img=33'},
    {name:'Fatima M.',text:'Learned a lot from this call.',rating:4,time:'1 week ago',img:'https://i.pravatar.cc/150?img=44'},
  ];

  useEffect(function(){
    if(!userId) return;
    // Record login event (once per session)
    try{
      var loginLog=JSON.parse(localStorage.getItem('login_log_'+userId)||'[]');
      var lastLogin=loginLog.length?new Date(loginLog[loginLog.length-1].t):null;
      var now=new Date();
      if(!lastLogin||now-lastLogin>3600000){// more than 1 hour gap = new session
        loginLog.push({t:now.toISOString()});
        localStorage.setItem('login_log_'+userId,JSON.stringify(loginLog.slice(-90)));
      }
    }catch(e){}
  },[userId]);

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
    var newBio = JSON.stringify({about:editAbout,tag:editTag,website_name:editWebsiteName,website_url:editWebsiteUrl});
    sbProfile.from('profiles').update({full_name:editName,bio:newBio}).eq('id',userId).then(function(res){
      setSavingEdit(false);
      if(res.error){
        console.error('RingIn Error [saveEditProfile]:', res.error && res.error.message ? res.error.message : 'Unknown error');
        alert('Something went wrong. Please try again.');
        return;
      }
      var updated={name:editName,tag:editTag,about:editAbout,website_name:editWebsiteName,website_url:editWebsiteUrl};
      setProfileInfo(updated);
      try{localStorage.setItem('profile_info_'+userId,JSON.stringify(updated));}catch(e){}
      setShowEditProfile(false);
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
          localStorage.setItem('avatar_'+userId,res.data.avatar_url);
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
    sbProfile.from('messages').select('id,content,created_at').eq('sender_id',userId).order('created_at',{ascending:false}).limit(50).then(function(r){messages=r.data||[];check();});

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
      alert('Only images allowed (JPG, PNG, GIF, WebP)');
      return;
    }
    // Validate file size (max 5MB)
    if(file.size > 5 * 1024 * 1024){
      alert('Image must be under 5MB');
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
          if(res.error){alert('Something went wrong. Please try again.');setUploading(false);return;}
          var pub = supabase.storage.from('avatars').getPublicUrl(fileName);
          var url = pub.data.publicUrl+'?t='+Date.now();
          setAvatarUrl(url);
          localStorage.setItem('avatar_'+userId,url);
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
      alert('Only images allowed (JPG, PNG, GIF, WebP)');
      return;
    }
    // Validate file size (max 5MB)
    if(file.size > 5 * 1024 * 1024){
      alert('Image must be under 5MB');
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
          if(res.error){alert('Cover upload failed: '+(res.error.message||'storage error'));setUploading(false);return;}
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
            var existing = {};
            try{ if(rb.data && rb.data.bio) existing = JSON.parse(rb.data.bio); }catch(e){ existing = {}; }
            existing.cover_url = url;
            supabase.from('profiles').update({bio: JSON.stringify(existing)}).eq('id',userId).then(function(r2){
              if(r2.error){ console.error('bio cover_url merge failed:', r2.error.message); alert('Cover saved locally, but could not sync to your account. Please try again later.'); }
            });
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
    if(!postText.trim()){alert('Write something first!');return;}
    if(!userId){alert('Please log in to post');return;}
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
      if(res.error){alert('Something went wrong. Please try again.');return;}
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
    function dayLabel(iso){
      var d=new Date(iso);
      var today=new Date();
      var yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
      if(d.toDateString()===today.toDateString()) return 'Today';
      if(d.toDateString()===yesterday.toDateString()) return 'Yesterday';
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
            onClick:function(){if(supportEmail.trim()&&supportMsg.trim())setSupportSent(true);else alert('Please fill in your email and describe your issue.');},
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
              var newBio=JSON.stringify({about:profileInfo.about||'',tag:acctTag,website_name:profileInfo.website_name||'',website_url:profileInfo.website_url||''});
              sbProfile.from('profiles').update({full_name:acctName,bio:newBio}).eq('id',userId).then(function(r){if(r.error)console.error('RingIn Error [saveProfileInfo]:', r.error);});
            }
            setAcctSaved(true); setTimeout(function(){setAcctSaved(false);},2000);
          },
          style:{width:'100%',padding:'11px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer'}
        },acctSaved?'Saved ✓':'Save Profile Info')
      ),
      // Contact section
      React.createElement('div',{style:{fontSize:'11px',fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px',paddingLeft:'2px'}},'Contact'),
      React.createElement('div',{style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'14px',padding:'16px',marginBottom:'20px'}},
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'6px'}},'Phone Number'),
        React.createElement('div',{style:{display:'flex',gap:'8px'}},
          React.createElement('button',{
            onClick:function(){setShowPhoneCodePicker(true);setAcctCountrySearch('');},
            style:{padding:'12px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',fontWeight:600,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}
          },acctPhoneCode),
          React.createElement('input',{type:'tel',value:acctPhone,onChange:function(e){setAcctPhone(e.target.value);localStorage.setItem('acct_phone',e.target.value);},placeholder:'Phone number',style:{flex:1,padding:'12px 14px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px',outline:'none',fontFamily:'inherit'}})
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
                  onMouseDown:function(){setAcctCountry(c[1]);localStorage.setItem('acct_country',c[1]);setShowCountryPicker(false);setAcctCountrySearch('');},
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
              // ALSO persist country / phone to location JSON (cross-device sync)
              bioJson.location = Object.assign({}, bioJson.location || {}, {
                country_name: acctCountry,
                dial: acctPhoneCode,
                phone: acctPhone,
              });
              sbProfile.from('profiles').update({full_name:acctName,bio:JSON.stringify(bioJson)}).eq('id',userId).then(function(r2){
                if(r2.error)console.error('RingIn Error [saveAll]:', r2.error);
              });
            });
          }
          setAcctSaved(true); setTimeout(function(){setAcctSaved(false);},2500);
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
          COUNTRIES.filter(function(c){return !acctCountrySearch||c[1].toLowerCase().includes(acctCountrySearch.toLowerCase())||c[2].includes(acctCountrySearch);}).map(function(c){
            var sel=acctPhoneCode===c[2];
            return React.createElement('div',{key:c[0],onClick:function(){setAcctPhoneCode(c[2]);localStorage.setItem('acct_phone_code',c[2]);setShowPhoneCodePicker(false);setAcctCountrySearch('');},
              style:{padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:sel?'rgba(123,110,255,0.1)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}},
              React.createElement('span',{style:{fontSize:'14px',color:'var(--text)',fontWeight:sel?600:400}},c[1]),
              React.createElement('span',{style:{fontSize:'13px',color:sel?'var(--ac)':'var(--t2)',fontWeight:sel?700:400}},c[2])
            );
          })
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
          TIMEZONES.filter(function(t){return !tzSearch||t[1].toLowerCase().includes(tzSearch.toLowerCase())||t[0].toLowerCase().includes(tzSearch.toLowerCase());}).map(function(t){
            var sel=acctTz===t[0];
            return React.createElement('div',{key:t[0],onClick:function(){setAcctTz(t[0]);try{localStorage.setItem('user_timezone',t[0]);}catch(e){}setShowTzPicker(false);setTzSearch('');},
              style:{padding:'13px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:sel?'rgba(123,110,255,0.1)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}},
              React.createElement('span',{style:{fontSize:'13px',color:'var(--text)',fontWeight:sel?600:400}},t[1]),
              sel?React.createElement('span',{style:{color:'var(--ac)',fontSize:'16px'}},'✓'):null
            );
          })
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
            onClick:function(){ removeCloseFriend(fid).catch(function(e){ alert('Failed to remove: '+(e&&e.message)); }); },
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
                removeCloseFriend(p.id).catch(function(e){ alert('Failed: '+(e&&e.message)); });
              } else {
                addCloseFriend(p.id).catch(function(e){ alert('Failed: '+(e&&e.message)); });
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
                        sbProfile.auth.resetPasswordForEmail(addr,{redirectTo:'https://ring-in.vercel.app'}).then(function(res){
                          setPwResetLoad(false);
                          if(res.error) setPwResetErr(res.error.message);
                          else setPwResetSent(true);
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
                        sbProfile.auth.signInWithPassword({email:email,password:pwCurrent}).then(function(res){
                          if(res.error){setPwChangeErr('Current password is incorrect.');setPwChangeLoad(false);return;}
                          sbProfile.auth.updateUser({password:pwNew}).then(function(r){
                            setPwChangeLoad(false);
                            if(r.error){setPwChangeErr(r.error.message);return;}
                            setPwChangeDone(true);
                          });
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
          return React.createElement('div',{key:opt[0],onClick:function(){setProfileVis(opt[0]);try{localStorage.setItem('profile_vis',opt[0]);}catch(e){}},style:{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',cursor:'pointer',background:isSelected?'rgba(123,110,255,0.08)':'transparent'}},
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
            onClick:function(){var n=!profileLocked;setProfileLocked(n);try{localStorage.setItem('profile_locked',n?'1':'0');}catch(e){}},
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
          {label:'Show Online Status',sub:'Others can see when you\'re active',val:showOnline,toggle:function(){var n=!showOnline;setShowOnline(n);try{localStorage.setItem('show_online',n?'1':'0');}catch(e){}sbProfile.from('profiles').update({is_online:n}).eq('id',userId).then(function(r){if(r.error)console.error('RingIn Error [setOnlineStatus]:', r.error);});}},
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
          {icon:'📥',label:'Download My Data',sub:'Get a copy of your RingIn data',fn:function(){var uid=userId;if(!uid){alert('Please log in first');return;}Promise.all([sbProfile.from('posts').select('*').eq('user_id',uid),sbProfile.from('comments').select('*').eq('user_id',uid)]).then(function(results){var data={exported_at:new Date().toISOString(),user_id:uid,email:email,posts:results[0].data||[],comments:results[1].data||[]};var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='ringin-data-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);});}},
          {icon:'🗑️',label:'Delete Account',sub:'30-day cooling-off — sign back in to cancel',fn:function(){
            // Real delete flow (T2.9). Calls the request_account_deletion
            // RPC defined in supabase/migrations/0011_account_deletion.sql.
            // - Sets profiles.deleted_at = now() → account hidden from app.
            // - User signs back in within 30 days to cancel.
            // - After 30 days a scheduled job purges PII.
            // If the migration hasn't been applied, RPC returns "function does
            // not exist" → fall back to the email-support message.
            if(!window.confirm('Delete your RingIn account?\n\n• You will be signed out.\n• You have 30 days to cancel by signing back in.\n• After 30 days, your name, email and avatar are permanently scrubbed.\n• Your posts and comments stay, anonymised.')) return;
            sbProfile.rpc('request_account_deletion').then(function(r){
              if(r.error){
                console.warn('[ringin] delete account RPC error', r.error);
                alert('Could not start deletion automatically. Please email support@ringin.app and we will process it manually.');
                return;
              }
              // Sign out — supabase client clears the session.
              try { sbProfile.auth.signOut(); } catch(_){}
              alert('Your account is now scheduled for deletion. Sign back in within 30 days to cancel. We are sorry to see you go.');
            });
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
    )
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
            onClick:function(){ forceSound('notification', 0); },
            style:{padding:'9px 14px',background:'var(--ac)',border:'none',borderRadius:'10px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',flexShrink:0}
          },'🔊 Sound'),
          React.createElement('button',{
            onClick:function(){
              var ok = forceHaptic([40, 30, 80]);
              if(!ok){
                // Fall back to a quick visual nudge — alert is acceptable here since the
                // user explicitly asked to test and we have no other channel to report.
                try { alert('Vibration is not supported on this browser (iOS Safari and most desktop browsers).'); } catch(e){}
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
                onTouchEnd:function(e){previewSound(type,pref.variant,pref.volume);},
                style:{flex:1,accentColor:'#7B6EFF',height:'4px',cursor:'pointer'}
              }),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)',minWidth:'30px',textAlign:'right'}},Math.round(pref.volume*100)+'%')
            )
          );
        })
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
            if(e.key==='Enter'&&mutedInput.trim()){
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
              if(!userId){alert('Please log in first');return;}
              if(!expertAppName.trim()||!expertAppBio.trim()){alert('Please fill in all required fields.');return;}
              sbProfile.from('profiles').update({bio:JSON.stringify(Object.assign({},profileInfo,{expert_request:{name:expertAppName,area:expertAppArea,bio:expertAppBio,exp:expertAppExp,rate:expertAppRate,applied_at:new Date().toISOString()}}))}).eq('id',userId).then(function(r){
                if(r.error){console.error('RingIn Error [expertAppSubmit]:', r.error && r.error.message ? r.error.message : 'Unknown error');alert('Something went wrong. Please try again.');return;}
                setExpertAppSubmitted(true);
              });
            },
            style:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#534AB7,#E84D9A)',border:'none',borderRadius:'12px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',marginTop:'4px',boxShadow:'0 4px 16px rgba(123,110,255,0.3)'}
          },'Submit Application')
        )
  );

  if(showSettings) return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'12px',padding:'16px 18px',borderBottom:'1px solid var(--border)'}},
      React.createElement('button',{onClick:function(){setShowSettings(false);},style:{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement('svg',{viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor',strokeWidth:'2.3',strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('polyline',{points:'15 18 9 12 15 6'}))),
      React.createElement('div',{style:{fontSize:'16px',fontWeight:700,color:'var(--text)'}},'Settings')
    ),
    React.createElement('div',{style:{padding:'14px 18px'}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}},
        [{v:'12',l:'Calls Made',icon:'📞'},{v:'1,240',l:'Coins',icon:'🪙'},{v:'4.8★',l:'Rating',icon:'⭐'}].map(function(s){
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
        [
          {icon:'👤',label:'Account Settings',sub:'Name, phone, country, timezone',fn:function(){setShowAcct(true);}},
          {icon:'🔒',label:'Privacy & Security',sub:'Password, visibility, locked profile',fn:function(){setShowPrivacy(true);}},
          {icon:'🔔',label:'Notification Settings',sub:'Manage your alerts',fn:function(){setShowNotif(true);}},
          {icon:'🔊',label:'Sound & Haptics',sub:'Typing, emoji, send, like, notification sounds',fn:function(){setShowSound(true);}},
          {icon:'📋',label:'Activity Log',sub:'Your logins, posts, likes & more',fn:function(){setShowActivityLog(true);}},
          {icon:'💬',label:'Help & Support',sub:'FAQs and contact us',fn:function(){setShowSupport(true);}},
          {icon:'⭐',label:'Rate the App',sub:'Enjoying RingIn? Let us know!',fn:function(){setShowRate(true);}},
        ].map(function(item,i,arr){
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
      },'Sign Out')
    )
  );

  // MAIN PROFILE
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%',background:'var(--bg)',overflowY:'auto'}},
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
                if(props.onViewUser) props.onViewUser({id:uid,full_name:name,avatar_url:av,email:''});
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
          onTouchStart:function(e){setDragging(true);setDragStart({x:e.touches[0].clientX-offset.x,y:e.touches[0].clientY-offset.y});},
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
            try { if (props.onSwitchTab) props.onSwitchTab('home'); } catch(_){}
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
    React.createElement('div',{style:{height:'130px',background:coverUrl?'none':'linear-gradient(135deg,#1a1040,#534AB7,#7C6FFF)',position:'relative',flexShrink:0,overflow:'visible'}},
      coverUrl ? React.createElement('img',{src:coverUrl,alt:'cover',style:{width:'100%',height:'100%',objectFit:'cover'}}) : null,
      React.createElement('label',{style:{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'5px 10px',fontSize:'10px',color:'#fff',cursor:'pointer'}},
        uploading?'Uploading...':'✏️ Edit Cover',
        React.createElement('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(e){if(e.target.files[0])uploadCover(e.target.files[0]);}})
      ),
      // Avatar — wrapped in AvatarRing so the user gets the gradient halo
      // on their profile cover whenever they have an active moment posted.
      // The ring ALSO renders even outside the cover area for the user's
      // own avatar (post headers below, etc.).
      React.createElement('div',{style:{position:'absolute',bottom:'-40px',left:'18px',zIndex:2}},
        React.createElement(AvatarRing,{ show: momentUserIds.has(userId), thickness: 4 },
          React.createElement('div',{onClick:function(){setShowAvatarMenu(true);},style:{width:'80px',height:'80px',borderRadius:'50%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:700,color:'#fff',border:'3px solid var(--bg)',overflow:'hidden',cursor:'pointer'}},
            avatarUrl ? React.createElement('img',{src:avatarUrl,alt:'avatar',style:{width:'100%',height:'100%',objectFit:'cover'}}) : initials
          )
        )
      )
    ),
    // Name row
    React.createElement('div',{style:{padding:'50px 18px 8px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
      React.createElement('div',{style:{flex:1,minWidth:0,paddingRight:'10px'}},
        React.createElement('div',{style:{fontSize:'18px',fontWeight:700,color:'var(--text)',marginBottom:'2px'}},profileInfo.name||email.split('@')[0]),
        profileInfo.tag ? React.createElement('div',{style:{fontSize:'12px',color:'#7B6EFF',fontWeight:600,marginBottom:'4px'}},profileInfo.tag) : null,
        profileInfo.about ? React.createElement('div',{style:{fontSize:'13px',color:'var(--t2)',lineHeight:1.5,marginBottom:'4px',whiteSpace:'pre-wrap'}},renderAbout(profileInfo.about)) : null,
        (profileInfo.website_name||profileInfo.website_url) ? React.createElement('a',{href:profileInfo.website_url||(profileInfo.website_name&&profileInfo.website_name.startsWith('http')?profileInfo.website_name:'https://'+profileInfo.website_name),target:'_blank',rel:'noreferrer',style:{fontSize:'12px',color:'#7B6EFF',display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px',textDecoration:'none'}},'🔗 '+(profileInfo.website_name||profileInfo.website_url)) : null,
        React.createElement('div',{style:{fontSize:'10px',color:'var(--t3)'}},'Member since April 2026')
      ),
      React.createElement('div',{style:{display:'flex',gap:'8px',flexShrink:0}},
        React.createElement('button',{onClick:openEditProfile,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 12px',display:'flex',alignItems:'center',gap:'4px',cursor:'pointer',fontSize:'12px',color:'var(--text)',fontWeight:600}},'✏️ Edit'),
        React.createElement('button',{onClick:function(){setShowSettings(true);},style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'50%',width:'36px',height:'36px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px'}},'⚙️')
      )
    ),
    // Stats
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'0 18px 12px'}},
      [{v:'12',l:'Calls'},{v:'1,240',l:'Coins'},{v:'0',l:'Reviews'}].map(function(s){
        return React.createElement('div',{key:s.l,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'10px',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:'16px',fontWeight:800,color:'var(--text)'}},s.v),
          React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},s.l)
        );
      })
    ),
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
              React.createElement('button',{onClick:function(){alert('Image upload coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer'}},'🖼️ Photo'),
              React.createElement('button',{onClick:function(){alert('GIF coming soon!');},style:{display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',background:'var(--bg4)',border:'1px solid var(--border)',borderRadius:'20px',color:'var(--t2)',fontSize:'11px',cursor:'pointer'}},'🎞️ GIF'),
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
              var items=[
                {icon:'🗑️',label:'Delete Post',red:true,fn:function(){setPostMenuProf(null);if(window.confirm('Delete this post?')){sbProfile.from('posts').delete().eq('id',p.id).then(function(){});setMyPosts(function(prev){return prev.filter(function(x){return x.id!==p.id;});});}}},
                {icon:'🔗',label:'Copy Link',fn:function(){var url='https://ring-in.vercel.app/post/'+p.id;try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied!');setPostMenuProf(null);}},
                {icon:'✏️',label:'Edit Post',fn:function(){alert('Edit coming soon');setPostMenuProf(null);}},
                {icon:'🔕',label:'Turn off notifications',fn:function(){alert('Notifications paused');setPostMenuProf(null);}}
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
                  if(navigator.share){navigator.share({title:'Check this out on RingIn',text:(p.text||'').substring(0,100),url:url});}
                  else{try{navigator.clipboard.writeText(url);}catch(e){}alert('Link copied to clipboard!');}
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
                  onKeyDown:function(e){if(e.key==='Enter'&&commentInputProf.trim()){submitCommentProf(p.id,commentInputProf);}},
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
      activeTab==='friends' ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'Experts You Follow'),
        FRIENDS.map(function(f,i){
          return React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px',marginBottom:'8px'}},
            React.createElement('div',{style:{width:'40px',height:'40px',borderRadius:'50%',background:f.color,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#fff',flexShrink:0}},
              f.img ? React.createElement('img',{src:f.img,alt:f.name,style:{width:'100%',height:'100%',objectFit:'cover'}}) : f.initials
            ),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{style:{fontSize:'13px',fontWeight:600,color:'var(--text)'}},f.name),
              React.createElement('div',{style:{fontSize:'10px',color:'var(--t2)'}},f.role)
            ),
            React.createElement('button',{onClick:function(){toggleFollow(String(f.id||f.name),f.name,f.img,f.role);},style:{fontSize:'10px',color:following[String(f.id||f.name)]?'var(--ac)':'#fff',background:following[String(f.id||f.name)]?'var(--acg)':'var(--ac)',border:following[String(f.id||f.name)]?'1px solid var(--ac)':'none',padding:'5px 10px',borderRadius:'20px',cursor:'pointer',fontWeight:600}},following[String(f.id||f.name)]?'Following':'+Follow')
          );
        })
      ) : null,
      // SKILLS TAB
      activeTab==='skills' ? React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--t2)',marginBottom:'10px'}},'Skills Learned'),
        SKILLS.map(function(s,i){
          return React.createElement('div',{key:i,style:{marginBottom:'14px'}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:'5px'}},
              React.createElement('span',{style:{fontSize:'12px',fontWeight:500,color:'var(--text)'}},s.label),
              React.createElement('span',{style:{fontSize:'11px',color:'var(--ac)'}},s.level+'%')
            ),
            React.createElement('div',{style:{height:'6px',background:'var(--bg4)',borderRadius:'10px',overflow:'hidden'}},
              React.createElement('div',{style:{height:'100%',width:s.level+'%',background:'linear-gradient(135deg,#7B6EFF,#E84D9A)',borderRadius:'10px'}})
            )
          );
        })
      ) : null,
      // REVIEWS TAB
      activeTab==='reviews' ? React.createElement('div',null,
        REVIEWS.map(function(r,i){
          return React.createElement('div',{key:i,style:{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'12px',padding:'12px',marginBottom:'10px'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}},
              React.createElement('div',{style:{width:'32px',height:'32px',borderRadius:'50%',overflow:'hidden',background:'var(--bg4)',flexShrink:0}},
                React.createElement('img',{src:r.img,alt:r.name,style:{width:'100%',height:'100%',objectFit:'cover'}})
              ),
              React.createElement('div',{style:{flex:1}},
                React.createElement('div',{style:{fontSize:'12px',fontWeight:600,color:'var(--text)'}},r.name),
                React.createElement('div',{style:{fontSize:'10px',color:'#F5A623'}},'⭐'.repeat(r.rating))
              ),
              React.createElement('span',{style:{fontSize:'10px',color:'var(--t3)'}},r.time)
            ),
            React.createElement('div',{style:{fontSize:'12px',color:'var(--t2)',lineHeight:1.5}},r.text)
          );
        })
      ) : null
    )
  );
}
