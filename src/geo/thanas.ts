// The metropolitan police thanas, the city areas nuhil's upazilas leave out (Dhaka district's
// upazilas are only Savar, Dhamrai, Keraniganj, Nawabganj and Dohar). Each names the public page its
// English name came from, and sourceBn the page of its Bangla name when that is another. English
// names drop "Thana" and "Model", and DMP's Tejgoan, Khilgoan, Jattrabari, Kodomtali and Chalkbazar
// are written as people spell them (Tejgaon, Khilgaon, Jatrabari, Kadamtali, Chawkbazar). A thana
// that is also an upazila of its district (Paba, Dakshin Surma) is left to the upazila list.

const PAGE_1 = 'https://dmp.gov.bd/find-your-local-police'
const PAGE_2 =
  'https://bn.wikipedia.org/wiki/%E0%A6%A2%E0%A6%BE%E0%A6%95%E0%A6%BE_%E0%A6%AE%E0%A7%87%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%AA%E0%A6%B2%E0%A6%BF%E0%A6%9F%E0%A6%A8_%E0%A6%AA%E0%A7%81%E0%A6%B2%E0%A6%BF%E0%A6%B6'
const PAGE_3 = 'https://www.cmp.gov.bd/index.php?cPath=295'
const PAGE_4 =
  'https://bn.wikipedia.org/wiki/%E0%A6%9A%E0%A6%9F%E0%A7%8D%E0%A6%9F%E0%A6%97%E0%A7%8D%E0%A6%B0%E0%A6%BE%E0%A6%AE_%E0%A6%AE%E0%A7%87%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%AA%E0%A6%B2%E0%A6%BF%E0%A6%9F%E0%A6%A8_%E0%A6%AA%E0%A7%81%E0%A6%B2%E0%A6%BF%E0%A6%B6'
const PAGE_5 = 'https://kmp.police.gov.bd/kmp-units'
const PAGE_6 =
  'https://bn.wikipedia.org/wiki/%E0%A6%96%E0%A7%81%E0%A6%B2%E0%A6%A8%E0%A6%BE_%E0%A6%AE%E0%A7%87%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%AA%E0%A6%B2%E0%A6%BF%E0%A6%9F%E0%A6%A8_%E0%A6%AA%E0%A7%81%E0%A6%B2%E0%A6%BF%E0%A6%B6'
const PAGE_7 = 'https://rmp.gov.bd/pages/static-pages/695e3b09c4774958d7b72177'
const PAGE_8 = 'https://smp.police.gov.bd/'
const PAGE_9 = 'https://bmp.police.gov.bd/'
const PAGE_10 =
  'https://bn.wikipedia.org/wiki/%E0%A6%B0%E0%A6%82%E0%A6%AA%E0%A7%81%E0%A6%B0_%E0%A6%AE%E0%A7%87%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%AA%E0%A6%B2%E0%A6%BF%E0%A6%9F%E0%A6%A8_%E0%A6%AA%E0%A7%81%E0%A6%B2%E0%A6%BF%E0%A6%B6'
const PAGE_11 =
  'https://bn.wikipedia.org/wiki/%E0%A6%97%E0%A6%BE%E0%A6%9C%E0%A7%80%E0%A6%AA%E0%A7%81%E0%A6%B0_%E0%A6%AE%E0%A7%87%E0%A6%9F%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%AA%E0%A6%B2%E0%A6%BF%E0%A6%9F%E0%A6%A8_%E0%A6%AA%E0%A7%81%E0%A6%B2%E0%A6%BF%E0%A6%B6'

export interface Thana {
  district: string
  name: string
  nameBn: string
  source: string
  sourceBn?: string
}

