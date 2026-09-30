import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import {
  Calendar,
  User,
  Clock,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Eye,
  BookOpen,
  Shield,
  Filter,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Info,
  Layers,
  MessageSquare,
  ArrowRight,
  Link as LinkIcon,
  X,
  Check,
  Compass,
  ArrowLeftRight
} from 'lucide-react';

const MIN_YEAR = -10000; // 10 000 f.v.t.
const MAX_YEAR = 2100;   // 2100 v.t.

// Helper function to calculate elapsed nominal year position handling missing Year 0
function yearToNominal(year) {
  const y = Number(year);
  if (y < 0) {
    return y - MIN_YEAR; // -10000 -> 0, -1 -> 9999
  } else {
    return (y - 1) + (-MIN_YEAR); // 1 -> 10000, 2100 -> 12099
  }
}

const TOTAL_YEAR_SPAN = yearToNominal(MAX_YEAR) - yearToNominal(MIN_YEAR); // 12099 years

// Convert year to percentage position on timeline canvas (0% to 100%)
function yearToPercent(year) {
  const nominal = yearToNominal(year);
  return Math.min(100, Math.max(0, (nominal / TOTAL_YEAR_SPAN) * 100));
}

// Calculate exact historical year difference accounting for missing Year 0
function calculateYearDistance(year1, year2) {
  const y1 = Number(year1);
  const y2 = Number(year2);
  if (isNaN(y1) || isNaN(y2)) return 0;
  if ((y1 < 0 && y2 > 0) || (y1 > 0 && y2 < 0)) {
    return Math.abs(y1) + Math.abs(y2) - 1;
  }
  return Math.abs(y1 - y2);
}

// Format year for Swedish UI display
function formatYear(year) {
  if (year === null || year === undefined || isNaN(year)) return '';
  const num = Math.abs(year);
  const formattedNum = num.toLocaleString('sv-SE');
  if (year < 0) {
    return `${formattedNum} f.v.t.`;
  }
  return `${formattedNum} v.t.`;
}

// Format start and optional end year
function formatYearSpan(startAr, slutAr) {
  if (!startAr && startAr !== 0) return '';
  const startStr = formatYear(startAr);
  if (!slutAr && slutAr !== 0) return startStr;
  const slutStr = formatYear(slutAr);
  return `${startStr} – ${slutStr}`;
}

