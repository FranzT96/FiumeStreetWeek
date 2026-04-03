'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const [activeAdminSubTab, setActiveAdminSubTab] = useState('live'); 
  
  const [newGame, setNewGame] = useState({ home_id: '', away_id: '', time: '18:00', court: 'A' });
  const [playerForms, setPlayerForms] = useState<Record<number, { name: string }>>({});
  const [editingPlayer, setEditingPlayer] = useState<{ id: number, name: string } | null>(null);
  const [editingTeam, setEditingTeam] = useState<{ id: number, name: string } | null>(null);
  
  const [gameToEdit, setGameToEdit] = useState<any | null>(null);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void; }>({ isOpen: false, title: '', message: '', type: 'alert' });

  // --- STATI PER AUTH ED EASTER EGG ---
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();
  const groups = ['A', 'B', 'C', 'D'];

  const fetchData = async () => {
    const { data: teamsData } = await supabase.from('teams').select('*, players(*)').order('points', { ascending: false }).order('wins', { ascending: false });
    const { data: gamesData } = await supabase.from('games').select('id, home_score, away_score, status, match_time, court, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)').order('match_time').order('id');
    if (teamsData) setTeams(teamsData);
    if (gamesData) setGames(gamesData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsAdminUnlocked(true);
    };
    checkSession();

    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    const channelPlayers = supabase.channel('realtime-players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchData(); }).subscribe();
    
    return () => { 
      supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); supabase.removeChannel(channelPlayers); 
    };
  }, []);

  const closeModal = () => setModal({ ...modal, isOpen: false });
  const showAlert = (title: string, message: string) => setModal({ isOpen: true, title, message, type: 'alert' });

  // --- LOGICA EASTER EGG CON PROTEZIONE LOGIN ---
  const handlePointerDown = () => {
    pressTimerRef.current = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(150);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAdminUnlocked(true);
        setActiveTab('admin');
      } else {
        setIsLoginModalOpen(true);
      }
    }, 3000);
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAlert("Errore Login", "Credenziali non valide. Riprova.");
    } else {
      setIsAdminUnlocked(true);
      setIsLoginModalOpen(false);
      setActiveTab('admin');
      setEmail('');
      setPassword('');
    }
  };

  // --- AZZERA TORNEO ---
  const resetTournament = () => {
    setModal({
      isOpen: true,
      title: "⚠️ ATTENZIONE",
      message: "Sei sicuro? Verranno azzerati tutti i punteggi e le classifiche torneranno a zero. Le squadre, i roster e il calendario dei match rimarranno intatti.",
      type: 'confirm',
      onConfirm: async () => {
        closeModal();
        setLoading(true);
        await supabase.from('games').update({ home_score: 0, away_score: 0, status: 'programmata' }).neq('id', -1);
        await supabase.from('teams').update({ points: 0, wins: 0, losses: 0, pf: 0, ps: 0 }).neq('id', -1);
        await fetchData();
      }
    });
  };

  // --- SCORE LOGIC (OPTIMISTIC) ---
  const updateScore = async (gameId: number, teamType: 'home' | 'away', pointsToAdd: number, currentScore: number) => {
    const field = teamType === 'home' ? 'home_score' : 'away_score';
    const newScore = Math.max(0, currentScore + pointsToAdd);
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: newScore } : g));
    await supabase.from('games').update({ [field]: newScore }).eq('id', gameId);
  };

  // --- STATUS LOGIC (FINISH / REOPEN / START) ---
  const updateStatus = async (gameId: number, newStatus: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    if (newStatus === 'in_corso' && game.status !== 'in_corso') {
      const liveCount = games.filter(g => g.status === 'in_corso').length;
      if (liveCount >= 2) {
        showAlert("Limite Raggiunto", "Ci sono già 2 partite in corso. Chiudine una prima di avviarne un'altra.");
        return;
      }
    }

    if (newStatus === 'finita' && game.status !== 'finita') {
      const homeWon = game.home_score > game.away_score;
      const awayWon = game.away_score > game.home_score;
      const { data: dbGame } = await supabase.from('games').select('home_team_id, away_team_id').eq('id', gameId).single();
      if (dbGame) {
        const { data: homeTeam } = await supabase.from('teams').select('*').eq('id', dbGame.home_team_id).single();
        const { data: awayTeam } = await supabase.from('teams').select('*').eq('id', dbGame.away_team_id).single();
        if (homeTeam && awayTeam) {
          await supabase.from('teams').update({ points: homeTeam.points + (homeWon ? 2 : 0), wins: homeTeam.wins + (homeWon ? 1 : 0), losses: homeTeam.losses + (awayWon ? 1 : 0), pf: homeTeam.pf + game.home_score, ps: homeTeam.ps + game.away_score }).eq('id', dbGame.home_team_id);
          await supabase.from('teams').update({ points: awayTeam.points + (awayWon ? 2 : 0), wins: awayTeam.wins + (awayWon ? 1 : 0), losses: awayTeam.losses + (homeWon ? 1 : 0), pf: awayTeam.pf + game.away_score, ps: awayTeam.ps + game.home_score }).eq('id', dbGame.away_team_id);
        }
      }
    } 
    
    if (newStatus === 'in_corso' && game.status === 'finita') {
      const homeWon = game.home_score > game.away_score;
      const awayWon = game.away_score > game.home_score;
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
    await supabase.from('games').update({ status: newStatus }).eq('id', gameId);
    fetchData();
  };

  const saveQuickEdit = async () => {
    if (!gameToEdit) return;
    await supabase.from('games').update({ match_time: gameToEdit.match_time, court: gameToEdit.court }).eq('id', gameToEdit.id);
    setGameToEdit(null);
    fetchData();
  };

  const createGame = async () => {
    if (!newGame.home_id || !newGame.away_id) return;
    await supabase.from('games').insert({ home_team_id: parseInt(newGame.home_id), away_team_id: parseInt(newGame.away_id), match_time: newGame.time, court: newGame.court, status: 'programmata' });
    setNewGame({ home_id: '', away_id: '', time: '18:00', court: 'A' });
    setIsNewGameModalOpen(false);
    fetchData();
  };

  const deleteGame = (id: number) => {
    setGameToEdit(null);
    setModal({ isOpen: true, title: "Elimina", message: "Cancellare questo match?", type: 'confirm', onConfirm: async () => { await supabase.from('games').delete().eq('id', id); fetchData(); closeModal(); } });
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

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-cyan-400 font-black uppercase italic animate-pulse tracking-widest">Sincronizzazione...</div>;

  const liveGames = games.filter(g => g.status === 'in_corso').slice(0, 2);
  const nextGames = games.filter(g => g.status === 'programmata').slice(0, 2);
  const activeLiveGamesCount = games.filter(g => g.status === 'in_corso').length;

  const navItemClass = isAdminUnlocked ? "w-1/5" : "w-1/4";

  return (
    <main className="min-h-screen bg-[#0f172a] p-3 md:p-8 font-sans text-slate-200 pb-24 select-none">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* LOGO: Visibile SOLO ed ESCLUSIVAMENTE nel tab 'home' */}
        {activeTab === 'home' && (
          <div className="flex justify-center items-center mb-8 pt-4 animate-fade-in">
            <img 
              src="/icon.png" 
              alt="Fiume Street Week Logo" 
              className="w-56 md:w-80 h-auto drop-shadow-[0_0_15px_rgba(236,72,153,0.4)] object-contain" 
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()} 
              style={{ WebkitTouchCallout: 'none', userSelect: 'none' }} 
            />
          </div>
        )}

        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-8">
            <div>
              <h2 className="text-xl font-black text-pink-500 uppercase flex items-center gap-2 border-b-2 border-slate-800 pb-2 italic mb-4">
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span> Live Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveGames.length === 0 ? (
                  <p className="text-slate-600 font-black uppercase text-[10px] italic tracking-widest bg-slate-900/50 p-6 rounded-xl border border-slate-800">Nessun match in corso...</p>
                ) : liveGames.map(game => (
                    <div key={game.id} className="bg-slate-900 border-2 border-pink-500 rounded-xl p-4 flex justify-between items-stretch relative shadow-[6px_6px_0px_0px_rgba(6,182,212,1)] overflow-hidden">
                      <div className="absolute top-0 right-0 bg-orange-500 text-black font-black text-[9px] px-3 py-1.5 rounded-bl-lg rounded-tr-[10px] uppercase z-10">CAMPO {game.court}</div>
                      
                      <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                        <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words">{game.home_team.name}</p>
                        <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.home_score}</p>
                      </div>
                      
                      <div className="flex flex-col justify-center text-center w-[20%] mt-4">
                        <span className="text-pink-500 font-black italic animate-pulse">VS</span>
                      </div>
                      
                      <div className="flex flex-col justify-between text-center w-[40%] mt-4">
                        <p className="text-[10px] text-cyan-400 font-black uppercase mb-1 leading-tight break-words">{game.away_team.name}</p>
                        <p className="text-4xl sm:text-5xl font-black text-white mt-auto">{game.away_score}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {nextGames.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest italic">🔜 Prossime Partite</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextGames.map(game => (
                    <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_25px] items-center gap-1 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 shadow-lg">
                      <div className="font-mono font-black text-orange-500 text-xs">{game.match_time}</div>
                      <div className="text-right font-bold text-slate-300 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team.name}</div>
                      <div className="text-center text-slate-600 font-black italic text-[10px] px-1">VS</div>
                      <div className="text-left font-bold text-slate-300 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team.name}</div>
                      <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded shadow-sm">{game.court}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* --- GIRONI --- */}
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
          <section className="animate-fade-in space-y-4">
            <h2 className="text-xl font-black text-orange-500 uppercase border-b-2 border-slate-800 pb-2 italic tracking-widest pt-4">Calendario Match</h2>
            <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {games.map((game, i) => (
                <div key={game.id} className={`grid grid-cols-[45px_1fr_auto_1fr_25px] items-center gap-1 p-3 ${i !== games.length - 1 ? 'border-b border-slate-800' : ''}`}>
                  <div className="font-mono font-black text-pink-500 text-[10px]">{game.match_time}</div>
                  
                  <div className="text-right font-black text-cyan-400 text-[10px] uppercase leading-tight break-words pr-1">{game.home_team.name}</div>
                  
                  <div className="flex justify-center items-center px-1">
                    {game.status === 'finita' ? (
                      <div className="bg-slate-800 border-2 border-slate-700 px-1.5 py-0.5 rounded text-white font-black text-[10px] shadow-sm">{game.home_score}-{game.away_score}</div>
                    ) : <div className="text-slate-600 font-black italic text-[9px]">VS</div>}
                  </div>
                  
                  <div className="text-left font-black text-cyan-400 text-[10px] uppercase leading-tight break-words pl-1">{game.away_team.name}</div>
                  
                  <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[9px] px-1.5 py-0.5 rounded">{game.court}</span></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- ADMIN AREA --- */}
        {activeTab === 'admin' && isAdminUnlocked && (
          <section className="animate-fade-in space-y-6">
            
            {/* INTESTAZIONE CON BIDONCINO ALLINEATO */}
            <div className="flex justify-between items-end border-b-2 border-orange-500 pb-2 pt-4">
              <h2 className="text-2xl font-black text-orange-500 uppercase italic m-0 leading-none">Control Panel</h2>
              {activeAdminSubTab === 'live' && (
                <button onClick={resetTournament} className="bg-red-600/20 text-red-500 border border-red-500/50 p-2 rounded-lg hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-lg" title="Azzera Punteggi e Classifiche">
                  🗑️
                </button>
              )}
            </div>

            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button onClick={() => setActiveAdminSubTab('live')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'live' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500'}`}>🟢 Live</button>
              <button onClick={() => setActiveAdminSubTab('orari')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'orari' ? 'bg-cyan-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>📅 Orari</button>
              <button onClick={() => setActiveAdminSubTab('roster')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'roster' ? 'bg-orange-500 text-slate-900 shadow-md' : 'text-slate-500'}`}>🏀 Roster</button>
            </div>

            {/* LIVE CONTROL */}
            {activeAdminSubTab === 'live' && (
              <div className="grid grid-cols-1 gap-6 pb-20">
                {games.map(game => (
                  <div key={game.id} className={`bg-slate-900 p-4 rounded-xl border-2 transition-all overflow-hidden ${
                    game.status === 'in_corso' 
                      ? 'border-pink-500 shadow-[6px_6px_0px_0px_rgba(6,182,212,1)]' 
                      : 'border-slate-800 opacity-80'
                  }`}>
                    
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-slate-500 font-mono font-black tracking-widest">{game.match_time} | CAMPO {game.court}</span>
                      {game.status === 'finita' && (
                        <button 
                          onClick={() => updateStatus(game.id, 'in_corso')} 
                          disabled={activeLiveGamesCount >= 2}
                          className={`text-[10px] font-black uppercase flex items-center gap-1 transition-colors ${activeLiveGamesCount >= 2 ? 'text-slate-600 cursor-not-allowed' : 'text-pink-500 hover:text-pink-400'}`}
                        >
                          <span>↺</span> Riapri
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-stretch bg-black p-3 rounded-lg mb-3">
                      
                      <div className="flex flex-col justify-between text-center w-[35%]">
                        <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400' : 'text-slate-500'}`}>{game.home_team.name}</p>
                        <p className={`text-3xl font-black mt-auto ${game.status === 'in_corso' ? 'text-white' : 'text-slate-400'}`}>{game.home_score}</p>
                      </div>
                      
                      <div className="flex flex-col justify-center text-center w-[30%] px-1">
                        {game.status === 'programmata' && (
                          <button 
                            onClick={() => updateStatus(game.id, 'in_corso')} 
                            disabled={activeLiveGamesCount >= 2}
                            className={`bg-cyan-500 text-black text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest transition-opacity ${activeLiveGamesCount >= 2 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            Avvia
                          </button>
                        )}
                        {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-3 py-1.5 rounded-md w-full uppercase tracking-widest">Chiudi</button>}
                        {game.status === 'finita' && <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block">Finita</span>}
                      </div>

                      <div className="flex flex-col justify-between text-center w-[35%]">
                        <p className={`text-[10px] font-black uppercase mb-1 leading-tight break-words ${game.status === 'in_corso' ? 'text-cyan-400' : 'text-slate-500'}`}>{game.away_team.name}</p>
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
                ))}
              </div>
            )}

            {/* ORARI ADMIN */}
            {activeAdminSubTab === 'orari' && (
              <div className="space-y-4 pb-20">
                <button onClick={() => setIsNewGameModalOpen(true)} className="w-full py-4 bg-slate-900 border-2 border-dashed border-cyan-500/50 rounded-xl text-cyan-400 font-black uppercase text-xs shadow-lg tracking-widest">➕ Nuova Partita</button>
                <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                  {games.map(game => (
                    <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_25px_30px] items-center gap-1 p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                      <span className="font-mono text-cyan-400 text-[10px] font-black">{game.match_time}</span>
                      <span className="text-[10px] font-black uppercase text-slate-200 text-right leading-tight break-words tracking-tighter">{game.home_team.name}</span>
                      <span className="text-[8px] text-slate-600 italic font-black px-1">VS</span>
                      <span className="text-[10px] font-black uppercase text-slate-200 text-left leading-tight break-words tracking-tighter">{game.away_team.name}</span>
                      <span className="text-orange-500 text-[10px] font-black text-center">{game.court}</span>
                      <button onClick={() => setGameToEdit({ ...game })} className="text-slate-500 hover:text-cyan-400 p-2 text-right">✏️</button>
                    </div>
                  ))}
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
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t-4 border-cyan-500 z-50">
        <div className="flex justify-around items-center max-w-lg mx-auto p-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center ${navItemClass} ${activeTab === 'home' ? 'text-pink-500' : 'text-slate-500'}`}><span className="text-xl mb-1">🔥</span><span className="text-[8px] font-black uppercase italic tracking-widest font-black">Live</span></button>
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center ${navItemClass} ${activeTab === 'gironi' ? 'text-cyan-400' : 'text-slate-500'}`}><span className="text-xl mb-1">📊</span><span className="text-[8px] font-black uppercase italic tracking-widest font-black">Gironi</span></button>
          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center ${navItemClass} ${activeTab === 'calendario' ? 'text-orange-500' : 'text-slate-500'}`}><span className="text-xl mb-1">📅</span><span className="text-[8px] font-black uppercase italic tracking-widest font-black">Orari</span></button>
          {isAdminUnlocked && (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center w-1/5 animate-fade-in ${activeTab === 'admin' ? 'text-white' : 'text-slate-500'}`}><span className="text-xl mb-1">⚙️</span><span className="text-[8px] font-black uppercase italic tracking-widest text-white font-black">Admin</span></button>
          )}
        </div>
      </nav>

      {/* --- MODALE LOGIN --- */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-cyan-500 rounded-2xl p-8 max-w-xs w-full shadow-2xl">
            <h3 className="text-2xl font-black uppercase mb-6 text-center text-cyan-400 italic tracking-widest">Admin Login</h3>
            <div className="space-y-4 mb-8">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-xs outline-none focus:border-cyan-500 font-mono" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black text-white p-4 rounded-xl border border-slate-800 text-xs outline-none focus:border-cyan-500 font-mono" />
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleLogin} className="bg-cyan-500 text-slate-900 py-4 rounded-xl font-black uppercase text-xs shadow-lg tracking-widest w-full">Entra</button>
              <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-500 py-2 font-black uppercase text-[10px] tracking-widest w-full">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALI CREA/EDIT/CONFERMA --- */}
      {isNewGameModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black uppercase mb-4 text-cyan-400 border-b border-slate-800 pb-2 italic tracking-widest font-black">Crea Partita</h3>
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-1 gap-3">
                <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Squadra Casa</label><select value={newGame.home_id} onChange={(e) => setNewGame({...newGame, home_id: e.target.value})} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-xs outline-none focus:border-cyan-500 font-black"><option value="">Seleziona...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Squadra Ospite</label><select value={newGame.away_id} onChange={(e) => setNewGame({...newGame, away_id: e.target.value})} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-xs outline-none focus:border-cyan-500 font-black"><option value="">Seleziona...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Orario</label><input type="time" value={newGame.time} onChange={(e) => setNewGame({...newGame, time: e.target.value})} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-sm font-mono outline-none focus:border-cyan-500 font-black" /></div>
                <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Campo</label><select value={newGame.court} onChange={(e) => setNewGame({...newGame, court: e.target.value})} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-sm font-black outline-none focus:border-cyan-500 font-black"><option value="A">Campo A</option><option value="B">Campo B</option></select></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={createGame} className="bg-cyan-500 text-slate-900 py-4 rounded-xl font-black uppercase text-xs shadow-lg shadow-cyan-500/20 tracking-widest font-black">Conferma e Crea</button>
              <button onClick={() => setIsNewGameModalOpen(false)} className="text-slate-500 py-2 font-black uppercase text-[10px] tracking-widest font-black">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {gameToEdit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black uppercase mb-4 text-cyan-400 border-b border-slate-800 pb-2 italic tracking-widest font-black">Modifica Partita</h3>
            <div className="space-y-4 mb-8 text-center">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-tighter font-black tracking-widest">{gameToEdit.home_team.name} vs {gameToEdit.away_team.name}</p>
              <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Orario</label><input type="time" value={gameToEdit.match_time} onChange={(e) => setGameToEdit({ ...gameToEdit, match_time: e.target.value })} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-sm font-mono outline-none focus:border-cyan-500 font-black" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1 tracking-widest font-black">Campo</label><select value={gameToEdit.court} onChange={(e) => setGameToEdit({ ...gameToEdit, court: e.target.value })} className="bg-black text-white p-3 rounded-lg w-full border border-slate-800 text-sm font-black outline-none focus:border-cyan-500 font-black"><option value="A">Campo A</option><option value="B">Campo B</option></select></div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={saveQuickEdit} className="bg-cyan-500 text-slate-900 py-3 rounded-xl font-black uppercase text-xs shadow-lg tracking-widest font-black">Salva Modifiche</button>
              <div className="flex gap-2"><button onClick={() => deleteGame(gameToEdit.id)} className="flex-1 bg-pink-600 text-white py-2 rounded-xl font-black uppercase text-[10px] tracking-widest font-black shadow-lg shadow-pink-500/20">Elimina Match</button><button onClick={() => setGameToEdit(null)} className="flex-1 bg-slate-800 text-slate-400 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest font-black">Chiudi</button></div>
            </div>
          </div>
        </div>
      )}

      {modal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-pink-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(236,72,153,1)]">
            <h3 className="text-2xl font-black uppercase mb-2 text-white italic tracking-tighter tracking-widest font-black">{modal.title}</h3>
            <p className="text-slate-300 font-bold mb-8 text-sm leading-tight uppercase tracking-tight tracking-widest">{modal.message}</p>
            <div className="flex justify-end gap-3">{modal.type === 'confirm' && <button onClick={closeModal} className="bg-slate-800 text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest font-black">Annulla</button>}<button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className="bg-pink-500 text-white px-5 py-2 rounded-lg font-black uppercase text-[10px] shadow-lg tracking-widest font-black">Procedi</button></div>
          </div>
        </div>
      )}
    </main>
  );
}