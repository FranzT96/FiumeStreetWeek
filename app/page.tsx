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
  
  const [activeTab, setActiveTab] = useState('home'); 
  const [activeAdminSubTab, setActiveAdminSubTab] = useState('live'); 
  const [activeResultMainTab, setActiveResultMainTab] = useState('3vs3'); 
  const [activeScheduleTab, setActiveScheduleTab] = useState('qualifiche'); 
  
  const [newGame, setNewGame] = useState({ home_id: '', away_id: '', time: '18:00', court: 'A', is_event: false, event_description: '', event_duration: '', stage: 'girone' });
  const [playerForms, setPlayerForms] = useState<Record<number, { name: string }>>({});
  const [editingPlayer, setEditingPlayer] = useState<{ id: number, name: string } | null>(null);
  const [editingTeam, setEditingTeam] = useState<{ id: number, name: string } | null>(null);
  
  const [gameToEdit, setGameToEdit] = useState<any | null>(null);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void; }>({ isOpen: false, title: '', message: '', type: 'alert' });

  // --- STATI PER AUTH (EASTER EGG) ---
  const [user, setUser] = useState<any | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- STATI PER EASTER EGG ADMIN ---
  const [isSecretLoginOpen, setIsSecretLoginOpen] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const [playoffScheme, setPlayoffScheme] = useState('AB_CD'); 

  // --- STATI PER 3-POINT CONTEST ---
  const [threePtPlayers, setThreePtPlayers] = useState<any[]>([]);
  const [threePtSubTab, setThreePtSubTab] = useState('qualifiche');
  const [new3PtName, setNew3PtName] = useState('');
  const [editing3Pt, setEditing3Pt] = useState<any | null>(null);

  // --- STATI PER KOTC ---
  const [kotcPlayers, setKotcPlayers] = useState<any[]>([]);
  const [kotcSubTab, setKotcSubTab] = useState('qualifiche');
  const [newKotcName, setNewKotcName] = useState('');
  const [editingKotc, setEditingKotc] = useState<any | null>(null);

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
    const { data: tptData } = await supabase.from('three_point_contest').select('*');
    const { data: kotcData } = await supabase.from('kotc_players').select('*'); // <--- AGGIUNTO KOTC
    
    if (teamsData) setTeams(teamsData);
    if (gamesData) setGames(gamesData);
    if (tptData) setThreePtPlayers(tptData);
    if (kotcData) setKotcPlayers(kotcData); // <--- AGGIUNTO KOTC

    setLoading(false);
  };

  useEffect(() => {
    checkSession();
    fetchData(); 

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
        setIsAdminUnlocked(session?.user?.email === ADMIN_EMAIL);
        fetchData();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdminUnlocked(false);
      }
    });

    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    const channelPlayers = supabase.channel('realtime-players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchData(); }).subscribe();
    const channel3pt = supabase.channel('realtime-3pt').on('postgres_changes', { event: '*', schema: 'public', table: 'three_point_contest' }, () => { fetchData(); }).subscribe();
    const channelKotc = supabase.channel('realtime-kotc').on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_players' }, () => { fetchData(); }).subscribe(); // <--- AGGIUNTO KOTC
    
    return () => { 
      supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); supabase.removeChannel(channelPlayers); supabase.removeChannel(channel3pt); supabase.removeChannel(channelKotc); // <--- AGGIUNTO KOTC
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, message: string) => setModal({ isOpen: true, title, message, type: 'alert' });

  // --- LOGICA EASTER EGG (LONG PRESS 3 SECONDI) ---
  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      setIsSecretLoginOpen(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 3000);
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // --- LOGICA AUTH ADMIN ---
  const handleAuthAction = async () => {
    setIsAuthLoading(true);

    if (!email || !password) {
      showAlert("Dati mancanti", "Inserisci email e password dello staff.");
      setIsAuthLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAlert("Accesso Negato", "Credenziali non valide."); 
    } else {
      setEmail(''); 
      setPassword('');
      setIsSecretLoginOpen(false);
      setActiveTab('admin'); 
    }
    setIsAuthLoading(false);
  };

  const performLogout = async () => {
    closeModal();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdminUnlocked(false);
    setEmail(''); 
    setPassword('');
    setActiveTab('home');
  };

  const promptLogout = () => {
    setModal({
      isOpen: true,
      title: "Logout Staff",
      message: "Sei sicuro di voler scollegare il pannello di controllo?",
      type: 'confirm',
      onConfirm: performLogout
    });
  };

  const resetTournament = () => {
    setModal({ 
      isOpen: true, 
      title: "⚠️ ATTENZIONE", 
      message: "Sei sicuro? Verranno azzerati i gironi, i Playoff e le classifiche. Per 3-Point Contest e KOTC verranno cancellate le fasi finali e azzerati i punteggi, ma gli iscritti iniziali verranno mantenuti.", 
      type: 'confirm', 
      onConfirm: async () => { 
        closeModal(); 
        setLoading(true); 
        
        // 1. Reset Torneo Base
        await supabase.from('games').update({ home_team_id: null, away_team_id: null, home_score: 0, away_score: 0, status: 'programmata' }).neq('stage', 'girone'); 
        await supabase.from('games').update({ home_score: 0, away_score: 0, status: 'programmata' }).eq('stage', 'girone'); 
        await supabase.from('teams').update({ points: 0, wins: 0, losses: 0, pf: 0, ps: 0 }).neq('id', -1); 
        
        // 2. Reset 3-Point Contest (Cancella fasi avanzate, azzera punteggi qualifiche)
        await supabase.from('three_point_contest').delete().neq('stage', 'qualifiche');
        await supabase.from('three_point_contest').update({ score: 0, time_seconds: 999.99 }).eq('stage', 'qualifiche');
        
        // 3. Reset KOTC (Cancella fasi avanzate, azzera punteggi e teste di serie qualifiche)
        await supabase.from('kotc_players').delete().neq('stage', 'qualifiche');
        await supabase.from('kotc_players').update({ score: 0, seed: 0 }).eq('stage', 'qualifiche');

        // Riporta i tab visuali alle qualifiche per non restare bloccati su schermate vuote
        setThreePtSubTab('qualifiche');
        setKotcSubTab('qualifiche');

        await fetchData(); 
      } 
    });
  };

  const getStageWeight = (stage: string) => {
    if (!stage || stage === 'girone') return 0;
    if (stage === 'ottavi') return 1; if (stage === 'quarti') return 2; if (stage === 'semi') return 3; if (stage === 'finali') return 4; return 5;
  };

  const sortedGames = [...games].sort((a, b) => {
    const wA = getStageWeight(a.stage); const wB = getStageWeight(b.stage);
    if (wA !== wB) return wA - wB; 
    
    // Aggiunto ": string" a t per far felice TypeScript
    const getMinutes = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h < 6 ? h + 24 : h) * 60 + m; 
    };
    
    const tA = getMinutes(a.match_time);
    const tB = getMinutes(b.match_time);
    
    if (tA !== tB) return tA - tB;
    return a.court.localeCompare(b.court);
  });

  // --- GENERATORE DI TITOLI PER LE FINALI ---
  const renderStageHeader = (g: any, index: number, array: any[]) => {
    // 1. Gli eventi non innescano MAI un titolo sopra di loro
    if (g.is_event) return null;

    let header = null;
    if (g.bracket_code === 'F3') header = "🥉 FINALE 3°/4° POSTO";
    else if (g.bracket_code === 'F1') header = "🏆 FINALISSIMA 1°/2° POSTO";
    else if (g.stage === 'ottavi') header = "🔥 OTTAVI DI FINALE";
    else if (g.stage === 'quarti') header = "⚡ QUARTI DI FINALE";
    else if (g.stage === 'semi') header = "💥 SEMIFINALI";

    if (!header) return null;

    // 2. Cerca la primissima partita VERA (non evento) che appartiene a questa fase
    const firstGame = array.find(x => {
       if (x.is_event) return false;
       if (header === "🥉 FINALE 3°/4° POSTO") return x.bracket_code === 'F3';
       if (header === "🏆 FINALISSIMA 1°/2° POSTO") return x.bracket_code === 'F1';
       return x.stage === g.stage;
    });

    // 3. Stampa il titolo SOLO se la riga che stiamo disegnando è esattamente quella prima partita
    if (g.id !== firstGame?.id) return null;

    return (
      <div className="w-full text-center py-3 mt-8 mb-4 bg-gradient-to-r from-transparent via-[#3d135e]/80 to-transparent border-y border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
        <span className="text-yellow-400 font-black uppercase tracking-[0.3em] text-[13px] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">{header}</span>
      </div>
    );
  };

  const adminLiveGames = [ ...sortedGames.filter(g => g.status === 'in_corso'), ...sortedGames.filter(g => g.status === 'programmata'), ...sortedGames.filter(g => g.status === 'finita') ];

  const generateBracket = async () => {
    const o1Match = games.find(g => g.bracket_code === 'O1');
    if (o1Match && o1Match.home_team_id) {
      showAlert("Attenzione", "I Playoff sono già stati popolati! Se vuoi rigenerarli, devi prima azzerare il torneo dal menu in alto.");
      return;
    }
    
    setLoading(true);
    
    // Scarica i team freschi di database, assicurandosi che siano in ordine di punti/vittorie
    const { data: latestTeams } = await supabase.from('teams').select('*').order('points', { ascending: false }).order('wins', { ascending: false });
    
    const getTeam = (group: string, rank: number) => {
      if (!latestTeams) return null;
      const gTeams = latestTeams.filter(t => t.group_name === group);
      return gTeams[rank - 1]?.id || null;
    };
    
    const schemeMap: Record<string, string[]> = {
      'AB_CD': ['A', 'B', 'C', 'D'], 'AC_BD': ['A', 'C', 'B', 'D'], 'AD_BC': ['A', 'D', 'B', 'C']
    };
    const [g1, g2, g3, g4] = schemeMap[playoffScheme];

    const updates = [
      { code: 'O1', home: getTeam(g1, 1), away: getTeam(g2, 4) },
      { code: 'O2', home: getTeam(g3, 2), away: getTeam(g4, 3) },
      { code: 'O3', home: getTeam(g2, 1), away: getTeam(g1, 4) },
      { code: 'O4', home: getTeam(g4, 2), away: getTeam(g3, 3) },
      { code: 'O5', home: getTeam(g3, 1), away: getTeam(g4, 4) },
      { code: 'O6', home: getTeam(g1, 2), away: getTeam(g2, 3) },
      { code: 'O7', home: getTeam(g4, 1), away: getTeam(g3, 4) },
      { code: 'O8', home: getTeam(g2, 2), away: getTeam(g1, 3) }
    ];

    let errors = 0;
    for (const u of updates) {
      const { error } = await supabase.from('games').update({ home_team_id: u.home || null, away_team_id: u.away || null }).eq('bracket_code', u.code);
      if (error) errors++;
    }

    await fetchData();
    
    if (errors > 0) {
      showAlert("Attenzione", "Ci sono stati dei problemi a inserire alcune partite nel tabellone.");
    } else {
      showAlert("Generato!", "Le squadre sono state inserite nel tabellone dei Playoff in base alla classifica finale dei gironi!");
    }
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
    // Blocco solo se è un evento ed è senza nome (per le partite, permettiamo il TBD)
    if (newGame.is_event && !newGame.event_description) {
      showAlert("Errore", "Inserisci il nome dell'evento.");
      return;
    }

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

    // Gestione sicura dei TBD: se è vuoto mettiamo null al posto di far crashare parseInt
    const hId = newGame.home_id ? parseInt(newGame.home_id) : null;
    const aId = newGame.away_id ? parseInt(newGame.away_id) : null;

    await supabase.from('games').insert({ 
      home_team_id: newGame.is_event ? null : hId, 
      away_team_id: newGame.is_event ? null : aId, 
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

  // --- LOGICA 3-POINT CONTEST ---
  const add3PtPlayer = async () => {
    if (!new3PtName) return;
    
    const { error } = await supabase.from('three_point_contest').insert({ name: new3PtName.toUpperCase(), stage: 'qualifiche' });
    
    if (error) {
      alert("Errore DB: " + error.message);
      console.error(error);
    } else {
      setNew3PtName('');
      fetchData();
    }
  };

  const save3PtPlayer = async () => {
    if (!editing3Pt) return;
    await supabase.from('three_point_contest').update({
      name: editing3Pt.name.toUpperCase(),
      score: parseInt(editing3Pt.score) || 0,
      time_seconds: parseFloat(editing3Pt.time_seconds) || 999.99
    }).eq('id', editing3Pt.id);
    setEditing3Pt(null);
    fetchData();
  };

  const delete3PtPlayer = async (id: number) => {
    setModal({ isOpen: true, title: "Elimina Iscritto", message: "Sei sicuro di voler rimuovere questo tiratore?", type: 'confirm', onConfirm: async () => { await supabase.from('three_point_contest').delete().eq('id', id); fetchData(); closeModal(); } });
  };

  const close3PtStage = (currentStage: string, topCount: number, nextStage: string) => {
    setModal({
      isOpen: true, title: `CHIUDI ${currentStage.toUpperCase()}`, 
      message: `I primi ${topCount} passeranno in ${nextStage.toUpperCase()}. Confermi? L'operazione è irreversibile.`, 
      type: 'confirm', onConfirm: async () => {
        closeModal();
        setLoading(true);
        // Prendi i migliori per questo stage
        const playersInStage = threePtPlayers.filter(p => p.stage === currentStage);
        const sorted = [...playersInStage].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.time_seconds - b.time_seconds;
        });
        const winners = sorted.slice(0, topCount);
        
        // Copiali nel prossimo stage azzerando il punteggio
        const newEntries = winners.map(w => ({ name: w.name, stage: nextStage, score: 0, time_seconds: 999.99 }));
        await supabase.from('three_point_contest').insert(newEntries);
        
        setThreePtSubTab(nextStage);
        fetchData();
      }
    });
  };

  const declare3PtWinner = () => {
    setModal({
      isOpen: true, title: "INCORONA VINCITORE", message: "Il primo in classifica verrà dichiarato campione. Confermi?", type: 'confirm', onConfirm: async () => {
        closeModal(); setLoading(true);
        const players = threePtPlayers.filter(p => p.stage === 'finali');
        const sorted = [...players].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score; return a.time_seconds - b.time_seconds;
        });
        if(sorted.length > 0) {
          await supabase.from('three_point_contest').update({ stage: 'vincitore' }).eq('id', sorted[0].id);
        }
        fetchData();
      }
    });
  };

  // --- LOGICA KING OF THE COURT (KOTC) ---
  const addKotcPlayer = async () => {
    if (!newKotcName) return;
    const { error } = await supabase.from('kotc_players').insert({ name: newKotcName.toUpperCase(), stage: 'qualifiche' });
    if (error) { alert("Errore DB: " + error.message); } else { setNewKotcName(''); fetchData(); }
  };

  const saveKotcPlayer = async () => {
    if (!editingKotc) return;
    await supabase.from('kotc_players').update({
      name: editingKotc.name.toUpperCase(), score: parseInt(editingKotc.score) || 0
    }).eq('id', editingKotc.id);
    setEditingKotc(null); fetchData();
  };

  const deleteKotcPlayer = async (id: number) => {
    setModal({ isOpen: true, title: "Elimina", message: "Rimuovere questo Re?", type: 'confirm', onConfirm: async () => { await supabase.from('kotc_players').delete().eq('id', id); fetchData(); closeModal(); } });
  };

  const closeKotcStage = (currentStage: string) => {
    let title = ""; let message = "";
    if (currentStage === 'qualifiche') { title = "CHIUDI QUALIFICHE"; message = "Passeranno in semifinale i migliori 4. Confermi?"; }
    if (currentStage === 'semi') { title = "CHIUDI SEMIFINALI"; message = "I due vincitori andranno in finale. In caso di pareggio, passa chi si è qualificato meglio. Confermi?"; }
    if (currentStage === 'finali') { title = "INCORONA IL RE"; message = "Il vincitore verrà eletto King Of The Court. Confermi?"; }

    setModal({ isOpen: true, title, message, type: 'confirm', onConfirm: async () => {
      closeModal(); setLoading(true);

      if (currentStage === 'qualifiche') {
        const players = kotcPlayers.filter(p => p.stage === 'qualifiche');
        const sorted = [...players].sort((a, b) => b.score - a.score);
        const top4 = sorted.slice(0, 4);
        // I 4 passano e ricevono un "Seed" (Testa di Serie da 1 a 4)
        const newEntries = top4.map((w, i) => ({ name: w.name, stage: 'semi', score: 0, seed: i + 1 }));
        await supabase.from('kotc_players').insert(newEntries);
        setKotcSubTab('semi');

      } else if (currentStage === 'semi') {
        const players = kotcPlayers.filter(p => p.stage === 'semi');
        const p1 = players.find(p => p.seed === 1); const p4 = players.find(p => p.seed === 4);
        const p2 = players.find(p => p.seed === 2); const p3 = players.find(p => p.seed === 3);

        let w1 = null, w2 = null;
        // In caso di parità, il >= fa passare chi ha il "seed" più basso (es: 1 passa al posto di 4)
        if (p1 && p4) w1 = p1.score >= p4.score ? p1 : p4; else if (p1) w1 = p1; else w1 = p4;
        if (p2 && p3) w2 = p2.score >= p3.score ? p2 : p3; else if (p2) w2 = p2; else w2 = p3;

        const newEntries = [];
        if(w1) newEntries.push({ name: w1.name, stage: 'finali', score: 0, seed: w1.seed });
        if(w2) newEntries.push({ name: w2.name, stage: 'finali', score: 0, seed: w2.seed });

        await supabase.from('kotc_players').insert(newEntries);
        setKotcSubTab('finali');

      } else if (currentStage === 'finali') {
        const players = kotcPlayers.filter(p => p.stage === 'finali');
        const sorted = [...players].sort((a, b) => b.score - a.score);
        if (sorted.length > 0) await supabase.from('kotc_players').update({ stage: 'vincitore' }).eq('id', sorted[0].id);
      }
      fetchData();
    }});
  };

  // Funzione visiva per stampare i giocatori KOTC (usata nelle qualifiche e nei match)
  const renderKotcPlayerRow = (p: any, rankLabel: string = '', isPassing: boolean = false) => {
    if (!p) return <div className="p-4 text-center text-purple-500 font-black text-[10px] uppercase tracking-widest border-b border-[#3d135e] last:border-0">In attesa sfidante...</div>;

    return (
      <div key={p.id} className={`p-3 border-b border-[#3d135e] last:border-0 transition-colors ${isPassing ? 'bg-yellow-900/20' : 'hover:bg-[#1a0833]/50'}`}>
        {isAdminUnlocked && editingKotc?.id === p.id ? (
          <div className="flex flex-col gap-3 bg-[#1a0833] p-4 rounded-xl border border-[#3d135e] shadow-inner my-2">
            <div className="grid grid-cols-[2fr_1fr] gap-3 w-full">
              <input className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] font-black uppercase border border-cyan-500 outline-none shadow-[0_0_8px_rgba(6,182,212,0.2)] box-border" value={editingKotc.name} onChange={(e) => setEditingKotc({...editingKotc, name: e.target.value})} placeholder="NOME RE" />
              <input type="number" className="w-full bg-[#090214] text-pink-400 p-3 rounded-lg text-sm font-black border border-pink-500 outline-none text-center shadow-[0_0_8px_rgba(236,72,153,0.2)] box-border" value={editingKotc.score == 0 ? '' : editingKotc.score} onChange={(e) => setEditingKotc({...editingKotc, score: e.target.value})} placeholder="PUNTI" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1 w-full">
              <button onClick={saveKotcPlayer} className="w-full bg-cyan-500 text-[#090214] py-3 rounded-lg font-black text-[11px] uppercase shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all">SALVA</button>
              <button onClick={() => setEditingKotc(null)} className="w-full bg-transparent border border-purple-500/50 text-purple-300 py-3 rounded-lg font-black text-[10px] uppercase active:scale-95 transition-all">ANNULLA</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {rankLabel && <span className={`font-black text-xs w-5 text-right ${isPassing ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-cyan-500'}`}>{rankLabel}</span>}
              <span className="text-[11px] font-black uppercase text-purple-100">{p.name}</span>
              {isAdminUnlocked && (
                <div className="flex gap-2 ml-2">
                  <button onClick={() => setEditingKotc({ ...p })} className="text-purple-500 hover:text-cyan-400 text-[10px]">✏️</button>
                  <button onClick={() => deleteKotcPlayer(p.id)} className="text-purple-500 hover:text-pink-500 text-[10px]">❌</button>
                </div>
              )}
            </div>
            <span className={`text-xl font-black ${isPassing ? 'text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]' : 'text-purple-300'}`}>{p.score}</span>
          </div>
        )}
      </div>
    );
  };

  // --- LOADING INIZIALE ---
  if (loading || authChecking) {
    return <div className="min-h-screen bg-gradient-to-b from-[#090214] via-[#1c053a] to-[#4a0d2a] flex items-center justify-center text-pink-500 font-black uppercase italic animate-pulse tracking-widest">Inizializzazione...</div>;
  }

  const liveGames = sortedGames.filter(g => g.status === 'in_corso').slice(0, 2);
  const nextGames = sortedGames.filter(g => g.status === 'programmata').slice(0, 2);
  const activeLiveGamesCount = games.filter(g => g.status === 'in_corso').length;

  const renderTeamName = (team: any, bracketCode: string, isHome: boolean) => {
    if (team && team.name) return team.name;
    return `TBD`;
  };

  // --- CALCOLO CAMPIONE DEL TORNEO ---
  const f1Game = sortedGames.find(g => g.bracket_code === 'F1' && g.status === 'finita');
  const tournamentChampion = f1Game ? (f1Game.home_score > f1Game.away_score ? f1Game.home_team : f1Game.away_team) : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090214] via-[#1c053a] to-[#4a0d2a] p-3 md:p-8 font-sans text-purple-200 pb-28 select-none relative">
      {/* Sfumatura tramonto fissa sul fondo dello schermo */}
      <div className="fixed bottom-0 left-0 w-full h-64 bg-gradient-to-t from-orange-600/20 via-pink-600/5 to-transparent pointer-events-none z-0"></div>
      
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* --- LOGO CON EASTER EGG (3 SECONDI) --- */}
        {activeTab === 'home' && (
          <div className="flex justify-center items-center mb-8 pt-4 animate-fade-in relative">
            {/* Bagliore dietro il logo per richiamare il sole/neon vaporwave */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-600/30 rounded-full blur-[80px] pointer-events-none"></div>
            <img 
              src="/icon.png" 
              alt="Fiume Street Week Logo" 
              className="w-56 md:w-80 h-auto drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] object-contain cursor-pointer relative z-10" 
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUpOrLeave}
              onPointerLeave={handlePointerUpOrLeave}
              onContextMenu={(e) => e.preventDefault()} 
              style={{ WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' }} 
            />
          </div>
        )}

        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-8 relative z-10 flex flex-col justify-center min-h-[60vh]">
            
            {/* 🏆 BANNER CAMPIONI 3VS3 (Riempie lo schermo se il torneo è finito) */}
            {tournamentChampion && (
              <div className="bg-[#110524]/90 backdrop-blur-md border-2 border-yellow-400 rounded-3xl p-10 text-center shadow-[0_0_60px_rgba(250,204,21,0.5)] relative overflow-hidden animate-fade-in my-auto">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-orange-500/20 to-transparent pointer-events-none"></div>
                <span className="text-8xl block mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-bounce">🏆</span>
                <h3 className="text-cyan-400 font-black uppercase text-sm tracking-widest mb-2">CAMPIONI FSW 2026</h3>
                <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 uppercase drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] mb-6">
                  {tournamentChampion.name}
                </p>
                <p className="text-yellow-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Il torneo è concluso!</p>
              </div>
            )}

            {/* 🔥 SEZIONE LIVE (Nascosta a torneo finito) */}
            {!tournamentChampion && (
              <>
                <div>
                  <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-[#3d135e] pb-2 italic mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-400">
                    <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse shadow-[0_0_10px_rgba(236,72,153,1)]"></span> Live Now
                  </h2>
                  <div className={`grid gap-4 ${liveGames.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {liveGames.length === 0 ? (
                      <p className="text-purple-400 font-black uppercase text-[10px] italic tracking-widest bg-[#110524]/80 backdrop-blur-md p-6 rounded-xl border border-[#3d135e]">Nessun match in corso...</p>
                    ) : liveGames.map(game => {
                      if (game.is_event) {
                        return (
                          <div key={game.id} className="bg-gradient-to-br from-[#2a063b] to-[#120322] border-2 border-pink-500 rounded-xl p-4 flex flex-col justify-center items-center relative shadow-[0_0_20px_rgba(236,72,153,0.4)] overflow-hidden min-h-[120px]">
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-[#090214] font-black text-[9px] px-3 py-1.5 rounded-bl-lg rounded-tr-[10px] uppercase z-10 shadow-[0_0_10px_rgba(234,179,8,0.5)]">CAMPO {game.court}</div>
                            <span className="text-3xl mb-2 animate-pulse drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]">🔥</span>
                            <p className="text-[14px] text-white font-black uppercase leading-tight text-center tracking-widest px-4">{game.event_description}</p>
                          </div>
                        );
                      }
                      return (
                        <div key={game.id} className="bg-[#110524]/90 backdrop-blur-lg border-2 border-cyan-500 rounded-xl p-4 flex justify-between items-stretch relative shadow-[0_0_20px_rgba(6,182,212,0.4)] overflow-hidden">
                          <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-[#090214] font-black text-[9px] px-3 py-1.5 rounded-bl-lg rounded-tr-[10px] uppercase z-10 shadow-[0_0_10px_rgba(234,179,8,0.5)]">CAMPO {game.court}</div>
                          <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                            <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{game.home_team?.name || 'TBD'}</p>
                            <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.home_score}</p>
                          </div>
                          <div className="flex flex-col justify-center text-center w-[20%] mt-4"><span className="text-pink-500 font-black italic animate-pulse drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">VS</span></div>
                          <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                            <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{game.away_team?.name || 'TBD'}</p>
                            <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.away_score}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {nextGames.length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-purple-300 uppercase flex items-center gap-2 mb-4 tracking-widest italic">🔜 Prossimi Eventi</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nextGames.map(game => {
                        if (game.is_event) {
                          return (
                            <div key={game.id} className="grid grid-cols-[45px_1fr_40px] items-center gap-2 bg-[#1a0833]/80 backdrop-blur-sm border border-pink-500/50 rounded-xl p-3 shadow-[0_0_10px_rgba(236,72,153,0.2)]">
                              <div className="font-mono font-black text-yellow-400 text-xs drop-shadow-[0_0_3px_rgba(250,204,21,0.8)]">{game.match_time}</div>
                              <div className="text-center font-black text-pink-300 text-[11px] uppercase leading-tight tracking-widest break-words">{game.event_description}</div>
                              <div className="flex justify-end pr-1"><span className="bg-pink-600 text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-[0_0_8px_rgba(236,72,153,0.6)]">{game.court}</span></div>
                            </div>
                          );
                        }
                        return (
                          <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_40px] items-center gap-1 bg-[#110524]/60 backdrop-blur-sm border border-[#3d135e] rounded-xl p-3 shadow-lg">
                            <div className="font-mono font-black text-yellow-400 text-xs drop-shadow-[0_0_3px_rgba(250,204,21,0.8)]">{game.match_time}</div>
                            <div className="text-right font-bold text-purple-200 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team?.name || 'TBD'}</div>
                            <div className="text-center text-purple-500 font-black italic text-[10px] px-1 drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">VS</div>
                            <div className="text-left font-bold text-purple-200 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team?.name || 'TBD'}</div>
                            <div className="flex justify-end pr-1"><span className="bg-cyan-500 text-[#090214] font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-[0_0_8px_rgba(6,182,212,0.6)]">{game.court}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* --- GIRONI TAB --- */}
        {activeTab === 'gironi' && (
          <section className="animate-fade-in pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pb-32">
            {groups.map((group) => (
              <div key={group} className="bg-[#110524]/80 backdrop-blur-lg rounded-2xl border border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] overflow-hidden">
                <div className="bg-cyan-500 text-[#090214] p-2 text-center shadow-[0_0_15px_rgba(6,182,212,0.5)]"><h3 className="text-xl font-black uppercase italic">GIRONE {group}</h3></div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between px-3 pb-1 text-[10px] font-black text-purple-400 border-b border-[#3d135e]">
                    <div className="w-1/2">SQUADRA</div>
                    <div className="flex w-1/2 justify-end gap-2 font-mono text-center">
                      <span className="w-4" title="Vinte">V</span><span className="w-4" title="Perse">P</span><span className="w-6" title="Punti Fatti">PF</span><span className="w-6" title="Punti Subiti">PS</span><span className="w-6 text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]" title="Punti in Classifica">PT</span>
                    </div>
                  </div>
                  {teams.filter((t) => t.group_name === group).map((team, index) => (
                    <details key={team.id} className="bg-[#1a0833]/60 rounded-lg border border-[#3d135e] cursor-pointer hover:bg-[#260c49]/80 transition-colors group">
                      <summary className="p-3 font-bold text-purple-100 flex justify-between items-start list-none">
                        <div className="flex items-start gap-2 w-1/2">
                          <span className="text-yellow-400 font-black text-xs shrink-0 mt-[2px] drop-shadow-[0_0_2px_rgba(250,204,21,0.8)]">{index + 1}.</span>
                          <span className="uppercase text-[10px] font-black truncate group-open:whitespace-normal group-open:break-words leading-tight drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">{team.name}</span>
                        </div>
                        <div className="flex w-1/2 justify-end gap-2 text-[10px] font-mono text-center items-center">
                          <span className="text-purple-300 w-4">{team.wins}</span><span className="text-purple-300 w-4">{team.losses}</span><span className="text-cyan-400 w-6 drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">{team.pf}</span><span className="text-pink-400 w-6 drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]">{team.ps}</span><span className="text-yellow-400 w-6 font-black text-xs drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">{team.points}</span>
                        </div>
                      </summary>
                      <div className="p-4 bg-[#090214]/80 border-t border-[#3d135e] mt-1">
                        <ul className="grid grid-cols-2 gap-3">
                          {team.players.map((player: any) => (
                            <li key={player.id} className="text-purple-200 flex items-start gap-1.5 text-[10px] font-bold uppercase leading-tight break-words">
                              <span className="bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.8)] w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]"></span>
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

        {/* --- RISULTATI PUBBLICO  --- */}
        {activeTab === 'calendario' && (
          <section className="animate-fade-in space-y-4 pt-4 relative z-10 pb-32">
            
            {/* NUOVI TAB PRINCIPALI: 3VS3, 3-PT, KOTC */}
            <div className="flex gap-2 bg-[#110524]/80 backdrop-blur-sm p-1.5 rounded-xl border border-[#3d135e] shadow-lg overflow-x-auto hide-scrollbar">
              <button onClick={() => setActiveResultMainTab('3vs3')} className={`whitespace-nowrap flex-1 py-3 px-4 rounded-lg font-black uppercase text-xs tracking-widest transition-all ${activeResultMainTab === '3vs3' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>3VS3</button>
              <button onClick={() => setActiveResultMainTab('3pt')} className={`whitespace-nowrap flex-1 py-3 px-4 rounded-lg font-black uppercase text-xs tracking-widest transition-all ${activeResultMainTab === '3pt' ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-[#090214] shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>3-PT Contest</button>
              <button onClick={() => setActiveResultMainTab('kotc')} className={`whitespace-nowrap flex-1 py-3 px-4 rounded-lg font-black uppercase text-xs tracking-widest transition-all ${activeResultMainTab === 'kotc' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-[#090214] shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>KOTC</button>
            </div>

            {/* CONTENUTO 3VS3 */}
            {activeResultMainTab === '3vs3' && (
              <div className="animate-fade-in">
                {/* SUB-TAB QUALIFICHE / FINALI */}
                <div className="flex gap-2 bg-[#090214]/60 backdrop-blur-sm p-1 rounded-xl border border-[#3d135e]/50 mb-4 w-max mx-auto shadow-inner">
                  <button onClick={() => setActiveScheduleTab('qualifiche')} className={`py-2 px-5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Qualifiche</button>
                  <button onClick={() => setActiveScheduleTab('finali')} className={`py-2 px-5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Finali</button>
                </div>

                <div className="bg-[#110524]/80 backdrop-blur-md border border-[#3d135e] rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  {(() => {
                    // sortedGames le ordina già per orario crescente!
                    const list = activeScheduleTab === 'qualifiche' 
                      ? sortedGames.filter(g => !g.stage || g.stage === 'girone')
                      : sortedGames.filter(g => g.stage && g.stage !== 'girone');
                    
                    const displayList = (activeScheduleTab === 'finali' && list.length === 0) ? dummyFinals : list;

                    if (displayList.length === 0) return <div className="p-8 text-center text-purple-400 font-black uppercase tracking-widest text-[10px]">Nessun risultato disponibile.</div>;

                    return displayList.map((game, i, array) => {
                      if (game.is_event) return null;

                      return (
                        <div key={game.id} className="w-full flex flex-col">
                          {renderStageHeader(game, i, array)}
                          
                          <div className={`grid grid-cols-[45px_1fr_auto_1fr_40px] items-center gap-1 p-3 ${i !== displayList.length - 1 ? 'border-b border-[#3d135e]' : ''}`}>
                            <div className="font-mono font-black text-cyan-400 text-[10px] drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">{game.match_time}</div>
                            <div className="text-right font-black text-purple-100 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team?.name || 'TBD'}</div>
                            
                            <div className="flex justify-center items-center px-1 min-w-[35px]">
                              {game.status === 'finita' ? (
                                <div className="bg-[#1a0833] border border-cyan-500/50 px-2 py-1 rounded text-cyan-300 font-black text-[12px] shadow-[0_0_8px_rgba(6,182,212,0.4)] whitespace-nowrap">{game.home_score} - {game.away_score}</div>
                              ) : game.status === 'in_corso' ? (
                                <div className="bg-pink-600 border border-pink-400 px-2 py-0.5 rounded text-white font-black text-[9px] shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse">LIVE</div>
                              ) : (
                                <div className="text-purple-500 font-black italic text-[9px] drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">VS</div>
                              )}
                            </div>
                            
                            <div className="text-left font-black text-purple-100 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team?.name || 'TBD'}</div>
                            <div className="flex justify-end pr-1"><span className="bg-gradient-to-br from-yellow-400 to-orange-500 text-[#090214] font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-[0_0_8px_rgba(250,204,21,0.6)]">{game.court}</span></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* CONTENUTO 3-POINT CONTEST */}
            {activeResultMainTab === '3pt' && (
              <div className="animate-fade-in">
                
                {/* SUB-TAB 3-PT */}
                <div className="flex gap-1 bg-[#090214]/60 backdrop-blur-sm p-1 rounded-xl border border-[#3d135e]/50 mb-6 shadow-inner overflow-x-auto hide-scrollbar">
                  <button onClick={() => setThreePtSubTab('qualifiche')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${threePtSubTab === 'qualifiche' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Qualifiche</button>
                  <button onClick={() => setThreePtSubTab('semi')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${threePtSubTab === 'semi' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Semifinali</button>
                  <button onClick={() => setThreePtSubTab('finali')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${threePtSubTab === 'finali' ? 'bg-yellow-400 text-[#090214] shadow-[0_0_10px_rgba(250,204,21,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Finali</button>
                </div>

                {/* VINCITORE SCREEN */}
                {threePtSubTab === 'finali' && threePtPlayers.some(p => p.stage === 'vincitore') ? (
                  <div className="bg-[#110524]/90 backdrop-blur-md border-2 border-yellow-400 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(250,204,21,0.4)] relative overflow-hidden animate-fade-in">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-orange-500/20 to-transparent pointer-events-none"></div>
                    <span className="text-7xl block mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-pulse">🏆</span>
                    <h3 className="text-cyan-400 font-black uppercase text-sm tracking-widest mb-1">Campione 3-PT 2026</h3>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] mb-4">
                      {threePtPlayers.find(p => p.stage === 'vincitore')?.name}
                    </p>
                    <div className="inline-block bg-[#090214] border border-pink-500 rounded-xl px-6 py-2 shadow-[0_0_10px_rgba(236,72,153,0.5)]">
                      <span className="text-pink-400 font-black text-xl">{threePtPlayers.find(p => p.stage === 'vincitore')?.score} PT</span>
                      <span className="text-purple-400 font-mono text-sm ml-3">IN {threePtPlayers.find(p => p.stage === 'vincitore')?.time_seconds}s</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* PANNELLO ADMIN AGGIUNTA E CHIUSURA (Visibile solo all'admin nel tab 3PT) */}
                    {isAdminUnlocked && (
                      <div className="bg-[#1a0833]/60 backdrop-blur-md border border-pink-500/50 rounded-xl p-4 mb-6 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                        <h3 className="text-pink-400 font-black uppercase text-[10px] tracking-widest mb-3">Gestione {threePtSubTab}</h3>
                        
                        {/* Aggiunta Giocatore solo in Qualifiche */}
                        {threePtSubTab === 'qualifiche' && (
                          <div className="flex gap-2 mb-4">
                            <input placeholder="NOME TIRATORE" className="flex-1 bg-[#090214] text-white p-3 rounded-lg text-xs outline-none uppercase border border-[#3d135e] focus:border-cyan-400 transition-all font-black" value={new3PtName} onChange={(e) => setNew3PtName(e.target.value)} />
                            <button onClick={add3PtPlayer} className="bg-cyan-500 text-[#090214] font-black px-5 rounded-lg text-[10px] uppercase tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.5)] active:scale-95">Add</button>
                          </div>
                        )}

                        {/* Bottoni "FINE" */}
                        {threePtSubTab === 'qualifiche' && (
                          <button onClick={() => close3PtStage('qualifiche', 10, 'semi')} className="w-full bg-[#090214] border border-pink-500 text-pink-400 font-black uppercase text-[10px] py-3 rounded-lg tracking-widest hover:bg-pink-600 hover:text-white transition-all">Chiudi Qualifiche (Passano i TOP 10) ➔</button>
                        )}
                        {threePtSubTab === 'semi' && (
                          <button onClick={() => close3PtStage('semi', 3, 'finali')} className="w-full bg-[#090214] border border-pink-500 text-pink-400 font-black uppercase text-[10px] py-3 rounded-lg tracking-widest hover:bg-pink-600 hover:text-white transition-all">Chiudi Semifinali (Passano i TOP 3) ➔</button>
                        )}
                        {threePtSubTab === 'finali' && (
                          <button onClick={declare3PtWinner} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-[#090214] font-black uppercase text-xs py-4 rounded-lg tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.5)] active:scale-95 transition-all">🏆 INCORONA VINCITORE 🏆</button>
                        )}
                      </div>
                    )}

                    {/* CLASSIFICA PUBBLICA */}
                    <div className="bg-[#110524]/80 backdrop-blur-md border border-[#3d135e] rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                      <div className="flex justify-between px-3 py-2 bg-[#1a0833] border-b border-[#3d135e] text-[9px] font-black uppercase tracking-widest text-purple-400">
                        <span>Rank & Nome</span>
                        <div className="flex gap-4">
                          <span>Punti</span>
                          <span>Tempo</span>
                        </div>
                      </div>

                      {(() => {
                        const currentPlayers = threePtPlayers.filter(p => p.stage === threePtSubTab);
                        const sorted = [...currentPlayers].sort((a, b) => {
                          if (b.score !== a.score) return b.score - a.score;
                          return a.time_seconds - b.time_seconds;
                        });

                        const passLimit = threePtSubTab === 'qualifiche' ? 10 : threePtSubTab === 'semi' ? 3 : 1;

                        if (sorted.length === 0) return <div className="p-8 text-center text-purple-400 font-black uppercase tracking-widest text-[10px]">Nessun tiratore.</div>;

                        return sorted.map((p, index) => {
                          const isPassing = index < passLimit;
                          return (
                            <div key={p.id} className={`p-3 border-b border-[#3d135e] last:border-0 transition-colors ${isPassing ? 'bg-cyan-900/20' : 'hover:bg-[#1a0833]/50'}`}>
                              
                              {/* VISTA ADMIN (Modifica riga) */}
                              {isAdminUnlocked && editing3Pt?.id === p.id ? (
                                <div className="flex flex-col gap-3 bg-[#1a0833] p-4 rounded-xl border border-[#3d135e] shadow-inner my-2">
                                  {/* RIGA 1: NOME */}
                                  <input className="bg-[#090214] text-white p-3 rounded-lg text-[11px] font-black uppercase border border-cyan-500 outline-none w-full shadow-[0_0_8px_rgba(6,182,212,0.2)]" value={editing3Pt.name} onChange={(e) => setEditing3Pt({...editing3Pt, name: e.target.value})} placeholder="NOME TIRATORE" />
                                  
                                  {/* RIGA 2: PUNTI E TEMPO (Uguali) */}
                                  <div className="grid grid-cols-2 gap-3 w-full">
                                    <input type="number" className="w-full bg-[#090214] text-pink-400 p-3 rounded-lg text-sm font-black border border-pink-500 outline-none text-center shadow-[0_0_8px_rgba(236,72,153,0.2)] box-border" value={editing3Pt.score == 0 ? '' : editing3Pt.score} onChange={(e) => setEditing3Pt({...editing3Pt, score: e.target.value})} placeholder="PUNTI" />
                                    <input type="number" step="0.01" className="w-full bg-[#090214] text-yellow-400 p-3 rounded-lg text-sm font-mono font-black border border-yellow-500 outline-none text-center shadow-[0_0_8px_rgba(250,204,21,0.2)] box-border" value={editing3Pt.time_seconds == 999.99 ? '' : editing3Pt.time_seconds} onChange={(e) => setEditing3Pt({...editing3Pt, time_seconds: e.target.value})} placeholder="TEMPO (s)" />
                                  </div>
                                  
                                  {/* RIGA 3: BOTTONI (Salva prima, Uguali) */}
                                  <div className="grid grid-cols-2 gap-2 mt-1 w-full">
                                    <button onClick={save3PtPlayer} className="w-full bg-cyan-500 text-[#090214] py-3 rounded-lg font-black text-[11px] uppercase shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all">SALVA</button>
                                    <button onClick={() => setEditing3Pt(null)} className="w-full bg-transparent border border-purple-500/50 text-purple-300 py-3 rounded-lg font-black text-[10px] uppercase active:scale-95 transition-all">ANNULLA</button>
                                  </div>
                                </div>
                              ) : (
                                /* VISTA NORMALE PUBBLICA */
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <span className={`font-black text-xs w-5 text-right ${isPassing ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'text-purple-500'}`}>{index + 1}.</span>
                                    <span className="text-[11px] font-black uppercase text-purple-100">{p.name}</span>
                                    {isAdminUnlocked && (
                                      <div className="flex gap-2 ml-2">
                                        <button onClick={() => setEditing3Pt({ ...p })} className="text-purple-500 hover:text-cyan-400 text-[10px]">✏️</button>
                                        <button onClick={() => delete3PtPlayer(p.id)} className="text-purple-500 hover:text-pink-500 text-[10px]">❌</button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-4 font-black">
                                    <span className={`text-sm ${isPassing ? 'text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]' : 'text-purple-300'}`}>{p.score}</span>
                                    <span className={`text-xs font-mono w-10 text-right mt-0.5 ${isPassing ? 'text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]' : 'text-purple-500'}`}>{p.time_seconds === 999.99 ? '--' : p.time_seconds}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CONTENUTO KOTC */}
            {activeResultMainTab === 'kotc' && (
              <div className="animate-fade-in">
                
                {/* SUB-TAB KOTC */}
                <div className="flex gap-1 bg-[#090214]/60 backdrop-blur-sm p-1 rounded-xl border border-[#3d135e]/50 mb-6 shadow-inner overflow-x-auto hide-scrollbar">
                  <button onClick={() => setKotcSubTab('qualifiche')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${kotcSubTab === 'qualifiche' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Qualifiche</button>
                  <button onClick={() => setKotcSubTab('semi')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${kotcSubTab === 'semi' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Semifinali</button>
                  <button onClick={() => setKotcSubTab('finali')} className={`flex-1 py-2 px-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${kotcSubTab === 'finali' ? 'bg-yellow-400 text-[#090214] shadow-[0_0_10px_rgba(250,204,21,0.4)]' : 'text-purple-500 hover:text-purple-300'}`}>Finali</button>
                </div>

                {/* VINCITORE KOTC */}
                {kotcSubTab === 'finali' && kotcPlayers.some(p => p.stage === 'vincitore') ? (
                  <div className="bg-[#110524]/90 backdrop-blur-md border-2 border-yellow-400 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(250,204,21,0.4)] relative overflow-hidden animate-fade-in">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-orange-500/20 to-transparent pointer-events-none"></div>
                    <span className="text-8xl block mb-2 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-pulse">👑</span>
                    <h3 className="text-pink-400 font-black uppercase text-xs tracking-widest mb-1 mt-6">IL RE DEL CAMPETTO È</h3>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] mb-2 mt-2">
                      {kotcPlayers.find(p => p.stage === 'vincitore')?.name}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* PANNELLO ADMIN KOTC */}
                    {isAdminUnlocked && (
                      <div className="bg-[#1a0833]/60 backdrop-blur-md border border-yellow-500/50 rounded-xl p-4 mb-6 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                        <h3 className="text-yellow-400 font-black uppercase text-[10px] tracking-widest mb-3">Gestione {kotcSubTab}</h3>
                        
                        {kotcSubTab === 'qualifiche' && (
                          <div className="flex gap-2 mb-4">
                            <input placeholder="NOME RE" className="flex-1 bg-[#090214] text-white p-3 rounded-lg text-xs outline-none uppercase border border-[#3d135e] focus:border-yellow-400 transition-all font-black" value={newKotcName} onChange={(e) => setNewKotcName(e.target.value)} />
                            <button onClick={addKotcPlayer} className="bg-yellow-400 text-[#090214] font-black px-5 rounded-lg text-[10px] uppercase tracking-widest shadow-[0_0_10px_rgba(250,204,21,0.5)] active:scale-95">Add</button>
                          </div>
                        )}

                        {kotcSubTab === 'qualifiche' && (
                          <button onClick={() => closeKotcStage('qualifiche')} className="w-full bg-[#090214] border border-yellow-500 text-yellow-400 font-black uppercase text-[10px] py-3 rounded-lg tracking-widest hover:bg-yellow-500 hover:text-[#090214] transition-all">Chiudi Qualifiche (Passano i TOP 4) ➔</button>
                        )}
                        {kotcSubTab === 'semi' && (
                          <button onClick={() => closeKotcStage('semi')} className="w-full bg-[#090214] border border-yellow-500 text-yellow-400 font-black uppercase text-[10px] py-3 rounded-lg tracking-widest hover:bg-yellow-500 hover:text-[#090214] transition-all">Chiudi Semifinali (Passano i Vincitori) ➔</button>
                        )}
                        {kotcSubTab === 'finali' && (
                          <button onClick={() => closeKotcStage('finali')} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-[#090214] font-black uppercase text-xs py-4 rounded-lg tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.5)] active:scale-95 transition-all">👑 INCORONA IL RE 👑</button>
                        )}
                      </div>
                    )}

                    {/* VISTE KOTC PUBBLICHE */}
                    {kotcSubTab === 'qualifiche' && (
                      <div className="bg-[#110524]/80 backdrop-blur-md border border-[#3d135e] rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] animate-fade-in">
                        <div className="flex justify-between px-3 py-2 bg-[#1a0833] border-b border-[#3d135e] text-[9px] font-black uppercase tracking-widest text-purple-400">
                          <span>Rank & Nome</span>
                          <span>Punti</span>
                        </div>
                        {(() => {
                          const qualPlayers = kotcPlayers.filter(p => p.stage === 'qualifiche');
                          const sorted = [...qualPlayers].sort((a,b) => b.score - a.score);
                          if (sorted.length === 0) return <div className="p-8 text-center text-purple-400 font-black uppercase tracking-widest text-[10px]">Nessun aspirante Re in lista.</div>;
                          // In qualifiche evidenziamo di giallo i TOP 4
                          return sorted.map((p, index) => renderKotcPlayerRow(p, `${index + 1}.`, index < 4));
                        })()}
                      </div>
                    )}

                    {kotcSubTab === 'semi' && (
                      <div className="space-y-6 animate-fade-in">
                        {(() => {
                          const semiPlayers = kotcPlayers.filter(p => p.stage === 'semi');
                          // Li andiamo a cercare tramite la "testa di serie" assegnata durante le qualifiche
                          const p1 = semiPlayers.find(p => p.seed === 1);
                          const p4 = semiPlayers.find(p => p.seed === 4);
                          const p2 = semiPlayers.find(p => p.seed === 2);
                          const p3 = semiPlayers.find(p => p.seed === 3);

                          return (
                            <>
                              <div className="bg-[#110524]/80 border border-cyan-500/50 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                <div className="bg-cyan-900/30 text-center text-[10px] font-black uppercase text-cyan-400 py-2 border-b border-cyan-500/50">Scontro 1</div>
                                {renderKotcPlayerRow(p1, '1°')}
                                <div className="bg-[#090214] text-center text-[9px] font-black italic text-pink-500 py-1 drop-shadow-[0_0_3px_rgba(236,72,153,0.5)] relative z-10">VS</div>
                                {renderKotcPlayerRow(p4, '4°')}
                              </div>
                              <div className="bg-[#110524]/80 border border-pink-500/50 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                                <div className="bg-pink-900/30 text-center text-[10px] font-black uppercase text-pink-400 py-2 border-b border-pink-500/50">Scontro 2</div>
                                {renderKotcPlayerRow(p2, '2°')}
                                <div className="bg-[#090214] text-center text-[9px] font-black italic text-cyan-400 py-1 drop-shadow-[0_0_3px_rgba(6,182,212,0.5)] relative z-10">VS</div>
                                {renderKotcPlayerRow(p3, '3°')}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {kotcSubTab === 'finali' && (
                      <div className="bg-[#110524]/80 border border-yellow-500/50 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.3)] animate-fade-in">
                        <div className="bg-yellow-500/10 text-center text-[11px] font-black uppercase text-yellow-400 py-3 border-b border-yellow-500/50 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">Grande Finale</div>
                        {(() => {
                          const finalPlayers = kotcPlayers.filter(p => p.stage === 'finali');
                          return (
                            <>
                              {renderKotcPlayerRow(finalPlayers[0])}
                              <div className="bg-[#090214] text-center text-[10px] font-black italic text-pink-500 py-2 drop-shadow-[0_0_3px_rgba(236,72,153,0.8)] relative z-10 border-y border-[#3d135e]">VS</div>
                              {renderKotcPlayerRow(finalPlayers[1])}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </section>
        )}

        {/* --- PLAYOFF TAB PUBBLICO --- */}
        {activeTab === 'playoff' && (
          <section className="animate-fade-in pt-4 relative z-10 h-[calc(100vh-140px)] flex flex-col">
            <h2 className="text-xl font-black uppercase border-b-2 border-[#3d135e] pb-2 italic tracking-widest mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)] shrink-0">Tabellone Finale</h2>

            {games.filter(g => g.stage && g.stage !== 'girone').length === 0 ? (
              <div className="bg-[#110524]/60 backdrop-blur-md border border-[#3d135e] rounded-xl p-8 text-center mt-8">
                <p className="text-purple-400 font-black uppercase tracking-widest text-sm italic">Tabellone in via di definizione...</p>
                <p className="text-purple-500/70 text-xs font-bold mt-2">I playoff appariranno qui al termine della fase a gironi.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-auto hide-scrollbar relative -mx-3 px-3 md:mx-0 md:px-0">
                
                <div className="flex gap-12 pt-12 pb-8 px-8 min-w-max items-start">
                  
                  {playoffStages.map((stage) => {
                    const stageGames = sortedGames.filter(g => g.stage === stage && !g.is_event);
                    if (stageGames.length === 0) return null;

                    // --- LAYOUT SPECIALE: LA COLONNA DELLE FINALI ---
                    if (stage === 'finali') {
                      const f1 = stageGames.find(g => g.bracket_code === 'F1');
                      const f3 = stageGames.find(g => g.bracket_code === 'F3');

                      return (
                        <div key={stage} className="w-[280px] relative h-[1040px]">
                          <div className="absolute -top-6 left-0 w-full text-center text-pink-500 font-black uppercase tracking-widest text-sm drop-shadow-[0_0_5px_rgba(236,72,153,0.5)] z-20">FINALI</div>

                          {/* Contenitore centrato verticalmente a 520px esatti (altezza d'incrocio delle Semifinali) */}
                          <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex flex-col items-center">
                            
                            {/* MATCH 1°/2° POSTO */}
                            {f1 && (
                              <div className="relative w-full mb-8">
                                {/* Linea in entrata dalle Semifinali */}
                                <div className="absolute top-1/2 -left-6 w-6 h-[2px] bg-cyan-500/70 z-0 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></div>
                                {/* Linea verticale che scende verso la finale 3°/4° posto */}
                                {f3 && <div className="absolute top-full left-1/2 -translate-x-1/2 w-[2px] h-8 bg-cyan-500/70 z-0 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></div>}
                                
                                <div className="bg-[#110524]/95 backdrop-blur-md border rounded-xl p-4 flex flex-col justify-center min-h-[90px] w-full relative z-10 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                                  <div className="absolute top-0 left-0 bg-yellow-400 text-[#090214] font-black text-[8px] px-2 py-1 rounded-br-lg rounded-tl-[10px] uppercase shadow-[0_0_10px_rgba(250,204,21,0.6)]">🏆 1°/2° POSTO</div>
                                  <div className="absolute top-0 right-0 bg-[#1a0833] border-b border-l text-purple-300 font-black text-[8px] px-2 py-1 rounded-bl-lg rounded-tr-[10px] uppercase border-yellow-400/50">{f1.match_time} | C.{f1.court}</div>
                                  
                                  <div className="mt-3 flex justify-between items-center w-full">
                                    <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${f1.home_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                      {renderTeamName(f1.home_team, f1.bracket_code, true)}
                                    </span>
                                    <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${f1.home_team ? 'text-white' : 'text-[#3d135e]'}`}>{f1.home_score}</span>
                                  </div>
                                  
                                  <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3d135e] to-transparent my-2 relative">
                                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#110524] px-2 text-[9px] font-black text-pink-500 italic drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]">VS</span>
                                  </div>
                                  
                                  <div className="flex justify-between items-center w-full">
                                    <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${f1.away_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                      {renderTeamName(f1.away_team, f1.bracket_code, false)}
                                    </span>
                                    <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${f1.away_team ? 'text-white' : 'text-[#3d135e]'}`}>{f1.away_score}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* MATCH 3°/4° POSTO */}
                            {f3 && (
                              <div className="relative w-full">
                                <div className="bg-[#110524]/95 backdrop-blur-md border rounded-xl p-4 flex flex-col justify-center min-h-[90px] w-full relative z-10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                                  <div className="absolute top-0 left-0 bg-orange-500 text-white font-black text-[8px] px-2 py-1 rounded-br-lg rounded-tl-[10px] uppercase shadow-[0_0_10px_rgba(249,115,22,0.6)]">🥉 3°/4° POSTO</div>
                                  <div className="absolute top-0 right-0 bg-[#1a0833] border-b border-l text-purple-300 font-black text-[8px] px-2 py-1 rounded-bl-lg rounded-tr-[10px] uppercase border-orange-500/30">{f3.match_time} | C.{f3.court}</div>
                                  
                                  <div className="mt-3 flex justify-between items-center w-full">
                                    <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${f3.home_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                      {renderTeamName(f3.home_team, f3.bracket_code, true)}
                                    </span>
                                    <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${f3.home_team ? 'text-white' : 'text-[#3d135e]'}`}>{f3.home_score}</span>
                                  </div>
                                  
                                  <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3d135e] to-transparent my-2 relative">
                                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#110524] px-2 text-[9px] font-black text-pink-500 italic drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]">VS</span>
                                  </div>
                                  
                                  <div className="flex justify-between items-center w-full">
                                    <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${f3.away_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                      {renderTeamName(f3.away_team, f3.bracket_code, false)}
                                    </span>
                                    <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${f3.away_team ? 'text-white' : 'text-[#3d135e]'}`}>{f3.away_score}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // --- LAYOUT STANDARD PER OTTAVI, QUARTI E SEMIFINALI ---
                    return (
                      <div key={stage} className="w-[280px] flex flex-col relative">
                        <div className="absolute -top-6 left-0 w-full text-center text-pink-500 font-black uppercase tracking-widest text-sm drop-shadow-[0_0_5px_rgba(236,72,153,0.5)] z-20">
                          {stage === 'semi' ? 'SEMIFINALI' : stage}
                        </div>
                        
                        {stageGames.map((game, i) => {
                          const hClass = stage === 'ottavi' ? 'h-[130px]' : stage === 'quarti' ? 'h-[260px]' : 'h-[520px]';

                          return (
                            <div key={game.id} className={`relative w-full flex items-center justify-center py-2 ${hClass}`}>
                              
                              {/* 🔗 LINEE IN USCITA VERSO DESTRA (Tutte tranne finali) 🔗 */}
                              <div className="absolute top-1/2 -right-6 w-6 h-[2px] bg-cyan-500/70 z-0 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></div>
                              <div className={`absolute -right-6 w-[2px] bg-cyan-500/70 z-0 shadow-[0_0_5px_rgba(6,182,212,0.5)] ${i % 2 === 0 ? 'top-1/2 h-[50%]' : 'bottom-1/2 h-[50%]'}`}></div>
                              
                              {/* 🔗 LINEE IN ENTRATA DA SINISTRA (Tutte tranne gli ottavi) 🔗 */}
                              {stage !== 'ottavi' && (
                                <div className="absolute top-1/2 -left-6 w-6 h-[2px] bg-cyan-500/70 z-0 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></div>
                              )}

                              <div className={`bg-[#110524]/95 backdrop-blur-md border rounded-xl p-4 flex flex-col justify-center min-h-[90px] w-full relative z-10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]`}>
                                <div className={`absolute top-0 left-0 bg-cyan-500 text-[#090214] font-black text-[8px] px-2 py-1 rounded-br-lg rounded-tl-[10px] uppercase shadow-[0_0_8px_rgba(6,182,212,0.6)]`}>MATCH {game.bracket_code}</div>
                                <div className={`absolute top-0 right-0 bg-[#1a0833] border-b border-l text-purple-300 font-black text-[8px] px-2 py-1 rounded-bl-lg rounded-tr-[10px] uppercase border-cyan-500/30`}>{game.match_time} | C.{game.court}</div>
                                
                                <div className="mt-3 flex justify-between items-center w-full">
                                  <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${game.home_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                    {renderTeamName(game.home_team, game.bracket_code, true)}
                                  </span>
                                  <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${game.home_team ? 'text-white' : 'text-[#3d135e]'}`}>{game.home_score}</span>
                                </div>
                                
                                <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3d135e] to-transparent my-2 relative">
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#110524] px-2 text-[9px] font-black text-pink-500 italic drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]">VS</span>
                                </div>
                                
                                <div className="flex justify-between items-center w-full">
                                  <span className={`text-[11px] font-black uppercase leading-tight break-words w-2/3 ${game.away_team ? 'text-purple-100' : 'text-purple-500 italic'}`}>
                                    {renderTeamName(game.away_team, game.bracket_code, false)}
                                  </span>
                                  <span className={`text-2xl font-black drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${game.away_team ? 'text-white' : 'text-[#3d135e]'}`}>{game.away_score}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {/* 🏆 COLONNA AGGIUNTIVA: IL PODIO 🏆 */}
                  <div className="w-[300px] flex flex-col justify-center relative pl-10 border-l-2 border-dashed border-pink-500/30 ml-6 shrink-0 h-[1040px]">
                    
                    <div className="w-full text-center text-yellow-400 font-black uppercase tracking-[0.3em] text-lg drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] mb-12">
                      PODIO UFFICIALE
                    </div>

                    {(() => {
                      const f1 = sortedGames.find(g => g.bracket_code === 'F1' && g.status === 'finita');
                      const f3 = sortedGames.find(g => g.bracket_code === 'F3' && g.status === 'finita');
                      
                      let p1 = null, p2 = null, p3 = null;
                      
                      if (f1) {
                        const h_won = f1.home_score > f1.away_score;
                        p1 = h_won ? f1.home_team : f1.away_team;
                        p2 = h_won ? f1.away_team : f1.home_team;
                      }
                      if (f3) {
                        const h_won = f3.home_score > f3.away_score;
                        p3 = h_won ? f3.home_team : f3.away_team;
                      }

                      if (!p1 && !p2 && !p3) return (
                        <div className="text-center text-purple-500/50 font-black uppercase tracking-widest text-sm border border-[#3d135e] bg-[#110524]/50 p-6 rounded-xl">
                          In attesa delle finali...
                        </div>
                      );

                      return (
                        <div className="flex flex-col gap-10 w-full pb-8">
                          {p1 && (
                            <div className="bg-gradient-to-br from-yellow-500/20 to-[#090214] border-2 border-yellow-400 rounded-xl p-6 text-center shadow-[0_0_30px_rgba(250,204,21,0.3)] relative transform hover:scale-105 transition-transform cursor-default">
                              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-5xl drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-bounce">👑</span>
                              <h4 className="text-yellow-400 font-black text-[10px] uppercase tracking-widest mt-2">1° Classificato</h4>
                              <p className="text-white font-black text-2xl uppercase mt-1 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{p1.name}</p>
                            </div>
                          )}
                          {p2 && (
                            <div className="bg-gradient-to-br from-gray-400/20 to-[#090214] border-2 border-gray-400 rounded-xl p-5 text-center shadow-[0_0_20px_rgba(156,163,175,0.3)] relative mt-4">
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl drop-shadow-[0_0_10px_rgba(156,163,175,0.8)]">🥈</span>
                              <h4 className="text-gray-400 font-black text-[10px] uppercase tracking-widest mt-1">2° Classificato</h4>
                              <p className="text-white font-black text-xl uppercase mt-1">{p2.name}</p>
                            </div>
                          )}
                          {p3 && (
                            <div className="bg-gradient-to-br from-orange-600/20 to-[#090214] border-2 border-orange-500 rounded-xl p-4 text-center shadow-[0_0_20px_rgba(249,115,22,0.3)] relative mt-4">
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">🥉</span>
                              <h4 className="text-orange-500 font-black text-[10px] uppercase tracking-widest mt-1">3° Classificato</h4>
                              <p className="text-white font-black text-lg uppercase mt-1">{p3.name}</p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                </div>
              </div>
            )}
          </section>
        )}

{/* --- SOCIAL PUBBLICO --- */}
        {activeTab === 'social' && (
          <section className="animate-fade-in pt-4 relative z-10 space-y-6">
            <div className="mb-6 border-b-2 border-[#3d135e] pb-2">
              <h2 className="text-2xl font-black uppercase italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                SOCIAL
              </h2>
              <p className="text-purple-300 text-[10px] font-bold uppercase tracking-widest mt-1">
                Resta connesso con il mondo FSW 2026
              </p>
            </div>

            {/* CARD 1: INSTAGRAM */}
            <div className="bg-[#110524]/80 backdrop-blur-md border-2 border-cyan-500/50 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all">
              <div className="bg-[#090214] p-4 rounded-2xl border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                {/* SVG Icona Instagram (Giallo Neon) */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-white font-black uppercase text-lg tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]">Instagram</h3>
                <p className="text-pink-400 font-mono text-[11px] font-bold mt-1 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">@fiumestreetweek</p>
              </div>
              <a 
                href="https://www.instagram.com/fiumestreetweek?igsh=anFlMG41N3MxcjZr&utm_source=qr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-[#090214] font-black uppercase text-[10px] px-6 py-3 rounded-xl tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all active:scale-95 text-center mt-2 sm:mt-0"
              >
                Apri ➔
              </a>
            </div>

            {/* CARD 2: HASHTAG / COMMUNITY */}
            <div className="bg-[#090214]/60 backdrop-blur-sm border border-purple-500/50 rounded-2xl p-5 text-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <span className="text-3xl block mb-2 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">📸</span>
              <h3 className="text-pink-400 font-black uppercase text-sm tracking-widest mb-2 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">Condividi il tuo torneo</h3>
              <p className="text-purple-200 text-[10px] uppercase font-bold leading-relaxed px-4">
                Usa l'hashtag <span className="text-cyan-400 font-black drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">#FSW2026</span> nelle tue storie e post. Le foto e i video più spettacolari verranno ripostati sul nostro profilo ufficiale!
              </p>
            </div>
          </section>
        )}

        {/* --- ADMIN AREA --- */}
        {activeTab === 'admin' && isAdminUnlocked && (
          <section className="animate-fade-in space-y-6 relative z-10">
            
            <div className="flex justify-between items-center border-b-2 border-yellow-400 pb-2 pt-4 relative z-[100]">
              <h2 className="text-2xl font-black uppercase italic m-0 leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">Control Panel</h2>
              <div className="relative">
                <button 
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)} 
                  className="bg-[#1a0833] text-purple-300 border border-[#3d135e] w-9 h-9 rounded-lg hover:bg-[#260c49] hover:text-white transition-all hover:shadow-[0_0_10px_rgba(168,85,247,0.4)] flex items-center justify-center shadow-lg text-lg pb-1 relative z-20"
                >
                  ⋮
                </button>
                {isAdminMenuOpen && (
                  <>
                    <div className="fixed inset-0 cursor-default" onClick={() => setIsAdminMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-[#110524]/95 backdrop-blur-md border border-pink-500 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] z-50 overflow-hidden animate-fade-in">
                      <button onClick={(e) => { e.stopPropagation(); setIsAdminMenuOpen(false); setTimeout(() => resetTournament(), 100); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-pink-500 hover:bg-pink-900/50 border-b border-[#3d135e] flex items-center gap-3 transition-colors relative z-10">
                        <span className="text-sm">🗑️</span> Azzera Torneo
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setIsAdminMenuOpen(false); setTimeout(() => promptLogout(), 100); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-purple-200 hover:bg-cyan-900/50 hover:text-cyan-300 flex items-center gap-3 transition-colors relative z-10">
                        <span className="text-sm">🚪</span> Esci dal Pannello
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-1 bg-[#110524]/80 backdrop-blur-sm p-1.5 rounded-xl border border-[#3d135e] overflow-x-auto hide-scrollbar relative z-10 shadow-lg">
              <button onClick={() => setActiveAdminSubTab('live')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${activeAdminSubTab === 'live' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.6)]' : 'text-purple-400 hover:text-purple-200'}`}>🟢 Live</button>
              <button onClick={() => setActiveAdminSubTab('orari')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${activeAdminSubTab === 'orari' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.6)]' : 'text-purple-400 hover:text-purple-200'}`}>📅 Orari</button>
              <button onClick={() => setActiveAdminSubTab('roster')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${activeAdminSubTab === 'roster' ? 'bg-yellow-400 text-[#090214] shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'text-purple-400 hover:text-purple-200'}`}>🏀 Roster</button>
              <button onClick={() => setActiveAdminSubTab('playoff')} className={`min-w-[70px] flex-1 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${activeAdminSubTab === 'playoff' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.6)]' : 'text-purple-400 hover:text-purple-200'}`}>🏆 Playoff</button>
            </div>

            {/* LIVE CONTROL */}
            {activeAdminSubTab === 'live' && (
              <div className="space-y-4 pb-20">
                
                <div className="flex gap-2 bg-[#110524]/80 backdrop-blur-sm p-1.5 rounded-xl border border-[#3d135e] mb-6 shadow-lg">
                  <button onClick={() => setActiveScheduleTab('qualifiche')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>Qualifiche</button>
                  <button onClick={() => setActiveScheduleTab('finali')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>Finali</button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {(() => {
                    const filteredLiveGames = adminLiveGames.filter(g => activeScheduleTab === 'qualifiche' ? (!g.stage || g.stage === 'girone') : (g.stage && g.stage !== 'girone'));

                    if (filteredLiveGames.length === 0) return <div className="p-8 text-center text-purple-400 font-black uppercase tracking-widest text-[10px] bg-[#110524]/60 backdrop-blur-sm rounded-xl border border-[#3d135e]">Nessun evento in questa fase.</div>;

                    return filteredLiveGames.map(game => {
                      if (game.is_event) {
                        return (
                          <div key={game.id} className={`bg-gradient-to-br from-[#2a063b] to-[#120322] p-4 rounded-xl border transition-all ${game.status === 'in_corso' ? 'border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]' : game.status === 'finita' ? 'border-[#3d135e] opacity-60' : 'border-pink-500/30'}`}>
                             <div className="flex justify-between items-center mb-3">
                               <span className="text-[10px] text-purple-300 font-mono font-black tracking-widest drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">{game.match_time} | CAMPO {game.court}</span>
                               {game.status === 'finita' && <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`text-[10px] font-black uppercase flex items-center gap-1 transition-colors ${activeLiveGamesCount >= 2 ? 'text-[#3d135e] cursor-not-allowed' : 'text-pink-500 hover:text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]'}`}><span>↺</span> Riapri</button>}
                             </div>
                             <div className="flex flex-col items-center justify-center bg-[#090214]/60 p-4 rounded-lg mb-3 min-h-[80px] text-center border border-pink-500/20">
                               <span className="text-2xl mb-1 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">🔥</span>
                               <p className="text-[12px] font-black uppercase text-pink-400 tracking-widest drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">{game.event_description}</p>
                             </div>
                             <div className="flex justify-center px-1">
                               {game.status === 'programmata' && game.event_description?.toUpperCase() !== 'PREMIAZIONI' && <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`bg-cyan-500 text-[#090214] text-[9px] font-black px-6 py-2 rounded-md uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.8)] ${activeLiveGamesCount >= 2 ? 'opacity-30 cursor-not-allowed' : 'shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`}>Avvia Evento</button>}
                               {game.status === 'programmata' && game.event_description?.toUpperCase() === 'PREMIAZIONI' && <span className="text-yellow-400/80 text-[10px] font-black uppercase tracking-widest block py-2">Solo in Calendario</span>}
                               {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-6 py-2 rounded-md uppercase tracking-widest shadow-[0_0_10px_rgba(236,72,153,0.6)]">Chiudi Evento</button>}
                               {game.status === 'finita' && <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest block">Evento Terminato</span>}
                             </div>
                          </div>
                        );
                      }

                      return (
                        <div key={game.id} className={`bg-[#110524]/90 backdrop-blur-md p-4 rounded-xl border transition-all overflow-hidden ${
                          game.status === 'in_corso' ? 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 
                          game.status === 'finita' ? 'border-[#3d135e] opacity-60' : 'border-cyan-900/40'
                        }`}>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] text-purple-400 font-mono font-black tracking-widest drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">{game.match_time} | CAMPO {game.court} {game.bracket_code ? `| ${game.bracket_code}` : ''}</span>
                            {game.status === 'finita' && (
                              <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2} className={`text-[10px] font-black uppercase flex items-center gap-1 transition-colors ${activeLiveGamesCount >= 2 ? 'text-[#3d135e] cursor-not-allowed' : 'text-cyan-400 hover:text-cyan-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]'}`}>
                                <span>↺</span> Riapri
                              </button>
                            )}
                          </div>

                          <div className="flex justify-between items-stretch bg-[#090214]/80 p-3 rounded-lg mb-3 border border-[#3d135e]/50">
                            <div className="flex flex-col justify-between text-center w-[35%]">
                              <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'text-purple-400'}`}>{game.home_team?.name || 'TBD'}</p>
                              <p className={`text-3xl font-black mt-auto drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${game.status === 'in_corso' ? 'text-white' : 'text-purple-500'}`}>{game.home_score}</p>
                            </div>
                            
                            <div className="flex flex-col justify-center text-center w-[30%] px-1">
                              {game.status === 'programmata' && (
                                <button onClick={() => updateStatus(game.id, 'in_corso')} disabled={activeLiveGamesCount >= 2 || (!game.home_team_id || !game.away_team_id)} className={`bg-cyan-500 text-[#090214] text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest transition-all ${(!game.home_team_id || !game.away_team_id) ? 'opacity-30 cursor-not-allowed' : activeLiveGamesCount >= 2 ? 'opacity-30 cursor-not-allowed' : 'hover:shadow-[0_0_15px_rgba(6,182,212,0.8)] shadow-[0_0_8px_rgba(6,182,212,0.5)]'}`}>
                                  Avvia
                                </button>
                              )}
                              {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest shadow-[0_0_8px_rgba(236,72,153,0.6)]">Chiudi</button>}
                              {game.status === 'finita' && <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest block">Finita</span>}
                            </div>
 
                            <div className="flex flex-col justify-between text-center w-[35%]">
                              <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : 'text-purple-400'}`}>{game.away_team?.name || 'TBD'}</p>
                              <p className={`text-3xl font-black mt-auto drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] ${game.status === 'in_corso' ? 'text-white' : 'text-purple-500'}`}>{game.away_score}</p>
                            </div>
                          </div>

                          {game.status === 'in_corso' && (
                            <div className="flex justify-between items-center w-full gap-2 mt-2">
                              <div className="flex gap-1">
                                <button onClick={() => updateScore(game.id, 'home', -1, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-pink-500/50 text-pink-500 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(236,72,153,0.3)]">-1</button>
                                <button onClick={() => updateScore(game.id, 'home', 1, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+1</button>
                                <button onClick={() => updateScore(game.id, 'home', 2, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+2</button>
                                <button onClick={() => updateScore(game.id, 'home', 3, game.home_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+3</button>
                              </div>
                              <span className="text-[10px] text-purple-500 font-black italic drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">VS</span>
                              <div className="flex gap-1">
                                <button onClick={() => updateScore(game.id, 'away', -1, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-pink-500/50 text-pink-500 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(236,72,153,0.3)]">-1</button>
                                <button onClick={() => updateScore(game.id, 'away', 1, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+1</button>
                                <button onClick={() => updateScore(game.id, 'away', 2, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+2</button>
                                <button onClick={() => updateScore(game.id, 'away', 3, game.away_score)} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#1a0833] rounded border border-cyan-500/50 text-cyan-400 font-black text-xs active:scale-95 shadow-[0_0_5px_rgba(6,182,212,0.3)]">+3</button>
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
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-full py-4 bg-[#110524]/60 backdrop-blur-sm border-2 border-dashed border-cyan-500/50 rounded-xl text-cyan-400 font-black uppercase text-xs shadow-[0_0_10px_rgba(6,182,212,0.2)] tracking-widest hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all">➕ Nuova Voce Calendario</button>
                
                <div className="flex gap-2 bg-[#110524]/80 backdrop-blur-sm p-1.5 rounded-xl border border-[#3d135e] mb-6 shadow-lg">
                  <button onClick={() => setActiveScheduleTab('qualifiche')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'qualifiche' ? 'bg-cyan-500 text-[#090214] shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>Qualifiche</button>
                  <button onClick={() => setActiveScheduleTab('finali')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all ${activeScheduleTab === 'finali' ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'text-purple-400 hover:text-purple-200'}`}>Finali</button>
                </div>

                <div className="bg-[#110524]/80 backdrop-blur-md rounded-xl overflow-hidden border border-[#3d135e] shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  {(() => {
                    const list = activeScheduleTab === 'qualifiche' 
                      ? sortedGames.filter(g => !g.stage || g.stage === 'girone')
                      : sortedGames.filter(g => g.stage && g.stage !== 'girone');
                    
                    const displayList = (activeScheduleTab === 'finali' && list.length === 0) ? dummyFinals : list;

                    if (displayList.length === 0) return <div className="p-8 text-center text-purple-400 font-black uppercase tracking-widest text-[10px]">Nessun elemento in calendario.</div>;

                    return displayList.map((game, i, array) => {
                      if (game.is_event) {
                        return (
                          <div key={game.id} className="w-full flex flex-col">
                            {renderStageHeader(game, i, array)}
                            <div className="grid grid-cols-[45px_1fr_40px_30px] items-center gap-2 p-3 hover:bg-[#1a0833]/80 transition-colors bg-gradient-to-r from-[#2a063b] to-[#1a0525] border-b border-[#3d135e]">
                              <span className="font-mono text-yellow-400 text-[10px] font-black drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]">{game.match_time}</span>
                              <span className="text-[11px] font-black uppercase text-pink-400 text-center tracking-widest break-words px-2 drop-shadow-[0_0_5px_rgba(236,72,153,0.3)]">{game.event_description}</span>
                              <div className="flex justify-end pr-1"><span className="bg-pink-500 text-white font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-[0_0_5px_rgba(236,72,153,0.5)]">{game.court}</span></div>
                              <button onClick={() => setGameToEdit({ ...game })} className="text-purple-400 hover:text-cyan-400 p-2 text-right transition-colors drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">✏️</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={game.id} className="w-full flex flex-col">
                          {renderStageHeader(game, i, array)}
                          <div className={`grid grid-cols-[45px_1fr_auto_1fr_40px_30px] items-center gap-1 p-3 hover:bg-[#1a0833]/80 transition-colors ${i !== displayList.length - 1 ? 'border-b border-[#3d135e]' : ''}`}>
                            <span className="font-mono text-cyan-400 text-[10px] font-black drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">{game.match_time}</span>
                            <span className="text-[10px] font-black uppercase text-purple-100 text-right leading-tight break-words tracking-tighter">{game.home_team?.name || 'TBD'}</span>
                            <span className="text-[8px] text-purple-500 italic font-black px-1 drop-shadow-[0_0_3px_rgba(168,85,247,0.5)]">VS</span>
                            <span className="text-[10px] font-black uppercase text-purple-100 text-left leading-tight break-words tracking-tighter">{game.away_team?.name || 'TBD'}</span>
                            <div className="flex justify-end pr-1"><span className="bg-gradient-to-br from-yellow-400 to-orange-500 text-[#090214] font-black text-[10px] w-6 h-6 flex items-center justify-center rounded shadow-[0_0_5px_rgba(250,204,21,0.5)]">{game.court}</span></div>
                            {game.id.toString().startsWith('d') ? (
                              <span className="w-8"></span> 
                            ) : (
                              <button onClick={() => setGameToEdit({ ...game })} className="text-purple-400 hover:text-cyan-400 p-2 text-right transition-colors drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">✏️</button>
                            )}
                          </div>
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
                  <div key={group} className="bg-[#110524]/80 backdrop-blur-md rounded-2xl border border-cyan-500/50 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <div className="bg-[#1a0833] p-2 text-center border-b border-[#3d135e]"><h3 className="text-xs font-black uppercase text-yellow-400 tracking-widest italic drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">Girone {group}</h3></div>
                    <div className="p-2 space-y-2">
                      {teams.filter(t => t.group_name === group).map((team) => (
                        <details key={team.id} className="bg-[#090214]/60 rounded-xl border border-[#3d135e] overflow-hidden group">
                          <summary className="p-3 font-bold text-purple-100 flex justify-between items-center list-none cursor-pointer hover:bg-[#1a0833] transition-all">
                            {editingTeam?.id === team.id ? (
                              <div className="flex gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <input value={editingTeam?.name || ''} onChange={(e) => setEditingTeam(prev => prev ? {...prev, name: e.target.value} : null)} className="bg-[#090214] text-cyan-400 p-1.5 rounded text-[10px] font-black uppercase border border-cyan-500 flex-1 outline-none shadow-[0_0_5px_rgba(6,182,212,0.3)]" autoFocus />
                                <button onClick={saveTeamName} className="bg-cyan-500 text-[#090214] px-3 rounded text-[9px] font-black uppercase shadow-[0_0_8px_rgba(6,182,212,0.5)]">Ok</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between w-full"><span className="uppercase text-[10px] font-black tracking-tight drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">{team.name}</span><button onClick={(e) => { e.preventDefault(); setEditingTeam({id: team.id, name: team.name}); }} className="text-purple-400 hover:text-cyan-400 text-xs p-1 drop-shadow-[0_0_3px_rgba(6,182,212,0.5)]">✏️</button></div>
                            )}
                          </summary>
                          <div className="p-3 bg-[#090214] border-t border-[#3d135e] space-y-3">
                            <ul className="space-y-1">
                              {team.players.map((p: any) => (
                                <li key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1.5 border-b border-[#3d135e]/50 last:border-0">
                                  {editingPlayer?.id === p.id ? (
                                    <div className="flex-1 flex gap-1"><input value={editingPlayer?.name || ''} onChange={(e) => setEditingPlayer(prev => prev ? {...prev, name: e.target.value} : null)} className="bg-[#090214] text-white p-1.5 rounded w-full text-[10px] uppercase border border-cyan-500 outline-none font-black shadow-[0_0_5px_rgba(6,182,212,0.3)]" autoFocus /><button onClick={saveEditPlayer} className="bg-cyan-500 text-[#090214] px-3 py-1.5 rounded font-black text-[9px] uppercase shadow-[0_0_8px_rgba(6,182,212,0.5)]">Ok</button></div>
                                  ) : (
                                    <><span className="uppercase text-purple-200">{p.name}</span><div className="flex gap-4"><button onClick={() => setEditingPlayer({id: p.id, name: p.name})} className="text-purple-500 hover:text-cyan-400 transition-colors">✏️</button><button onClick={() => deletePlayer(p.id)} className="text-purple-500 hover:text-pink-500 transition-colors drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]">❌</button></div></>
                                  )}
                                </li>
                              ))}
                            </ul>
                            <div className="flex gap-1.5 pt-2">
                              <input placeholder="Nuovo Giocatore" className="flex-1 bg-[#110524] text-white p-2 rounded text-[10px] outline-none uppercase border border-[#3d135e] focus:border-yellow-400 focus:shadow-[0_0_5px_rgba(250,204,21,0.3)] font-black tracking-tighter transition-all" value={playerForms[team.id]?.name || ''} onChange={(e) => setPlayerForms({...playerForms, [team.id]: { name: e.target.value }})} />
                              <button onClick={() => addPlayer(team.id)} className="bg-yellow-400 text-[#090214] font-black px-4 rounded text-[10px] uppercase tracking-tighter shadow-[0_0_8px_rgba(250,204,21,0.5)]">Add</button>
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
                <div className="bg-[#110524]/80 backdrop-blur-md border border-pink-500 rounded-xl p-6 text-center shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                  <h3 className="text-pink-400 font-black uppercase tracking-widest mb-2 italic drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">Motore Tabellone</h3>
                  <p className="text-purple-300 text-xs font-bold mb-6">Assicurati che i gironi siano conclusi. Scegli lo schema degli incroci e genera le fasi finali.</p>
                  
                  <div className="mb-6 text-left">
                    <label className="text-[10px] font-black uppercase text-purple-400 block mb-2 tracking-widest">Incroci Ottavi</label>
                    <select value={playoffScheme} onChange={(e) => setPlayoffScheme(e.target.value)} className="bg-[#090214] text-white p-3 rounded-lg w-full border border-pink-500/50 text-sm font-black outline-none focus:border-pink-500 focus:shadow-[0_0_10px_rgba(236,72,153,0.3)] transition-all">
                      <option value="AB_CD">Girone A vs B  |  Girone C vs D</option>
                      <option value="AC_BD">Girone A vs C  |  Girone B vs D</option>
                      <option value="AD_BC">Girone A vs D  |  Girone B vs C</option>
                    </select>
                  </div>
                  
                  <button onClick={generateBracket} className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black uppercase text-sm px-6 py-4 rounded-xl w-full tracking-widest active:scale-95 transition-all shadow-[0_0_15px_rgba(236,72,153,0.5)] hover:shadow-[0_0_20px_rgba(236,72,153,0.8)]">
                    Genera Tabellone ⚡
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* --- MENU BASSO DINAMICO (GRIGLIA FISSA A 5 O 6) CON NEON GLOW --- */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#090214]/80 backdrop-blur-xl border-t-2 border-pink-500 shadow-[0_-15px_40px_rgba(249,115,22,0.25)] z-[200]">
        <div className={`grid ${isAdminUnlocked ? 'grid-cols-6' : 'grid-cols-5'} max-w-md mx-auto px-1 pt-2 pb-6`}>
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'home' ? 'text-pink-500 -translate-y-1 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
            <span className="text-xl sm:text-2xl">🔥</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Live</span>
          </button>
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'gironi' ? 'text-cyan-400 -translate-y-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
            <span className="text-xl sm:text-2xl">📊</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Gironi</span>
          </button>
          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'calendario' ? 'text-yellow-400 -translate-y-1 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
            <span className="text-xl sm:text-2xl">📅</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Risultati</span>
          </button>
          <button onClick={() => setActiveTab('playoff')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'playoff' ? 'text-pink-500 -translate-y-1 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
            <span className="text-xl sm:text-2xl">🏆</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Playoff</span>
          </button>
          
          {/* NUOVO TASTO SOCIAL */}
          <button onClick={() => setActiveTab('social')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'social' ? 'text-cyan-400 -translate-y-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
            <span className="text-xl sm:text-2xl">📱</span>
            <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Social</span>
          </button>
          
          {isAdminUnlocked && (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center justify-center transition-all ${activeTab === 'admin' ? 'text-white -translate-y-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-purple-400/50 hover:text-purple-200'}`}>
              <span className="text-xl sm:text-2xl">⚙️</span>
              <span className="text-[8px] font-black uppercase italic mt-1 tracking-tight">Admin</span>
            </button>
          )}
        </div>
      </nav>
{/* --- MODALE NUOVA VOCE CALENDARIO --- */}
      {isNewGameModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#090214]/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#110524] border-2 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <h3 className="text-xl font-black uppercase mb-4 text-white italic drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              Nuova Voce Calendario
            </h3>
            
            <div className="flex gap-2 mb-4 bg-[#090214] p-1 rounded-lg border border-[#3d135e]">
              <button onClick={() => setNewGame({...newGame, is_event: false})} className={`flex-1 py-2 rounded font-black text-[10px] uppercase tracking-widest transition-all ${!newGame.is_event ? 'bg-cyan-500 text-[#090214]' : 'text-purple-500'}`}>Partita</button>
              <button onClick={() => setNewGame({...newGame, is_event: true})} className={`flex-1 py-2 rounded font-black text-[10px] uppercase tracking-widest transition-all ${newGame.is_event ? 'bg-pink-600 text-white' : 'text-purple-500'}`}>Evento</button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] text-cyan-400 font-black uppercase mb-1 block">Orario</label>
                  <input type="time" value={newGame.time} onChange={(e) => setNewGame({...newGame, time: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-cyan-500 font-mono" />
                </div>
                <div className="w-24">
                  <label className="text-[10px] text-cyan-400 font-black uppercase mb-1 block">Campo</label>
                  <select value={newGame.court} onChange={(e) => setNewGame({...newGame, court: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-yellow-400 font-black uppercase mb-1 block">Fase (Stage)</label>
                <select value={newGame.stage} onChange={(e) => setNewGame({...newGame, stage: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] uppercase border border-[#3d135e] outline-none focus:border-yellow-400 font-black">
                  <option value="girone">Girone / Qualifiche</option>
                  <option value="ottavi">Ottavi</option>
                  <option value="quarti">Quarti</option>
                  <option value="semi">Semifinali</option>
                  <option value="finali">Finali</option>
                </select>
              </div>

              {newGame.is_event ? (
                <>
                  <div>
                    <label className="text-[10px] text-pink-400 font-black uppercase mb-1 block">Nome Evento</label>
                    <input type="text" placeholder="Es. Gara da 3 Punti" value={newGame.event_description} onChange={(e) => setNewGame({...newGame, event_description: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-xs border border-[#3d135e] outline-none focus:border-pink-500 uppercase font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] text-pink-400 font-black uppercase mb-1 block">Durata (min)</label>
                    <input type="number" placeholder="Es. 15" value={newGame.event_duration} onChange={(e) => setNewGame({...newGame, event_duration: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-pink-500 font-mono" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] text-purple-400 font-black uppercase mb-1 block">Squadra Casa</label>
                    <select value={newGame.home_id} onChange={(e) => setNewGame({...newGame, home_id: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] uppercase border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                      <option value="">-- TBD --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-400 font-black uppercase mb-1 block">Squadra Trasferta</label>
                    <select value={newGame.away_id} onChange={(e) => setNewGame({...newGame, away_id: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] uppercase border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                      <option value="">-- TBD --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsNewGameModalOpen(false)} className="bg-transparent border border-purple-500/50 text-purple-300 px-4 py-3 rounded-lg font-black uppercase text-[10px] hover:bg-[#1a0833] transition-all">Annulla</button>
              <button onClick={createGame} className="bg-cyan-500 text-[#090214] px-5 py-3 rounded-lg font-black uppercase text-[10px] shadow-[0_0_10px_rgba(6,182,212,0.6)] active:scale-95 transition-all">Crea</button>
            </div>
          </div>
        </div>
      )}

{/* --- MODALE EDIT PARTITA / EVENTO --- */}
      {gameToEdit && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#090214]/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#110524] border-2 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <h3 className="text-xl font-black uppercase mb-4 text-white italic drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">
              Modifica {gameToEdit.is_event ? 'Evento' : 'Partita'}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] text-cyan-400 font-black uppercase mb-1 block">Orario</label>
                  <input type="time" value={gameToEdit.match_time} onChange={(e) => setGameToEdit({...gameToEdit, match_time: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-cyan-500 font-mono" />
                </div>
                <div className="w-24">
                  <label className="text-[10px] text-cyan-400 font-black uppercase mb-1 block">Campo</label>
                  <select value={gameToEdit.court} onChange={(e) => setGameToEdit({...gameToEdit, court: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              </div>

              {gameToEdit.is_event ? (
                <>
                  <div>
                    <label className="text-[10px] text-pink-400 font-black uppercase mb-1 block">Descrizione</label>
                    <input type="text" value={gameToEdit.event_description || ''} onChange={(e) => setGameToEdit({...gameToEdit, event_description: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-xs border border-[#3d135e] outline-none focus:border-pink-500 uppercase font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] text-pink-400 font-black uppercase mb-1 block">Durata (min)</label>
                    <input type="number" value={gameToEdit.event_duration || 0} onChange={(e) => setGameToEdit({...gameToEdit, event_duration: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-sm border border-[#3d135e] outline-none focus:border-pink-500 font-mono" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] text-purple-400 font-black uppercase mb-1 block">Squadra Casa</label>
                    <select value={gameToEdit.home_team_id || ''} onChange={(e) => setGameToEdit({...gameToEdit, home_team_id: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] uppercase border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                      <option value="">-- TBD --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-400 font-black uppercase mb-1 block">Squadra Trasferta</label>
                    <select value={gameToEdit.away_team_id || ''} onChange={(e) => setGameToEdit({...gameToEdit, away_team_id: e.target.value})} className="w-full bg-[#090214] text-white p-3 rounded-lg text-[11px] uppercase border border-[#3d135e] outline-none focus:border-cyan-500 font-black">
                      <option value="">-- TBD --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between items-center mt-6">
              <button onClick={() => deleteGame(gameToEdit.id)} className="text-pink-500 font-black text-[10px] uppercase hover:text-pink-400 drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]">🗑️ Elimina</button>
              <div className="flex gap-2">
                <button onClick={() => setGameToEdit(null)} className="bg-transparent border border-purple-500/50 text-purple-300 px-4 py-3 rounded-lg font-black uppercase text-[10px] hover:bg-[#1a0833] transition-all">Annulla</button>
                <button onClick={saveQuickEdit} className="bg-cyan-500 text-[#090214] px-5 py-3 rounded-lg font-black uppercase text-[10px] shadow-[0_0_10px_rgba(6,182,212,0.6)] active:scale-95 transition-all">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* --- MODALE ALERTS / CONFERME --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#090214]/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#110524] border-2 border-yellow-400 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_30px_rgba(250,204,21,0.3)]">
            <h3 className="text-2xl font-black uppercase mb-2 text-white italic drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{modal.title}</h3>
            <p className="text-purple-200 font-bold mb-8 text-sm leading-tight uppercase tracking-tight">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' && <button onClick={closeModal} className="bg-[#1a0833] border border-[#3d135e] text-purple-300 px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-[#260c49] transition-all">Annulla</button>}
              <button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className="bg-yellow-400 text-[#090214] px-5 py-2 rounded-lg font-black uppercase text-[10px] shadow-[0_0_10px_rgba(250,204,21,0.6)] active:scale-95 transition-all">Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE SEGRETA ADMIN (EASTER EGG) --- */}
      {isSecretLoginOpen && !user && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#090214]/95 backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-[#110524] border border-cyan-500 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_40px_rgba(6,182,212,0.4)] relative">
            
            <button onClick={() => setIsSecretLoginOpen(false)} className="absolute top-4 right-4 text-cyan-500/50 hover:text-cyan-400 font-black text-xl drop-shadow-[0_0_5px_rgba(6,182,212,0.8)] transition-all">✕</button>

            <div className="mb-8 text-center mt-2">
              <h3 className="font-black uppercase italic tracking-widest mb-2 text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">Area Staff</h3>
              <p className="text-pink-500 text-[10px] font-bold uppercase tracking-widest drop-shadow-[0_0_3px_rgba(236,72,153,0.5)]">Accesso riservato al tavolo giuria.</p>
            </div>

            <div className="space-y-4 mb-8">
              <input type="email" placeholder="Email Staff" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#090214] text-cyan-300 p-4 rounded-xl border border-cyan-900 text-sm outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] font-mono transition-all" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#090214] text-cyan-300 p-4 rounded-xl border border-cyan-900 text-sm outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] font-mono transition-all" />
            </div>

            <button 
              onClick={handleAuthAction} 
              disabled={isAuthLoading} 
              className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${isAuthLoading ? 'opacity-50 cursor-not-allowed bg-[#1a0833] text-purple-500' : 'bg-cyan-500 text-[#090214] shadow-[0_0_15px_rgba(6,182,212,0.6)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)] active:scale-95'}`}
            >
              {isAuthLoading ? 'Verifica...' : 'Sblocca Controlli'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}