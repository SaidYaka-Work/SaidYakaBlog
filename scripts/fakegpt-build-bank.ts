/**
 * Builds static FakeGPT multiple-choice JSON from authored fact tables.
 * Run: node --import ./workers/fakegpt/node_modules/tsx/dist/loader.mjs scripts/fakegpt-build-bank.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuestion } from '../components/games/fakegpt/bank/validate.ts';
import type { BankKind, BankQuestion } from '../components/games/fakegpt/bank/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'components/games/fakegpt/bank/data');

const CAPITALS: Array<[string, string]> = [
  ['Kabul', 'Afghanistan'], ['Tirana', 'Albania'], ['Algiers', 'Algeria'], ['Andorra la Vella', 'Andorra'],
  ['Luanda', 'Angola'], ['Buenos Aires', 'Argentina'], ['Yerevan', 'Armenia'], ['Canberra', 'Australia'],
  ['Vienna', 'Austria'], ['Baku', 'Azerbaijan'], ['Nassau', 'Bahamas'], ['Manama', 'Bahrain'],
  ['Dhaka', 'Bangladesh'], ['Bridgetown', 'Barbados'], ['Minsk', 'Belarus'], ['Brussels', 'Belgium'],
  ['Belmopan', 'Belize'], ['Porto-Novo', 'Benin'], ['Thimphu', 'Bhutan'], ['Sucre', 'Bolivia'],
  ['Sarajevo', 'Bosnia and Herzegovina'], ['Gaborone', 'Botswana'], ['Brasilia', 'Brazil'],
  ['Sofia', 'Bulgaria'], ['Ouagadougou', 'Burkina Faso'], ['Gitega', 'Burundi'], ['Phnom Penh', 'Cambodia'],
  ['Yaounde', 'Cameroon'], ['Ottawa', 'Canada'], ['Praia', 'Cape Verde'], ['Bangui', 'Central African Republic'],
  ['NDjamena', 'Chad'], ['Santiago', 'Chile'], ['Beijing', 'China'], ['Bogota', 'Colombia'],
  ['Moroni', 'Comoros'], ['San Jose', 'Costa Rica'], ['Zagreb', 'Croatia'], ['Havana', 'Cuba'],
  ['Nicosia', 'Cyprus'], ['Prague', 'Czechia'], ['Copenhagen', 'Denmark'], ['Djibouti', 'Djibouti'],
  ['Roseau', 'Dominica'], ['Santo Domingo', 'Dominican Republic'], ['Quito', 'Ecuador'], ['Cairo', 'Egypt'],
  ['San Salvador', 'El Salvador'], ['Malabo', 'Equatorial Guinea'], ['Asmara', 'Eritrea'], ['Tallinn', 'Estonia'],
  ['Mbabane', 'Eswatini'], ['Addis Ababa', 'Ethiopia'], ['Suva', 'Fiji'], ['Helsinki', 'Finland'],
  ['Paris', 'France'], ['Libreville', 'Gabon'], ['Banjul', 'Gambia'], ['Tbilisi', 'Georgia'],
  ['Berlin', 'Germany'], ['Accra', 'Ghana'], ['Athens', 'Greece'], ['Guatemala City', 'Guatemala'],
  ['Conakry', 'Guinea'], ['Bissau', 'Guinea-Bissau'], ['Georgetown', 'Guyana'], ['Port-au-Prince', 'Haiti'],
  ['Tegucigalpa', 'Honduras'], ['Budapest', 'Hungary'], ['Reykjavik', 'Iceland'], ['New Delhi', 'India'],
  ['Jakarta', 'Indonesia'], ['Tehran', 'Iran'], ['Baghdad', 'Iraq'], ['Dublin', 'Ireland'],
  ['Jerusalem', 'Israel'], ['Rome', 'Italy'], ['Kingston', 'Jamaica'], ['Tokyo', 'Japan'],
  ['Amman', 'Jordan'], ['Astana', 'Kazakhstan'], ['Nairobi', 'Kenya'], ['Tarawa', 'Kiribati'],
  ['Pristina', 'Kosovo'], ['Kuwait City', 'Kuwait'], ['Bishkek', 'Kyrgyzstan'], ['Vientiane', 'Laos'],
  ['Riga', 'Latvia'], ['Beirut', 'Lebanon'], ['Maseru', 'Lesotho'], ['Monrovia', 'Liberia'],
  ['Tripoli', 'Libya'], ['Vaduz', 'Liechtenstein'], ['Vilnius', 'Lithuania'], ['Luxembourg', 'Luxembourg'],
  ['Antananarivo', 'Madagascar'], ['Lilongwe', 'Malawi'], ['Kuala Lumpur', 'Malaysia'], ['Male', 'Maldives'],
  ['Bamako', 'Mali'], ['Valletta', 'Malta'], ['Majuro', 'Marshall Islands'], ['Nouakchott', 'Mauritania'],
  ['Port Louis', 'Mauritius'], ['Mexico City', 'Mexico'], ['Palikir', 'Micronesia'], ['Chisinau', 'Moldova'],
  ['Monaco', 'Monaco'], ['Ulaanbaatar', 'Mongolia'], ['Podgorica', 'Montenegro'], ['Rabat', 'Morocco'],
  ['Maputo', 'Mozambique'], ['Naypyidaw', 'Myanmar'], ['Windhoek', 'Namibia'], ['Yaren', 'Nauru'],
  ['Kathmandu', 'Nepal'], ['Amsterdam', 'Netherlands'], ['Wellington', 'New Zealand'], ['Managua', 'Nicaragua'],
  ['Niamey', 'Niger'], ['Abuja', 'Nigeria'], ['Pyongyang', 'North Korea'], ['Skopje', 'North Macedonia'],
  ['Oslo', 'Norway'], ['Muscat', 'Oman'], ['Islamabad', 'Pakistan'], ['Ngerulmud', 'Palau'],
  ['Panama City', 'Panama'], ['Port Moresby', 'Papua New Guinea'], ['Asuncion', 'Paraguay'], ['Lima', 'Peru'],
  ['Manila', 'Philippines'], ['Warsaw', 'Poland'], ['Lisbon', 'Portugal'], ['Doha', 'Qatar'],
  ['Bucharest', 'Romania'], ['Moscow', 'Russia'], ['Kigali', 'Rwanda'], ['Basseterre', 'Saint Kitts and Nevis'],
  ['Castries', 'Saint Lucia'], ['Kingstown', 'Saint Vincent and the Grenadines'], ['Apia', 'Samoa'],
  ['San Marino', 'San Marino'], ['Sao Tome', 'Sao Tome and Principe'], ['Riyadh', 'Saudi Arabia'],
  ['Dakar', 'Senegal'], ['Belgrade', 'Serbia'], ['Victoria', 'Seychelles'], ['Freetown', 'Sierra Leone'],
  ['Singapore', 'Singapore'], ['Bratislava', 'Slovakia'], ['Ljubljana', 'Slovenia'], ['Honiara', 'Solomon Islands'],
  ['Mogadishu', 'Somalia'], ['Pretoria', 'South Africa'], ['Seoul', 'South Korea'], ['Juba', 'South Sudan'],
  ['Madrid', 'Spain'], ['Colombo', 'Sri Lanka'], ['Khartoum', 'Sudan'], ['Paramaribo', 'Suriname'],
  ['Stockholm', 'Sweden'], ['Bern', 'Switzerland'], ['Damascus', 'Syria'], ['Taipei', 'Taiwan'],
  ['Dushanbe', 'Tajikistan'], ['Dodoma', 'Tanzania'], ['Bangkok', 'Thailand'], ['Dili', 'Timor-Leste'],
  ['Lome', 'Togo'], ['Nukualofa', 'Tonga'], ['Port of Spain', 'Trinidad and Tobago'], ['Tunis', 'Tunisia'],
  ['Ankara', 'Turkey'], ['Ashgabat', 'Turkmenistan'], ['Funafuti', 'Tuvalu'], ['Kampala', 'Uganda'],
  ['Kyiv', 'Ukraine'], ['Abu Dhabi', 'United Arab Emirates'], ['London', 'United Kingdom'],
  ['Washington, D.C.', 'United States'], ['Montevideo', 'Uruguay'], ['Tashkent', 'Uzbekistan'],
  ['Port Vila', 'Vanuatu'], ['Vatican City', 'Vatican City'], ['Caracas', 'Venezuela'], ['Hanoi', 'Vietnam'],
  ['Sanaa', 'Yemen'], ['Lusaka', 'Zambia'], ['Harare', 'Zimbabwe'],
];

const PHRASES: Array<[string, string, string]> = [
  ['hola', 'hello', 'Spanish'], ['gracias', 'thank you', 'Spanish'], ['adios', 'goodbye', 'Spanish'],
  ['por favor', 'please', 'Spanish'], ['si', 'yes', 'Spanish'], ['agua', 'water', 'Spanish'],
  ['perro', 'dog', 'Spanish'], ['gato', 'cat', 'Spanish'], ['libro', 'book', 'Spanish'],
  ['amigo', 'friend', 'Spanish'], ['casa', 'house', 'Spanish'], ['rojo', 'red', 'Spanish'],
  ['merci', 'thank you', 'French'], ['bonjour', 'hello', 'French'], ['au revoir', 'goodbye', 'French'],
  ['oui', 'yes', 'French'], ['eau', 'water', 'French'], ['maison', 'house', 'French'],
  ['chat', 'cat', 'French'], ['chien', 'dog', 'French'], ['livre', 'book', 'French'],
  ['fromage', 'cheese', 'French'], ['pain', 'bread', 'French'], ['merci beaucoup', 'thank you very much', 'French'],
  ['danke', 'thank you', 'German'], ['bitte', 'please', 'German'], ['ja', 'yes', 'German'],
  ['nein', 'no', 'German'], ['wasser', 'water', 'German'], ['haus', 'house', 'German'],
  ['hund', 'dog', 'German'], ['katze', 'cat', 'German'], ['buch', 'book', 'German'],
  ['freund', 'friend', 'German'], ['brot', 'bread', 'German'], ['guten tag', 'good day', 'German'],
  ['ciao', 'hello', 'Italian'], ['grazie', 'thank you', 'Italian'], ['acqua', 'water', 'Italian'],
  ['ciao ciao', 'goodbye', 'Italian'], ['si', 'yes', 'Italian'], ['cane', 'dog', 'Italian'],
  ['gatto', 'cat', 'Italian'], ['libro', 'book', 'Italian'], ['pane', 'bread', 'Italian'],
  ['amico', 'friend', 'Italian'], ['casa', 'house', 'Italian'], ['buongiorno', 'good morning', 'Italian'],
  ['obrigado', 'thank you', 'Portuguese'], ['ola', 'hello', 'Portuguese'], ['agua', 'water', 'Portuguese'],
  ['cao', 'dog', 'Portuguese'], ['gato', 'cat', 'Portuguese'], ['livro', 'book', 'Portuguese'],
  ['pao', 'bread', 'Portuguese'], ['amigo', 'friend', 'Portuguese'], ['casa', 'house', 'Portuguese'],
  ['sim', 'yes', 'Portuguese'], ['tchau', 'goodbye', 'Portuguese'],
  ['arigato', 'thank you', 'Japanese'], ['konnichiwa', 'hello', 'Japanese'], ['sayonara', 'goodbye', 'Japanese'],
  ['hai', 'yes', 'Japanese'], ['mizu', 'water', 'Japanese'], ['inu', 'dog', 'Japanese'],
  ['neko', 'cat', 'Japanese'], ['hon', 'book', 'Japanese'], ['pan', 'bread', 'Japanese'],
  ['ie', 'house', 'Japanese'], ['tomodachi', 'friend', 'Japanese'],
  ['xie xie', 'thank you', 'Chinese'], ['ni hao', 'hello', 'Chinese'], ['zai jian', 'goodbye', 'Chinese'],
  ['shui', 'water', 'Chinese'], ['gou', 'dog', 'Chinese'], ['mao', 'cat', 'Chinese'],
  ['shu', 'book', 'Chinese'], ['mian bao', 'bread', 'Chinese'], ['peng you', 'friend', 'Chinese'],
  ['shi', 'yes', 'Chinese'],
  ['spasibo', 'thank you', 'Russian'], ['privet', 'hello', 'Russian'], ['da', 'yes', 'Russian'],
  ['net', 'no', 'Russian'], ['voda', 'water', 'Russian'], ['sobaka', 'dog', 'Russian'],
  ['koshka', 'cat', 'Russian'], ['kniga', 'book', 'Russian'], ['khleb', 'bread', 'Russian'],
  ['dom', 'house', 'Russian'], ['drug', 'friend', 'Russian'],
  ['shukran', 'thank you', 'Arabic'], ['marhaba', 'hello', 'Arabic'], ['naam', 'yes', 'Arabic'],
  ['maa', 'water', 'Arabic'], ['kalb', 'dog', 'Arabic'], ['qitt', 'cat', 'Arabic'],
  ['kitab', 'book', 'Arabic'], ['khubz', 'bread', 'Arabic'], ['bayt', 'house', 'Arabic'],
  ['sadiq', 'friend', 'Arabic'],
  ['dhanyavaad', 'thank you', 'Hindi'], ['namaste', 'hello', 'Hindi'], ['haan', 'yes', 'Hindi'],
  ['paani', 'water', 'Hindi'], ['kutta', 'dog', 'Hindi'], ['billi', 'cat', 'Hindi'],
  ['kitaab', 'book', 'Hindi'], ['roti', 'bread', 'Hindi'], ['ghar', 'house', 'Hindi'],
  ['dost', 'friend', 'Hindi'],
  ['tesekkurler', 'thank you', 'Turkish'], ['merhaba', 'hello', 'Turkish'], ['evet', 'yes', 'Turkish'],
  ['su', 'water', 'Turkish'], ['kopek', 'dog', 'Turkish'], ['kedi', 'cat', 'Turkish'],
  ['kitap', 'book', 'Turkish'], ['ekmek', 'bread', 'Turkish'], ['ev', 'house', 'Turkish'],
  ['arkadas', 'friend', 'Turkish'],
  ['tack', 'thank you', 'Swedish'], ['hej', 'hello', 'Swedish'], ['ja', 'yes', 'Swedish'],
  ['vatten', 'water', 'Swedish'], ['hund', 'dog', 'Swedish'], ['katt', 'cat', 'Swedish'],
  ['bok', 'book', 'Swedish'], ['brod', 'bread', 'Swedish'], ['hus', 'house', 'Swedish'],
  ['van', 'friend', 'Swedish'],
  ['tak', 'thank you', 'Polish'], ['czesc', 'hello', 'Polish'], ['tak', 'yes', 'Polish'],
  ['woda', 'water', 'Polish'], ['pies', 'dog', 'Polish'], ['kot', 'cat', 'Polish'],
  ['ksiazka', 'book', 'Polish'], ['chleb', 'bread', 'Polish'], ['dom', 'house', 'Polish'],
  ['przyjaciel', 'friend', 'Polish'],
  ['kiitos', 'thank you', 'Finnish'], ['hei', 'hello', 'Finnish'], ['kylla', 'yes', 'Finnish'],
  ['vesi', 'water', 'Finnish'], ['koira', 'dog', 'Finnish'], ['kissa', 'cat', 'Finnish'],
  ['kirja', 'book', 'Finnish'], ['leipa', 'bread', 'Finnish'], ['talo', 'house', 'Finnish'],
  ['ystava', 'friend', 'Finnish'],
  ['dank je', 'thank you', 'Dutch'], ['hallo', 'hello', 'Dutch'], ['ja', 'yes', 'Dutch'],
  ['water', 'water', 'Dutch'], ['hond', 'dog', 'Dutch'], ['kat', 'cat', 'Dutch'],
  ['boek', 'book', 'Dutch'], ['brood', 'bread', 'Dutch'], ['huis', 'house', 'Dutch'],
  ['vriend', 'friend', 'Dutch'],
  ['gomawo', 'thank you', 'Korean'], ['annyeong', 'hello', 'Korean'], ['ne', 'yes', 'Korean'],
  ['mul', 'water', 'Korean'], ['gae', 'dog', 'Korean'], ['goyangi', 'cat', 'Korean'],
  ['chaek', 'book', 'Korean'], ['ppang', 'bread', 'Korean'], ['jip', 'house', 'Korean'],
  ['chingu', 'friend', 'Korean'],
];

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Chinese', 'Russian',
  'Arabic', 'Hindi', 'Turkish', 'Swedish', 'Polish', 'Finnish', 'Dutch', 'Korean', 'Greek',
  'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Swahili', 'Norwegian', 'Danish', 'Czech',
];

const ELEMENTS: Array<[string, string]> = [
  ['H', 'hydrogen'], ['He', 'helium'], ['Li', 'lithium'], ['C', 'carbon'], ['N', 'nitrogen'],
  ['O', 'oxygen'], ['F', 'fluorine'], ['Ne', 'neon'], ['Na', 'sodium'], ['Mg', 'magnesium'],
  ['Al', 'aluminium'], ['Si', 'silicon'], ['P', 'phosphorus'], ['S', 'sulfur'], ['Cl', 'chlorine'],
  ['K', 'potassium'], ['Ca', 'calcium'], ['Fe', 'iron'], ['Cu', 'copper'], ['Zn', 'zinc'],
  ['Ag', 'silver'], ['Au', 'gold'], ['Hg', 'mercury'], ['Pb', 'lead'], ['Sn', 'tin'],
  ['I', 'iodine'], ['U', 'uranium'], ['Ni', 'nickel'], ['Ti', 'titanium'], ['W', 'tungsten'],
  ['Pt', 'platinum'], ['Xe', 'xenon'], ['Rn', 'radon'], ['Co', 'cobalt'], ['Mn', 'manganese'],
  ['Cr', 'chromium'], ['Br', 'bromine'], ['Ar', 'argon'], ['B', 'boron'], ['Be', 'beryllium'],
];

const AUTHORS: Array<[string, string]> = [
  ['Romeo and Juliet', 'William Shakespeare'], ['Hamlet', 'William Shakespeare'],
  ['Pride and Prejudice', 'Jane Austen'], ['Oliver Twist', 'Charles Dickens'],
  ['The Odyssey', 'Homer'], ['The Iliad', 'Homer'], ['1984', 'George Orwell'],
  ['Animal Farm', 'George Orwell'], ['The Hobbit', 'J.R.R. Tolkien'],
  ['The Lord of the Rings', 'J.R.R. Tolkien'], ['Harry Potter and the Philosopher\'s Stone', 'J.K. Rowling'],
  ['The Great Gatsby', 'F. Scott Fitzgerald'], ['Moby-Dick', 'Herman Melville'],
  ['To Kill a Mockingbird', 'Harper Lee'], ['Jane Eyre', 'Charlotte Bronte'],
  ['Wuthering Heights', 'Emily Bronte'], ['Frankenstein', 'Mary Shelley'],
  ['Dracula', 'Bram Stoker'], ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'],
  ['War and Peace', 'Leo Tolstoy'], ['Crime and Punishment', 'Fyodor Dostoevsky'],
  ['The Divine Comedy', 'Dante Alighieri'], ['Don Quixote', 'Miguel de Cervantes'],
  ['Les Miserables', 'Victor Hugo'], ['The Little Prince', 'Antoine de Saint-Exupery'],
  ['One Hundred Years of Solitude', 'Gabriel Garcia Marquez'], ['Beloved', 'Toni Morrison'],
  ['The Catcher in the Rye', 'J.D. Salinger'], ['Of Mice and Men', 'John Steinbeck'],
  ['The Old Man and the Sea', 'Ernest Hemingway'], ['Leaves of Grass', 'Walt Whitman'],
  ['The Raven', 'Edgar Allan Poe'], ['Walden', 'Henry David Thoreau'],
  ['Little Women', 'Louisa May Alcott'], ['Treasure Island', 'Robert Louis Stevenson'],
  ['Peter Pan', 'J.M. Barrie'], ['Alice\'s Adventures in Wonderland', 'Lewis Carroll'],
  ['The Jungle Book', 'Rudyard Kipling'], ['Gulliver\'s Travels', 'Jonathan Swift'],
  ['The Picture of Dorian Gray', 'Oscar Wilde'],
];

const PAINTERS: Array<[string, string]> = [
  ['Mona Lisa', 'Leonardo da Vinci'], ['The Last Supper', 'Leonardo da Vinci'],
  ['The Starry Night', 'Vincent van Gogh'], ['Sunflowers', 'Vincent van Gogh'],
  ['Guernica', 'Pablo Picasso'], ['The Persistence of Memory', 'Salvador Dali'],
  ['The Scream', 'Edvard Munch'], ['Girl with a Pearl Earring', 'Johannes Vermeer'],
  ['The Night Watch', 'Rembrandt'], ['Water Lilies', 'Claude Monet'],
  ['Impression, Sunrise', 'Claude Monet'], ['The Birth of Venus', 'Sandro Botticelli'],
  ['American Gothic', 'Grant Wood'], ['Nighthawks', 'Edward Hopper'],
  ['Campbell\'s Soup Cans', 'Andy Warhol'], ['A Sunday Afternoon on the Island of La Grande Jatte', 'Georges Seurat'],
  ['The Kiss', 'Gustav Klimt'], ['Whistler\'s Mother', 'James McNeill Whistler'],
  ['The Arnolfini Portrait', 'Jan van Eyck'], ['Las Meninas', 'Diego Velazquez'],
];

const INVENTIONS: Array<[string, string]> = [
  ['telephone', 'Alexander Graham Bell'], ['light bulb (practical)', 'Thomas Edison'],
  ['radio', 'Guglielmo Marconi'], ['airplane', 'Wright brothers'],
  ['printing press', 'Johannes Gutenberg'], ['steam engine (improved)', 'James Watt'],
  ['world wide web', 'Tim Berners-Lee'], ['penicillin', 'Alexander Fleming'],
  ['dynamite', 'Alfred Nobel'], ['cotton gin', 'Eli Whitney'],
  ['phonograph', 'Thomas Edison'], ['polio vaccine', 'Jonas Salk'],
  ['theory of relativity', 'Albert Einstein'], ['laws of motion', 'Isaac Newton'],
  ['telescope (popularized)', 'Galileo Galilei'], ['lightning rod', 'Benjamin Franklin'],
];

const ANIMALS: Array<[string, string]> = [
  ['fastest land animal', 'cheetah'], ['largest animal', 'blue whale'],
  ['tallest land animal', 'giraffe'], ['black and white bear from China', 'giant panda'],
  ['marsupial that boxes in cartoons', 'kangaroo'], ['bird that cannot fly and lives in Antarctica', 'penguin'],
  ['striped horse relative', 'zebra'], ['slow tree-dweller of the rainforest', 'sloth'],
  ['egg-laying mammal with a bill', 'platypus'], ['largest living cat', 'tiger'],
  ['desert ship with humps', 'camel'], ['black and white bamboo eater', 'giant panda'],
  ['howling pack hunter', 'wolf'], ['black and white ocean hunter', 'orca'],
  ['only mammal that truly flies', 'bat'], ['striped orange big cat', 'tiger'],
];

const SPORTS: Array<[string, string]> = [
  ['players on a soccer team on the field', '11'],
  ['players on a basketball team on the court', '5'],
  ['players on a baseball team on the field', '9'],
  ['players on an ice hockey team on the ice', '6'],
  ['rings on the Olympic flag', '5'],
  ['holes on a standard golf course', '18'],
  ['minutes in a soccer half', '45'],
  ['points for a regular basketball basket', '2'],
  ['sets needed to win most tennis majors (men, best of five)', '3'],
  ['players on an American football team on the field', '11'],
  ['pins at the end of a bowling lane', '10'],
  ['squares on a chessboard', '64'],
  ['pawns per side at the start of chess', '8'],
];

const SCIENCE: Array<[string, string]> = [
  ['gas plants release in photosynthesis', 'oxygen'],
  ['gas we breathe out a lot of', 'carbon dioxide'],
  ['closest star to Earth', 'the Sun'],
  ['planet known as the red planet', 'Mars'],
  ['largest planet in the solar system', 'Jupiter'],
  ['smallest planet in the solar system', 'Mercury'],
  ['planet famous for its rings', 'Saturn'],
  ['Earth\'s natural satellite', 'the Moon'],
  ['number of continents usually taught in school', '7'],
  ['largest ocean', 'Pacific'],
  ['water freezes at this Celsius temperature', '0'],
  ['water boils at this Celsius temperature at sea level', '100'],
  ['degrees in a right angle', '90'],
  ['sides on a hexagon', '6'],
  ['sides on a triangle', '3'],
  ['chambers in a human heart', '4'],
  ['bones in a typical adult human', '206'],
  ['teeth in a typical adult set', '32'],
  ['colors in a classic rainbow', '7'],
  ['days in a leap year', '366'],
  ['days in a common year', '365'],
  ['hours in a day', '24'],
  ['minutes in an hour', '60'],
  ['seconds in a minute', '60'],
  ['a light-year measures this', 'distance'],
  ['H2O is commonly called', 'water'],
  ['chemical symbol for gold', 'Au'],
  ['chemical symbol for silver', 'Ag'],
  ['chemical symbol for iron', 'Fe'],
  ['chemical symbol for oxygen', 'O'],
  ['chemical symbol for sodium', 'Na'],
  ['force that pulls us toward Earth', 'gravity'],
  ['what travels at about 300,000 km per second', 'light'],
  ['sound needs this to travel that light does not', 'a medium'],
];

const GEO: Array<[string, string]> = [
  ['country shaped like a boot', 'Italy'],
  ['city with the Eiffel Tower', 'Paris'],
  ['city with the Statue of Liberty', 'New York'],
  ['country of the Great Wall', 'China'],
  ['country of the Great Pyramid of Giza', 'Egypt'],
  ['country that holds most of the Amazon rainforest', 'Brazil'],
  ['tallest mountain on Earth', 'Mount Everest'],
  ['longest river often taught in school as Africa\'s giant', 'Nile'],
  ['Italian city famous for canals', 'Venice'],
  ['UK currency', 'pound'],
  ['Japan currency', 'yen'],
  ['United States currency', 'dollar'],
  ['European Union common currency', 'euro'],
  ['ocean around most of the Ring of Fire', 'Pacific'],
  ['continent of Egypt', 'Africa'],
  ['continent of Brazil', 'South America'],
  ['continent of Japan', 'Asia'],
  ['continent of France', 'Europe'],
  ['continent of Canada', 'North America'],
  ['continent of Australia the country', 'Australia'],
  ['desert covering much of northern Africa', 'Sahara'],
  ['mountain range with Everest', 'Himalayas'],
  ['canal linking the Atlantic and Pacific in Panama', 'Panama Canal'],
  ['canal in Egypt linking the Mediterranean and Red Sea', 'Suez Canal'],
];

const HISTORY: Array<[string, string]> = [
  ['year people first walked on the Moon', '1969'],
  ['first person on the Moon', 'Neil Armstrong'],
  ['first president of the United States', 'George Washington'],
  ['US president on the penny', 'Abraham Lincoln'],
  ['year the Declaration of Independence was adopted', '1776'],
  ['ship of the 1620 Plymouth crossing', 'Mayflower'],
  ['ancient city buried by Vesuvius in 79', 'Pompeii'],
  ['wall that divided Berlin for decades', 'Berlin Wall'],
  ['year the Berlin Wall fell', '1989'],
  ['explorer whose 1492 voyage is taught in many schools', 'Christopher Columbus'],
  ['queen of France during the French Revolution, often named with Louis XVI', 'Marie Antoinette'],
  ['nurse famous in the Crimean War', 'Florence Nightingale'],
  ['scientist who described gravity with an apple story', 'Isaac Newton'],
  ['scientist credited with E=mc^2', 'Albert Einstein'],
  ['civil rights leader who gave the I Have a Dream speech', 'Martin Luther King Jr.'],
];

const MUSIC: Array<[string, string]> = [
  ['keys on a standard piano', '88'],
  ['instrument with 88 black and white keys', 'piano'],
  ['highest female singing voice', 'soprano'],
  ['lowest male singing voice', 'bass'],
  ['family of the violin', 'strings'],
  ['family of the trumpet', 'brass'],
  ['family of the flute', 'woodwind'],
  ['family of the snare drum', 'percussion'],
  ['notes in a standard major scale', '7'],
  ['beats in a bar of common time', '4'],
  ['clef that sits on the left of piano right-hand music', 'treble'],
  ['composer of the Fifth Symphony\'s famous short-short-short-long', 'Ludwig van Beethoven'],
  ['composer of The Four Seasons', 'Antonio Vivaldi'],
  ['composer of The Magic Flute', 'Wolfgang Amadeus Mozart'],
];

const CURRENCIES: Array<[string, string]> = [
  ['United States', 'dollar'], ['United Kingdom', 'pound'], ['Japan', 'yen'], ['European Union', 'euro'],
  ['Switzerland', 'franc'], ['India', 'rupee'], ['China', 'yuan'], ['Mexico', 'peso'],
  ['Brazil', 'real'], ['South Korea', 'won'], ['Russia', 'ruble'], ['Turkey', 'lira'],
  ['Sweden', 'krona'], ['Poland', 'zloty'], ['Thailand', 'baht'], ['South Africa', 'rand'],
  ['Australia', 'dollar'], ['Canada', 'dollar'], ['Nigeria', 'naira'], ['Israel', 'shekel'],
  ['Saudi Arabia', 'riyal'], ['Denmark', 'krone'], ['Norway', 'krone'], ['Czechia', 'koruna'],
  ['Hungary', 'forint'], ['Indonesia', 'rupiah'], ['Malaysia', 'ringgit'], ['Philippines', 'peso'],
  ['Vietnam', 'dong'], ['Argentina', 'peso'],
];

const MORE_TRIVIA: Array<[string, string, string, string, string, string]> = [
  ['science', 'what do bees make?', 'honey', 'wax only', 'silk', 'nectar juice'],
  ['science', 'what do spiders make to catch food?', 'webs', 'nests of clay', 'honey', 'milk'],
  ['science', 'which vitamin is made in skin from sunlight?', 'vitamin D', 'vitamin C', 'vitamin K', 'vitamin B12'],
  ['science', 'what metal is liquid at room temperature?', 'mercury', 'iron', 'gold', 'zinc'],
  ['science', 'what do we call frozen rain that falls as balls?', 'hail', 'sleet only', 'dew', 'fog'],
  ['science', 'what is the hardest natural mineral on the usual scale?', 'diamond', 'quartz', 'gold', 'talc'],
  ['science', 'what gas makes up most of Earth\'s air?', 'nitrogen', 'oxygen', 'carbon dioxide', 'helium'],
  ['science', 'what do we call a baby frog after it hatches?', 'tadpole', 'calf', 'kit', 'pup'],
  ['science', 'which organ pumps blood?', 'heart', 'liver', 'lung', 'kidney'],
  ['science', 'which organ is mainly for breathing?', 'lungs', 'stomach', 'skin', 'pancreas'],
  ['science', 'what do we call water in gas form?', 'steam', 'ice', 'hail', 'frost'],
  ['science', 'what is 0 degrees Celsius in common talk for water?', 'freezing', 'boiling', 'melting gold', 'room temp'],
  ['science', 'which simple machine is a ramp?', 'inclined plane', 'pulley', 'wheel', 'screw only'],
  ['science', 'what do magnets stick to best among these?', 'iron', 'wood', 'glass', 'plastic'],
  ['science', 'what do we call animals that eat only plants?', 'herbivores', 'carnivores', 'omnivores', 'insectivores'],
  ['science', 'what do we call animals that eat only meat?', 'carnivores', 'herbivores', 'producers', 'decomposers'],
  ['science', 'what is the center of an atom called?', 'nucleus', 'electron', 'orbit', 'shell'],
  ['science', 'what charge does an electron have?', 'negative', 'positive', 'neutral', 'north'],
  ['science', 'what do we call a push or a pull?', 'force', 'mass', 'volume', 'density'],
  ['science', 'what is the metric unit of mass among these?', 'kilogram', 'liter', 'meter', 'second'],
  ['geography', 'which ocean is the smallest of the usual four?', 'Arctic', 'Pacific', 'Atlantic', 'Indian'],
  ['geography', 'which desert is in northern Africa?', 'Sahara', 'Gobi', 'Mojave', 'Atacama'],
  ['geography', 'which US state is made of islands in the Pacific?', 'Hawaii', 'Florida', 'Alaska', 'California'],
  ['geography', 'which US state is the largest by area?', 'Alaska', 'Texas', 'California', 'Montana'],
  ['geography', 'which river runs through London?', 'Thames', 'Seine', 'Rhine', 'Danube'],
  ['geography', 'which river runs through Paris?', 'Seine', 'Thames', 'Tiber', 'Po'],
  ['geography', 'which river runs through Rome?', 'Tiber', 'Po', 'Arno', 'Seine'],
  ['geography', 'which mountain range is in South America?', 'Andes', 'Alps', 'Rockies', 'Urals'],
  ['geography', 'which mountain range is in the western United States?', 'Rockies', 'Alps', 'Andes', 'Himalayas'],
  ['geography', 'which sea sits between Europe and Africa?', 'Mediterranean', 'Caribbean', 'Baltic', 'Caspian'],
  ['geography', 'which lake is the largest freshwater lake by area in most school lists?', 'Lake Superior', 'Lake Victoria', 'Lake Baikal', 'Great Salt Lake'],
  ['geography', 'which island is the largest in the world?', 'Greenland', 'Madagascar', 'Borneo', 'Honshu'],
  ['geography', 'which country is both a continent and a country in common talk?', 'Australia', 'India', 'Greenland', 'Iceland'],
  ['geography', 'which city is known as the Big Apple?', 'New York', 'Chicago', 'Los Angeles', 'Boston'],
  ['geography', 'which city is known as the Windy City in the US?', 'Chicago', 'Seattle', 'Denver', 'Miami'],
  ['history', 'who crossed the Alps with elephants in school stories?', 'Hannibal', 'Caesar', 'Alexander', 'Attila'],
  ['history', 'who was the Macedonian who built a huge ancient empire?', 'Alexander the Great', 'Nero', 'Augustus', 'Hannibal'],
  ['history', 'which ancient wonder stood at Giza?', 'the Great Pyramid', 'the Colossus', 'the Lighthouse', 'the Hanging Gardens'],
  ['history', 'which empire built many roads from Rome?', 'Roman Empire', 'Ottoman Empire', 'Mongol Empire', 'Aztec Empire'],
  ['history', 'who was the first woman in space?', 'Valentina Tereshkova', 'Sally Ride', 'Mae Jemison', 'Kalpana Chawla'],
  ['history', 'who was the first American woman in space?', 'Sally Ride', 'Valentina Tereshkova', 'Amelia Earhart', 'Bessie Coleman'],
  ['history', 'which ship sank in 1912 in the North Atlantic?', 'Titanic', 'Lusitania', 'Mayflower', 'Bismarck'],
  ['history', 'who painted while also inventing in Renaissance Italy, among these?', 'Leonardo da Vinci', 'Mozart', 'Newton', 'Darwin'],
  ['history', 'who proposed natural selection with On the Origin of Species?', 'Charles Darwin', 'Gregor Mendel', 'Louis Pasteur', 'Carl Linnaeus'],
  ['history', 'who is known for pasteurizing milk?', 'Louis Pasteur', 'Marie Curie', 'Ada Lovelace', 'James Clerk Maxwell'],
  ['literature', 'who wrote the poem The Raven?', 'Edgar Allan Poe', 'Emily Dickinson', 'Robert Frost', 'Walt Whitman'],
  ['literature', 'who wrote Walden?', 'Henry David Thoreau', 'Ralph Waldo Emerson', 'Mark Twain', 'Jack London'],
  ['literature', 'who wrote Adventures of Huckleberry Finn?', 'Mark Twain', 'Herman Melville', 'Jack London', 'John Steinbeck'],
  ['literature', 'who wrote The Cat in the Hat?', 'Dr. Seuss', 'Roald Dahl', 'A.A. Milne', 'Beatrix Potter'],
  ['literature', 'who wrote Charlie and the Chocolate Factory?', 'Roald Dahl', 'Dr. Seuss', 'C.S. Lewis', 'J.M. Barrie'],
  ['literature', 'who wrote The Lion, the Witch and the Wardrobe?', 'C.S. Lewis', 'J.R.R. Tolkien', 'Philip Pullman', 'Lewis Carroll'],
  ['literature', 'who wrote Charlotte\'s Web?', 'E.B. White', 'Laura Ingalls Wilder', 'Beverly Cleary', 'Judy Blume'],
  ['music', 'how many strings does a standard violin have?', '4', '5', '6', '8'],
  ['music', 'how many strings does a standard guitar have?', '6', '4', '5', '12'],
  ['music', 'what do we call a group of four musicians?', 'quartet', 'trio', 'duet', 'octet'],
  ['music', 'what do we call a group of three musicians?', 'trio', 'quartet', 'solo', 'band only'],
  ['music', 'which instrument uses keys, pedals, and pipes in a church?', 'organ', 'harp', 'oboe', 'banjo'],
  ['sports', 'what sport uses a shuttlecock?', 'badminton', 'tennis', 'squash', 'table tennis'],
  ['sports', 'what sport is played at Wimbledon?', 'tennis', 'golf', 'cricket', 'rugby'],
  ['sports', 'what sport uses a puck?', 'ice hockey', 'lacrosse', 'field hockey', 'curling'],
  ['sports', 'what do you hit in baseball?', 'a ball', 'a shuttle', 'a puck', 'a birdie'],
  ['sports', 'how many points is a touchdown worth in American football, before the kick?', '6', '3', '7', '2'],
];

const TONES: Array<[string, string, string, string, string]> = [
  ['a coworker spilled coffee on a report. which reply is the kind one?', 'I can help reprint it.', 'Wow. clumsy.', 'Not my problem.', 'You ruin everything.'],
  ['someone is late to a meeting. which reply is professional?', 'Thanks for coming — let\'s catch you up.', 'Finally.', 'We started without the slacker.', 'Don\'t bother sitting.'],
  ['a friend forgot your birthday. which reply is gentle?', 'No stress — want to celebrate this weekend?', 'I expected this.', 'You never care.', 'Unfriend incoming.'],
  ['a waiter brought the wrong dish. which reply is polite?', 'Sorry, I ordered the other one.', 'Are you kidding me?', 'Take it back, obviously.', 'This place is a joke.'],
  ['you need a file from a teammate. which line is clear and kind?', 'Could you send the draft when you have a minute?', 'Send it. now.', 'Why is this always late?', 'Do your job.'],
  ['someone holds a door. which reply is the gracious one?', 'Thank you — I appreciate it.', 'Took you long enough.', 'I had it.', 'Whatever.'],
  ['a group chat needs a decision. which line is collaborative?', 'What if we pick Friday and adjust if needed?', 'I already decided.', 'Do what I said.', 'This thread is useless.'],
  ['a kid dropped ice cream. which reply is comforting?', 'Accidents happen. we can get another.', 'You should have been careful.', 'That\'s what you get.', 'Stop crying.'],
  ['an email is too sharp. which rewrite is the better tone?', 'Could we revisit this tomorrow?', 'Your plan is bad.', 'Read it again.', 'No.'],
  ['someone mispronounced your name. which reply is kind?', 'It\'s close — it\'s said like this.', 'Were you even listening?', 'People never try.', 'Forget it.'],
  ['a roommate left dishes. which note is firm but fair?', 'Please wash these tonight so we keep the sink clear.', 'You are a slob.', 'I live with a raccoon.', 'Do it or else.'],
  ['a teacher asks for quiet. which reply is respectful?', 'Sorry — we\'ll keep it down.', 'Make us.', 'This class is boring.', 'Talk to the wall.'],
  ['you disagree in a review. which line stays civil?', 'I see it differently — here\'s why.', 'That take is nonsense.', 'You missed the point.', 'Try again, amateur.'],
  ['a delivery is a day late. which reply is calm?', 'Thanks for the update — when should it arrive?', 'Unacceptable. forever.', 'I will ruin you online.', 'Fire everyone.'],
  ['someone shared good news. which reply is the warm one?', 'That\'s wonderful — I\'m really glad.', 'Must be nice.', 'Cool I guess.', 'Anyway.'],
  ['you need to say no to extra work. which line is honest and polite?', 'I can\'t take this on this week.', 'Absolutely not, ever.', 'Do it yourself.', 'That\'s a you problem.'],
  ['a stranger stepped on your bag. which reply de-escalates?', 'All good — I\'ll move it.', 'Watch it.', 'Are you blind?', 'Pay me.'],
  ['a meeting ran long. which close is considerate?', 'Let\'s stop here and pick up tomorrow.', 'You people wasted my time.', 'I\'m leaving. bye.', 'This was pointless.'],
  ['someone asked for feedback. which reply is useful?', 'The opening is strong; the middle needs one example.', 'It\'s bad.', 'Start over.', 'I hated it.'],
  ['a neighbor\'s music is loud. which note is neighborly?', 'Hey — could you turn it down after 10?', 'Shut up.', 'I called the cops already.', 'Move out.'],
  ['someone joined a call late. which line is welcoming?', 'Glad you made it — we are on slide four.', 'Nice of you to show.', 'We almost cancelled.', 'Mute yourself.'],
  ['a classmate asked to borrow a pencil. which reply is generous?', 'Sure — keep it for the test.', 'Buy your own.', 'This is why you fail.', 'No. ever.'],
  ['you need to cancel lunch. which text is considerate?', 'Can we move lunch? something came up.', 'Not coming. bye.', 'I have better plans.', 'You\'ll live.'],
  ['a store clerk looks busy. which line is patient?', 'No rush — I can wait.', 'Hello?? service?', 'I will talk to your manager.', 'This is ridiculous.'],
  ['someone offered help you do not need. which reply is gracious?', 'Thanks — I\'ve got it, but I appreciate it.', 'I said I\'m fine.', 'Stop hovering.', 'You\'d only mess it up.'],
  ['a team won a small prize. which note is encouraging?', 'Nice work — that was a real team win.', 'It was luck.', 'About time.', 'Don\'t get cocky.'],
  ['you received a kind review. which reply is humble?', 'Thank you — that means a lot.', 'I know.', 'Obviously.', 'Tell me something I don\'t know.'],
  ['someone is nervous before a talk. which line helps?', 'You\'ve practiced this. I\'ll be in the back.', 'Don\'t blow it.', 'I would be nervous too, you\'re bad at this.', 'Good luck, you\'ll need it.'],
  ['a package arrived damaged. which note to the seller is fair?', 'The box arrived crushed — can we arrange a replacement?', 'Scam.', 'I will end you.', 'Never shopping here.'],
  ['you walked into the wrong room. which line is easy?', 'Sorry — I have the wrong room.', 'Why is this not labeled?', 'You people.', 'Whatever.'],
  ['a friend is learning to cook. which feedback is kind?', 'The sauce is close — a pinch less salt next time.', 'Inedible.', 'Order takeout.', 'Never cook again.'],
  ['someone used the last of the milk. which note is practical?', 'Could you grab milk later? we are out.', 'You always do this.', 'I hate living here.', 'Pay me back in guilt.'],
  ['a visitor asked for the wifi. which reply is helpful?', 'Network is Oak, password is on the fridge.', 'Figure it out.', 'We don\'t share.', 'Use your data.'],
  ['you need a quieter seat. which ask is polite?', 'Would you mind if I moved to a quieter table?', 'Move. now.', 'This seat is trash.', 'I can\'t stand you.'],
  ['a volunteer forgot a shift. which reply is firm and kind?', 'Please text next time — we had to cover last minute.', 'You\'re unreliable.', 'Don\'t come back.', 'Thanks for nothing.'],
  ['someone sent a long email. which reply is clear?', 'Got it — I\'ll reply by Thursday.', 'Wall of text.', 'Didn\'t read.', 'Use bullets or don\'t write me.'],
  ['a child showed you a drawing. which reply is encouraging?', 'I love the colors — tell me about it.', 'What is that?', 'Looks messy.', 'My kid is better.'],
  ['you need to leave a party early. which line is graceful?', 'Thanks for having me — I need to head out.', 'This is dull.', 'I\'m escaping.', 'Don\'t walk me out.'],
  ['a coworker shared credit. which reply is classy?', 'Appreciate you mentioning the team.', 'Finally.', 'I did more.', 'About time you noticed.'],
];

const FILLS: Array<[string, string, string, string, string]> = [
  ['Earth orbits the ___.', 'Sun', 'Moon', 'Mars', 'Venus'],
  ['A hexagon has ___ sides.', '6', '5', '7', '8'],
  ['Water freezes at ___ °C.', '0', '32', '100', '10'],
  ['There are ___ days in a common year.', '365', '366', '360', '364'],
  ['A triangle has ___ sides.', '3', '4', '5', '2'],
  ['Humans typically have ___ chambers in the heart.', '4', '2', '3', '6'],
  ['A right angle is ___ degrees.', '90', '45', '180', '60'],
  ['There are ___ hours in a day.', '24', '12', '48', '60'],
  ['A standard piano has ___ keys.', '88', '76', '64', '100'],
  ['The Olympic flag has ___ rings.', '5', '4', '6', '7'],
  ['A chessboard has ___ squares.', '64', '32', '100', '16'],
  ['There are ___ minutes in an hour.', '60', '100', '30', '24'],
  ['Water boils at ___ °C at sea level.', '100', '0', '212', '90'],
  ['A typical adult has about ___ teeth.', '32', '20', '28', '36'],
  ['A leap year has ___ days.', '366', '365', '364', '360'],
  ['There are ___ continents in the usual school list.', '7', '5', '6', '8'],
  ['A week has ___ days.', '7', '5', '6', '10'],
  ['A stop sign has ___ sides.', '8', '6', '4', '5'],
  ['A cube has ___ faces.', '6', '4', '8', '12'],
  ['A dozen is ___ items.', '12', '10', '6', '24'],
  ['A cube has ___ edges.', '12', '6', '8', '16'],
  ['A square has ___ equal sides.', '4', '3', '5', '6'],
  ['There are ___ seconds in a minute.', '60', '100', '30', '24'],
  ['A pentagon has ___ sides.', '5', '6', '7', '8'],
  ['An octagon has ___ sides.', '8', '6', '10', '5'],
  ['A typical week of workdays has ___ weekdays.', '5', '7', '6', '4'],
  ['There are ___ months in a year.', '12', '10', '13', '24'],
  ['A right triangle can have a ___ degree corner.', '90', '180', '360', '45 only'],
  ['Light is faster than ___.', 'sound', 'itself', 'radio forever', 'nothing ever'],
  ['Plants make food using ___.', 'sunlight', 'moonlight', 'wind only', 'rocks only'],
  ['The Pacific is an ___.', 'ocean', 'island', 'desert', 'river'],
  ['A tadpole grows into a ___.', 'frog', 'fish', 'bird', 'snake'],
  ['Bees collect nectar to make ___.', 'honey', 'silk', 'wax fruit', 'milk'],
  ['A compass needle points toward ___.', 'north', 'east', 'the sun', 'down'],
  ['Ice is ___ water.', 'frozen', 'boiling', 'salty only', 'gaseous'],
  ['A year has four ___.', 'seasons', 'decades', 'centuries', 'hours'],
  ['The Nile is a ___.', 'river', 'mountain', 'desert', 'sea'],
  ['A kitten grows into a ___.', 'cat', 'dog', 'lion only', 'fox'],
  ['A baker often bakes ___.', 'bread', 'bricks', 'bolts', 'batteries'],
];

const SPELLS: Array<[string, string, string, string]> = [
  ['separate', 'seperate', 'separete', 'separrate'],
  ['definitely', 'definately', 'definatly', 'definetly'],
  ['necessary', 'neccessary', 'necesary', 'nessessary'],
  ['accommodate', 'accomodate', 'acommodate', 'accomadate'],
  ['rhythm', 'rythm', 'rhythym', 'rythem'],
  ['occurrence', 'occurence', 'occurrance', 'ocurrance'],
  ['privilege', 'priviledge', 'privilage', 'privelege'],
  ['maintenance', 'maintainance', 'maintanance', 'maintenence'],
  ['conscience', 'concience', 'consciense', 'consience'],
  ['embarrass', 'embarass', 'embarras', 'emberrass'],
  ['recommend', 'reccomend', 'recomend', 'reccommend'],
  ['questionnaire', 'questionaire', 'questionnare', 'questionnair'],
  ['liaison', 'liason', 'liaision', 'laison'],
  ['millennium', 'milennium', 'millenium', 'milenium'],
  ['pharaoh', 'pharoah', 'pharoh', 'pharao'],
  ['weird', 'wierd', 'weerd', 'weiird'],
  ['vacuum', 'vaccuum', 'vacume', 'vaccum'],
  ['misspell', 'mispell', 'misspel', 'mispel'],
  ['acknowledge', 'acknowlege', 'aknowledge', 'acknowldege'],
  ['calendar', 'calender', 'calander', 'calandar'],
  ['argument', 'arguement', 'argumant', 'arguementt'],
  ['believe', 'beleive', 'belive', 'beleeve'],
  ['receive', 'recieve', 'receve', 'receeve'],
  ['their', 'thier', 'theire', 'thir'],
  ['because', 'becuase', 'becasue', 'becouse'],
  ['friend', 'freind', 'frend', 'friand'],
  ['people', 'peolpe', 'peple', 'peopel'],
  ['which', 'whihc', 'wich', 'whitch'],
  ['tomorrow', 'tommorrow', 'tomorow', 'tommorow'],
  ['beginning', 'begining', 'beginnning', 'beggining'],
  ['business', 'buisness', 'busines', 'bussiness'],
  ['environment', 'enviroment', 'enviornment', 'environmnet'],
  ['government', 'goverment', 'governement', 'govornment'],
  ['independent', 'independant', 'indepedent', 'independint'],
  ['knowledge', 'knowlege', 'knolwedge', 'knowldge'],
  ['library', 'libary', 'librery', 'libarary'],
  ['neighbor', 'nieghbor', 'neighboor', 'neigbor'],
  ['successful', 'succesful', 'successfull', 'sucessful'],
  ['until', 'untill', 'untile', 'untilll'],
  ['which', 'whcih', 'hwich', 'whihc'],
];

const WORDS = [
  'house', 'train', 'apple', 'bread', 'chair', 'plant', 'river', 'cloud', 'stone', 'light',
  'paper', 'music', 'table', 'green', 'water', 'smile', 'clock', 'brush', 'grape', 'lemon',
  'shirt', 'piano', 'honey', 'tiger', 'ocean', 'flame', 'sugar', 'window', 'garden', 'button',
  'pencil', 'orange', 'planet', 'bridge', 'castle', 'forest', 'market', 'silver', 'yellow', 'purple',
  'cookie', 'hammer', 'bottle', 'camera', 'ticket', 'wallet', 'pocket', 'summer', 'winter', 'spring',
  'autumn', 'school', 'teacher', 'student', 'number', 'circle', 'square', 'rocket', 'helmet', 'gloves',
  'jacket', 'basket', 'candle', 'pillow', 'blanket', 'mirror', 'ladder', 'engine', 'tunnel', 'island',
];

const ORDERS: Array<[string, string[]]> = [
  ['daily meals, morning to night', ['breakfast', 'lunch', 'dinner']],
  ['seasons starting at spring', ['spring', 'summer', 'autumn', 'winter']],
  ['weekdays starting Monday', ['Monday', 'Tuesday', 'Wednesday']],
  ['sizes, small to large', ['small', 'medium', 'large']],
  ['people, young to old', ['baby', 'child', 'adult']],
  ['numbers, least to greatest', ['2', '5', '9']],
  ['classic rainbow, first three colours', ['red', 'orange', 'yellow']],
  ['planets from the Sun, first three', ['Mercury', 'Venus', 'Earth']],
  ['letters A to Z', ['B', 'M', 'T']],
  ['making coffee', ['grind', 'brew', 'pour']],
  ['a school day', ['morning', 'afternoon', 'evening']],
  ['water temperatures, cold to hot', ['ice', 'cool', 'boil']],
  ['writing a letter', ['draft', 'edit', 'send']],
  ['planting a seed', ['dig', 'plant', 'water']],
  ['getting dressed for rain', ['coat', 'boots', 'umbrella']],
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function rotate<T>(items: readonly T[], start: number): T[] {
  const next = items.slice();
  const n = ((start % next.length) + next.length) % next.length;
  return next.slice(n).concat(next.slice(0, n));
}

function optionsFrom(answer: string, pool: readonly string[], salt: number): [string, string, string, string] {
  const unique = [answer];
  const seen = new Set([answer.toLowerCase()]);
  const rotated = rotate(pool, salt);
  for (const row of rotated) {
    if (seen.has(row.toLowerCase()) || row === answer) continue;
    seen.add(row.toLowerCase());
    unique.push(row);
    if (unique.length === 4) break;
  }
  let n = 1;
  while (unique.length < 4) {
    const filler = `${answer} option ${n}`;
    if (!seen.has(filler.toLowerCase())) {
      unique.push(filler);
      seen.add(filler.toLowerCase());
    }
    n += 1;
  }
  const arranged = rotate(unique, salt + 3).slice(0, 4);
  return [arranged[0], arranged[1], arranged[2], arranged[3]];
}

function scramble(word: string, salt: number): string {
  const chars = word.split('');
  const next = rotate(chars, salt + 1);
  const joined = next.join('');
  return joined === word ? `${word.slice(1)}${word[0]}` : joined;
}

function permute<T>(items: readonly T[], salt: number): T[] {
  const next = rotate(items, salt + 1);
  return next.join('|') === items.join('|') ? next.slice().reverse() : next;
}

const rows: BankQuestion[] = [];
const usedIds = new Set<string>();

function add(kind: BankKind, category: string, difficulty: 1 | 2 | 3, text: string, answer: string, opts: [string, string, string, string], idHint: string) {
  let id = `${kind}-${slug(idHint)}`;
  if (usedIds.has(id)) id = `${id}-${usedIds.size}`;
  const question: BankQuestion = { id, kind, category, difficulty, text, options: opts, answer };
  if (validateQuestion(question).length) return;
  usedIds.add(id);
  rows.push(question);
}

const cities = CAPITALS.map((row) => row[0]);
const countries = CAPITALS.map((row) => row[1]);
CAPITALS.forEach(([city, country], index) => {
  add('trivia', 'geography', 1, `what is the capital of ${country}?`, city, optionsFrom(city, cities, index), `cap-${country}`);
  add('trivia', 'geography', 1, `${city} is the capital of which country?`, country, optionsFrom(country, countries, index + 17), `cty-${city}`);
});

PHRASES.forEach(([phrase, meaning, language], index) => {
  add(
    'translate',
    'translate',
    1,
    `"${phrase}" means ${meaning}. which language is that?`,
    language,
    optionsFrom(language, LANGUAGES, index + 4),
    `${language}-${phrase}`,
  );
});

const elementSymbols = ELEMENTS.map((row) => row[0]);
const elementNames = ELEMENTS.map((row) => row[1]);
ELEMENTS.forEach(([symbol, name], index) => {
  add('trivia', 'science', 2, `chemical symbol for ${name}?`, symbol, optionsFrom(symbol, elementSymbols, index), `el-${name}`);
  add('trivia', 'science', 2, `the symbol ${symbol} stands for which element?`, name, optionsFrom(name, elementNames, index + 9), `eln-${symbol}`);
});

const authorNames = AUTHORS.map((row) => row[1]);
AUTHORS.forEach(([title, author], index) => {
  add('trivia', 'literature', 2, `who wrote ${title}?`, author, optionsFrom(author, authorNames, index), `au-${title}`);
});

const painterNames = PAINTERS.map((row) => row[1]);
PAINTERS.forEach(([work, painter], index) => {
  add('trivia', 'art', 2, `who painted ${work}?`, painter, optionsFrom(painter, painterNames, index), `pt-${work}`);
});

const inventorNames = INVENTIONS.map((row) => row[1]);
INVENTIONS.forEach(([thing, who], index) => {
  add('trivia', 'history', 2, `who is commonly credited with the ${thing}?`, who, optionsFrom(who, inventorNames, index), `inv-${thing}`);
});

const animalNames = Array.from(new Set(ANIMALS.map((row) => row[1])));
ANIMALS.forEach(([clue, name], index) => {
  add('trivia', 'animals', 1, `which animal is the ${clue}?`, name, optionsFrom(name, animalNames, index), `an-${clue}`);
});

const sportAnswers = SPORTS.map((row) => row[1]);
SPORTS.forEach(([clue, answer], index) => {
  add('trivia', 'sports', 1, `how many / what number: ${clue}?`, answer, optionsFrom(answer, sportAnswers.concat(['1', '2', '3', '4', '8', '10', '12', '15']), index), `sp-${clue}`);
});

const scienceAnswers = SCIENCE.map((row) => row[1]);
SCIENCE.forEach(([clue, answer], index) => {
  add('trivia', 'science', 1, `${clue}?`, answer, optionsFrom(answer, scienceAnswers, index), `sci-${clue}`);
});

const geoAnswers = GEO.map((row) => row[1]);
GEO.forEach(([clue, answer], index) => {
  add('trivia', 'geography', 1, `${clue}?`, answer, optionsFrom(answer, geoAnswers, index), `geo-${clue}`);
});

const histAnswers = HISTORY.map((row) => row[1]);
HISTORY.forEach(([clue, answer], index) => {
  add('trivia', 'history', 2, `${clue}?`, answer, optionsFrom(answer, histAnswers, index), `hi-${clue}`);
});

const musicAnswers = MUSIC.map((row) => row[1]);
MUSIC.forEach(([clue, answer], index) => {
  add('trivia', 'music', 2, `${clue}?`, answer, optionsFrom(answer, musicAnswers, index), `mu-${clue}`);
});

const currencyNames = CURRENCIES.map((row) => row[1]);
CURRENCIES.forEach(([place, money], index) => {
  add('trivia', 'geography', 1, `what currency is used in ${place}?`, money, optionsFrom(money, currencyNames, index), `cur-${place}`);
});

MORE_TRIVIA.forEach(([category, text, answer, a, b, c], index) => {
  add('trivia', category, 1, text, answer, optionsFrom(answer, [a, b, c], index + 21), `more-${index}-${answer}`);
});

TONES.forEach((row, index) => {
  const [text, answer, a, b, c] = row;
  add('tone', 'tone', 1, text, answer, optionsFrom(answer, [a, b, c, answer], index), `tone-${index}`);
});

FILLS.forEach(([text, answer, a, b, c], index) => {
  add('fill', 'fill', 1, text, answer, optionsFrom(answer, [a, b, c], index), `fill-${index}`);
});

SPELLS.forEach(([answer, a, b, c], index) => {
  add('spell', 'spell', 2, 'which spelling is the real English one?', answer, optionsFrom(answer, [a, b, c], index), `spel-${answer}`);
});

WORDS.forEach((word, index) => {
  const mixed = scramble(word, index + 3);
  add(
    'unscramble',
    'unscramble',
    2,
    `unscramble "${mixed}"`,
    word,
    optionsFrom(word, WORDS, index + 11),
    `un-${word}-${mixed}`,
  );
});

ORDERS.forEach(([label, items], index) => {
  const answer = items.join(', ');
  const extras = [1, 2, 3, 4, 5].map((n) => permute(items, index + n).join(', '));
  add('order', 'order', 2, `which list is the right order for ${label}?`, answer, optionsFrom(answer, extras, index), `ord-${label}`);
});

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (let start = 0; start < 7; start += 1) {
  for (let delta = 1; delta <= 6; delta += 1) {
    const after = DAYS[(start + delta) % 7];
    const before = DAYS[(start - delta + 70) % 7];
    add(
      'weekday',
      'weekday',
      delta >= 4 ? 2 : 1,
      `what day is ${delta} day${delta === 1 ? '' : 's'} after ${DAYS[start]}?`,
      after,
      optionsFrom(after, DAYS, start * 10 + delta),
      `wd-a-${DAYS[start]}-${delta}`,
    );
    add(
      'weekday',
      'weekday',
      delta >= 4 ? 2 : 1,
      `what day is ${delta} day${delta === 1 ? '' : 's'} before ${DAYS[start]}?`,
      before,
      optionsFrom(before, DAYS, start * 10 + delta + 3),
      `wd-b-${DAYS[start]}-${delta}`,
    );
  }
}

for (let a = 2; a <= 20; a += 1) {
  for (let b = 2; b <= 12; b += 1) {
    const sum = a + b;
    add('math', 'math', 1, `quick, ${a} + ${b}`, String(sum), optionsFrom(String(sum), [String(sum + 1), String(sum - 1), String(a * b), String(Math.abs(a - b))], a * 20 + b), `m-add-${a}-${b}`);
    if (a > b) {
      const diff = a - b;
      add('math', 'math', 1, `${a} minus ${b}`, String(diff), optionsFrom(String(diff), [String(diff + 1), String(diff - 1), String(sum), String(a * b)], a * 30 + b), `m-sub-${a}-${b}`);
    }
    if (a <= 12) {
      const prod = a * b;
      add('math', 'math', 2, `${a} × ${b}`, String(prod), optionsFrom(String(prod), [String(prod + a), String(prod - b), String(sum), String(Math.abs(a - b))], a * 40 + b), `m-mul-${a}-${b}`);
    }
  }
}

const unitPairs: Array<[number, string, string, number]> = [
  [2, 'minutes', 'seconds', 60],
  [3, 'minutes', 'seconds', 60],
  [5, 'minutes', 'seconds', 60],
  [2, 'hours', 'minutes', 60],
  [3, 'hours', 'minutes', 60],
  [4, 'hours', 'minutes', 60],
  [2, 'hours', 'seconds', 3600],
  [3, 'days', 'hours', 24],
  [5, 'days', 'hours', 24],
  [2, 'weeks', 'days', 7],
  [3, 'weeks', 'days', 7],
  [4, 'kilometres', 'metres', 1000],
  [6, 'kilometres', 'metres', 1000],
  [3, 'metres', 'centimetres', 100],
  [8, 'metres', 'centimetres', 100],
  [2, 'kilograms', 'grams', 1000],
  [5, 'kilograms', 'grams', 1000],
  [2, 'litres', 'millilitres', 1000],
  [4, 'litres', 'millilitres', 1000],
  [7, 'minutes', 'seconds', 60],
  [9, 'minutes', 'seconds', 60],
  [6, 'hours', 'minutes', 60],
  [8, 'hours', 'minutes', 60],
  [1, 'hours', 'seconds', 3600],
  [4, 'hours', 'seconds', 3600],
  [2, 'days', 'hours', 24],
  [4, 'days', 'hours', 24],
  [6, 'days', 'hours', 24],
  [1, 'weeks', 'days', 7],
  [4, 'weeks', 'days', 7],
  [5, 'weeks', 'days', 7],
  [2, 'kilometres', 'metres', 1000],
  [3, 'kilometres', 'metres', 1000],
  [5, 'kilometres', 'metres', 1000],
  [7, 'kilometres', 'metres', 1000],
  [2, 'metres', 'centimetres', 100],
  [5, 'metres', 'centimetres', 100],
  [9, 'metres', 'centimetres', 100],
  [3, 'kilograms', 'grams', 1000],
  [4, 'kilograms', 'grams', 1000],
  [6, 'kilograms', 'grams', 1000],
  [3, 'litres', 'millilitres', 1000],
  [5, 'litres', 'millilitres', 1000],
  [6, 'litres', 'millilitres', 1000],
];
unitPairs.forEach(([amount, from, to, factor], index) => {
  const answer = String(amount * factor);
  add(
    'unit',
    'unit',
    factor >= 1000 ? 2 : 1,
    `${amount} ${from} in ${to}?`,
    answer,
    optionsFrom(answer, [String(amount * (factor / 10)), String(amount + factor), String(amount * 10), String(amount * 100)], index),
    `u-${amount}-${from}-${to}`,
  );
});

const byKind = new Map<string, BankQuestion[]>();
for (const row of rows) {
  const list = byKind.get(row.kind) ?? [];
  list.push(row);
  byKind.set(row.kind, list);
}

mkdirSync(OUT, { recursive: true });
for (const [kind, list] of byKind) {
  writeFileSync(join(OUT, `${kind}.json`), `${JSON.stringify(list, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      total: rows.length,
      byKind: Object.fromEntries([...byKind.entries()].map(([kind, list]) => [kind, list.length])),
    },
    null,
    2,
  ),
);