const INITIAL_HISTORICAL_DATA = [
  {
    id: 'jordbrukets-framvaxt',
    titel: 'Jordbrukets framväxt',
    typ: 'EPOK',
    startAr: -10000,
    slutAr: -3000,
    beskrivning: 'Övergången från samlar- och jägarsamhällen till bofast jordbruk (den neolitiska revolutionen). Processen inleddes i den Bördiga halvmånen och utvecklades självständigt på flera håll i världen. Ledde till befolkningstillväxt och de första bofasta civilisatonscentrena.',
    farg: '#E2F0D9',
    bildeUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://ne.se/uppslagsverk/encyklopedi/l%C3%A5ng/neolitiska-revolutionen', 'https://so-rummet.se/kategorier/neolitiska-revolutionen'],
    koppladeObjektIds: ['skriften-mesopotamien'],
    atarkoppling: ''
  },
  {
    id: 'skriften-mesopotamien',
    titel: 'Skriften utvecklas i Mesopotamien',
    typ: 'HANDELSE',
    startAr: -3200,
    slutAr: null,
    beskrivning: 'Kilskriften uppstår i Sumer i sydliga Mesopotamien som ett system för att bokföra handelsvaror och skatter. Det markerar övergången från förhistorisk tid till nedskriven historisk tid.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/mesopotamien'],
    koppladeObjektIds: ['jordbrukets-framvaxt'],
    atarkoppling: ''
  },
  {
    id: 'antiken-medelhavet',
    titel: 'Antiken i Medelhavsområdet',
    typ: 'EPOK',
    startAr: -800,
    slutAr: 500,
    beskrivning: 'Tidsperiod dominerad av de grekiska stadsstaterna och det romerska riket. Kännetecknas av utveckling inom filosofi, demokrati, rättssystem, arkitektur och litteratur kring Medelhavet.',
    farg: '#FCE4D6',
    bildeUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/antiken'],
    koppladeObjektIds: ['konfucius', 'alexander-den-store', 'vastrom-fall'],
    atarkoppling: ''
  },
  {
    id: 'konfucius',
    titel: 'Konfucius',
    typ: 'PERSON',
    startAr: -551,
    slutAr: -479,
    beskrivning: 'Kinesisk filosof och tänkares vars läror om etik, moral, social ordning och respekt för traditioner kom att forma kinesiskt samhällsliv och statsförvaltning under tusentals år.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://ne.se/uppslagsverk/encyklopedi/l%C3%A5ng/konfucius'],
    koppladeObjektIds: [],
    atarkoppling: ''
  },
  {
    id: 'alexander-den-store',
    titel: 'Alexander den store',
    typ: 'PERSON',
    startAr: -356,
    slutAr: -323,
    beskrivning: 'Konung av Makedonien som erövrade Perserriket och skapade ett av historiens största imperier. Hans fälttåg spred den grekiska kulturen över Främre Orienten (hellenismen).',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/alexander-den-store'],
    koppladeObjektIds: ['antiken-medelhavet'],
    atarkoppling: ''
  },
  {
    id: 'vastrom-fall',
    titel: 'Västromerska rikets fall',
    typ: 'HANDELSE',
    startAr: 476,
    slutAr: null,
    beskrivning: 'Den siste västromerske kejsaren Romulus Augustulus avsätts av den germanske fältherren Odovakar. Händelsen brukar traditionellt markera slutet på antiken i Västeuropa.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/romarrikets-fall'],
    koppladeObjektIds: ['antiken-medelhavet', 'medeltiden-europa'],
    atarkoppling: ''
  },
  {
    id: 'medeltiden-europa',
    titel: 'Medeltiden i Europa',
    typ: 'EPOK',
    startAr: 500,
    slutAr: 1500,
    beskrivning: 'Period i Europas historia mellan antikens slut och renässansens/tidigmodern tid. Obs! Medeltiden är en specifik europeisk periodindelning och motsvaras inte av samma skede i övriga världen.',
    farg: '#FFF2CC',
    bildeUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/medeltiden'],
    koppladeObjektIds: ['muhammed', 'mansa-musa', 'gutenberg'],
    atarkoppling: ''
  },
  {
    id: 'muhammed',
    titel: 'Muhammed',
    typ: 'PERSON',
    startAr: 570,
    slutAr: 632,
    beskrivning: 'Islamisk profet och grundare av religionen islam. Enade de arabiska stammarna på den Arabiska halvön under en gemensam tro och skapade grunden för det arabisk-islamiska väldet.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/islam'],
    koppladeObjektIds: [],
    atarkoppling: ''
  },
  {
    id: 'mansa-musa',
    titel: 'Mansa Musa',
    typ: 'PERSON',
    startAr: 1280,
    slutAr: 1337,
    beskrivning: 'Härskare över Maliriket i Västafrika. Känd för sin enorma rikedom baserad på guld- och salt-handel samt sin berömda pilgrimsfärd till Mekka 1324.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1608848461950-0fe51dfc41cb?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/afrikas-historia'],
    koppladeObjektIds: ['medeltiden-europa'],
    atarkoppling: ''
  },
  {
    id: 'gutenberg',
    titel: 'Gutenbergs tryckteknik',
    typ: 'HANDELSE',
    startAr: 1450,
    slutAr: null,
    beskrivning: 'Johann Gutenberg utvecklar lösa typer i metall och tryckpressen i Mainz. Obs! Träsnittstryck och rörliga typer av lera/metall hade utvecklats och tillämpats flera hundra år tidigare i Kina och Korea.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/boktryckarkonsten'],
    koppladeObjektIds: ['medeltiden-europa'],
    atarkoppling: ''
  },
  {
    id: 'columbus-karibien',
    titel: 'Columbus når Karibien',
    typ: 'HANDELSE',
    startAr: 1492,
    slutAr: null,
    beskrivning: 'Christofer Columbus landstiger i Västindien. Händelsen inledde den europeiska koloniseringen av Amerika. Obs! Kontinenten var redan befolkad av urfolk med rika kulturer sedan tiotusentals år.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/upptacktsresor'],
    koppladeObjektIds: [],
    atarkoppling: ''
  },
  {
    id: 'industrialiseringen-storbritannien',
    titel: 'Industrialiseringen i Storbritannien',
    typ: 'EPOK',
    startAr: 1760,
    slutAr: 1840,
    beskrivning: 'Den stora omvandlingen från jordbrukssamhälle till industrisamhälle med ångmaskiner, fabriker och urbanisering. Sprreds senare över Europa och övriga världen.',
    farg: '#E8EEF5',
    bildeUrl: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/industriella-revolutionen'],
    koppladeObjektIds: ['franska-revolutionen'],
    atarkoppling: ''
  },
  {
    id: 'franska-revolutionen',
    titel: 'Franska revolutionen inleds',
    typ: 'HANDELSE',
    startAr: 1789,
    slutAr: null,
    beskrivning: 'Politisk omvälvning mot det absoluta kungadömet och ståndssamhället i Frankrike. Lade grunden för moderna idéer om mänskliga rättigheter, demokrati och nationalism.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/franska-revolutionen'],
    koppladeObjektIds: ['industrialiseringen-storbritannien'],
    atarkoppling: ''
  },
  {
    id: 'forsta-varldskriget',
    titel: 'Första världskriget',
    typ: 'EPOK',
    startAr: 1914,
    slutAr: 1918,
    beskrivning: 'Global konflikt främst utkämpad i Europa mellan trippelententen och trippelalliansen/centralmakterna. Innebar skyttegravskrig, nya vapenteknologier och upplösning av stora imperier.',
    farg: '#F2DCDB',
    bildeUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/forsta-varldskriget'],
    koppladeObjektIds: ['andra-varldskriget'],
    atarkoppling: ''
  },
  {
    id: 'andra-varldskriget',
    titel: 'Andra världskriget',
    typ: 'EPOK',
    startAr: 1939,
    slutAr: 1945,
    beskrivning: 'Omfattande världskrig utlöst av Nazitysklands expansionism och axelmakterna. Medförde Förintelsen, totalt krig mot civilbefolkningar och atomvapnens första användning.',
    farg: '#E2D9F0',
    bildeUrl: 'https://images.unsplash.com/photo-1508847154043-be5407fcaa5a?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/andra-varldskriget'],
    koppladeObjektIds: ['forsta-varldskriget', 'fn-bildas'],
    atarkoppling: ''
  },
  {
    id: 'fn-bildas',
    titel: 'Förenta nationerna bildas',
    typ: 'HANDELSE',
    startAr: 1945,
    slutAr: null,
    beskrivning: 'Internationell organisation grundad efter andra världskriget för att främja fred, säkerhet, mänskliga rättigheter och internationellt samarbete.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://fn.se/om-oss/vad-vi-gor/fn-historia/'],
    koppladeObjektIds: ['andra-varldskriget'],
    atarkoppling: ''
  },
  {
    id: 'berlinmuren-oppnas',
    titel: 'Berlinmuren öppnas',
    typ: 'HANDELSE',
    startAr: 1989,
    slutAr: null,
    beskrivning: 'Gränsen mellan Öst- och Västberlin öppnas efter folkliga protester i Östtyskland. Symboliserar kalla krigets slut och framväxten av ett enat Europa.',
    farg: '#D6E1E4',
    bildeUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    bidragsgivare: 'Historieinstitutionen',
    skapareId: 'system_teacher',
    status: 'PUBLICERAD',
    kallor: ['https://so-rummet.se/kategorier/berlinmuren'],
    koppladeObjektIds: [],
    atarkoppling: ''
  }
];

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const config = JSON.parse(__firebase_config);
    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
  }
} catch (e) {
  console.warn('Firebase init fallback to local state:', e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'tidsperspektiv-default';

export default function App() {
  // Navigation View State ('TIMELINE', 'ALL_OBJECTS', 'MY_CONTRIBUTIONS', 'REVIEW')
  const [activeTab, setActiveTab] = useState('TIMELINE');

  // User State & Roles
  const [userRole, setUserRole] = useState('LAERARE'); // 'LAERARE' or 'ELEV'
  const [userName, setUserName] = useState('Gymnasieeleven');
  const [userId, setUserId] = useState('user_local_1');
  const [authUser, setAuthUser] = useState(null);

  // Core Data State
  const [objects, setObjects] = useState(INITIAL_HISTORICAL_DATA);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Lokal lagring aktiv');

  // Timeline UI State
  const [zoomLevel, setZoomLevel] = useState(1); // 1x to 10x multiplier
  const scrollContainerRef = useRef(null);
  const [failedImages, setFailedImages] = useState({});

  // Modals and Interaction State
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const [defaultEditorType, setDefaultEditorType] = useState('HANDELSE');

  // Time Comparison Module State
  const [compareObjAId, setCompareObjAId] = useState('columbus-karibien');
  const [compareObjBId, setCompareObjBId] = useState('franska-revolutionen');

  // Search & Filter State in "Alla objekt"
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALLA');

  useEffect(() => {
    if (!firebaseAuth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(firebaseAuth, __initial_auth_token);
        } else {
          await signInAnonymously(firebaseAuth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();

    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setAuthUser(u);
      if (u) {
        setUserId(u.uid);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseDb || !authUser) return;
    setLoading(true);
    // Public artifacts path rule 1
    const colRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'tidsperspektiv_objects');

    const unsub = onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const fetched = snapshot.docs.map(doc => doc.data());
        setObjects(fetched);
        setSyncStatus('Synkroniserad med klasmoln');
      } else {
        // Seed initial data if collection empty
        INITIAL_HISTORICAL_DATA.forEach(item => {
          setDoc(doc(colRef, item.id), item).catch(err => console.error(err));
        });
        setObjects(INITIAL_HISTORICAL_DATA);
        setSyncStatus('Klasmoln initierat med startmaterial');
      }
      setLoading(false);
    }, (err) => {
      console.error('Firestore listener error:', err);
      setSyncStatus('Lokal demonstrasjonslagring (Offline)');
      setLoading(false);
    });

    return () => unsub();
  }, [authUser]);

  const publishedObjects = useMemo(() => {
    return objects.filter(o => o.status === 'PUBLICERAD');
  }, [objects]);

  const pendingObjects = useMemo(() => {
    return objects.filter(o => o.status === 'VÄNTAR_GRANSKNING');
  }, [objects]);

  const myObjects = useMemo(() => {
    return objects.filter(o => o.skapareId === userId || o.bidragsgivare === userName);
  }, [objects, userId, userName]);

  const activeEpochs = useMemo(() => {
    return publishedObjects.filter(o => o.typ === 'EPOK');
  }, [publishedObjects]);

  const selectedObject = useMemo(() => {
    return objects.find(o => o.id === selectedObjectId) || null;
  }, [objects, selectedObjectId]);

  const epochSegments = useMemo(() => {
    if (activeEpochs.length === 0) return [];

    // Collect all year boundaries from published epochs
    const points = new Set([MIN_YEAR, MAX_YEAR]);
    activeEpochs.forEach(e => {
      points.add(Math.max(MIN_YEAR, Math.min(MAX_YEAR, e.startAr)));
      points.add(Math.max(MIN_YEAR, Math.min(MAX_YEAR, e.slutAr || MAX_YEAR)));
    });

    const sortedPoints = Array.from(points).sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const segStart = sortedPoints[i];
      const segEnd = sortedPoints[i + 1];
      if (segStart === segEnd) continue;

      // Find all epochs overlapping this segment
      const overlapping = activeEpochs.filter(e => {
        const eEnd = e.slutAr || MAX_YEAR;
        return e.startAr < segEnd && eEnd > segStart;
      });

      if (overlapping.length > 0) {
        const startPct = yearToPercent(segStart);
        const endPct = yearToPercent(segEnd);
        segments.push({
          startAr: segStart,
          slutAr: segEnd,
          startPct,
          widthPct: endPct - startPct,
          epochs: overlapping
        });
      }
    }
    return segments;
  }, [activeEpochs]);

  const handleSaveObject = async (formData) => {
    setLoading(true);
    const isTeacher = userRole === 'LAERARE';
    const status = isTeacher ? 'PUBLICERAD' : 'VÄNTAR_GRANSKNING';

    const newObj = {
      ...formData,
      id: formData.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      skapareId: formData.skapareId || userId,
      bidragsgivare: formData.bidragsgivare || (isTeacher ? 'Lärare' : userName),
      status: status,
      atarkoppling: formData.atarkoppling || ''
    };

    // Update local state immediately
    setObjects(prev => {
      const idx = prev.findIndex(o => o.id === newObj.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = newObj;
        return updated;
      }
      return [...prev, newObj];
    });

    // Firestore sync if available
    if (firebaseDb) {
      try {
        const docRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'tidsperspektiv_objects', newObj.id);
        await setDoc(docRef, newObj);
      } catch (e) {
        console.error('Error saving to Firestore:', e);
      }
    }

    setLoading(false);
    setIsEditorOpen(false);
    setEditingObject(null);
  };

  const handleUpdateStatus = async (objectId, newStatus, feedbackText = '') => {
    setLoading(true);
    setObjects(prev => prev.map(o => {
      if (o.id === objectId) {
        return { ...o, status: newStatus, atarkoppling: feedbackText };
      }
      return o;
    }));

    if (firebaseDb) {
      try {
        const docRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'tidsperspektiv_objects', objectId);
        await updateDoc(docRef, { status: newStatus, atarkoppling: feedbackText });
      } catch (e) {
        console.error('Error updating status:', e);
      }
    }
    setLoading(false);
  };

  const handleDeleteObject = async (objectId) => {
    if (!window.confirm('Är du säker på att du vill ta bort detta objekt?')) return;
    setLoading(true);
    setObjects(prev => prev.filter(o => o.id !== objectId));

    if (firebaseDb) {
      try {
        const docRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'tidsperspektiv_objects', objectId);
        await deleteDoc(docRef);
      } catch (e) {
        console.error('Error deleting object:', e);
      }
    }
    if (selectedObjectId === objectId) setSelectedObjectId(null);
    setLoading(false);
  };

  const handleZoom = (direction) => {
    setZoomLevel(prev => {
      if (direction === 'in') return Math.min(10, +(prev + 0.5).toFixed(1));
      if (direction === 'out') return Math.max(1, +(prev - 0.5).toFixed(1));
      return 1;
    });
  };

  const panTimeline = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = scrollContainerRef.current.clientWidth * 0.4;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const jumpToPeriod = (startYear, endYear) => {
    const startPct = yearToPercent(startYear) / 100;
    const endPct = yearToPercent(endYear) / 100;
    const spanPct = Math.max(0.04, endPct - startPct);

    // Calculate zoom needed to fit range in viewport nicely
    const targetZoom = Math.min(10, Math.max(1, +(1 / spanPct).toFixed(1)));
    setZoomLevel(targetZoom);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        const containerWidth = scrollContainerRef.current.clientWidth;
        const totalContentWidth = containerWidth * targetZoom;
        const centerPct = (startPct + endPct) / 2;
        const targetScroll = (centerPct * totalContentWidth) - (containerWidth / 2);
        scrollContainerRef.current.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }, 50);
  };

  const scrollToObjectOnTimeline = (obj) => {
    setActiveTab('TIMELINE');
    setSelectedObjectId(obj.id);
    const startPct = yearToPercent(obj.startAr) / 100;
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const containerWidth = scrollContainerRef.current.clientWidth;
        const totalContentWidth = containerWidth * zoomLevel;
        const targetScroll = (startPct * totalContentWidth) - (containerWidth / 2);
        scrollContainerRef.current.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#F4F7F8] text-[#173C42] font-sans flex flex-col antialiased selection:bg-[#D6FF72] selection:text-[#142F35]">
      
      {/* Top Application Header Bar */}
      <header className="bg-[#142F35] text-white shadow-md border-b border-[#D6E1E4]/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo and Academic Title */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('TIMELINE')}>
              <div className="w-10 h-10 rounded-lg bg-[#D6FF72] text-[#142F35] flex items-center justify-center font-bold text-xl shadow-inner">
                <Compass className="w-6 h-6 text-[#142F35]" />
              </div>
              <div>
                <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Tidsperspektiv
                  <span className="text-xs bg-[#D6FF72]/20 text-[#D6FF72] px-2 py-0.5 rounded border border-[#D6FF72]/30 font-sans font-normal">
                    Historia
                  </span>
                </h1>
                <p className="text-xs text-emerald-100/70 hidden sm:block">Interaktiv historisk tidslinje för gymnasiet</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setActiveTab('TIMELINE')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'TIMELINE' ? 'bg-[#173C42] text-[#D6FF72] border-b-2 border-[#D6FF72]' : 'text-gray-200 hover:text-white hover:bg-[#173C42]/50'
                }`}
              >
                <Clock className="w-4 h-4" />
                Tidslinje
              </button>

              <button
                onClick={() => setActiveTab('ALL_OBJECTS')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ALL_OBJECTS' ? 'bg-[#173C42] text-[#D6FF72] border-b-2 border-[#D6FF72]' : 'text-gray-200 hover:text-white hover:bg-[#173C42]/50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Alla objekt ({publishedObjects.length})
              </button>

              <button
                onClick={() => setActiveTab('MY_CONTRIBUTIONS')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'MY_CONTRIBUTIONS' ? 'bg-[#173C42] text-[#D6FF72] border-b-2 border-[#D6FF72]' : 'text-gray-200 hover:text-white hover:bg-[#173C42]/50'
                }`}
              >
                <User className="w-4 h-4" />
                Mina bidrag ({myObjects.length})
              </button>

              {userRole === 'LAERARE' && (
                <button
                  onClick={() => setActiveTab('REVIEW')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 relative ${
                    activeTab === 'REVIEW' ? 'bg-[#173C42] text-[#D6FF72] border-b-2 border-[#D6FF72]' : 'text-gray-200 hover:text-white hover:bg-[#173C42]/50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Granska
                  {pendingObjects.length > 0 && (
                    <span className="bg-amber-400 text-slate-950 font-bold text-xs px-1.5 py-0.2 rounded-full">
                      {pendingObjects.length}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* Top Action Buttons and Role Switcher */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setEditingObject(null);
                  setDefaultEditorType('HANDELSE');
                  setIsEditorOpen(true);
                }}
                className="bg-[#D6FF72] hover:bg-[#c3f553] text-[#142F35] font-semibold text-xs sm:text-sm px-3 py-2 rounded-lg transition shadow flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Lägg till</span> objekt
              </button>

              <button
                onClick={() => {
                  setEditingObject(null);
                  setDefaultEditorType('EPOK');
                  setIsEditorOpen(true);
                }}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs sm:text-sm px-3 py-2 rounded-lg transition border border-emerald-600/40 flex items-center gap-1"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Lägg till</span> epok
              </button>

              {/* Role Toggle Switcher */}
              <div className="ml-2 pl-2 border-l border-emerald-700/60 flex items-center gap-1 text-xs">
                <span className="text-gray-300 hidden lg:inline">Roll:</span>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="bg-[#173C42] text-white border border-emerald-600/50 rounded px-2 py-1 focus:outline-none text-xs font-medium cursor-pointer"
                  title="Växla roll för tester"
                >
                  <option value="LAERARE">👨‍🏫 Lärare</option>
                  <option value="ELEV">🎓 Elev</option>
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex overflow-x-auto bg-[#173C42] px-2 py-1 space-x-1 border-t border-emerald-800/40 text-xs">
          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${activeTab === 'TIMELINE' ? 'bg-[#142F35] text-[#D6FF72]' : 'text-gray-300'}`}
          >
            Tidslinje
          </button>
          <button
            onClick={() => setActiveTab('ALL_OBJECTS')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${activeTab === 'ALL_OBJECTS' ? 'bg-[#142F35] text-[#D6FF72]' : 'text-gray-300'}`}
          >
            Alla ({publishedObjects.length})
          </button>
          <button
            onClick={() => setActiveTab('MY_CONTRIBUTIONS')}
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${activeTab === 'MY_CONTRIBUTIONS' ? 'bg-[#142F35] text-[#D6FF72]' : 'text-gray-300'}`}
          >
            Mina bidrag ({myObjects.length})
          </button>
          {userRole === 'LAERARE' && (
            <button
              onClick={() => setActiveTab('REVIEW')}
              className={`px-3 py-1.5 rounded font-medium whitespace-nowrap flex items-center gap-1 ${activeTab === 'REVIEW' ? 'bg-[#142F35] text-[#D6FF72]' : 'text-gray-300'}`}
            >
              Granska {pendingObjects.length > 0 && `(${pendingObjects.length})`}
            </button>
          )}
        </div>
      </header>

      {}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">

        {/* Sync Status Banner */}
        <div className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-[#D6E1E4] text-xs text-gray-600 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${syncStatus.includes('Offline') ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            <span className="font-medium text-[#173C42]">{syncStatus}</span>
            <span className="text-gray-400">|</span>
            <span>Aktiv användare: <strong className="text-[#173C42]">{userRole === 'LAERARE' ? 'Lärare (Full redigeringsrätt)' : userName}</strong></span>
          </div>
          {loading && (
            <div className="flex items-center space-x-1 text-emerald-700 animate-pulse">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Uppdaterar...</span>
            </div>
          )}
        </div>

        {/* TAB 1: TIMELINE MAIN VIEW */}
        {activeTab === 'TIMELINE' && (
          <div className="space-y-4">
            
            {/* Timeline Toolbar: Zoom & Quick Period Buttons */}
            <div className="bg-white p-4 rounded-xl border border-[#D6E1E4] shadow-sm space-y-3">
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Zoom controls */}
                <div className="flex items-center space-x-2 bg-[#F4F7F8] p-1.5 rounded-lg border border-[#D6E1E4]">
                  <button
                    onClick={() => handleZoom('out')}
                    disabled={zoomLevel <= 1}
                    className="p-1.5 bg-white hover:bg-gray-100 disabled:opacity-40 text-[#173C42] rounded border border-[#D6E1E4] transition shadow-sm"
                    title="Zooma ut (-)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-2 px-2">
                    <span className="text-xs font-bold text-[#173C42] min-w-[50px]">Skala: {zoomLevel}x</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={zoomLevel}
                      onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                      className="w-24 sm:w-32 accent-[#173C42] cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => handleZoom('in')}
                    disabled={zoomLevel >= 10}
                    className="p-1.5 bg-white hover:bg-gray-100 disabled:opacity-40 text-[#173C42] rounded border border-[#D6E1E4] transition shadow-sm"
                    title="Zooma in (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Pan Left/Right & Reset controls */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-[#F4F7F8] p-1 rounded-lg border border-[#D6E1E4]">
                    <button
                      onClick={() => panTimeline('left')}
                      className="p-1.5 hover:bg-white text-[#173C42] rounded transition"
                      title="Panorera vänster"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 px-1 font-medium">Panorera</span>
                    <button
                      onClick={() => panTimeline('right')}
                      className="p-1.5 hover:bg-white text-[#173C42] rounded transition"
                      title="Panorera höger"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                    }}
                    className="text-xs font-medium text-[#173C42] bg-[#F4F7F8] hover:bg-white border border-[#D6E1E4] px-3 py-2 rounded-lg transition"
                  >
                    Visa hela tidslinjen
                  </button>
                </div>

                {/* Overlapping Epoch Explanation Indicator */}
                <div className="flex items-center space-x-2 text-xs text-gray-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                  <div className="w-5 h-3 rounded border border-amber-300" style={{ background: 'repeating-linear-gradient(45deg, #FCE4D6, #FCE4D6 4px, #FFF2CC 4px, #FFF2CC 8px)' }}></div>
                  <span className="font-medium">Randig bakgrund = överlappande epoker</span>
                </div>
              </div>

              {/* Quick Jump Historical Period Buttons */}
              <div className="flex items-center space-x-2 overflow-x-auto pt-1 text-xs border-t border-gray-100">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px] whitespace-nowrap">Snabbzoom:</span>
                <button onClick={() => jumpToPeriod(-10000, 2100)} className="px-2.5 py-1 bg-[#F4F7F8] hover:bg-[#D6E1E4] text-[#173C42] rounded font-medium transition whitespace-nowrap">
                  🌍 Överblick (-10 000 till 2100)
                </button>
                <button onClick={() => jumpToPeriod(-800, 500)} className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-900 rounded font-medium border border-orange-200 transition whitespace-nowrap">
                  🏛️ Antiken (-800 till 500)
                </button>
                <button onClick={() => jumpToPeriod(500, 1500)} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-medium border border-amber-200 transition whitespace-nowrap">
                  🏰 Medeltiden (500 till 1500)
                </button>
                <button onClick={() => jumpToPeriod(1500, 2026)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded font-medium border border-blue-200 transition whitespace-nowrap">
                  ⛵ 1500–nutid
                </button>
                <button onClick={() => jumpToPeriod(1900, 2026)} className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded font-medium border border-purple-200 transition whitespace-nowrap">
                  🚀 1900–nutid
                </button>
              </div>

            </div>

            {}
            <div className="bg-white rounded-xl border border-[#D6E1E4] shadow-md overflow-hidden">
              
              <div 
                ref={scrollContainerRef}
                className="overflow-x-auto relative select-none"
                style={{ cursor: 'grab' }}
              >
                {/* Dynamically Sized Inner Timeline Track */}
                <div 
                  className="relative py-6 px-12 min-h-[520px] transition-all duration-300"
                  style={{ width: `${Math.max(100, zoomLevel * 100)}%` }}
                >

                  {/* 1. EPOCH BACKGROUND OVERLAYS (FULL HEIGHT) */}
                  <div className="absolute inset-y-0 left-12 right-12 pointer-events-none z-0">
                    {epochSegments.map((seg, idx) => {
                      let bgStyle = {};
                      if (seg.epochs.length === 1) {
                        bgStyle = { backgroundColor: seg.epochs[0].farg || '#FFF2CC', opacity: 0.5 };
                      } else if (seg.epochs.length > 1) {
                        const colors = seg.epochs.map(e => e.farg || '#E8EEF5');
                        const stripeStops = colors.map((col, cIdx) => {
                          const size = 12;
                          return `${col} ${cIdx * size}px, ${col} ${(cIdx + 1) * size}px`;
                        }).join(', ');
                        bgStyle = {
                          backgroundImage: `repeating-linear-gradient(135deg, ${stripeStops})`,
                          opacity: 0.65
                        };
                      }

                      return (
                        <div
                          key={`seg_${idx}_${seg.startAr}`}
                          className="absolute top-0 bottom-0 border-l border-r border-[#173C42]/10 transition-all"
                          style={{
                            left: `${seg.startPct}%`,
                            width: `${seg.widthPct}%`,
                            ...bgStyle
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* 2. TOP EPOCH HEADER BUTTONS TRACK */}
                  <div className="relative z-20 mb-8 h-10 border-b border-[#D6E1E4] pb-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider absolute -top-5 left-0">Historiska epoker:</span>
                    {activeEpochs.map((epok) => {
                      const startPct = yearToPercent(epok.startAr);
                      const endPct = yearToPercent(epok.slutAr || MAX_YEAR);
                      const widthPct = Math.max(1.5, endPct - startPct);

                      return (
                        <div
                          key={epok.id}
                          onClick={() => setSelectedObjectId(epok.id)}
                          className="absolute top-0 h-8 rounded-md border border-[#173C42]/20 shadow-sm cursor-pointer hover:ring-2 ring-[#173C42] transition flex items-center px-2 overflow-hidden group"
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: epok.farg || '#E2F0D9'
                          }}
                          title={`${epok.titel} (${formatYearSpan(epok.startAr, epok.slutAr)})`}
                        >
                          {/* Epoch icon preview */}
                          <div className="w-5 h-5 rounded flex-shrink-0 bg-white/70 overflow-hidden mr-1.5 flex items-center justify-center">
                            {epok.bildeUrl && !failedImages[epok.id] ? (
                              <img src={epok.bildeUrl} alt="" className="w-full h-full object-cover" onError={() => setFailedImages(p => ({...p, [epok.id]: true}))} />
                            ) : (
                              <Layers className="w-3 h-3 text-[#173C42]" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-[#173C42] truncate group-hover:underline">
                            {epok.titel}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3. TIME AXIS LINE & TICK MARKS */}
                  <div className="relative my-8 h-10 border-y-2 border-[#173C42] bg-white/80 z-10 flex items-center">
                    
                    {/* Render Periodic Year Tick Markers */}
                    {(() => {
                      const ticks = [];
                      const step = zoomLevel > 5 ? 100 : zoomLevel > 2 ? 500 : 1000;
                      
                      for (let y = MIN_YEAR; y <= MAX_YEAR; y += step) {
                        if (y === 0) continue; // No Year 0
                        const pct = yearToPercent(y);
                        ticks.push(
                          <div
                            key={`tick_${y}`}
                            className="absolute top-0 bottom-0 flex flex-col items-center justify-between pointer-events-none"
                            style={{ left: `${pct}%` }}
                          >
                            <div className="w-0.5 h-2 bg-[#173C42]"></div>
                            <span className="text-[10px] font-bold text-[#173C42] bg-white/90 px-1 rounded shadow-xs whitespace-nowrap">
                              {formatYear(y)}
                            </span>
                            <div className="w-0.5 h-2 bg-[#173C42]"></div>
                          </div>
                        );
                      }
                      return ticks;
                    })()}
                  </div>

                  {/* 4. EVENTS TRACK (HÄNDELSER) */}
                  <div className="relative z-20 my-6 min-h-[140px] border-b border-dashed border-[#D6E1E4] pb-4">
                    <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider block mb-2">Händelser:</span>
                    {publishedObjects.filter(o => o.typ === 'HANDELSE').map((item, idx) => {
                      const pct = yearToPercent(item.startAr);
                      // Alternate row offset to avoid overlapping cards
                      const rowOffset = (idx % 3) * 44;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedObjectId(item.id)}
                          className="absolute cursor-pointer transition-all hover:scale-105 hover:z-30 group"
                          style={{
                            left: `${pct}%`,
                            top: `${rowOffset}px`,
                            transform: 'translateX(-50%)'
                          }}
                        >
                          {/* Connector Line to Axis */}
                          <div className="w-0.5 h-6 bg-[#173C42]/40 mx-auto -mb-1"></div>

                          {/* Event Card */}
                          <div className="bg-white border-2 border-[#173C42]/20 hover:border-[#173C42] rounded-lg p-1.5 shadow-md flex items-center space-x-2 max-w-[180px] sm:max-w-[210px] group-hover:shadow-lg">
                            <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200">
                              {item.bildeUrl && !failedImages[item.id] ? (
                                <img src={item.bildeUrl} alt="" className="w-full h-full object-cover" onError={() => setFailedImages(p => ({...p, [item.id]: true}))} />
                              ) : (
                                <Calendar className="w-4 h-4 text-[#173C42]" />
                              )}
                            </div>
                            <div className="overflow-hidden text-left">
                              <h4 className="text-xs font-bold text-[#173C42] leading-tight truncate">{item.titel}</h4>
                              <p className="text-[10px] text-teal-800 font-semibold">{formatYear(item.startAr)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 5. PERSONS TRACK (PERSONER - ROUND CARDS) */}
                  <div className="relative z-20 my-6 min-h-[140px]">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block mb-2">Personer:</span>
                    {publishedObjects.filter(o => o.typ === 'PERSON').map((item, idx) => {
                      const pct = yearToPercent(item.startAr);
                      const rowOffset = (idx % 3) * 44;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedObjectId(item.id)}
                          className="absolute cursor-pointer transition-all hover:scale-105 hover:z-30 group"
                          style={{
                            left: `${pct}%`,
                            top: `${rowOffset}px`,
                            transform: 'translateX(-50%)'
                          }}
                        >
                          {/* Connector Line */}
                          <div className="w-0.5 h-6 bg-amber-700/40 mx-auto -mb-1"></div>

                          {/* Person Round Card */}
                          <div className="bg-amber-50/90 border-2 border-amber-800/30 hover:border-amber-800 rounded-full py-1 px-2 shadow-md flex items-center space-x-2 max-w-[180px] sm:max-w-[210px] group-hover:shadow-lg">
                            <div className="w-8 h-8 rounded-full bg-amber-200 overflow-hidden flex-shrink-0 flex items-center justify-center border border-amber-400">
                              {item.bildeUrl && !failedImages[item.id] ? (
                                <img src={item.bildeUrl} alt="" className="w-full h-full object-cover" onError={() => setFailedImages(p => ({...p, [item.id]: true}))} />
                              ) : (
                                <User className="w-4 h-4 text-amber-900" />
                              )}
                            </div>
                            <div className="overflow-hidden text-left pr-1">
                              <h4 className="text-xs font-bold text-amber-950 leading-tight truncate">{item.titel}</h4>
                              <p className="text-[10px] text-amber-800 font-medium">{formatYearSpan(item.startAr, item.slutAr)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>

            </div>

            {}
            <div className="bg-white p-5 rounded-xl border border-[#D6E1E4] shadow-sm">
              <div className="flex items-center space-x-2 mb-3">
                <ArrowLeftRight className="w-5 h-5 text-[#173C42]" />
                <h3 className="font-serif font-bold text-lg text-[#173C42]">Hur långt är det mellan?</h3>
                <span className="text-xs text-gray-500 font-normal">Jämför tidsavstånd mellan två historiska skeenden</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
                
                {/* Object A Select */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Första objektet (A):</label>
                  <select
                    value={compareObjAId}
                    onChange={(e) => setCompareObjAId(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2.5 text-sm font-medium text-[#173C42] focus:outline-none focus:ring-2 ring-[#173C42]"
                  >
                    {publishedObjects.map(o => (
                      <option key={`a_${o.id}`} value={o.id}>
                        {o.titel} ({formatYear(o.startAr)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Object B Select */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Andra objektet (B):</label>
                  <select
                    value={compareObjBId}
                    onChange={(e) => setCompareObjBId(e.target.value)}
                    className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2.5 text-sm font-medium text-[#173C42] focus:outline-none focus:ring-2 ring-[#173C42]"
                  >
                    {publishedObjects.map(o => (
                      <option key={`b_${o.id}`} value={o.id}>
                        {o.titel} ({formatYear(o.startAr)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Result Box */}
                {(() => {
                  const objA = publishedObjects.find(o => o.id === compareObjAId);
                  const objB = publishedObjects.find(o => o.id === compareObjBId);

                  if (!objA || !objB) return null;

                  const distance = calculateYearDistance(objA.startAr, objB.startAr);
                  const crossesZero = (objA.startAr < 0 && objB.startAr > 0) || (objA.startAr > 0 && objB.startAr < 0);

                  return (
                    <div className="bg-[#173C42] text-white p-3 rounded-lg shadow-inner flex flex-col justify-center">
                      <span className="text-[11px] text-[#D6FF72] uppercase tracking-wider font-semibold">Beräknat tidsavstånd:</span>
                      <div className="text-xl font-bold font-serif text-white">
                        {distance.toLocaleString('sv-SE')} år
                      </div>
                      <p className="text-[11px] text-emerald-100/80 mt-0.5">
                        Från {formatYear(objA.startAr)} till {formatYear(objB.startAr)}
                        {crossesZero && <span className="block text-amber-200 font-normal">*Beräknat utan år 0 (korrekt övergång f.v.t./v.t.)</span>}
                      </p>
                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: ALL OBJECTS GRID VIEW */}
        {activeTab === 'ALL_OBJECTS' && (
          <div className="space-y-4">
            
            {/* Search & Filter Header */}
            <div className="bg-white p-4 rounded-xl border border-[#D6E1E4] shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
              
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Sök i historien..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#173C42]"
                />
              </div>

              <div className="flex items-center space-x-1 w-full sm:w-auto overflow-x-auto text-xs">
                <button
                  onClick={() => setFilterType('ALLA')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${filterType === 'ALLA' ? 'bg-[#173C42] text-white' : 'bg-[#F4F7F8] text-gray-600 hover:bg-gray-200'}`}
                >
                  Alla
                </button>
                <button
                  onClick={() => setFilterType('HANDELSE')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${filterType === 'HANDELSE' ? 'bg-[#173C42] text-white' : 'bg-[#F4F7F8] text-gray-600 hover:bg-gray-200'}`}
                >
                  Händelser
                </button>
                <button
                  onClick={() => setFilterType('PERSON')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${filterType === 'PERSON' ? 'bg-[#173C42] text-white' : 'bg-[#F4F7F8] text-gray-600 hover:bg-gray-200'}`}
                >
                  Personer
                </button>
                <button
                  onClick={() => setFilterType('EPOK')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${filterType === 'EPOK' ? 'bg-[#173C42] text-white' : 'bg-[#F4F7F8] text-gray-600 hover:bg-gray-200'}`}
                >
                  Epoker
                </button>
              </div>

            </div>

            {/* Objects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publishedObjects
                .filter(o => filterType === 'ALLA' || o.typ === filterType)
                .filter(o => o.titel.toLowerCase().includes(searchQuery.toLowerCase()) || o.beskrivning.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#D6E1E4] shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Header with Type Badge */}
                      <div className="relative h-44 bg-gray-100 overflow-hidden flex items-center justify-center">
                        {item.bildeUrl && !failedImages[item.id] ? (
                          <img
                            src={item.bildeUrl}
                            alt={item.titel}
                            className={`w-full h-full object-cover ${item.typ === 'PERSON' ? 'p-2 rounded-full max-w-[160px] mx-auto shadow' : ''}`}
                            onError={() => setFailedImages(p => ({...p, [item.id]: true}))}
                          />
                        ) : (
                          <div className="text-gray-400 flex flex-col items-center">
                            {item.typ === 'PERSON' ? <User className="w-12 h-12" /> : item.typ === 'EPOK' ? <Layers className="w-12 h-12" /> : <Calendar className="w-12 h-12" />}
                            <span className="text-xs mt-1">Bild saknas</span>
                          </div>
                        )}

                        <span className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow ${
                          item.typ === 'PERSON' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          item.typ === 'EPOK' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          'bg-teal-100 text-teal-900 border border-teal-300'
                        }`}>
                          {item.typ}
                        </span>
                      </div>

                      {/* Content Info */}
                      <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-serif font-bold text-lg text-[#173C42] leading-snug">{item.titel}</h3>
                        </div>

                        <p className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded w-max border border-emerald-100">
                          {formatYearSpan(item.startAr, item.slutAr)}
                        </p>

                        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                          {item.beskrivning}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-4 pt-0 border-t border-gray-100 mt-2 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400">Bidrag: {item.bidragsgivare}</span>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => scrollToObjectOnTimeline(item)}
                          className="text-xs bg-[#F4F7F8] hover:bg-[#D6E1E4] text-[#173C42] px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Tidslinje
                        </button>
                        <button
                          onClick={() => setSelectedObjectId(item.id)}
                          className="text-xs bg-[#173C42] hover:bg-[#142F35] text-white px-2.5 py-1.5 rounded font-medium transition"
                        >
                          Detaljer
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
            </div>

          </div>
        )}

        {/* TAB 3: MY CONTRIBUTIONS VIEW */}
        {activeTab === 'MY_CONTRIBUTIONS' && (
          <div className="space-y-4">
            
            <div className="bg-white p-5 rounded-xl border border-[#D6E1E4] shadow-sm flex justify-between items-center">
              <div>
                <h2 className="font-serif font-bold text-xl text-[#173C42]">Mina bidrag och förslag</h2>
                <p className="text-xs text-gray-500">Här kan du följa status för dina skapade eller redigerade historiska objekt</p>
              </div>

              <button
                onClick={() => {
                  setEditingObject(null);
                  setDefaultEditorType('HANDELSE');
                  setIsEditorOpen(true);
                }}
                className="bg-[#D6FF72] hover:bg-[#c3f553] text-[#142F35] font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition shadow flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Skapa nytt bidrag
              </button>
            </div>

            {myObjects.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-[#D6E1E4] text-center space-y-3">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="font-serif font-bold text-lg text-gray-700">Du har inga sparade bidrag ännu</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Klicka på "Skapa nytt bidrag" för att lägga till en händelse, person eller epok på klassens tidslinje.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myObjects.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-[#D6E1E4] shadow-sm space-y-3">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.status === 'PUBLICERAD' ? 'bg-emerald-100 text-emerald-800' :
                          item.status === 'BEHÖVER_KOMPLETTERING' ? 'bg-amber-100 text-amber-900' :
                          'bg-blue-100 text-blue-900'
                        }`}>
                          {item.status === 'PUBLICERAD' ? '✓ Publicerad' : item.status === 'BEHÖVER_KOMPLETTERING' ? '⚠️ Behöver komplettering' : '⏳ Väntar på granskning'}
                        </span>
                        <h3 className="font-serif font-bold text-lg text-[#173C42] mt-1">{item.titel}</h3>
                      </div>

                      <span className="text-xs font-semibold text-gray-500">{formatYearSpan(item.startAr, item.slutAr)}</span>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2">{item.beskrivning}</p>

                    {/* Teacher Feedback Box if exists */}
                    {item.atarkoppling && (
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                        <span className="font-bold flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                          Återkoppling från läraren:
                        </span>
                        <p>{item.atarkoppling}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex justify-end space-x-2">
                      {(userRole === 'LAERARE' || item.skapareId === userId) && (
                        <button
                          onClick={() => {
                            setEditingObject(item);
                            setIsEditorOpen(true);
                          }}
                          className="text-xs bg-[#F4F7F8] hover:bg-[#D6E1E4] text-[#173C42] px-3 py-1.5 rounded font-medium transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Redigera & Skicka igen
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: TEACHER REVIEW QUEUE VIEW */}
        {activeTab === 'REVIEW' && userRole === 'LAERARE' && (
          <div className="space-y-4">
            
            <div className="bg-white p-5 rounded-xl border border-[#D6E1E4] shadow-sm">
              <h2 className="font-serif font-bold text-xl text-[#173C42]">Lärargranskning – Väntande bidrag</h2>
              <p className="text-xs text-gray-500">Granska och ge återkoppling på elevbidrag innan de publiceras på klassens gemensamma tidslinje</p>
            </div>

            {pendingObjects.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-[#D6E1E4] text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="font-serif font-bold text-lg text-gray-700">Granskningskön är tom!</h3>
                <p className="text-xs text-gray-500">Alla inskickade elevbidrag har granskats och behandlats.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingObjects.map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    onApprove={(id) => handleUpdateStatus(id, 'PUBLICERAD', '')}
                    onRequestRevision={(id, text) => handleUpdateStatus(id, 'BEHÖVER_KOMPLETTERING', text)}
                    onEdit={(obj) => {
                      setEditingObject(obj);
                      setIsEditorOpen(true);
                    }}
                  />
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {}
      {selectedObject && (
        <ObjectDetailModal
          object={selectedObject}
          allObjects={publishedObjects}
          userRole={userRole}
          userId={userId}
          onClose={() => setSelectedObjectId(null)}
          onEdit={(obj) => {
            setSelectedObjectId(null);
            setEditingObject(obj);
            setIsEditorOpen(true);
          }}
          onDelete={(id) => handleDeleteObject(id)}
          onSelectObject={(id) => setSelectedObjectId(id)}
          onShowOnTimeline={(obj) => scrollToObjectOnTimeline(obj)}
        />
      )}

      {}
      {isEditorOpen && (
        <ObjectEditorModal
          initialObject={editingObject}
          defaultType={defaultEditorType}
          allObjects={publishedObjects}
          userRole={userRole}
          userName={userName}
          userId={userId}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingObject(null);
          }}
          onSave={handleSaveObject}
        />
      )}

      {/* Footer */}
      <footer className="bg-[#142F35] text-emerald-100/60 py-6 text-center text-xs border-t border-emerald-800/40 mt-12">
        <p>Tidsperspektiv – Digitalt historiskt läromedel för gymnasieskolan</p>
        <p className="mt-1 text-emerald-200/40">Alla tidsangivelser beräknas proportionerligt utan år 0 (f.v.t. / v.t.)</p>
      </footer>

    </div>
  );
}

function ReviewCard({ item, onApprove, onRequestRevision, onEdit }) {
  const [feedback, setFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  return (
    <div className="bg-white p-5 rounded-xl border border-[#D6E1E4] shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b border-gray-100 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
            {item.typ}
          </span>
          <h3 className="font-serif font-bold text-xl text-[#173C42] mt-1">{item.titel}</h3>
          <p className="text-xs text-gray-500">Inskickat av: <strong>{item.bidragsgivare}</strong></p>
        </div>

        <span className="text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
          {formatYearSpan(item.startAr, item.slutAr)}
        </span>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{item.beskrivning}</p>

      {item.bildeUrl && (
        <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
          <img src={item.bildeUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {showFeedbackInput && (
        <div className="space-y-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
          <label className="block text-xs font-semibold text-amber-900">Skriv pedagogisk återkoppling till eleven:</label>
          <textarea
            rows="2"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="T.ex: Förtydliga källangivelsen eller lägg till slutår..."
            className="w-full text-xs p-2 bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 ring-amber-500"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setShowFeedbackInput(false)}
              className="text-xs text-gray-600 px-2 py-1 hover:underline"
            >
              Avbryt
            </button>
            <button
              onClick={() => {
                if (!feedback.trim()) return;
                onRequestRevision(item.id, feedback);
              }}
              className="text-xs bg-amber-600 text-white font-medium px-3 py-1 rounded hover:bg-amber-700"
            >
              Skicka återkoppling
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onEdit(item)}
          className="text-xs bg-[#F4F7F8] hover:bg-[#D6E1E4] text-[#173C42] px-3 py-2 rounded font-medium transition flex items-center gap-1"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Redigera först
        </button>

        <div className="flex space-x-2">
          {!showFeedbackInput && (
            <button
              onClick={() => setShowFeedbackInput(true)}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-2 rounded font-medium transition flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Begär komplettering
            </button>
          )}

          <button
            onClick={() => onApprove(item.id)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded transition flex items-center gap-1 shadow-sm"
          >
            <Check className="w-4 h-4" />
            Godkänn & Publicera
          </button>
        </div>
      </div>

    </div>
  );
}

function ObjectDetailModal({ object, allObjects, userRole, userId, onClose, onEdit, onDelete, onSelectObject, onShowOnTimeline }) {
  // Compute Contemporary Epochs overlapping with this object's time
  const contemporaryEpochs = useMemo(() => {
    const start = object.startAr;
    const end = object.slutAr || object.startAr;
    return allObjects.filter(o => {
      if (o.typ !== 'EPOK' || o.id === object.id) return false;
      const epokEnd = o.slutAr || MAX_YEAR;
      return o.startAr <= end && epokEnd >= start;
    });
  }, [object, allObjects]);

  // Resolve linked objects
  const linkedObjects = useMemo(() => {
    if (!object.koppladeObjektIds) return [];
    return allObjects.filter(o => object.koppladeObjektIds.includes(o.id));
  }, [object, allObjects]);

  const canEdit = userRole === 'LAERARE' || object.skapareId === userId;
  const durationYears = object.slutAr ? calculateYearDistance(object.startAr, object.slutAr) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#D6E1E4] relative animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header Image */}
        <div className="relative h-56 bg-slate-800 overflow-hidden flex items-center justify-center">
          {object.bildeUrl ? (
            <img
              src={object.bildeUrl}
              alt={object.titel}
              className={`w-full h-full object-cover ${object.typ === 'PERSON' ? 'p-4 rounded-full max-w-[200px] mx-auto shadow-2xl' : ''}`}
            />
          ) : (
            <div className="text-emerald-100/50 flex flex-col items-center">
              {object.typ === 'PERSON' ? <User className="w-16 h-16" /> : <Calendar className="w-16 h-16" />}
              <span className="text-xs mt-2">Bild saknas</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow ${
                object.typ === 'PERSON' ? 'bg-amber-400 text-slate-950' :
                object.typ === 'EPOK' ? 'bg-emerald-400 text-slate-950' :
                'bg-teal-300 text-slate-950'
              }`}>
                {object.typ}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-1">{object.titel}</h2>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 space-y-5">
          
          {/* Time Span & Duration */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F4F7F8] p-3 rounded-xl border border-[#D6E1E4]">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Tidsangivelse:</span>
              <span className="text-base font-bold text-[#173C42]">
                {formatYearSpan(object.startAr, object.slutAr)}
              </span>
            </div>

            {durationYears !== null && (
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Varaktighet:</span>
                <span className="text-sm font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                  {durationYears.toLocaleString('sv-SE')} år
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Historisk Beskrivning:</h4>
            <p className="text-sm text-[#173C42] leading-relaxed whitespace-pre-line">{object.beskrivning}</p>
          </div>

          {/* Manually Linked Objects */}
          {linkedObjects.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-[#173C42]" />
                Kopplade objekt (Historiska samband):
              </h4>
              <div className="flex flex-wrap gap-2">
                {linkedObjects.map(link => (
                  <button
                    key={link.id}
                    onClick={() => onSelectObject(link.id)}
                    className="text-xs bg-[#173C42] text-white hover:bg-[#142F35] px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 shadow-sm"
                  >
                    <span>{link.titel}</span>
                    <span className="text-[10px] text-emerald-200">({formatYear(link.startAr)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contemporary Epochs (Samtida Epoker) */}
          {contemporaryEpochs.length > 0 && (
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 space-y-1.5">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-emerald-800" />
                Samtida epoker (Tidsmässig överlappning):
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {contemporaryEpochs.map(ep => (
                  <span
                    key={ep.id}
                    onClick={() => onSelectObject(ep.id)}
                    className="text-xs bg-white text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded cursor-pointer hover:underline font-medium"
                  >
                    {ep.titel} ({formatYearSpan(ep.startAr, ep.slutAr)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources and Contributor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-xs text-gray-600">
            <div>
              <span className="font-bold block mb-1">Källor och fördjupning:</span>
              {object.kallor && object.kallor.length > 0 ? (
                <ul className="space-y-1">
                  {object.kallor.map((k, i) => (
                    <li key={i}>
                      <a href={k} target="_blank" rel="noopener noreferrer" className="text-teal-800 hover:underline flex items-center gap-1 truncate">
                        <BookOpen className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{k}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-400">Inga källor angivna</span>
              )}
            </div>

            <div>
              <span className="font-bold block mb-1">Bidragsgivare:</span>
              <p>{object.bidragsgivare || 'Lärare'}</p>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap justify-between items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onShowOnTimeline(object);
              }}
              className="text-xs bg-[#D6FF72] hover:bg-[#c3f553] text-[#142F35] font-bold px-4 py-2 rounded-lg transition flex items-center gap-1 shadow-sm"
            >
              <Eye className="w-4 h-4" />
              Visa på tidslinjen
            </button>

            <div className="flex space-x-2">
              {canEdit && (
                <>
                  <button
                    onClick={() => onDelete(object.id)}
                    className="text-xs text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                    title="Ta bort"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(object)}
                    className="text-xs bg-[#173C42] text-white hover:bg-[#142F35] px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Redigera
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function ObjectEditorModal({ initialObject, defaultType, allObjects, userRole, userName, userId, onClose, onSave }) {
  const [titel, setTitel] = useState(initialObject?.titel || '');
  const [typ, setTyp] = useState(initialObject?.typ || defaultType || 'HANDELSE');
  
  // Start year magnitude & era
  const [startNum, setStartNum] = useState(initialObject ? Math.abs(initialObject.startAr) : 1000);
  const [startEra, setStartEra] = useState(initialObject && initialObject.startAr < 0 ? 'f.v.t.' : 'v.t.');

  // Optional Slut year magnitude & era
  const [hasSlutAr, setHasSlutAr] = useState(initialObject?.slutAr !== null && initialObject?.slutAr !== undefined);
  const [slutNum, setSlutNum] = useState(initialObject?.slutAr ? Math.abs(initialObject.slutAr) : 1500);
  const [slutEra, setSlutEra] = useState(initialObject && initialObject.slutAr && initialObject.slutAr < 0 ? 'f.v.t.' : 'v.t.');

  const [beskrivning, setBeskrivning] = useState(initialObject?.beskrivning || '');
  const [farg, setFarg] = useState(initialObject?.farg || '#E2F0D9');
  const [bildeUrl, setBildeUrl] = useState(initialObject?.bildeUrl || '');
  const [bidragsgivare, setBidragsgivare] = useState(initialObject?.bidragsgivare || (userRole === 'LAERARE' ? 'Lärare' : userName));
  const [kallorInput, setKallorInput] = useState(initialObject?.kallor ? initialObject.kallor.join('\n') : '');
  const [koppladeIds, setKoppladeIds] = useState(initialObject?.koppladeObjektIds || []);

  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Compute actual signed internal year (-10000 to +2100)
  const computeSignedYear = (num, era) => {
    const val = Number(num);
    if (isNaN(val) || val === 0) return null;
    return era === 'f.v.t.' ? -Math.abs(val) : Math.abs(val);
  };

  // Image File FileReader Base64 conversion
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Bildfilen är för stor. Välj en bild under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBildeUrl(reader.result);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!titel.trim()) {
      setErrorMsg('Ange en titel på objektet.');
      return;
    }

    const computedStart = computeSignedYear(startNum, startEra);
    if (computedStart === null) {
      setErrorMsg('Ange ett giltigt startår (år 0 existerar inte).');
      return;
    }

    if (computedStart < MIN_YEAR || computedStart > MAX_YEAR) {
      setErrorMsg(`Årtalet måste ligga inom intervallet 10 000 f.v.t. till 2100 v.t.`);
      return;
    }

    let computedSlut = null;
    if (typ === 'EPOK' || hasSlutAr) {
      computedSlut = computeSignedYear(slutNum, slutEra);
      if (computedSlut === null) {
        setErrorMsg('Ange ett giltigt slutår för epoken/spannet.');
        return;
      }
      if (computedSlut < MIN_YEAR || computedSlut > MAX_YEAR) {
        setErrorMsg(`Slutåret måste ligga inom intervallet 10 000 f.v.t. till 2100 v.t.`);
        return;
      }
      if (computedSlut < computedStart) {
        setErrorMsg('Slutåret kan inte vara tidigare än startåret.');
        return;
      }
    }

    const kallorArray = kallorInput
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 5); // Limit max 5 sources

    const formData = {
      id: initialObject?.id,
      titel: titel.trim(),
      typ: typ,
      startAr: computedStart,
      slutAr: computedSlut,
      beskrivning: beskrivning.trim(),
      farg: farg,
      bildeUrl: bildeUrl,
      bidragsgivare: bidragsgivare.trim(),
      skapareId: initialObject?.skapareId || userId,
      kallor: kallorArray,
      koppladeObjektIds: koppladeIds
    };

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#D6E1E4] relative p-6 space-y-5 animate-in fade-in zoom-in duration-200">
        
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h2 className="font-serif font-bold text-xl text-[#173C42]">
            {initialObject ? 'Redigera historiskt objekt' : 'Skapa nytt historiskt objekt'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Object Type Picker */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Objekttyp:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTyp('HANDELSE')}
                className={`p-2.5 rounded-lg border font-medium transition text-center ${
                  typ === 'HANDELSE' ? 'bg-[#173C42] text-white border-[#173C42]' : 'bg-[#F4F7F8] text-gray-700 border-[#D6E1E4]'
                }`}
              >
                📅 Händelse (Fyrkant)
              </button>
              <button
                type="button"
                onClick={() => setTyp('PERSON')}
                className={`p-2.5 rounded-lg border font-medium transition text-center ${
                  typ === 'PERSON' ? 'bg-[#173C42] text-white border-[#173C42]' : 'bg-[#F4F7F8] text-gray-700 border-[#D6E1E4]'
                }`}
              >
                👤 Person (Rund)
              </button>
              <button
                type="button"
                onClick={() => setTyp('EPOK')}
                className={`p-2.5 rounded-lg border font-medium transition text-center ${
                  typ === 'EPOK' ? 'bg-[#173C42] text-white border-[#173C42]' : 'bg-[#F4F7F8] text-gray-700 border-[#D6E1E4]'
                }`}
              >
                📜 Epok (Bakgrundsfält)
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Titel / Namn:*</label>
            <input
              type="text"
              required
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="T.ex. Franska revolutionen eller Konfucius"
              className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 ring-[#173C42]"
            />
          </div>

          {/* Years Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F4F7F8] p-3 rounded-xl border border-[#D6E1E4]">
            
            {/* Start Year */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {typ === 'PERSON' ? 'Födelseår:*' : 'Startår:*'}
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={startNum}
                  onChange={(e) => setStartNum(e.target.value)}
                  className="w-full bg-white border border-[#D6E1E4] rounded p-2 text-sm font-semibold text-[#173C42]"
                />
                <select
                  value={startEra}
                  onChange={(e) => setStartEra(e.target.value)}
                  className="bg-white border border-[#D6E1E4] rounded px-2 text-xs font-bold text-[#173C42]"
                >
                  <option value="f.v.t.">f.v.t.</option>
                  <option value="v.t.">v.t.</option>
                </select>
              </div>
            </div>

            {/* End Year (Required for Epok, optional for others) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-bold text-gray-700">
                  {typ === 'PERSON' ? 'Dödsår:' : 'Slutår:'}
                </label>
                {typ !== 'EPOK' && (
                  <label className="text-[10px] text-gray-500 cursor-pointer flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={hasSlutAr}
                      onChange={(e) => setHasSlutAr(e.target.checked)}
                    />
                    Har tidsspann
                  </label>
                )}
              </div>

              {(typ === 'EPOK' || hasSlutAr) ? (
                <div className="flex space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={slutNum}
                    onChange={(e) => setSlutNum(e.target.value)}
                    className="w-full bg-white border border-[#D6E1E4] rounded p-2 text-sm font-semibold text-[#173C42]"
                  />
                  <select
                    value={slutEra}
                    onChange={(e) => setSlutEra(e.target.value)}
                    className="bg-white border border-[#D6E1E4] rounded px-2 text-xs font-bold text-[#173C42]"
                  >
                    <option value="f.v.t.">f.v.t.</option>
                    <option value="v.t.">v.t.</option>
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic pt-2">Gäller enskild händelsepunkt</p>
              )}
            </div>

          </div>

          {/* Epoch Color Picker (if Epok) */}
          {typ === 'EPOK' && (
            <div>
              <label className="block font-bold text-gray-700 mb-1">Bakgrundsfärg för epokfältet:</label>
              <div className="flex items-center space-x-2">
                {['#E2F0D9', '#FCE4D6', '#FFF2CC', '#E8EEF5', '#F2DCDB', '#E2D9F0'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFarg(c)}
                    className={`w-8 h-8 rounded-full border-2 transition ${farg === c ? 'border-[#173C42] scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={farg}
                  onChange={(e) => setFarg(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Historisk beskrivning:</label>
            <textarea
              rows="3"
              value={beskrivning}
              onChange={(e) => setBeskrivning(e.target.value)}
              placeholder="Beskriv skeendet sakligt och med fokus på förståelse för epoken eller händelsen..."
              className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 ring-[#173C42]"
            />
          </div>

          {/* Image Upload & Preview */}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <label className="block font-bold text-gray-700">Bild:**</label>
            
            <div className="flex items-center space-x-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#F4F7F8] hover:bg-[#D6E1E4] text-[#173C42] border border-[#D6E1E4] px-3 py-2 rounded-lg font-medium transition flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" />
                Välj bild från datorn
              </button>

              <span className="text-gray-400 text-[10px]">eller ange bildlänk (URL) below</span>
            </div>

            <input
              type="url"
              value={bildeUrl}
              onChange={(e) => setBildeUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2 text-xs"
            />

            {/* Image Preview Box */}
            {bildeUrl && (
              <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className={`w-12 h-12 overflow-hidden border border-gray-300 ${typ === 'PERSON' ? 'rounded-full' : 'rounded'}`}>
                  <img src={bildeUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <span className="text-gray-500 text-[11px]">Förhandsvisning ({typ === 'PERSON' ? 'Rund' : 'Fyrkantig'})</span>
                <button type="button" onClick={() => setBildeUrl('')} className="text-red-500 hover:underline text-[10px] ml-auto">
                  Ta bort bild
                </button>
              </div>
            )}
          </div>

          {/* Manual Linked Objects Selection */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block font-bold text-gray-700 mb-1">Koppla till andra historiska objekt:</label>
            <div className="max-h-28 overflow-y-auto bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2 space-y-1">
              {allObjects.filter(o => o.id !== initialObject?.id).map(obj => (
                <label key={`link_opt_${obj.id}`} className="flex items-center space-x-2 text-xs text-[#173C42] cursor-pointer hover:bg-white p-1 rounded">
                  <input
                    type="checkbox"
                    checked={koppladeIds.includes(obj.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setKoppladeIds(prev => [...prev, obj.id]);
                      } else {
                        setKoppladeIds(prev => prev.filter(id => id !== obj.id));
                      }
                    }}
                  />
                  <span>{obj.titel} ({formatYear(obj.startAr)})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Contributor Name & Sources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Ditt namn / Gruppnamn:</label>
              <input
                type="text"
                value={bidragsgivare}
                onChange={(e) => setBidragsgivare(e.target.value)}
                className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Källor (en länk per rad, max 5):</label>
              <textarea
                rows="2"
                value={kallorInput}
                onChange={(e) => setKallorInput(e.target.value)}
                placeholder="https://so-rummet.se/..."
                className="w-full bg-[#F4F7F8] border border-[#D6E1E4] rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="bg-[#D6FF72] hover:bg-[#c3f553] text-[#142F35] font-bold px-5 py-2 rounded-lg transition shadow-md"
            >
              {userRole === 'LAERARE' ? 'Spara & Publicera' : 'Skicka för granskning'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}