export const THANAS: Thana[] = [
  { district: 'Dhaka', name: 'Adabor', nameBn: 'আদাবর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Badda', nameBn: 'বাড্ডা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Banani', nameBn: 'বনানী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Bangshal', nameBn: 'বংশাল', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Bimanbandar', nameBn: 'বিমানবন্দর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Cantonment', nameBn: 'ক্যান্টনমেন্ট', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Chawkbazar', nameBn: 'চকবাজার', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Dakshin Khan', nameBn: 'দক্ষিণখান', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Darus-Salam', nameBn: 'দারুস সালাম', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Demra', nameBn: 'ডেমরা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Dhanmondi', nameBn: 'ধানমন্ডি', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Gandaria', nameBn: 'গেন্ডারিয়া', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Gulshan', nameBn: 'গুলশান', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Hazaribag', nameBn: 'হাজারীবাগ', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Jatrabari', nameBn: 'যাত্রাবাড়ী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Kafrul', nameBn: 'কাফরুল', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Kalabagan', nameBn: 'কলাবাগান', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Kamrangirchar', nameBn: 'কামরাঙ্গীরচর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Khilgaon', nameBn: 'খিলগাঁও', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Khilkhet', nameBn: 'খিলক্ষেত', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Kadamtali', nameBn: 'কদমতলী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Kotwali', nameBn: 'কোতোয়ালী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Lalbagh', nameBn: 'লালবাগ', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Mirpur', nameBn: 'মিরপুর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Mohammadpur', nameBn: 'মোহাম্মদপুর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Motijheel', nameBn: 'মতিঝিল', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Mugda', nameBn: 'মুগদা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'New Market', nameBn: 'নিউ মার্কেট', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Pallabi', nameBn: 'পল্লবী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Paltan', nameBn: 'পল্টন', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Ramna', nameBn: 'রমনা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Rampura', nameBn: 'রামপুরা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Rupnagar', nameBn: 'রূপনগর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Sabujbag', nameBn: 'সবুজবাগ', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Shah Ali', nameBn: 'শাহ আলী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Shahbag', nameBn: 'শাহবাগ', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Shahjahanpur', nameBn: 'শাহজাহানপুর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Sutrapur', nameBn: 'সূত্রাপুর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Shyampur', nameBn: 'শ্যামপুর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Sher e Bangla Nagar', nameBn: 'শেরে বাংলা নগর', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Tejgaon Industrial', nameBn: 'তেজগাঁও শিল্পাঞ্চল', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Tejgaon', nameBn: 'তেজগাঁও', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Turag', nameBn: 'তুরাগ', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Uttara East', nameBn: 'উত্তরা পূর্ব', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Uttara West', nameBn: 'উত্তরা পশ্চিম', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Uttar Khan', nameBn: 'উত্তরখান', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Bhasantek', nameBn: 'ভাষানটেক', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Vatara', nameBn: 'ভাটারা', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Wari', nameBn: 'ওয়ারী', source: PAGE_1, sourceBn: PAGE_2 },
  { district: 'Dhaka', name: 'Hatirjheel', nameBn: 'হাতিরঝিল', source: PAGE_2 },
  { district: 'Chattogram', name: 'Akbar Shah', nameBn: 'আকবর শাহ', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Bayazid Bostami', nameBn: 'বায়েজিদ বোস্তামী', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Chawk Bazar', nameBn: 'চকবাজার', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Kotwali', nameBn: 'কোতোয়ালী', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Bakolia', nameBn: 'বাকলিয়া', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Sadarghat', nameBn: 'সদরঘাট', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Doublemooring', nameBn: 'ডবলমুরিং', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Khulshi', nameBn: 'খুলশী', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Panchlaish', nameBn: 'পাঁচলাইশ', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Chandgaon', nameBn: 'চান্দগাঁও', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Halishahar', nameBn: 'হালিশহর', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Pahartali', nameBn: 'পাহাড়তলী', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Port', nameBn: 'বন্দর', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'EPZ', nameBn: 'ইপিজেড', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Patenga', nameBn: 'পতেঙ্গা', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Chattogram', name: 'Karnophuli', nameBn: 'কর্ণফুলি', source: PAGE_3, sourceBn: PAGE_4 },
  { district: 'Khulna', name: 'Khulna Sadar', nameBn: 'খুলনা সদর', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Sonadanga', nameBn: 'সোনাডাঙ্গা', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Labanchora', nameBn: 'লবণচরা', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Horintana', nameBn: 'হরিণটানা', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Khalishpur', nameBn: 'খালিশপুর', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Daulatpur', nameBn: 'দৌলতপুর', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Khanjahan Ali', nameBn: 'খানজাহান আলী', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Khulna', name: 'Aranghata', nameBn: 'আড়ংঘাটা', source: PAGE_5, sourceBn: PAGE_6 },
  { district: 'Rajshahi', name: 'Boalia', nameBn: 'বোয়ালিয়া', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Rajpara', nameBn: 'রাজপাড়া', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Chandrima', nameBn: 'চন্দ্রিমা', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Motihar', nameBn: 'মতিহার', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Katakhali', nameBn: 'কাটাখালী', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Belpukur', nameBn: 'বেলপুকুর', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Shah Makhdum', nameBn: 'শাহমখদুম', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Airport', nameBn: 'এয়ারপোর্ট', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Kashiadanga', nameBn: 'কাশিয়াডাঙ্গা', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Damkura', nameBn: 'দামকুড়া', source: PAGE_7 },
  { district: 'Rajshahi', name: 'Karnahar', nameBn: 'কর্ণহার', source: PAGE_7 },
  { district: 'Sylhet', name: 'Kotwali', nameBn: 'কোতোয়ালী', source: PAGE_8 },
  { district: 'Sylhet', name: 'Jalalabad', nameBn: 'জালালাবাদ', source: PAGE_8 },
  { district: 'Sylhet', name: 'Airport', nameBn: 'এয়ারপোর্ট', source: PAGE_8 },
  { district: 'Sylhet', name: 'Moglabazar', nameBn: 'মোগলাবাজার', source: PAGE_8 },
  { district: 'Sylhet', name: 'Shah Poran', nameBn: 'শাহপরান', source: PAGE_8 },
  { district: 'Barishal', name: 'Kotwali', nameBn: 'কোতোয়ালী', source: PAGE_9 },
  { district: 'Barishal', name: 'Bandar', nameBn: 'বন্দর', source: PAGE_9 },
  { district: 'Barishal', name: 'Kaunia', nameBn: 'কাউনিয়া', source: PAGE_9 },
  { district: 'Barishal', name: 'Airport', nameBn: 'এয়ারপোর্ট', source: PAGE_9 },
  { district: 'Rangpur', name: 'Kotwali', nameBn: 'কোতয়ালি', source: PAGE_10 },
  { district: 'Rangpur', name: 'Parshuram', nameBn: 'পরশুরাম', source: PAGE_10 },
  { district: 'Rangpur', name: 'Tajhat', nameBn: 'তাজহাট', source: PAGE_10 },
  { district: 'Rangpur', name: 'Mahiganj', nameBn: 'মাহিগঞ্জ', source: PAGE_10 },
  { district: 'Rangpur', name: 'Haragach', nameBn: 'হারাগাছ', source: PAGE_10 },
  { district: 'Rangpur', name: 'Hazirhat', nameBn: 'হাজীরহাট', source: PAGE_10 },
  { district: 'Gazipur', name: 'Sadar', nameBn: 'সদর', source: PAGE_11 },
  { district: 'Gazipur', name: 'Bason', nameBn: 'বাসন', source: PAGE_11 },
  { district: 'Gazipur', name: 'Konabari', nameBn: 'কোনাবাড়ী', source: PAGE_11 },
  { district: 'Gazipur', name: 'Kashimpur', nameBn: 'কাশিমপুর', source: PAGE_11 },
  { district: 'Gazipur', name: 'Gacha', nameBn: 'গাছা', source: PAGE_11 },
  { district: 'Gazipur', name: 'Pubail', nameBn: 'পূবাইল', source: PAGE_11 },
  { district: 'Gazipur', name: 'Tongi East', nameBn: 'টঙ্গী পূর্ব', source: PAGE_11 },
  { district: 'Gazipur', name: 'Tongi West', nameBn: 'টঙ্গী পশ্চিম', source: PAGE_11 },
]
