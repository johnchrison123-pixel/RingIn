/* eslint-disable */
/* ════════════════════════════════════════════════════════════════════
 * worldCities.js — autosuggest list for hometown + current city inputs.
 *
 * NOT exhaustive — but covers the geographies RingIn cares about:
 *   - Every district HQ in Kerala
 *   - All Indian state capitals + tier-1/tier-2 cities
 *   - Every Gulf city with a Malayalee population
 *   - Major UK/US/Canada/Australia/Singapore/Pakistan diaspora hubs
 *
 * Stored as a flat array. Search is plain substring match (case-
 * insensitive). The autosuggest only displays cities ONCE the user
 * starts typing — never as a flat dropdown.
 * ════════════════════════════════════════════════════════════════════ */

export var WORLD_CITIES = [
  /* ── Kerala — every district HQ + popular towns ── */
  'Kochi','Ernakulam','Kozhikode','Calicut','Thiruvananthapuram','Trivandrum',
  'Thrissur','Kollam','Quilon','Kannur','Cannanore','Palakkad','Malappuram',
  'Kasaragod','Pathanamthitta','Idukki','Kottayam','Alappuzha','Alleppey',
  'Wayanad','Kalpetta','Aluva','Angamaly','Perumbavoor','Muvattupuzha',
  'Thodupuzha','Pala','Changanassery','Chengannur','Tiruvalla','Adoor',
  'Kayamkulam','Mavelikkara','Karunagappally','Cherthala','Kunnamkulam',
  'Guruvayur','Chalakudy','Aluva','Kothamangalam','Vadakara','Thalassery',
  'Tellicherry','Payyannur','Taliparamba','Tirur','Ponnani','Manjeri','Nilambur',
  'Mannarkkad','Ottapalam','Chittur','Cherpulassery','Shoranur','Pattambi',
  'Kanjirappally','Vaikom','Ettumanoor','Kumarakom','Munnar','Thekkady',
  'Varkala','Kovalam','Neyyattinkara','Punalur','Pathanapuram','Sasthamcotta',

  /* ── India metros + state capitals ── */
  'Mumbai','Delhi','New Delhi','Bangalore','Bengaluru','Hyderabad','Chennai',
  'Madras','Kolkata','Calcutta','Pune','Ahmedabad','Surat','Jaipur','Lucknow',
  'Kanpur','Nagpur','Indore','Thane','Bhopal','Visakhapatnam','Vizag','Patna',
  'Vadodara','Baroda','Ghaziabad','Ludhiana','Agra','Nashik','Faridabad',
  'Meerut','Rajkot','Kalyan','Vasai','Varanasi','Banaras','Srinagar','Aurangabad',
  'Dhanbad','Amritsar','Navi Mumbai','Allahabad','Prayagraj','Ranchi','Howrah',
  'Coimbatore','Jabalpur','Gwalior','Vijayawada','Jodhpur','Madurai','Raipur',
  'Kota','Guwahati','Chandigarh','Mysore','Mysuru','Mangalore','Mangaluru',
  'Hubli','Belgaum','Davanagere','Tirunelveli','Tiruchirappalli','Trichy','Salem',
  'Erode','Vellore','Tirupur','Tiruppur','Tuticorin','Thoothukudi','Pondicherry',
  'Puducherry','Cuddalore','Karaikal','Nellore','Tirupati','Warangal','Karimnagar',
  'Khammam','Nizamabad','Adilabad','Mahbubnagar','Eluru','Anantapur','Kurnool',
  'Kadapa','Cuttack','Bhubaneswar','Rourkela','Sambalpur','Berhampur','Brahmapur',
  'Asansol','Siliguri','Durgapur','Bardhaman','Burdwan','Malda','Jamshedpur',
  'Bokaro','Hazaribagh','Patiala','Bathinda','Mohali','Panipat','Hisar','Rohtak',
  'Karnal','Sonipat','Gurgaon','Gurugram','Noida','Greater Noida',

  /* ── Gulf — every Malayalee-relevant city ── */
  'Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Al Ain',
  'Umm Al Quwain',
  'Riyadh','Jeddah','Mecca','Makkah','Medina','Madinah','Dammam','Khobar',
  'Al Khobar','Dhahran','Jubail','Yanbu','Tabuk','Abha','Hail','Al Hasa','Buraydah',
  'Najran','Khamis Mushait','Taif',
  'Doha','Al Wakra','Al Khor',
  'Kuwait City','Salmiya','Hawally','Mubarak Al-Kabeer','Farwaniya',
  'Manama','Riffa','Muharraq',
  'Muscat','Salalah','Sohar','Sur','Nizwa',

  /* ── UK ── */
  'London','Manchester','Birmingham','Liverpool','Leeds','Sheffield','Bristol',
  'Newcastle','Edinburgh','Glasgow','Cardiff','Belfast','Oxford','Cambridge',
  'Brighton','Reading','Leicester','Nottingham','Coventry','Hull','Plymouth',
  'Stoke-on-Trent','Wolverhampton','Sunderland','Aberdeen','Dundee',

  /* ── USA ── */
  'New York','New York City','NYC','Los Angeles','LA','Chicago','Houston','Phoenix',
  'Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin',
  'Jacksonville','Fort Worth','Columbus','Indianapolis','Charlotte','San Francisco',
  'SF','Seattle','Denver','Washington','Washington DC','Boston','El Paso',
  'Nashville','Detroit','Portland','Memphis','Oklahoma City','Las Vegas','Louisville',
  'Baltimore','Milwaukee','Albuquerque','Tucson','Fresno','Sacramento','Mesa',
  'Kansas City','Atlanta','Long Beach','Colorado Springs','Raleigh','Miami','Tampa',
  'Orlando','Jersey City','Newark','Pittsburgh','Cincinnati','Cleveland','Minneapolis',
  'Saint Paul','St Paul','Wichita','Arlington','New Orleans','Honolulu','Anchorage',
  'Plano','Irving','Frisco','Sunnyvale','Cupertino','Redmond','Bellevue','Edison',
  'Iselin','Jericho','Hicksville','Princeton',

  /* ── Canada ── */
  'Toronto','Vancouver','Montreal','Calgary','Edmonton','Ottawa','Winnipeg',
  'Mississauga','Brampton','Hamilton','Kitchener','Waterloo','London Ontario',
  'Halifax','Surrey','Burnaby','Markham','Vaughan','Regina','Saskatoon','Victoria',
  'Quebec City','Windsor','Sherbrooke',

  /* ── Australia + NZ ── */
  'Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Newcastle Australia',
  'Canberra','Wollongong','Hobart','Geelong','Darwin','Cairns','Townsville',
  'Auckland','Wellington','Christchurch','Hamilton NZ',

  /* ── Singapore + Malaysia ── */
  'Singapore','Kuala Lumpur','KL','George Town','Penang','Johor Bahru','Ipoh',
  'Shah Alam','Petaling Jaya','Subang Jaya','Klang',

  /* ── Pakistan ── */
  'Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar',
  'Quetta','Sialkot','Gujranwala','Hyderabad Pakistan',

  /* ── Bangladesh, Sri Lanka, Nepal ── */
  'Dhaka','Chittagong','Sylhet','Colombo','Kandy','Galle','Kathmandu','Pokhara',

  /* ── Europe ── */
  'Paris','Marseille','Lyon','Berlin','Hamburg','Munich','Frankfurt','Cologne',
  'Stuttgart','Düsseldorf','Madrid','Barcelona','Valencia','Seville','Rome',
  'Milan','Naples','Turin','Florence','Venice','Amsterdam','Rotterdam','The Hague',
  'Brussels','Antwerp','Zurich','Geneva','Vienna','Stockholm','Copenhagen','Oslo',
  'Helsinki','Warsaw','Krakow','Prague','Budapest','Lisbon','Porto','Athens',
  'Istanbul','Dublin','Cork','Reykjavik','Tallinn','Riga','Vilnius',

  /* ── East Asia ── */
  'Tokyo','Osaka','Kyoto','Yokohama','Nagoya','Sapporo','Fukuoka','Hiroshima',
  'Seoul','Busan','Incheon','Daegu','Beijing','Shanghai','Guangzhou','Shenzhen',
  'Chengdu','Hong Kong','Macau','Taipei','Kaohsiung',

  /* ── Middle East (non-Gulf) ── */
  'Tehran','Mashhad','Isfahan','Tel Aviv','Jerusalem','Amman','Beirut','Damascus',
  'Cairo','Alexandria','Casablanca','Tunis','Algiers',

  /* ── Africa ── */
  'Lagos','Abuja','Nairobi','Mombasa','Dar es Salaam','Addis Ababa','Johannesburg',
  'Cape Town','Pretoria','Durban','Accra','Kigali','Kampala',

  /* ── South America ── */
  'São Paulo','Sao Paulo','Rio de Janeiro','Brasilia','Buenos Aires','Santiago',
  'Lima','Bogota','Caracas','Montevideo','Quito',

  /* ── Russia + Central Asia ── */
  'Moscow','Saint Petersburg','St Petersburg','Novosibirsk','Yekaterinburg',
  'Almaty','Tashkent','Baku','Tbilisi','Yerevan','Astana'
];

/* Filter cities by a search prefix/substring. Returns up to N matches.
 * Case-insensitive; sorts exact-prefix matches above mid-substring. */
export function searchCities(q, maxResults) {
  if (!q || typeof q !== 'string') return [];
  var qq = q.trim().toLowerCase();
  if (qq.length < 1) return [];
  var prefix = [];
  var mid = [];
  for (var i = 0; i < WORLD_CITIES.length; i++) {
    var c = WORLD_CITIES[i];
    var lc = c.toLowerCase();
    if (lc === qq) {
      prefix.unshift(c);
      continue;
    }
    if (lc.indexOf(qq) === 0) {
      prefix.push(c);
    } else if (lc.indexOf(qq) > 0) {
      mid.push(c);
    }
  }
  var out = prefix.concat(mid);
  var cap = (typeof maxResults === 'number' && maxResults > 0) ? maxResults : 12;
  return out.slice(0, cap);
}
