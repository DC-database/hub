/* ==========================================================================
   iba-1705-place.js — 17.0.5 patch 17 (patch 19: Gulf time zones = Qatar,
   district code in Qatar from the device location)
   Where an approval was given: a 3-letter country code at the end of the
   ESN, e.g. "AB12C3D4E5/ALI/QAT" in Qatar or "AB12C3D4E5/ALI/CHN" in China.
   It comes from the device's time zone (phones and laptops change it by
   themselves when they land abroad), so nothing is asked and no outside
   service is used. Unknown time zone = no code (the ESN stays as before).
   window.ibaEsnPlace()      -> 'QAT' / 'CHN' / ''
   window.ibaEsnWithPlace(e) -> e + '/CODE' (only when e has no place yet)
   ========================================================================== */
(function () {
  'use strict';
  if (window.ibaEsnPlace) return;
  // ISO 3166 alpha-3 country -> its IANA time zones (from tzdata zone.tab + links)
  var BY_COUNTRY = {"ABW":"America/Aruba","AFG":"Asia/Kabul","AGO":"Africa/Luanda","AIA":"America/Anguilla","ALA":"Europe/Mariehamn","ALB":"Europe/Tirane","AND":"Europe/Andorra","ARE":"Asia/Dubai","ARG":"America/Argentina/Buenos_Aires|America/Argentina/Catamarca|America/Argentina/ComodRivadavia|America/Argentina/Cordoba|America/Argentina/Jujuy|America/Argentina/La_Rioja|America/Argentina/Mendoza|America/Argentina/Rio_Gallegos|America/Argentina/Salta|America/Argentina/San_Juan|America/Argentina/San_Luis|America/Argentina/Tucuman|America/Argentina/Ushuaia|America/Buenos_Aires|America/Catamarca|America/Cordoba|America/Jujuy|America/Mendoza|America/Rosario","ARM":"Asia/Yerevan","ASM":"Pacific/Pago_Pago|Pacific/Samoa|US/Samoa","ATA":"Antarctica/Casey|Antarctica/Davis|Antarctica/DumontDUrville|Antarctica/Mawson|Antarctica/McMurdo|Antarctica/Palmer|Antarctica/Rothera|Antarctica/South_Pole|Antarctica/Syowa|Antarctica/Troll|Antarctica/Vostok","ATF":"Indian/Kerguelen","ATG":"America/Antigua","AUS":"Antarctica/Macquarie|Australia/ACT|Australia/Adelaide|Australia/Brisbane|Australia/Broken_Hill|Australia/Canberra|Australia/Currie|Australia/Darwin|Australia/Eucla|Australia/Hobart|Australia/LHI|Australia/Lindeman|Australia/Lord_Howe|Australia/Melbourne|Australia/NSW|Australia/North|Australia/Perth|Australia/Queensland|Australia/South|Australia/Sydney|Australia/Tasmania|Australia/Victoria|Australia/West|Australia/Yancowinna","AUT":"Europe/Vienna","AZE":"Asia/Baku","BDI":"Africa/Bujumbura","BEL":"Europe/Brussels","BEN":"Africa/Porto-Novo","BES":"America/Kralendijk","BFA":"Africa/Ouagadougou","BGD":"Asia/Dacca|Asia/Dhaka","BGR":"Europe/Sofia","BHR":"Asia/Bahrain","BHS":"America/Nassau","BIH":"Europe/Sarajevo","BLM":"America/St_Barthelemy","BLR":"Europe/Minsk","BLZ":"America/Belize","BMU":"Atlantic/Bermuda","BOL":"America/La_Paz","BRA":"America/Araguaina|America/Bahia|America/Belem|America/Boa_Vista|America/Campo_Grande|America/Cuiaba|America/Eirunepe|America/Fortaleza|America/Maceio|America/Manaus|America/Noronha|America/Porto_Acre|America/Porto_Velho|America/Recife|America/Rio_Branco|America/Santarem|America/Sao_Paulo|Brazil/Acre|Brazil/DeNoronha|Brazil/East|Brazil/West","BRB":"America/Barbados","BRN":"Asia/Brunei","BTN":"Asia/Thimbu|Asia/Thimphu","BWA":"Africa/Gaborone","CAF":"Africa/Bangui","CAN":"America/Atikokan|America/Blanc-Sablon|America/Cambridge_Bay|America/Coral_Harbour|America/Creston|America/Dawson|America/Dawson_Creek|America/Edmonton|America/Fort_Nelson|America/Glace_Bay|America/Goose_Bay|America/Halifax|America/Inuvik|America/Iqaluit|America/Moncton|America/Montreal|America/Nipigon|America/Pangnirtung|America/Rainy_River|America/Rankin_Inlet|America/Regina|America/Resolute|America/St_Johns|America/Swift_Current|America/Thunder_Bay|America/Toronto|America/Vancouver|America/Whitehorse|America/Winnipeg|America/Yellowknife|Canada/Atlantic|Canada/Central|Canada/Eastern|Canada/Mountain|Canada/Newfoundland|Canada/Pacific|Canada/Saskatchewan|Canada/Yukon","CCK":"Indian/Cocos","CHE":"Europe/Zurich","CHL":"America/Coyhaique|America/Punta_Arenas|America/Santiago|Chile/Continental|Chile/EasterIsland|Pacific/Easter","CHN":"Asia/Chongqing|Asia/Chungking|Asia/Harbin|Asia/Kashgar|Asia/Shanghai|Asia/Urumqi|PRC","CIV":"Africa/Abidjan","CMR":"Africa/Douala","COD":"Africa/Kinshasa|Africa/Lubumbashi","COG":"Africa/Brazzaville","COK":"Pacific/Rarotonga","COL":"America/Bogota","COM":"Indian/Comoro","CPV":"Atlantic/Cape_Verde","CRI":"America/Costa_Rica","CUB":"America/Havana|Cuba","CUW":"America/Curacao","CXR":"Indian/Christmas","CYM":"America/Cayman","CYP":"Asia/Famagusta|Asia/Nicosia|Europe/Nicosia","CZE":"Europe/Prague","DEU":"Europe/Berlin|Europe/Busingen","DJI":"Africa/Djibouti","DMA":"America/Dominica","DNK":"Europe/Copenhagen","DOM":"America/Santo_Domingo","DZA":"Africa/Algiers","ECU":"America/Guayaquil|Pacific/Galapagos","EGY":"Africa/Cairo|Egypt","ERI":"Africa/Asmara|Africa/Asmera","ESH":"Africa/El_Aaiun","ESP":"Africa/Ceuta|Atlantic/Canary|Europe/Madrid","EST":"Europe/Tallinn","ETH":"Africa/Addis_Ababa","FIN":"Europe/Helsinki","FJI":"Pacific/Fiji","FLK":"Atlantic/Stanley","FRA":"Europe/Paris","FRO":"Atlantic/Faeroe|Atlantic/Faroe","FSM":"Pacific/Chuuk|Pacific/Kosrae|Pacific/Pohnpei|Pacific/Ponape|Pacific/Truk|Pacific/Yap","GAB":"Africa/Libreville","GBR":"Europe/Belfast|Europe/London|GB|GB-Eire","GEO":"Asia/Tbilisi","GGY":"Europe/Guernsey","GHA":"Africa/Accra","GIB":"Europe/Gibraltar","GIN":"Africa/Conakry","GLP":"America/Guadeloupe","GMB":"Africa/Banjul","GNB":"Africa/Bissau","GNQ":"Africa/Malabo","GRC":"Europe/Athens","GRD":"America/Grenada","GRL":"America/Danmarkshavn|America/Godthab|America/Nuuk|America/Scoresbysund|America/Thule","GTM":"America/Guatemala","GUF":"America/Cayenne","GUM":"Pacific/Guam","GUY":"America/Guyana","HKG":"Asia/Hong_Kong|Hongkong","HND":"America/Tegucigalpa","HRV":"Europe/Zagreb","HTI":"America/Port-au-Prince","HUN":"Europe/Budapest","IDN":"Asia/Jakarta|Asia/Jayapura|Asia/Makassar|Asia/Pontianak|Asia/Ujung_Pandang","IMN":"Europe/Isle_of_Man","IND":"Asia/Calcutta|Asia/Kolkata","IOT":"Indian/Chagos","IRL":"Eire|Europe/Dublin","IRN":"Asia/Tehran|Iran","IRQ":"Asia/Baghdad","ISL":"Atlantic/Reykjavik|Iceland","ISR":"Asia/Jerusalem|Asia/Tel_Aviv|Israel","ITA":"Europe/Rome","JAM":"America/Jamaica|Jamaica","JEY":"Europe/Jersey","JOR":"Asia/Amman","JPN":"Asia/Tokyo|Japan","KAZ":"Asia/Almaty|Asia/Aqtau|Asia/Aqtobe|Asia/Atyrau|Asia/Oral|Asia/Qostanay|Asia/Qyzylorda","KEN":"Africa/Nairobi","KGZ":"Asia/Bishkek","KHM":"Asia/Phnom_Penh","KIR":"Pacific/Enderbury|Pacific/Kanton|Pacific/Kiritimati|Pacific/Tarawa","KNA":"America/St_Kitts","KOR":"Asia/Seoul|ROK","KWT":"Asia/Kuwait","LAO":"Asia/Vientiane","LBN":"Asia/Beirut","LBR":"Africa/Monrovia","LBY":"Africa/Tripoli|Libya","LCA":"America/St_Lucia","LIE":"Europe/Vaduz","LKA":"Asia/Colombo","LSO":"Africa/Maseru","LTU":"Europe/Vilnius","LUX":"Europe/Luxembourg","LVA":"Europe/Riga","MAC":"Asia/Macao|Asia/Macau","MAF":"America/Marigot","MAR":"Africa/Casablanca","MCO":"Europe/Monaco","MDA":"Europe/Chisinau|Europe/Tiraspol","MDG":"Indian/Antananarivo","MDV":"Indian/Maldives","MEX":"America/Bahia_Banderas|America/Cancun|America/Chihuahua|America/Ciudad_Juarez|America/Ensenada|America/Hermosillo|America/Matamoros|America/Mazatlan|America/Merida|America/Mexico_City|America/Monterrey|America/Ojinaga|America/Santa_Isabel|America/Tijuana|Mexico/BajaNorte|Mexico/BajaSur|Mexico/General","MHL":"Kwajalein|Pacific/Kwajalein|Pacific/Majuro","MKD":"Europe/Skopje","MLI":"Africa/Bamako|Africa/Timbuktu","MLT":"Europe/Malta","MMR":"Asia/Rangoon|Asia/Yangon","MNE":"Europe/Podgorica","MNG":"Asia/Choibalsan|Asia/Hovd|Asia/Ulaanbaatar|Asia/Ulan_Bator","MNP":"Pacific/Saipan","MOZ":"Africa/Maputo","MRT":"Africa/Nouakchott","MSR":"America/Montserrat","MTQ":"America/Martinique","MUS":"Indian/Mauritius","MWI":"Africa/Blantyre","MYS":"Asia/Kuala_Lumpur|Asia/Kuching","MYT":"Indian/Mayotte","NAM":"Africa/Windhoek","NCL":"Pacific/Noumea","NER":"Africa/Niamey","NFK":"Pacific/Norfolk","NGA":"Africa/Lagos","NIC":"America/Managua","NIU":"Pacific/Niue","NLD":"Europe/Amsterdam","NOR":"Atlantic/Jan_Mayen|Europe/Oslo","NPL":"Asia/Kathmandu|Asia/Katmandu","NRU":"Pacific/Nauru","NZL":"NZ|NZ-CHAT|Pacific/Auckland|Pacific/Chatham","OMN":"Asia/Muscat","PAK":"Asia/Karachi","PAN":"America/Panama","PCN":"Pacific/Pitcairn","PER":"America/Lima","PHL":"Asia/Manila","PLW":"Pacific/Palau","PNG":"Pacific/Bougainville|Pacific/Port_Moresby","POL":"Europe/Warsaw|Poland","PRI":"America/Puerto_Rico","PRK":"Asia/Pyongyang","PRT":"Atlantic/Azores|Atlantic/Madeira|Europe/Lisbon|Portugal","PRY":"America/Asuncion","PSE":"Asia/Gaza|Asia/Hebron","PYF":"Pacific/Gambier|Pacific/Marquesas|Pacific/Tahiti","QAT":"Asia/Qatar","REU":"Indian/Reunion","ROU":"Europe/Bucharest","RUS":"Asia/Anadyr|Asia/Barnaul|Asia/Chita|Asia/Irkutsk|Asia/Kamchatka|Asia/Khandyga|Asia/Krasnoyarsk|Asia/Magadan|Asia/Novokuznetsk|Asia/Novosibirsk|Asia/Omsk|Asia/Sakhalin|Asia/Srednekolymsk|Asia/Tomsk|Asia/Ust-Nera|Asia/Vladivostok|Asia/Yakutsk|Asia/Yekaterinburg|Europe/Astrakhan|Europe/Kaliningrad|Europe/Kirov|Europe/Moscow|Europe/Samara|Europe/Saratov|Europe/Ulyanovsk|Europe/Volgograd|W-SU","RWA":"Africa/Kigali","SAU":"Asia/Riyadh","SDN":"Africa/Khartoum","SEN":"Africa/Dakar","SGP":"Asia/Singapore|Singapore","SGS":"Atlantic/South_Georgia","SHN":"Atlantic/St_Helena","SJM":"Arctic/Longyearbyen","SLB":"Pacific/Guadalcanal","SLE":"Africa/Freetown","SLV":"America/El_Salvador","SMR":"Europe/San_Marino","SOM":"Africa/Mogadishu","SPM":"America/Miquelon","SRB":"Europe/Belgrade","SSD":"Africa/Juba","STP":"Africa/Sao_Tome","SUR":"America/Paramaribo","SVK":"Europe/Bratislava","SVN":"Europe/Ljubljana","SWE":"Europe/Stockholm","SWZ":"Africa/Mbabane","SXM":"America/Lower_Princes","SYC":"Indian/Mahe","SYR":"Asia/Damascus","TCA":"America/Grand_Turk","TCD":"Africa/Ndjamena","TGO":"Africa/Lome","THA":"Asia/Bangkok","TJK":"Asia/Dushanbe","TKL":"Pacific/Fakaofo","TKM":"Asia/Ashgabat|Asia/Ashkhabad","TLS":"Asia/Dili","TON":"Pacific/Tongatapu","TTO":"America/Port_of_Spain","TUN":"Africa/Tunis","TUR":"Asia/Istanbul|Europe/Istanbul|Turkey","TUV":"Pacific/Funafuti","TWN":"Asia/Taipei|ROC","TZA":"Africa/Dar_es_Salaam","UGA":"Africa/Kampala","UKR":"Europe/Kiev|Europe/Kyiv|Europe/Simferopol|Europe/Uzhgorod|Europe/Zaporozhye","UMI":"Pacific/Midway|Pacific/Wake","URY":"America/Montevideo","USA":"America/Adak|America/Anchorage|America/Atka|America/Boise|America/Chicago|America/Denver|America/Detroit|America/Fort_Wayne|America/Indiana/Indianapolis|America/Indiana/Knox|America/Indiana/Marengo|America/Indiana/Petersburg|America/Indiana/Tell_City|America/Indiana/Vevay|America/Indiana/Vincennes|America/Indiana/Winamac|America/Indianapolis|America/Juneau|America/Kentucky/Louisville|America/Kentucky/Monticello|America/Knox_IN|America/Los_Angeles|America/Louisville|America/Menominee|America/Metlakatla|America/New_York|America/Nome|America/North_Dakota/Beulah|America/North_Dakota/Center|America/North_Dakota/New_Salem|America/Phoenix|America/Shiprock|America/Sitka|America/Yakutat|Navajo|Pacific/Honolulu|Pacific/Johnston|US/Alaska|US/Aleutian|US/Arizona|US/Central|US/East-Indiana|US/Eastern|US/Hawaii|US/Indiana-Starke|US/Michigan|US/Mountain|US/Pacific","UZB":"Asia/Samarkand|Asia/Tashkent","VAT":"Europe/Vatican","VCT":"America/St_Vincent","VEN":"America/Caracas","VGB":"America/Tortola","VIR":"America/St_Thomas|America/Virgin","VNM":"Asia/Ho_Chi_Minh|Asia/Saigon","VUT":"Pacific/Efate","WLF":"Pacific/Wallis","WSM":"Pacific/Apia","YEM":"Asia/Aden","ZAF":"Africa/Johannesburg","ZMB":"Africa/Lusaka","ZWE":"Africa/Harare"};
  var MAP = null;
  function map() {
    if (MAP) return MAP;
    MAP = {};
    Object.keys(BY_COUNTRY).forEach(function (c) { BY_COUNTRY[c].split('|').forEach(function (z) { MAP[z] = c; }); });
    return MAP;
  }
  // 17.0.5 patch 19: Windows in Qatar is usually set to "(UTC+03:00) Kuwait,
  // Riyadh", which the browser reports as Asia/Riyadh (= SAU). These Gulf
  // zones share Qatar's clock, so they count as Qatar. (A trip to Saudi,
  // Kuwait or Bahrain therefore also shows QAT.)
  var HOME = { 'Asia/Qatar': 1, 'Asia/Riyadh': 1, 'Asia/Kuwait': 1, 'Asia/Bahrain': 1, 'Asia/Aden': 1 };
  function place() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { tz = ''; }
    if (HOME[tz]) return 'QAT';
    return map()[tz] || '';
  }
  // 17.0.5 patch 19: in Qatar, the district from the device location
  // (the browser asks "Allow location?" once; No = just QAT). Nearest
  // centre from this list; martin can rename codes or add places here.
  var QATAR_BOX = { s: 24.45, n: 26.25, w: 50.70, e: 51.70 };
  var DISTRICTS = [
    ['WBY', 'West Bay', 25.3240, 51.5310], ['PRL', 'The Pearl', 25.3700, 51.5500], ['KTR', 'Katara', 25.3600, 51.5250],
    ['LUS', 'Lusail', 25.4200, 51.4900], ['ONZ', 'Onaiza', 25.3400, 51.5150], ['MRK', 'Al Markhiya', 25.3300, 51.4950],
    ['DHL', 'Duhail', 25.3500, 51.4800], ['GHR', 'Al Gharafa', 25.3400, 51.4500], ['MKH', 'Madinat Khalifa', 25.3150, 51.4800],
    ['SAD', 'Al Sadd', 25.2840, 51.4980], ['BMH', 'Bin Mahmoud', 25.2870, 51.5130], ['MSH', 'Msheireb', 25.2860, 51.5270],
    ['MNS', 'Al Mansoura', 25.2700, 51.5300], ['NJM', 'Najma', 25.2700, 51.5400], ['HLW', 'Al Hilal West', 25.2570, 51.5280],
    ['HLE', 'Al Hilal East', 25.2550, 51.5450], ['OAP', 'Old Airport', 25.2480, 51.5560], ['NUA', 'Nuaija', 25.2450, 51.5180],
    ['THU', 'Al Thumama', 25.2250, 51.5450], ['HIA', 'Hamad Airport', 25.2730, 51.6080], ['AHM', 'Abu Hamour', 25.2400, 51.5000],
    ['AKH', 'Ain Khaled', 25.2250, 51.4800], ['WAB', 'Al Waab', 25.2600, 51.4700], ['MSL', 'Al Messila', 25.2900, 51.4650],
    ['AZZ', 'Al Aziziya', 25.2550, 51.4500], ['RYN', 'Al Rayyan', 25.2900, 51.4250], ['MTR', 'Muaither', 25.2700, 51.3950],
    ['SLY', 'Al Sailiya', 25.2100, 51.3800], ['IND', 'Industrial Area', 25.2000, 51.4400], ['WKR', 'Al Wukair', 25.1500, 51.5400],
    ['WAK', 'Al Wakra', 25.1700, 51.6000], ['MES', 'Mesaieed', 24.9900, 51.5500], ['UMS', 'Umm Salal', 25.4100, 51.4100],
    ['KHR', 'Al Khor', 25.6800, 51.5000], ['RLF', 'Ras Laffan', 25.9000, 51.5500], ['SHM', 'Al Shamal', 26.1200, 51.2000],
    ['DKN', 'Dukhan', 25.4300, 50.7800]
  ];
  function district(lat, lng) {
    var best = null, bd = 1e9, k = Math.cos(lat * Math.PI / 180);
    DISTRICTS.forEach(function (d) {
      var dy = lat - d[2], dx = (lng - d[3]) * k, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = d; }
    });
    return best ? best[0] : 'QAT';
  }
  var fix = null; // { code, at }
  var FIX_MS = 15 * 60 * 1000;
  function locate(waitMs) {
    return new Promise(function (done) {
      var finished = false;
      var end = function (v) { if (!finished) { finished = true; done(v); } };
      setTimeout(function () { end(null); }, waitMs);
      try {
        if (!navigator.geolocation) return end(null);
        navigator.geolocation.getCurrentPosition(function (p) { end(p && p.coords); }, function () { end(null); },
          { enableHighAccuracy: false, timeout: Math.max(1000, waitMs - 500), maximumAge: 10 * 60 * 1000 });
      } catch (_) { end(null); }
    });
  }
  // async: country abroad (no question asked), district in Qatar
  function placeAsync() {
    var code = place();
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    if (!HOME[tz]) return Promise.resolve(code);
    if (fix && Date.now() - fix.at < FIX_MS) return Promise.resolve(fix.code);
    // up to 12 s, so the first "Allow location?" can be answered; then plain QAT
    return locate(12000).then(function (c) {
      if (!c) return 'QAT';
      var lat = c.latitude, lng = c.longitude, b = QATAR_BOX;
      var out = (lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e) ? district(lat, lng) : (map()[tz] || 'QAT');
      fix = { code: out, at: Date.now() };
      return out;
    });
  }
  function withPlaceAsync(esn) {
    var s = String(esn || '');
    if (!s || s.split('/').length >= 3) return Promise.resolve(s);
    return placeAsync().then(function (code) { return code ? s + '/' + code : s; }, function () { return s; });
  }
  window.ibaEsnPlaceAsync = placeAsync;
  window.ibaEsnWithPlaceAsync = withPlaceAsync;
  window.ibaEsnDistricts = DISTRICTS;

  function withPlace(esn) {
    var s = String(esn || '');
    var code = place();
    if (!s || !code || s.split('/').length >= 3) return s;
    return s + '/' + code;
  }
  window.ibaEsnPlace = place;
  window.ibaEsnWithPlace = withPlace;
})();
