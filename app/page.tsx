'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase';

export default function Home() {
  // --- CONFIGURAZIONE ADMIN ---
  const ADMIN_EMAIL = 'fiumestreetweek@gmail.com';

  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false); 
  
  const [teams, setTeams] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState('home'); 
  const [activeAdminSubTab, setActiveAdminSubTab] = useState('live'); 
  const [activeScheduleTab, setActiveScheduleTab] = useState('qualifiche'); 
  const [activeShopTab, setActiveShopTab] = useState('canotte'); 
  
  const [newGame, setNewGame] = useState({ home_id: '', away_id: '', time: '18:00', court: 'A', is_event: false, event_description: '', event_duration: '', stage: 'girone' });
  const [playerForms, setPlayerForms] = useState<Record<number, { name: string }>>({});
  const [editingPlayer, setEditingPlayer] = useState<{ id: number, name: string } | null>(null);
  const [editingTeam, setEditingTeam] = useState<{ id: number, name: string } | null>(null);
  
  const [gameToEdit, setGameToEdit] = useState<any | null>(null);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void; }>({ isOpen: false, title: '', message: '', type: 'alert' });

  // --- ASTE STATE ---
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [selectedBidItem, setSelectedBidItem] = useState<any | null>(null);
  const [bidForm, setBidForm] = useState({ amount: '' }); 
  const [openedEnvelopes, setOpenedEnvelopes] = useState<Record<number, boolean>>({});
  const [bidError, setBidError] = useState<string | null>(null); 
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<number | string, number>>({});

  // --- STATI PER AUTH E MENU ADMIN ---
  const [user, setUser] = useState<any | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  
  // FIX: Memoria di ferro per il recupero password
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const isRecoveryRef = useRef(false);
  
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');

  const [playoffScheme, setPlayoffScheme] = useState('AB_CD'); 

  const supabase = createClient();
  const groups = ['A', 'B', 'C', 'D'];
  const playoffStages = ['ottavi', 'quarti', 'semi', 'finali'];

  const dummyFinals = [
    { id: 'd1', match_time: '19:00', court: 'A', status: 'programmata', is_event: false },
    { id: 'd2', match_time: '19:00', court: 'B', status: 'programmata', is_event: false },
    { id: 'd3', match_time: '19:20', court: 'A', status: 'programmata', is_event: false },
    { id: 'd4', match_time: '19:20', court: 'B', status: 'programmata', is_event: false },
    { id: 'd5', match_time: '19:40', court: 'A', status: 'programmata', is_event: false },
    { id: 'd6', match_time: '19:40', court: 'B', status: 'programmata', is_event: false },
  ];

  const dummyShopItems = [
    { id: 's1', name: 'Canotta FSW Nera', type: 'canotte', base_price: 25, image_url: '/shop/Nera.png' },
    { id: 's2', name: 'Canotta FSW Bianca', type: 'canotte', base_price: 25, image_url: '/shop/Bianca.png' },
    { id: 's3', name: 'Canotta Iverson - Limited', type: 'limited', base_price: 15, image_url: '/shop/Iverson.png' },
    { id: 's4', name: 'Canotta Rodman - Limited', type: 'limited', base_price: 15, image_url: '/shop/Rodman.png' },
    { id: 's5', name: 'Canotta Curry - Limited', type: 'limited', base_price: 15, image_url: '/shop/Curry.png' }
  ];

  const extractNameFromEmail = (userEmail: string) => {
    if (!userEmail) return 'Anonimo';
    const namePart = userEmail.split('@')[0];
    const cleanName = namePart.replace(/[._-]/g, ' ');
    return cleanName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setIsAdminUnlocked(session.user.email === ADMIN_EMAIL);
    } else {
      setUser(null);
      setIsAdminUnlocked(false);
    }
    setAuthChecking(false);
  };

  const fetchData = async () => {
    const { data: teamsData } = await supabase.from('teams').select('*, players(*)').order('points', { ascending: false }).order('wins', { ascending: false });
    const { data: gamesData } = await supabase.from('games').select('id, home_score, away_score, status, match_time, court, stage, bracket_code, home_team_id, away_team_id, is_event, event_description, event_duration, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)').order('match_time').order('id');
    const { data: shopData, error: shopError } = await supabase.from('shop_items').select('*');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user.email === ADMIN_EMAIL) {
      const { data: bidsData } = await supabase.from('bids').select('*').order('amount', { ascending: false }).order('created_at', { ascending: true }); 
      if (bidsData) setBids(bidsData);
    }

    if (teamsData) setTeams(teamsData);
    if (gamesData) setGames(gamesData);
    
    if (!shopError && shopData && shopData.length > 0) {
      setShopItems(shopData);
    } else {
      setShopItems(dummyShopItems); 
    }

    setLoading(false);
  };

  useEffect(() => {
    // 1. Controllo Immediato dell'URL (prima che Supabase lo pulisca)
    if (typeof window !== 'undefined' && window.location.href.includes('type=recovery')) {
      isRecoveryRef.current = true;
      setIsRecoveringPassword(true);
      setAuthChecking(false);
    }

    checkSession();

    // 2. Ascoltatore Eventi Auth
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // L'utente ha cliccato il link
        isRecoveryRef.current = true;
        setIsRecoveringPassword(true);
        setAuthChecking(false);
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        setIsAdminUnlocked(session?.user?.email === ADMIN_EMAIL);
        
        // Se NON stiamo facendo un recupero, navighiamo nell'app
        if (!isRecoveryRef.current) {
          setIsRecoveringPassword(false);
          fetchData();
          setActiveTab('home');
        } else {
          // Se siamo in recupero, sblocca il caricamento ma mostra la modale di password
          setAuthChecking(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdminUnlocked(false);
        setIsRecoveringPassword(false);
        isRecoveryRef.current = false;
      }
    });

    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    const channelPlayers = supabase.channel('realtime-players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchData(); }).subscribe();
    
    return () => { 
      supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); supabase.removeChannel(channelPlayers); 
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && !isRecoveringPassword) fetchData();
  }, [user, isRecoveringPassword]);

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, message: string) => setModal({ isOpen: true, title, message, type: 'alert' });

  // --- LOGICA AGGIORNAMENTO PASSWORD DA LINK ---
  const handleUpdatePassword = async () => {
    if (!password) {
      showAlert("Attenzione", "Inserisci la nuova password.");
      return;
    }
    
    setIsAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsAuthLoading(false);

    if (error) {
      showAlert("Errore", "Impossibile aggiornare la password: " + error.message);
    } else {
      isRecoveryRef.current = false;
      setIsRecoveringPassword(false);
      setPassword('');
      window.location.hash = ""; // Pulizia profonda
      showAlert("Successo! 🚀", "La tua password è stata aggiornata. Ora sei loggato.");
      fetchData();
      setActiveTab('home');
    }
  };

  const handleAuthAction = async () => {
    setIsAuthLoading(true);

    if (authMode === 'reset') {
      if (!email) {
        showAlert("Dati mancanti", "Inserisci la tua email per recuperare la password.");
        setIsAuthLoading(false);
        return;
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        showAlert("Errore", "Impossibile inviare il link. Controlla l'email.");
      } else {
        showAlert("Controlla la Mail", "Ti abbiamo inviato un link sicuro per reimpostare la tua password.");
        setAuthMode('login');
      }
      setIsAuthLoading(false);
      return;
    }

    if (!email || !password) {
      showAlert("Dati mancanti", "Inserisci email e password.");
      setIsAuthLoading(false);
      return;
    }
    
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showAlert("Errore Login", "Credenziali non valide o account non confermato."); 
      } else {
        setEmail(''); setPassword('');
      }
    } else {
      if (!regName) {
        showAlert("Dati mancanti", "Inserisci il tuo Nome e Cognome per registrarti.");
        setIsAuthLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: regName
          }
        }
      });

      if (error) {
        showAlert("Errore Registrazione", error.message);
      } else {
        setEmail(''); setPassword(''); setRegName('');
        
        if (data.user && !data.session) {
          showAlert("ATTENZIONE", "Devi disattivare 'Confirm email' su Supabase > Authentication > Providers > Email per permettere l'accesso diretto.");
        } else {
          showAlert("Fiume Street Week", "Benvenuto alla Fiume Street Week 2026");
        }
      }
    }
    setIsAuthLoading(false);
  };

  const performLogout = async () => {
    closeModal();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdminUnlocked(false);
    setEmail(''); setPassword(''); setRegName('');
    setActiveTab('home');
  };

  const promptLogout = () => {
    setModal({
      isOpen: true,
      title: "Logout",
      message: "Sei sicuro di voler uscire dal tuo account?",
      type: 'confirm',
      onConfirm: performLogout
    });
  };

  const resetTournament = () => {
    setModal({ isOpen: true, title: "⚠️ ATTENZIONE", message: "Sei sicuro? Verranno azzerati i punteggi delle partite a gironi, le classifiche, e VERRANNO ELIMINATI i Playoff generati. I roster e il calendario iniziale rimarranno intatti.", type: 'confirm', onConfirm: async () => { closeModal(); setLoading(true); await supabase.from('games').delete().neq('stage', 'girone'); await supabase.from('games').update({ home_score: 0, away_score: 0, status: 'programmata' }).eq('stage', 'girone'); await supabase.from('teams').update({ points: 0, wins: 0, losses: 0, pf: 0, ps: 0 }).neq('id', -1); await fetchData(); } });
  };

  const getStageWeight = (stage: string) => {
    if (!stage || stage === 'girone') return 0;
    if (stage === 'ottavi') return 1; if (stage === 'quarti') return 2; if (stage === 'semi') return 3; if (stage === 'finali') return 4; return 5;
  };

  const sortedGames = [...games].sort((a, b) => {
    const wA = getStageWeight(a.stage); const wB = getStageWeight(b.stage);
    if (wA !== wB) return wA - wB; 
    if (a.match_time !== b.match_time) return a.match_time.localeCompare(b.match_time);
    return a.court.localeCompare(b.court);
  });

  const adminLiveGames = [ ...sortedGames.filter(g => g.status === 'in_corso'), ...sortedGames.filter(g => g.status === 'programmata'), ...sortedGames.filter(g => g.status === 'finita') ];

  const generateBracket = async () => {
    if (games.some(g => g.stage && g.stage !== 'girone')) {
      showAlert("Attenzione", "I Playoff sono già stati generati! Se vuoi rigenerarli, apri il menu ⋮ e usa 'Azzera Torneo' per ricalcolare gli incroci.");
      return;
    }
    setLoading(true);
    const getTeam = (group: string, rank: number) => {
      const gTeams = teams.filter(t => t.group_name === group);
      return gTeams[rank - 1]?.id || null;
    };
    const schemeMap: Record<string, string[]> = {
      'AB_CD': ['A', 'B', 'C', 'D'], 'AC_BD': ['A', 'C', 'B', 'D'], 'AD_BC': ['A', 'D', 'B', 'C']
    };
    const [g1, g2, g3, g4] = schemeMap[playoffScheme];

    const playoffMatches = [
      { stage: 'ottavi', bracket_code: 'O1', home_team_id: getTeam(g1, 1), away_team_id: getTeam(g2, 4), match_time: '19:00', court: 'A', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O2', home_team_id: getTeam(g3, 2), away_team_id: getTeam(g4, 3), match_time: '19:00', court: 'B', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O3', home_team_id: getTeam(g2, 1), away_team_id: getTeam(g1, 4), match_time: '19:20', court: 'A', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O4', home_team_id: getTeam(g4, 2), away_team_id: getTeam(g3, 3), match_time: '19:20', court: 'B', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O5', home_team_id: getTeam(g3, 1), away_team_id: getTeam(g4, 4), match_time: '19:40', court: 'A', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O6', home_team_id: getTeam(g1, 2), away_team_id: getTeam(g2, 3), match_time: '19:40', court: 'B', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O7', home_team_id: getTeam(g4, 1), away_team_id: getTeam(g3, 4), match_time: '20:00', court: 'A', status: 'programmata', is_event: false },
      { stage: 'ottavi', bracket_code: 'O8', home_team_id: getTeam(g2, 2), away_team_id: getTeam(g1, 3), match_time: '20:00', court: 'B', status: 'programmata', is_event: false },
      { stage: 'quarti', bracket_code: 'Q1', match_time: '20:20', court: 'A', status: 'programmata', is_event: false },
      { stage: 'quarti', bracket_code: 'Q2', match_time: '20:20', court: 'B', status: 'programmata', is_event: false },
      { stage: 'quarti', bracket_code: 'Q3', match_time: '20:40', court: 'A', status: 'programmata', is_event: false },
      { stage: 'quarti', bracket_code: 'Q4', match_time: '20:40', court: 'B', status: 'programmata', is_event: false },
      { stage: 'semi', bracket_code: 'S1', match_time: '21:00', court: 'A', status: 'programmata', is_event: false },
      { stage: 'semi', bracket_code: 'S2', match_time: '21:20', court: 'A', status: 'programmata', is_event: false },
      { stage: 'finali', bracket_code: 'F3', match_time: '21:40', court: 'A', status: 'programmata', is_event: false }, 
      { stage: 'finali', bracket_code: 'F1', match_time: '22:10', court: 'A', status: 'programmata', is_event: false }, 
    ];
    await supabase.from('games').insert(playoffMatches);
    fetchData();
    showAlert("Generato!", "Il tabellone dei Playoff è stato generato in base agli incroci scelti e alla classifica attuale.");
  };

  const advancePlayoffTeam = async (game: any, winnerId: number, loserId: number) => {
    const code = game.bracket_code;
    let nextGameCode = null; let isHome = true;
    let loserGameCode = null; let loserIsHome = true;

    switch(code) {
        case 'O1': nextGameCode = 'Q1'; isHome = true; break;
        case 'O2': nextGameCode = 'Q1'; isHome = false; break;
        case 'O3': nextGameCode = 'Q2'; isHome = true; break;
        case 'O4': nextGameCode = 'Q2'; isHome = false; break;
        case 'O5': nextGameCode = 'Q3'; isHome = true; break;
        case 'O6': nextGameCode = 'Q3'; isHome = false; break;
        case 'O7': nextGameCode = 'Q4'; isHome = true; break;
        case 'O8': nextGameCode = 'Q4'; isHome = false; break;
        case 'Q1': nextGameCode = 'S1'; isHome = true; break;
        case 'Q2': nextGameCode = 'S1'; isHome = false; break;
        case 'Q3': nextGameCode = 'S2'; isHome = true; break;
        case 'Q4': nextGameCode = 'S2'; isHome = false; break;
        case 'S1': nextGameCode = 'F1'; isHome = true; loserGameCode = 'F3'; loserIsHome = true; break;
        case 'S2': nextGameCode = 'F1'; isHome = false; loserGameCode = 'F3'; loserIsHome = false; break;
    }

    if (nextGameCode && winnerId) {
        const nextGame = games.find(g => g.bracket_code === nextGameCode);
        if (nextGame) {
            const updateField = isHome ? 'home_team_id' : 'away_team_id';
            await supabase.from('games').update({ [updateField]: winnerId }).eq('id', nextGame.id);
        }
    }
    if (loserGameCode && loserId) {
        const loserGame = games.find(g => g.bracket_code === loserGameCode);
        if (loserGame) {
            const updateField = loserIsHome ? 'home_team_id' : 'away_team_id';
            await supabase.from('games').update({ [updateField]: loserId }).eq('id', loserGame.id);
        }
    }
  };

  const updateScore = async (gameId: number, teamType: 'home' | 'away', pointsToAdd: number, currentScore: number) => {
    const field = teamType === 'home' ? 'home_score' : 'away_score';
    const newScore = Math.max(0, currentScore + pointsToAdd);
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: newScore } : g));
    await supabase.from('games').update({ [field]: newScore }).eq('id', gameId);
  };

  const updateStatus = async (gameId: number, newStatus: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    if (newStatus === 'in_corso' && game.status !== 'in_corso') {
      const liveCount = games.filter(g => g.status === 'in_corso').length;
      if (liveCount >= 2) {
        showAlert("Limite Raggiunto", "Ci sono già 2 partite/eventi in corso. Chiudine uno prima di avviarne un altro.");
        return;
      }
    }

    if (!game.is_event) {
      if (newStatus === 'finita' && game.status !== 'finita') {
        const homeWon = game.home_score > game.away_score;
        const awayWon = game.away_score > game.home_score;
        const winnerId = homeWon ? game.home_team_id : game.away_team_id;
        const loserId = homeWon ? game.away_team_id : game.home_team_id;

        if (game.stage === 'girone' || !game.stage) {
          const { data: dbGame } = await supabase.from('games').select('home_team_id, away_team_id').eq('id', gameId).single();
          if (dbGame) {
            const { data: homeTeam } = await supabase.from('teams').select('*').eq('id', dbGame.home_team_id).single();
            const { data: awayTeam } = await supabase.from('teams').select('*').eq('id', dbGame.away_team_id).single();
            if (homeTeam && awayTeam) {
              await supabase.from('teams').update({ points: homeTeam.points + (homeWon ? 2 : 0), wins: homeTeam.wins + (homeWon ? 1 : 0), losses: homeTeam.losses + (awayWon ? 1 : 0), pf: homeTeam.pf + game.home_score, ps: homeTeam.ps + game.away_score }).eq('id', dbGame.home_team_id);
              await supabase.from('teams').update({ points: awayTeam.points + (awayWon ? 2 : 0), wins: awayTeam.wins + (awayWon ? 1 : 0), losses: awayTeam.losses + (homeWon ? 1 : 0), pf: awayTeam.pf + game.away_score, ps: awayTeam.ps + game.home_score }).eq('id', dbGame.away_team_id);
            }
          }
        } else {
          await advancePlayoffTeam(game, winnerId, loserId);
        }
      } 
      
      if (newStatus === 'in_corso' && game.status === 'finita') {
        const homeWon = game.home_score > game.away_score;
        const awayWon = game.away_score > game.home_score;
        
        if (game.stage === 'girone' || !game.stage) {
          const { data: dbGame } = await supabase.from('games').select('home_team_id, away_team_id').eq('id', gameId).single();
          if (dbGame) {
            const { data: homeTeam } = await supabase.from('teams').select('*').eq('id', dbGame.home_team_id).single();
            const { data: awayTeam } = await supabase.from('teams').select('*').eq('id', dbGame.away_team_id).single();
            if (homeTeam && awayTeam) {
              await supabase.from('teams').update({ points: Math.max(0, homeTeam.points - (homeWon ? 2 : 0)), wins: Math.max(0, homeTeam.wins - (homeWon ? 1 : 0)), losses: Math.max(0, homeTeam.losses - (awayWon ? 1 : 0)), pf: Math.max(0, homeTeam.pf - game.home_score), ps: Math.max(0, homeTeam.ps - game.away_score) }).eq('id', dbGame.home_team_id);
              await supabase.from('teams').update({ points: Math.max(0, awayTeam.points - (awayWon ? 2 : 0)), wins: Math.max(0, awayTeam.wins - (awayWon ? 1 : 0)), losses: Math.max(0, awayTeam.losses - (homeWon ? 1 : 0)), pf: Math.max(0, awayTeam.pf - game.away_score), ps: Math.max(0, awayTeam.ps - game.home_score) }).eq('id', dbGame.away_team_id);
            }
          }
        }
      }
    }
    await supabase.from('games').update({ status: newStatus }).eq('id', gameId);
    fetchData();
  };

  const saveQuickEdit = async () => {
    if (!gameToEdit) return;
    await supabase.from('games').update({ 
      match_time: gameToEdit.match_time, 
      court: gameToEdit.court, 
      home_team_id: gameToEdit.is_event ? null : (gameToEdit.home_team_id || null), 
      away_team_id: gameToEdit.is_event ? null : (gameToEdit.away_team_id || null),
      is_event: gameToEdit.is_event,
      event_description: gameToEdit.event_description,
      event_duration: gameToEdit.event_duration,
      stage: gameToEdit.stage
    }).eq('id', gameToEdit.id);
    setGameToEdit(null);
    fetchData();
  };

  const addMinutesToTime = (timeStr: string, minsToAdd: number) => {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minsToAdd, 0, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const createGame = async () => {
    if (!newGame.is_event && (!newGame.home_id || !newGame.away_id)) return;
    if (newGame.is_event && !newGame.event_description) return;

    setIsNewGameModalOpen(false); 
    setLoading(true);
    
    const duration = parseInt(newGame.event_duration) || 0;

    if (newGame.is_event && duration > 0) {
      const isQualifiche = newGame.stage === 'girone';
      const gamesToShift = games.filter(g => {
        const isGameQualifiche = !g.stage || g.stage === 'girone';
        return isQualifiche === isGameQualifiche && g.match_time >= newGame.time;
      });

      for (const g of gamesToShift) {
        const newTime = addMinutesToTime(g.match_time, duration);
        await supabase.from('games').update({ match_time: newTime }).eq('id', g.id);
      }
    }

    await supabase.from('games').insert({ 
      home_team_id: newGame.is_event ? null : parseInt(newGame.home_id), 
      away_team_id: newGame.is_event ? null : parseInt(newGame.away_id), 
      match_time: newGame.time, 
      court: newGame.court, 
      status: 'programmata', 
      stage: newGame.stage, 
      is_event: newGame.is_event,
      event_description: newGame.event_description,
      event_duration: duration
    });
    
    setNewGame({ home_id: '', away_id: '', time: '18:00', court: 'A', is_event: false, event_description: '', event_duration: '', stage: 'girone' });
    fetchData();
  };

  const deleteGame = (id: number) => {
    setGameToEdit(null);
    setModal({ isOpen: true, title: "Elimina", message: "Cancellare questo elemento dal calendario?", type: 'confirm', onConfirm: async () => { await supabase.from('games').delete().eq('id', id); fetchData(); closeModal(); } });
  };

  const saveTeamName = async () => {
    if (!editingTeam || !editingTeam.name) return;
    await supabase.from('teams').update({ name: editingTeam.name.toUpperCase() }).eq('id', editingTeam.id);
    setEditingTeam(null);
    fetchData();
  };

  const addPlayer = async (teamId: number) => {
    const form = playerForms[teamId];
    if (!form || !form.name) return;
    await supabase.from('players').insert({ team_id: teamId, name: form.name.toUpperCase() });
    setPlayerForms(prev => ({ ...prev, [teamId]: { name: '' } }));
    fetchData();
  };

  const saveEditPlayer = async () => {
    if (!editingPlayer || !editingPlayer.name) return;
    await supabase.from('players').update({ name: editingPlayer.name.toUpperCase() }).eq('id', editingPlayer.id);
    setEditingPlayer(null); fetchData();
  };

  const deletePlayer = (id: number) => {
    setModal({ isOpen: true, title: "Rimuovi", message: "Eliminare il giocatore?", type: 'confirm', onConfirm: async () => { await supabase.from('players').delete().eq('id', id); fetchData(); closeModal(); } });
  };

  const nextImage = (e: React.MouseEvent, itemId: string | number, max: number) => { e.stopPropagation(); setCurrentImageIndexes(prev => ({...prev, [itemId]: ((prev[itemId] || 0) + 1) % max})); };
  const prevImage = (e: React.MouseEvent, itemId: string | number, max: number) => { e.stopPropagation(); setCurrentImageIndexes(prev => ({...prev, [itemId]: ((prev[itemId] || 0) - 1 + max) % max})); };

  const submitBid = async () => {
    setBidError(null); 

    if (!bidForm.amount) {
      setBidError("Inserisci una cifra per l'offerta.");
      return;
    }
    
    const amountNum = parseFloat(bidForm.amount.replace(',', '.'));
    
    if (isNaN(amountNum) || amountNum < selectedBidItem.base_price) {
      setBidError(`L'offerta deve essere maggiore o uguale a €${selectedBidItem.base_price}`);
      return;
    }

    if (typeof selectedBidItem.id === 'string') {
      setBidError("Articolo di prova. Sostituisci i dati fittizi col DB per testare.");
      return;
    }

    const userEmail = user?.email || '';
    const userName = user?.user_metadata?.full_name || extractNameFromEmail(userEmail);
    const newTimestamp = new Date().toISOString();

    setIsSubmittingBid(true);

    const { data: existingBids } = await supabase.from('bids')
      .select('id')
      .eq('item_id', selectedBidItem.id)
      .eq('contact_info', userEmail);

    let error = null;

    if (existingBids && existingBids.length > 0) {
      const { error: updateError } = await supabase.from('bids')
        .update({ amount: amountNum, bidder_name: userName, created_at: newTimestamp })
        .eq('id', existingBids[0].id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('bids').insert({
        item_id: selectedBidItem.id,
        bidder_name: userName,
        contact_info: userEmail, 
        amount: amountNum,
        created_at: newTimestamp
      });
      error = insertError;
    }

    setIsSubmittingBid(false);

    if (error) {
      console.error(error);
      setBidError("Errore di connessione. Riprova tra poco.");
    } else {
      setIsBidModalOpen(false);
      setBidForm({ amount: '' });
      setBidError(null);
      showAlert("Offerta Inviata! 🚀", "La tua offerta in busta chiusa è stata registrata e aggiornata.");
      fetchData(); 
    }
  };

  if (authChecking) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-cyan-400 font-black uppercase italic animate-pulse tracking-widest">Inizializzazione...</div>;

  // --- SCHERMATA AGGIORNAMENTO PASSWORD (via link email) ---
  if (isRecoveringPassword) {
    return (
      <main className="min-h-screen bg-[#0f172a] p-4 flex items-center justify-center font-sans">
        <div className="bg-slate-900 border-4 border-cyan-500 rounded-3xl p-8 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(6,182,212,1)] animate-fade-in relative overflow-hidden">
          <h3 className="text-2xl font-black uppercase mb-2 text-center text-white italic tracking-widest">Nuova Password</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest text-center mb-6">Inserisci la tua nuova password per l'account.</p>
          <input type="password" placeholder="Nuova Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-sm outline-none focus:border-cyan-500 font-mono transition-colors mb-6" />
          <button onClick={handleUpdatePassword} disabled={isAuthLoading} className={`w-full py-4 rounded-xl font-black uppercase text-xs shadow-lg tracking-widest transition-transform ${isAuthLoading ? 'opacity-50 cursor-not-allowed bg-slate-700 text-white' : 'bg-cyan-500 text-slate-900 active:scale-95'}`}>
            {isAuthLoading ? 'Salvataggio...' : 'Salva e Accedi'}
          </button>
        </div>
        {modal.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-900 border-4 border-orange-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(249,115,22,1)]">
              <h3 className="text-2xl font-black uppercase mb-2 text-white italic tracking-tighter tracking-widest">{modal.title}</h3>
              <p className="text-slate-300 font-bold mb-8 text-sm leading-tight uppercase tracking-tight tracking-widest">{modal.message}</p>
              <div className="flex justify-end gap-3"><button onClick={closeModal} className="bg-orange-500 text-black px-5 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg tracking-widest active:scale-95">Ok</button></div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // --- SCHERMATA MURO DI LOGIN / REGISTRAZIONE / RESET ---
  if (!user) {
    return (
      <main className="min-h-screen bg-[#0f172a] p-4 flex items-center justify-center font-sans">
        <div className="bg-slate-900 border-4 border-cyan-500 rounded-3xl p-8 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(6,182,212,1)] animate-fade-in relative overflow-hidden">
          
          <div className="flex justify-center mb-8">
            <img src="/icon.png" alt="FSW Logo" className="w-40 h-auto drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] object-contain" />
          </div>
          
          {authMode !== 'reset' && (
            <div className="flex gap-2 mb-6">
              <button onClick={() => { setAuthMode('login'); }} className={`flex-1 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors ${authMode === 'login' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500 bg-slate-800/50 hover:bg-slate-800'}`}>Accedi</button>
              <button onClick={() => { setAuthMode('register'); }} className={`flex-1 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors ${authMode === 'register' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 bg-slate-800/50 hover:bg-slate-800'}`}>Registrati</button>
            </div>
          )}

          {authMode === 'reset' && (
            <div className="mb-6 text-center">
              <h3 className="text-cyan-400 font-black uppercase italic tracking-widest mb-2">Recupera Password</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Inserisci la tua email per ricevere il link magico.</p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <input type="email" placeholder="Indirizzo Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-sm outline-none focus:border-cyan-500 font-mono transition-colors" />
            
            {authMode !== 'reset' && (
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-sm outline-none focus:border-cyan-500 font-mono transition-colors" />
            )}
            
            {authMode === 'login' && (
              <div className="text-right">
                <button onClick={() => setAuthMode('reset')} className="text-slate-500 hover:text-cyan-400 text-[10px] font-black uppercase tracking-widest transition-colors">Password dimenticata?</button>
              </div>
            )}

            {authMode === 'register' && (
              <div className="space-y-4 pt-2 border-t border-slate-800 mt-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-cyan-500 tracking-widest block mb-1">Nome e Cognome</label>
                  <input type="text" placeholder="Mario Rossi" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-xs outline-none focus:border-cyan-500 uppercase font-black" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleAuthAction} disabled={isAuthLoading} className={`w-full py-4 rounded-xl font-black uppercase text-xs shadow-lg tracking-widest transition-transform ${isAuthLoading ? 'opacity-50 cursor-not-allowed bg-slate-700 text-white' : authMode === 'login' ? 'bg-cyan-500 text-slate-900 active:scale-95' : authMode === 'register' ? 'bg-pink-500 text-white active:scale-95' : 'bg-orange-500 text-slate-900 active:scale-95'}`}>
              {isAuthLoading ? 'Caricamento...' : authMode === 'login' ? 'Entra nel Torneo' : authMode === 'register' ? 'Crea Account' : 'Invia Link di Recupero'}
            </button>
            
            {authMode === 'reset' && (
              <button onClick={() => setAuthMode('login')} className="text-slate-500 py-2 font-black uppercase text-[10px] tracking-widest w-full hover:text-white transition-colors">Torna al Login</button>
            )}
          </div>
        </div>

        {/* MODALE ALERTS PER LA SCHERMATA LOGIN */}
        {modal.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-900 border-4 border-orange-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(249,115,22,1)]">
              <h3 className="text-2xl font-black uppercase mb-2 text-white italic tracking-tighter tracking-widest">{modal.title}</h3>
              <p className="text-slate-300 font-bold mb-8 text-sm leading-tight uppercase tracking-tight tracking-widest">{modal.message}</p>
              <div className="flex justify-end gap-3">
                {modal.type === 'confirm' && (
                  <button onClick={closeModal} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest font-black hover:bg-slate-700 transition-colors">Annulla</button>
                )}
                <button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className="bg-orange-500 text-black px-5 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg tracking-widest active:scale-95">Conferma</button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // --- APP PRINCIPALE LOGGATA ---
  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-cyan-400 font-black uppercase italic animate-pulse tracking-widest">Sincronizzazione Dati...</div>;

  const liveGames = sortedGames.filter(g => g.status === 'in_corso').slice(0, 2);
  const nextGames = sortedGames.filter(g => g.status === 'programmata').slice(0, 2);
  const activeLiveGamesCount = games.filter(g => g.status === 'in_corso').length;

  const renderTeamName = (team: any, bracketCode: string, isHome: boolean) => {
    if (team && team.name) return team.name;
    return `TBD (Da decidere)`;
  };

  return (
    <main className="min-h-screen bg-[#0f172a] p-3 md:p-8 font-sans text-slate-200 pb-28 select-none">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {activeTab === 'home' && (
          <div className="flex justify-center items-center mb-8 pt-4 animate-fade-in">
            <img src="/icon.png" alt="Fiume Street Week Logo" className="w-56 md:w-80 h-auto drop-shadow-[0_0_15px_rgba(236,72,153,0.4)] object-contain" onContextMenu={(e) => e.preventDefault()} style={{ WebkitTouchCallout: 'none', userSelect: 'none' }} />
          </div>
        )}

        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-8">
            <div>
              <h2 className="text-xl font-black text-pink-500 uppercase flex items-center gap-2 border-b-2 border-slate-800 pb-2 italic mb-4">
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span> Live Now
              </h2>
              <div className={`grid gap-4 ${liveGames.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {liveGames.length === 0 ? (
                  <p className="text-slate-600 font-black uppercase text-[10px] italic tracking-widest bg-slate-900/50 p-6 rounded-xl border border-slate-800">Nessun match in corso...</p>
                ) : liveGames.map(game => {
                  if (game.is_event) {
                    return (
                      <div key={game.id} className="bg-gradient-to-r from-pink-900/50 to-orange-900/50 border-2 border-pink-500 rounded-xl p-4 flex flex-col justify-center items-center relative shadow-[6px_6px_0px_0px_rgba(236,72,153,1)] overflow-hidden min-h-[120px]">
                        <div className="absolute top-0 right-0 bg-orange-500 text-black font-black text-[9px] px-3 py-1.5 rounded-bl-lg rounded-tr-[10px] uppercase z-10">CAMPO {game.court}</div>
                        <span className="text-3xl mb-2 animate-pulse">🔥</span>
                        <p className="text-[14px] text-white font-black uppercase leading-tight text-center tracking-widest px-4">{game.event_description}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={game.id} className="bg-slate-900 border-2 border-pink-500 rounded-xl p-4 flex justify-between items-stretch relative shadow-[6px_6px_0px_0px_rgba(6,182,212,1)] overflow-hidden">
                      <div className="absolute top-0 right-0 bg-orange-500 text-black font-black text-[9px] px-3 py-1.5 rounded-bl-lg rounded-tr-[10px] uppercase z-10">CAMPO {game.court}</div>
                      <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                        <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words">{game.home_team?.name || 'TBD'}</p>
                        <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.home_score}</p>
                      </div>
                      <div className="flex flex-col justify-center text-center w-[20%] mt-4"><span className="text-pink-500 font-black italic animate-pulse">VS</span></div>
                      <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                        <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words">{game.away_team?.name || 'TBD'}</p>
                        <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.away_score}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {nextGames.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest italic">🔜 Prossimi Eventi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextGames.map(game => {
                    if (game.is_event) {
                      return (
                        <div key={game.id} className="grid grid-cols-[45px_1fr_40px] items-center gap-2 bg-gradient-to-r from-pink-900/40 to-orange-900/40 border border-pink-500/50 rounded-xl p-3 shadow-lg">
                          <div className="font-mono font-black text-orange-400 text-xs">{game.match_time}</div>
                          <div className="text-center font-black text-pink-300 text-[11px] uppercase leading-tight tracking-widest break-words">{game.event_description}</div>
                          <div className="flex justify-end pr-1"><span className="bg-pink-500 text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-sm">{game.court}</span></div>
                        </div>
                      );
                    }
                    return (
                      <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_40px] items-center gap-1 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 shadow-lg">
                        <div className="font-mono font-black text-orange-500 text-xs">{game.match_time}</div>
                        <div className="text-right font-bold text-slate-300 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team?.name || 'TBD'}</div>
                        <div className="text-center text-slate-600 font-black italic text-[10px] px-1">VS</div>
                        <div className="text-left font-bold text-slate-300 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team?.name || 'TBD'}</div>
                        <div className="flex justify-end pr-1"><span className="bg-orange-500 text-black font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-sm">{game.court}</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* --- SHOP TAB --- */}
        {activeTab === 'shop' && (
          <section className="animate-fade-in space-y-6 pt-4">
            <h2 className="text-xl font-black text-purple-500 uppercase flex items-center gap-2 border-b-2 border-slate-800 pb-2 italic mb-4">
              🛍️ Merchandising
            </h2>

            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button onClick={() => setActiveShopTab('canotte')} className={`flex-1 py-3 rounded-lg font-black uppercase text-xs tracking-widest ${activeShopTab === 'canotte' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>Canotte</button>
              <button onClick={() => setActiveShopTab('limited')} className={`flex-1 py-3 rounded-lg font-black uppercase text-xs tracking-widest ${activeShopTab === 'limited' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500'}`}>Limited Edition</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {shopItems.filter(i => i.type === activeShopTab).length === 0 ? (
                <div className="col-span-full p-8 text-center text-slate-500 font-black uppercase tracking-widest text-[10px] bg-slate-900/50 rounded-xl border border-slate-800">Nessun articolo al momento.</div>
              ) : (
                shopItems.filter(i => i.type === activeShopTab).map((item) => {
                  const images = item.image_url ? item.image_url.split(',').map((u: string) => u.trim()) : [];
                  const imgIdx = currentImageIndexes[item.id] || 0;
                  const currentImage = images[imgIdx] || 'https://via.placeholder.com/400x500/0f172a/06b6d4?text=FOTO+NON+DISPONIBILE';

                  return (
                    <div key={item.id} className={`bg-slate-900 rounded-2xl overflow-hidden border-2 shadow-xl flex flex-col ${item.type === 'limited' ? 'border-pink-500 shadow-[4px_4px_0px_0px_rgba(236,72,153,1)]' : 'border-cyan-500 shadow-[4px_4px_0px_0px_rgba(6,182,212,1)]'}`}>
                      
                      <div className="aspect-[2/3] bg-slate-800 relative group">
                        <img src={currentImage} alt={`${item.name} - Foto ${imgIdx + 1}`} className="w-full h-full object-cover transition-opacity duration-300" />
                        
                        {item.type === 'limited' && (
                          <div className="absolute top-2 right-2 bg-pink-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-md animate-pulse z-10">Asta al Buio</div>
                        )}

                        {images.length > 1 && (
                          <>
                            <button onClick={(e) => prevImage(e, item.id, images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm opacity-80 hover:opacity-100 transition-opacity active:scale-95">{'<'}</button>
                            <button onClick={(e) => nextImage(e, item.id, images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm opacity-80 hover:opacity-100 transition-opacity active:scale-95">{'>'}</button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 px-2 py-1 rounded-full">
                              {images.map((_: string, idx: number) => (
                                <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === imgIdx ? 'bg-pink-500' : 'bg-white/50'}`} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="p-4 flex flex-col flex-1 justify-between">
                        <div>
                          <h3 className="font-black uppercase text-white leading-tight mb-1 text-sm">{item.name}</h3>
                          {item.type === 'limited' ? (
                            <p className="text-pink-400 font-black text-xs italic tracking-widest mb-3">Prezzo base: €{item.base_price}</p>
                          ) : (
                            <p className="text-cyan-400 font-black text-sm mb-3">€{item.base_price}</p>
                          )}
                        </div>
                        
                        {item.type === 'limited' ? (
                          <button onClick={() => { setSelectedBidItem(item); setIsBidModalOpen(true); setBidError(null); }} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-colors shadow-lg shadow-pink-500/20 mt-auto active:scale-95">Fai un'offerta 🤫</button>
                        ) : (
                          <button onClick={() => showAlert("Corri al Bar! 🍻", "Le canotte ufficiali FSW ti aspettano al bar dell'evento! Vai a sceglierla, provala e falla tua prima che finiscano le taglie.")} className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-colors shadow-lg active:scale-95 mt-auto">Acquista al bar</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* --- GIRONI TAB --- */}
        {activeTab === 'gironi' && (
          <section className="animate-fade-in pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map((group) => (
              <div key={group} className="bg-slate-900 rounded-2xl border-4 border-cyan-500 shadow-[6px_6px_0px_0px_rgba(249,115,22,1)] overflow-hidden">
                <div className="bg-cyan-500 text-slate-900 p-2 text-center"><h3 className="text-xl font-black uppercase italic">GIRONE {group}</h3></div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between px-3 pb-1 text-[10px] font-black text-slate-400 border-b border-slate-700/50">
                    <div className="w-1/2">SQUADRA</div>
                    <div className="flex w-1/2 justify-end gap-2 font-mono text-center">
                      <span className="w-4" title="Vinte">V</span><span className="w-4" title="Perse">P</span><span className="w-6" title="Punti Fatti">PF</span><span className="w-6" title="Punti Subiti">PS</span><span className="w-6 text-orange-500" title="Punti in Classifica">PT</span>
                    </div>
                  </div>
                  {teams.filter((t) => t.group_name === group).map((team, index) => (
                    <details key={team.id} className="bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800/80 transition-colors group">
                      <summary className="p-3 font-bold text-slate-200 flex justify-between items-start list-none">
                        <div className="flex items-start gap-2 w-1/2">
                          <span className="text-orange-500 font-black text-xs shrink-0 mt-[2px]">{index + 1}.</span>
                          <span className="uppercase text-[10px] font-black truncate group-open:whitespace-normal group-open:break-words leading-tight">{team.name}</span>
                        </div>
                        <div className="flex w-1/2 justify-end gap-2 text-[10px] font-mono text-center items-center">
                          <span className="text-slate-400 w-4">{team.wins}</span><span className="text-slate-400 w-4">{team.losses}</span><span className="text-cyan-500 w-6">{team.pf}</span><span className="text-pink-500 w-6">{team.ps}</span><span className="text-orange-400 w-6 font-black text-xs">{team.points}</span>
                        </div>
                      </summary>
                      <div className="p-4 bg-slate-900/80 border-t border-slate-700 mt-1">
                        <ul className="grid grid-cols-2 gap-3">
                          {team.players.map((player: any) => (
                            <li key={player.id} className="text-slate-300 flex items-start gap-1.5 text-[10px] font-bold uppercase leading-tight break-words">
                              <span className="bg-pink-500 w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]"></span>
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* --- CALENDARIO PUBBLICO --- */}
        {activeTab === 'calendario' && (
          <section className="animate-fade-in space-y-4 pt-4">
            
            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 mb-6">
              <button onClick={() => setActiveScheduleTab('qualifiche')} className={`flex-1 py-3 rounded-lg font-black uppercase text-xs tracking-widest ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>Qualifiche</button>
              <button onClick={() => setActiveScheduleTab('finali')} className={`flex-1 py-3 rounded-lg font-black uppercase text-xs tracking-widest ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500'}`}>Finali</button>
            </div>

            <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {(() => {
                const list = activeScheduleTab === 'qualifiche' 
                  ? sortedGames.filter(g => !g.stage || g.stage === 'girone')
                  : sortedGames.filter(g => g.stage && g.stage !== 'girone');
                
                const displayList = (activeScheduleTab === 'finali' && list.length === 0) ? dummyFinals : list;

                if (displayList.length === 0) return <div className="p-8 text-center text-slate-500 font-black uppercase tracking-widest text-[10px]">Nessun match trovato.</div>;

                return displayList.map((game, i) => {
                  if (game.is_event) {
                    return (
                      <div key={game.id} className="grid grid-cols-[45px_1fr_40px] items-center gap-2 p-3 bg-gradient-to-r from-pink-900/40 to-orange-900/40 border-b border-slate-800 last:border-0">
                        <div className="font-mono font-black text-orange-400 text-[10px]">{game.match_time}</div>
                        <div className="text-center font-black text-pink-400 text-[11px] uppercase leading-tight tracking-widest break-words px-2">{game.event_description}</div>
                        <div className="flex justify-end pr-1"><span className="bg-pink-500 text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-sm">{game.court}</span></div>
                      </div>
                    );
                  }
                  return (
                    <div key={game.id} className={`grid grid-cols-[45px_1fr_auto_1fr_40px] items-center gap-1 p-3 ${i !== displayList.length - 1 ? 'border-b border-slate-800' : ''}`}>
                      <div className="font-mono font-black text-pink-500 text-[10px]">{game.match_time}</div>
                      <div className="text-right font-black text-cyan-400 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team?.name || 'TBD'}</div>
                      <div className="flex justify-center items-center px-1">
                        {game.status === 'finita' ? (
                          <div className="bg-slate-800 border-2 border-slate-700 px-1.5 py-0.5 rounded text-white font-black text-[10px] shadow-sm">{game.home_score}-{game.away_score}</div>
                        ) : <div className="text-slate-600 font-black italic text-[9px]">VS</div>}
                      </div>
                      <div className="text-left font-black text-cyan-400 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team?.name || 'TBD'}</div>
                      <div className="flex justify-end pr-1"><span className="bg-orange-500 text-black font-black text-[10px] w-6 h-6 flex items-center justify-center rounded">{game.court}</span></div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        )}

        {/* --- PLAYOFF TAB PUBBLICO --- */}
        {activeTab === 'playoff' && (
          <section className="animate-fade-in pt-4">
            <h2 className="text-xl font-black text-orange-500 uppercase border-b-2 border-slate-800 pb-2 italic tracking-widest mb-4">Tabellone Finale</h2>
            
            {games.filter(g => g.stage && g.stage !== 'girone').length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center mt-8">
                <p className="text-slate-500 font-black uppercase tracking-widest text-sm italic">Tabellone in via di definizione...</p>
                <p className="text-slate-600 text-xs font-bold mt-2">I playoff appariranno qui al termine della fase a gironi.</p>
              </div>
            ) : (
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 hide-scrollbar px-2">
                {playoffStages.map(stage => {
                  const stageGames = sortedGames.filter(g => g.stage === stage);
                  if (stageGames.length === 0) return null;
                  
                  return (
                    <div key={stage} className="min-w-[85vw] sm:min-w-[320px] snap-center flex flex-col gap-4 relative">
                      <div className="bg-pink-600 text-white text-center py-2 rounded-t-xl font-black uppercase tracking-widest text-sm shadow-md">
                        {stage === 'finali' ? 'FINALI' : stage}
                      </div>
                      
                      {stageGames.map((game, i) => {
                        if(game.is_event) return null; 
                        return (
                          <div key={game.id} className="bg-slate-900 border-2 border-cyan-500 rounded-xl p-4 flex flex-col justify-between relative shadow-[4px_4px_0px_0px_rgba(6,182,212,1)]">
                            <div className="absolute top-0 left-0 bg-cyan-500 text-slate-900 font-black text-[8px] px-2 py-1 rounded-br-lg rounded-tl-[10px] uppercase">MATCH {game.bracket_code}</div>
                            <div className="absolute top-0 right-0 bg-slate-800 text-slate-400 font-black text-[8px] px-2 py-1 rounded-bl-lg rounded-tr-[10px] uppercase">{game.match_time} | C.{game.court}</div>
                            
                            <div className="mt-4 flex justify-between items-center w-full">
                              <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${game.home_team ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                                {renderTeamName(game.home_team, game.bracket_code, true)}
                              </span>
                              <span className={`text-2xl font-black ${game.home_team ? 'text-white' : 'text-slate-700'}`}>{game.home_score}</span>
                            </div>
                            
                            <div className="w-full h-px bg-slate-800 my-3 relative">
                              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-[9px] font-black text-pink-500 italic">VS</span>
                            </div>
                            
                            <div className="flex justify-between items-center w-full">
                              <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${game.away_team ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                                {renderTeamName(game.away_team, game.bracket_code, false)}
                              </span>
                              <span className={`text-2xl font-black ${game.away_team ? 'text-white' : 'text-slate-700'}`}>{game.away_score}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* --- ADMIN AREA --- */}
        {activeTab === 'admin' && isAdminUnlocked && (
          <section className="animate-fade-in space-y-6">
            
            <div className="flex justify-between items-center border-b-2 border-orange-500 pb-2 pt-4 relative z-[100]">
              <h2 className="text-2xl font-black text-orange-500 uppercase italic m-0 leading-none">Control Panel</h2>
              <div className="relative">
                <button 
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} 
                  className="bg-slate-800 text-slate-400 border border-slate-700 w-9 h-9 rounded-lg hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center shadow-lg text-lg pb-1 relative z-20"
                >
                  ⋮
                </button>
                {isAdminMenuOpen && (
                  <>
                    <div className="fixed inset-0 cursor-default" onClick={() => setIsAdminMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                      <button onClick={(e) => { e.stopPropagation(); setIsAdminMenuOpen(false); setTimeout(() => resetTournament(), 100); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-red-500 hover:bg-slate-800 border-b border-slate-800 flex items-center gap-3 transition-colors relative z-10">
                        <span className="text-sm">🗑️</span> Azzera Torneo
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto hide-scrollbar relative z-10">
              <button onClick={() => setActiveAdminSubTab('live')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'live' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500'}`}>🟢 Live</button>
              <button onClick={() => setActiveAdminSubTab('orari')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'orari' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>📅 Orari</button>
              <button onClick={() => setActiveAdminSubTab('roster')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'roster' ? 'bg-orange-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>🏀 Roster</button>
              <button onClick={() => setActiveAdminSubTab('playoff')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'playoff' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500'}`}>🏆 Playoff</button>
              <button onClick={() => setActiveAdminSubTab('aste')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'aste' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-500'}`}>🎁 Aste</button>
            </div>

            {/* LIVE CONTROL */}
            {activeAdminSubTab === 'live' && (
              <div className="space-y-4 pb-20">
                
                <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 mb-6">
                  <button onClick={() => setActiveScheduleTab('qualifiche')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>Qualifiche</button>
                  <button onClick={() => setActiveScheduleTab('finali')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500'}`}>Finali</button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {(() => {
                    const filteredLiveGames = adminLiveGames.filter(g => activeScheduleTab === 'qualifiche' ? (!g.stage || g.stage === 'girone') : (g.stage && g.stage !== 'girone'));

                    if (filteredLiveGames.length === 0) return <div className="p-8 text-center text-slate-500 font-black uppercase tracking-widest text-[10px] bg-slate-900/50 rounded-xl border border-slate-800">Nessun evento in questa fase.</div>;

                    return filteredLiveGames.map(game => {
                      if (game.is_event) {
                        return (
                          <div key={game.id} className={`bg-gradient-to-r from-pink-900/40 to-orange-900/40 p-4 rounded-xl border-2 transition-all ${game.status === 'in_corso' ? 'border-pink-500 shadow-[6px_6px_0px_0px_rgba(236,72,153,1)]' : game.status === 'finita' ? 'border-slate-800 opacity-60' : 'border-pink-500/50'}`}>
                             <div className="flex justify-between items-center mb-3">
                               <span className="text-[10px] text-slate-300 font-mono font-black tracking-widest">{game.match_time} | CAMPO {game.court}</span>
                               {game.status === 'finita' && <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`text-[10px] font-black uppercase flex items-center gap-1 transition-colors ${activeLiveGamesCount >= 2 ? 'text-slate-600 cursor-not-allowed' : 'text-pink-500 hover:text-pink-400'}`}><span>↺</span> Riapri</button>}
                             </div>
                             <div className="flex flex-col items-center justify-center bg-black/60 p-4 rounded-lg mb-3 min-h-[80px] text-center">
                               <span className="text-2xl mb-1">🔥</span>
                               <p className="text-[12px] font-black uppercase text-pink-400 tracking-widest">{game.event_description}</p>
                             </div>
                             <div className="flex justify-center px-1">
                               {game.status === 'programmata' && <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`bg-cyan-500 text-black text-[9px] font-black px-6 py-2 rounded-md uppercase tracking-widest transition-opacity ${activeLiveGamesCount >= 2 ? 'opacity-30 cursor-not-allowed' : ''}`}>Avvia Evento</button>}
                               {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-6 py-2 rounded-md uppercase tracking-widest">Chiudi Evento</button>}
                               {game.status === 'finita' && <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block">Evento Terminato</span>}
                             </div>
                          </div>
                        );
                      }

                      return (
                        <div key={game.id} className={`bg-slate-900 p-4 rounded-xl border-2 transition-all overflow-hidden ${
                          game.status === 'in_corso' ? 'border-pink-500 shadow-[6px_6px_0px_0px_rgba(6,182,212,1)]' : 
                          game.status === 'finita' ? 'border-slate-800 opacity-60' : 'border-slate-700'
                        }`}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] text-slate-500 font-mono font-black tracking-widest">{game.match_time} | CAMPO {game.court} {game.bracket_code ? `| ${game.bracket_code}` : ''}</span>
                            {game.status === 'finita' && (
                              <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`text-[10px] font-black uppercase flex items-center gap-1 transition-colors ${activeLiveGamesCount >= 2 ? 'text-slate-600 cursor-not-allowed' : 'text-pink-500 hover:text-pink-400'}`}>
                                <span>↺</span> Riapri
                              </button>
                            )}
                          </div>

                          <div className="flex justify-between items-stretch bg-black p-3 rounded-lg mb-3">
                            <div className="flex flex-col justify-between text-center w-[35%]">
                              <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400' : 'text-slate-500'}`}>{game.home_team?.name || 'TBD'}</p>
                              <p className={`text-3xl font-black mt-auto ${game.status === 'in_corso' ? 'text-white' : 'text-slate-400'}`}>{game.home_score}</p>
                            </div>
                            
                            <div className="flex flex-col justify-center text-center w-[30%] px-1">
                              {game.status === 'programmata' && (
                                <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2 || (!game.home_team_id || !game.away_team_id)} className={`bg-cyan-500 text-black text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest transition-opacity ${(activeLiveGamesCount >= 2 || !game.home_team_id || !game.away_team_id) ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                  Avvia
                                </button>
                              )}
                              {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest">Chiudi</button>}
                              {game.status === 'finita' && <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block">Finita</span>}
                            </div>

                            <div className="flex flex-col justify-between text-center w-[35%]">
                              <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400' : 'text-slate-500'}`}>{game.away_team?.name || 'TBD'}</p>
                              <p className={`text-3xl font-black mt-auto ${game.status === 'in_corso' ? 'text-white' : 'text-slate-400'}`}>{game.away_score}</p>
                            </div>
                          </div>

                          {game.status === 'in_corso' && (
                            <div className="flex justify-between items-center w-full gap-2 mt-2">
                              <div className="flex gap-1">
                                <button onClick={() => updateScore(game.id, 'home', -1, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-red-500 font-black text-xs active:scale-95">-1</button>
                                <button onClick={() => updateScore(game.id, 'home', 1, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+1</button>
                                <button onClick={() => updateScore(game.id, 'home', 2, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+2</button>
                                <button onClick={() => updateScore(game.id, 'home', 3, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+3</button>
                              </div>
                              <span className="text-[10px] text-slate-600 font-black italic">VS</span>
                              <div className="flex gap-1">
                                <button onClick={() => updateScore(game.id, 'away', -1, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-red-500 font-black text-xs active:scale-95">-1</button>
                                <button onClick={() => updateScore(game.id, 'away', 1, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+1</button>
                                <button onClick={() => updateScore(game.id, 'away', 2, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+2</button>
                                <button onClick={() => updateScore(game.id, 'away', 3, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-cyan-400 font-black text-xs active:scale-95">+3</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ORARI ADMIN */}
            {activeAdminSubTab === 'orari' && (
              <div className="space-y-4 pb-20">
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-full py-4 bg-slate-900 border-2 border-dashed border-cyan-500/50 rounded-xl text-cyan-400 font-black uppercase text-xs shadow-lg tracking-widest">➕ Nuova Voce Calendario</button>
                
                <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 mb-6">
                  <button onClick={() => setActiveScheduleTab('qualifiche')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>Qualifiche</button>
                  <button onClick={() => setActiveScheduleTab('finali')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500'}`}>Finali</button>
                </div>

                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                  {(() => {
                    const list = activeScheduleTab === 'qualifiche' 
                      ? sortedGames.filter(g => !g.stage || g.stage === 'girone')
                      : sortedGames.filter(g => g.stage && g.stage !== 'girone');
                    
                    const displayList = (activeScheduleTab === 'finali' && list.length === 0) ? dummyFinals : list;

                    if (displayList.length === 0) return <div className="p-8 text-center text-slate-500 font-black uppercase tracking-widest text-[10px]">Nessun elemento in calendario.</div>;

                    return displayList.map((game, i) => {
                      if (game.is_event) {
                        return (
                          <div key={game.id} className="grid grid-cols-[45px_1fr_40px_30px] items-center gap-2 p-3 hover:bg-slate-800/30 transition-colors bg-gradient-to-r from-pink-900/40 to-orange-900/40 border-b border-slate-800">
                            <span className="font-mono text-orange-400 text-[10px] font-black">{game.match_time}</span>
                            <span className="text-[11px] font-black uppercase text-pink-400 text-center tracking-widest break-words px-2">{game.event_description}</span>
                            <div className="flex justify-end pr-1"><span className="bg-pink-500 text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded">{game.court}</span></div>
                            <button onClick={() => setGameToEdit({ ...game })} className="text-slate-300 hover:text-white p-2 text-right">✏️</button>
                          </div>
                        );
                      }

                      return (
                        <div key={game.id} className={`grid grid-cols-[45px_1fr_auto_1fr_40px_30px] items-center gap-1 p-3 hover:bg-slate-800/30 transition-colors ${i !== displayList.length - 1 ? 'border-b border-slate-800' : ''}`}>
                          <span className="font-mono text-cyan-400 text-[10px] font-black">{game.match_time}</span>
                          <span className="text-[10px] font-black uppercase text-slate-200 text-right leading-tight break-words tracking-tighter">{game.home_team?.name || 'TBD'}</span>
                          <span className="text-[8px] text-slate-600 italic font-black px-1">VS</span>
                          <span className="text-[10px] font-black uppercase text-slate-200 text-left leading-tight break-words tracking-tighter">{game.away_team?.name || 'TBD'}</span>
                          <div className="flex justify-end pr-1"><span className="bg-orange-500 text-black font-black text-[10px] w-6 h-6 flex items-center justify-center rounded">{game.court}</span></div>
                          {game.id.toString().startsWith('d') ? (
                            <span className="w-8"></span> 
                          ) : (
                            <button onClick={() => setGameToEdit({ ...game })} className="text-slate-500 hover:text-cyan-400 p-2 text-right">✏️</button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ROSTER ADMIN */}
            {activeAdminSubTab === 'roster' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {groups.map((group) => (
                  <div key={group} className="bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-xl">
                    <div className="bg-slate-800/50 p-2 text-center border-b border-slate-700"><h3 className="text-xs font-black uppercase text-orange-500 tracking-widest italic">Girone {group}</h3></div>
                    <div className="p-2 space-y-2">
                      {teams.filter(t => t.group_name === group).map((team) => (
                        <details key={team.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden group">
                          <summary className="p-3 font-bold text-slate-200 flex justify-between items-center list-none cursor-pointer hover:bg-slate-800/50 transition-all">
                            {editingTeam?.id === team.id ? (
                              <div className="flex gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <input value={editingTeam?.name || ''} onChange={(e) => setEditingTeam(prev => prev ? {...prev, name: e.target.value} : null)} className="bg-black text-cyan-400 p-1.5 rounded text-[10px] font-black uppercase border border-cyan-500 flex-1 outline-none font-black" autoFocus />
                                <button onClick={saveTeamName} className="bg-cyan-500 text-black px-3 rounded text-[9px] font-black uppercase">Ok</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between w-full"><span className="uppercase text-[10px] font-black tracking-tight">{team.name}</span><button onClick={(e) => { e.preventDefault(); setEditingTeam({id: team.id, name: team.name}); }} className="text-slate-500 hover:text-cyan-400 text-xs p-1">✏️</button></div>
                            )}
                          </summary>
                          <div className="p-3 bg-black/20 border-t border-slate-700/50 space-y-3">
                            <ul className="space-y-1">
                              {team.players.map((p: any) => (
                                <li key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1.5 border-b border-slate-800 last:border-0">
                                  {editingPlayer?.id === p.id ? (
                                    <div className="flex-1 flex gap-1"><input value={editingPlayer?.name || ''} onChange={(e) => setEditingPlayer(prev => prev ? {...prev, name: e.target.value} : null)} className="bg-black text-white p-1.5 rounded w-full text-[10px] uppercase border border-cyan-500 outline-none font-black" autoFocus /><button onClick={saveEditPlayer} className="bg-cyan-500 text-black px-3 py-1.5 rounded font-black text-[9px] uppercase font-black">Ok</button></div>
                                  ) : (
                                    <><span className="uppercase text-slate-300">{p.name}</span><div className="flex gap-4"><button onClick={() => setEditingPlayer({id: p.id, name: p.name})} className="text-slate-500 hover:text-cyan-400 transition-colors">✏️</button><button onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-pink-500 transition-colors">❌</button></div></>
                                  )}
                                </li>
                              ))}
                            </ul>
                            <div className="flex gap-1.5 pt-2">
                              <input placeholder="Nuovo Giocatore" className="flex-1 bg-black text-white p-2 rounded text-[10px] outline-none uppercase border border-slate-800 focus:border-orange-500 font-black tracking-tighter" value={playerForms[team.id]?.name || ''} onChange={(e) => setPlayerForms({...playerForms, [team.id]: { name: e.target.value }})} />
                              <button onClick={() => addPlayer(team.id)} className="bg-orange-500 text-black font-black px-4 rounded text-[10px] uppercase tracking-tighter shadow-md">Aggiungi</button>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PLAYOFF GENERATOR ADMIN */}
            {activeAdminSubTab === 'playoff' && (
              <div className="space-y-6 pb-20">
                <div className="bg-slate-900 border-2 border-pink-500 rounded-xl p-6 text-center shadow-[4px_4px_0px_0px_rgba(236,72,153,1)]">
                  <h3 className="text-pink-500 font-black uppercase tracking-widest mb-2 italic">Motore Tabellone</h3>
                  <p className="text-slate-400 text-xs font-bold mb-6">Assicurati che i gironi siano conclusi. Scegli lo schema degli incroci e genera le fasi finali.</p>
                  
                  <div className="mb-6 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Incroci Ottavi</label>
                    <select value={playoffScheme} onChange={(e) => setPlayoffScheme(e.target.value)} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-sm font-black outline-none focus:border-pink-500">
                      <option value="AB_CD">Girone A vs B  |  Girone C vs D</option>
                      <option value="AC_BD">Girone A vs C  |  Girone B vs D</option>
                      <option value="AD_BC">Girone A vs D  |  Girone B vs C</option>
                    </select>
                  </div>
                  
                  <button onClick={generateBracket} className="bg-pink-500 text-white font-black uppercase text-sm px-6 py-4 rounded-xl w-full tracking-widest active:scale-95 transition-all shadow-md">
                    Genera Tabellone ⚡
                  </button>
                </div>
              </div>
            )}

            {/* ADMIN ASTE VIEW */}
            {activeAdminSubTab === 'aste' && (
              <div className="space-y-6 pb-20">
                <h3 className="text-purple-400 font-black uppercase tracking-widest italic border-b border-slate-800 pb-2">Buste Limited Edition</h3>
                
                {shopItems.filter(i => i.type === 'limited').map(item => (
                  <div key={item.id} className="bg-slate-900 border-2 border-purple-500/50 rounded-xl overflow-hidden shadow-xl">
                    <div className="p-4 flex justify-between items-center bg-slate-800/30">
                      <div>
                        <h4 className="font-black text-white uppercase text-sm">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">Prezzo Base: €{item.base_price}</p>
                      </div>
                      <button 
                        onClick={() => setOpenedEnvelopes(prev => ({...prev, [item.id]: !prev[item.id]}))}
                        className={`px-4 py-2 rounded font-black uppercase text-[10px] tracking-widest transition-all ${openedEnvelopes[item.id] ? 'bg-slate-700 text-slate-300' : 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'}`}
                      >
                        {openedEnvelopes[item.id] ? 'Chiudi' : 'Apri Busta ✉️'}
                      </button>
                    </div>
                    
                    {openedEnvelopes[item.id] && (
                      <div className="p-4 border-t border-slate-800 bg-black/40">
                        {bids.filter(b => b.item_id === item.id).length === 0 ? (
                          <p className="text-center text-slate-500 text-[10px] font-black uppercase tracking-widest py-4">Nessuna offerta registrata.</p>
                        ) : (
                          <ul className="space-y-2">
                            {bids.filter(b => b.item_id === item.id).map((bid, idx) => (
                              <li key={bid.id} className={`flex justify-between items-center p-3 rounded-lg border ${idx === 0 ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-pink-500 shadow-[2px_2px_0px_0px_rgba(236,72,153,1)]' : 'bg-slate-800/50 border-slate-700'}`}>
                                <div className="flex flex-col">
                                  <span className="font-black text-white uppercase text-xs">
                                    {idx === 0 && '👑 '} {bid.bidder_name}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {bid.contact_info} • {new Date(bid.created_at).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                                <span className={`font-black text-lg ${idx === 0 ? 'text-pink-400' : 'text-cyan-400'}`}>€{bid.amount}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* --- MENU BASSO DINAMICO (GRIGLIA FISSA A 6) --- */}
      <nav className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t-2 border-cyan-500 z-[200]">
        <div className="grid grid-cols-6 max-w-md mx-auto px-1 pt-2 pb-6">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'home' ? 'text-pink-500 -translate-y-1' : 'text-slate-400'}`}>
            <span className="text-xl sm:text-2xl">🔥</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Live</span>
          </button>
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'gironi' ? 'text-cyan-400 -translate-y-1' : 'text-slate-400'}`}>
            <span className="text-xl sm:text-2xl">📊</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Gironi</span>
          </button>
          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'calendario' ? 'text-orange-500 -translate-y-1' : 'text-slate-400'}`}>
            <span className="text-xl sm:text-2xl">📅</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Orari</span>
          </button>
          <button onClick={() => setActiveTab('playoff')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'playoff' ? 'text-pink-600 -translate-y-1' : 'text-slate-400'}`}>
            <span className="text-xl sm:text-2xl">🏆</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Playoff</span>
          </button>
          <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'shop' ? 'text-purple-400 -translate-y-1' : 'text-slate-400'}`}>
            <span className="text-xl sm:text-2xl">🛍️</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Shop</span>
          </button>
          {isAdminUnlocked ? (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'admin' ? 'text-white -translate-y-1' : 'text-slate-400'}`}>
              <span className="text-xl sm:text-2xl">⚙️</span>
              <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Admin</span>
            </button>
          ) : (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); promptLogout(); }} className="flex flex-col items-center justify-center text-slate-400 active:text-white touch-manipulation relative z-[210]">
              <span className="text-xl sm:text-2xl">🚪</span>
              <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Esci</span>
            </button>
          )}
        </div>
      </nav>

      {/* --- MODALE ALERTS / CONFERME (Z-INDEX 300) --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-orange-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(249,115,22,1)]">
            <h3 className="text-2xl font-black uppercase mb-2 text-white italic">{modal.title}</h3>
            <p className="text-slate-300 font-bold mb-8 text-sm leading-tight uppercase tracking-tight">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' && <button onClick={closeModal} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest">Annulla</button>}
              <button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className="bg-orange-500 text-black px-5 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg active:scale-95">Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE ASTA BUSTA CHIUSA --- */}
      {isBidModalOpen && selectedBidItem && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-pink-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(236,72,153,1)]">
            <h3 className="text-xl font-black uppercase mb-1 text-white italic">Piazza Offerta</h3>
            <p className="text-[10px] text-pink-400 font-bold mb-6 uppercase">{selectedBidItem.name} - Base: €{selectedBidItem.base_price}</p>
            {bidError && <div className="bg-red-900/30 border border-red-500 text-red-400 p-3 rounded-xl text-[10px] font-black uppercase mb-6 text-center">{bidError}</div>}
            <div className="space-y-4 mb-8">
              <div className="bg-black/50 p-3 rounded-xl border border-slate-800">
                <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Stai offrendo come:</p>
                <p className="text-sm text-slate-300 font-black uppercase">{user?.user_metadata?.full_name || extractNameFromEmail(user?.email)}</p>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-pink-500 block mb-1">La tua offerta (€)</label>
                <input type="number" step="0.50" value={bidForm.amount} onChange={(e) => setBidForm({amount: e.target.value})} className="w-full bg-black text-pink-400 p-3 rounded-xl border border-pink-900 text-xl outline-none font-black" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={submitBid} disabled={isSubmittingBid} className="text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg bg-pink-600 active:scale-95">{isSubmittingBid ? 'Invio...' : 'Invia Busta Chiusa 🤫'}</button>
              <button onClick={() => { setIsBidModalOpen(false); setBidForm({amount: ''}); setBidError(null); }} className="text-slate-500 py-2 font-black uppercase text-[10px] w-full">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}