'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('live');
  
  const [newGame, setNewGame] = useState({ home_id: '', away_id: '', time: '18:00', court: 'A' });
  const [playerForms, setPlayerForms] = useState<Record<number, { name: string }>>({});
  const [editingPlayer, setEditingPlayer] = useState<{ id: number, name: string } | null>(null);

  const [modal, setModal] = useState<{
    isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      fetchData();
    };
    checkUserAndFetchData();
  }, [router, supabase]);

  const fetchData = async () => {
    const { data: gamesData } = await supabase.from('games').select('id, home_team_id, away_team_id, home_score, away_score, status, match_time, court, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)').order('match_time').order('id');
    const { data: teamsData } = await supabase.from('teams').select('*, players(*)').order('group_name').order('id');
    
    if (gamesData) setGames(gamesData);
    if (teamsData) setTeams(teamsData);
    setLoading(false);
  };

  const showAlert = (title: string, message: string) => setModal({ isOpen: true, title, message, type: 'alert' });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModal({ ...modal, isOpen: false });

  const createGame = async () => {
    if (!newGame.home_id || !newGame.away_id) return showAlert("Attenzione", "Seleziona entrambe le squadre!");
    if (newGame.home_id === newGame.away_id) return showAlert("Alt Lì!", "Una squadra non può giocare contro se stessa!");

    const { error } = await supabase.from('games').insert({
      home_team_id: parseInt(newGame.home_id), away_team_id: parseInt(newGame.away_id), match_time: newGame.time, court: newGame.court, status: 'programmata'
    });

    if (error) showAlert("Errore", "Si è verificato un errore nella creazione della partita.");
    else { setNewGame({ ...newGame, home_id: '', away_id: '' }); fetchData(); }
  };

  const deleteGame = (id: number) => {
    showConfirm("Elimina Partita", "Sei sicuro di voler eliminare definitivamente questa partita dal calendario?", async () => {
      await supabase.from('games').delete().eq('id', id); fetchData(); closeModal();
    });
  };

  const updateScore = async (gameId: number, teamType: 'home' | 'away', pointsToAdd: number, currentScore: number) => {
    const field = teamType === 'home' ? 'home_score' : 'away_score';
    const newScore = Math.max(0, currentScore + pointsToAdd);
    setGames(games.map(g => g.id === gameId ? { ...g, [field]: newScore } : g));
    await supabase.from('games').update({ [field]: newScore }).eq('id', gameId);
  };

  const updateStatus = async (gameId: number, newStatus: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

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
    setGames(games.map(g => g.id === gameId ? { ...g, status: newStatus } : g));
    await supabase.from('games').update({ status: newStatus }).eq('id', gameId);
  };

  const saveMatchTime = async (gameId: number, newTime: string) => {
    await supabase.from('games').update({ match_time: newTime }).eq('id', gameId); fetchData();
  };

  const updateCourt = async (gameId: number, newCourt: string) => {
    setGames(games.map(g => g.id === gameId ? { ...g, court: newCourt } : g));
    await supabase.from('games').update({ court: newCourt }).eq('id', gameId);
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
    setEditingPlayer(null); 
    fetchData(); 
  };

  const deletePlayer = (id: number) => {
    showConfirm("Rimuovi Giocatore", "Sei sicuro di voler cacciare questo giocatore dal team?", async () => {
      await supabase.from('players').delete().eq('id', id); fetchData(); closeModal();
    });
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-cyan-400 font-bold uppercase tracking-widest">Caricamento...</div>;

  const liveGamesCount = games.filter(g => g.status === 'in_corso').length;

  return (
    <main className="min-h-screen bg-[#0f172a] p-4 font-sans text-slate-200">
      <div className="max-w-6xl mx-auto pb-10">
        
        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border-2 border-cyan-500 mb-6">
          <h1 className="text-xl md:text-2xl font-black text-orange-500 uppercase">Dashboard Admin</h1>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded text-xs uppercase">Esci</button>
        </div>

        <div className="flex gap-2 mb-8 bg-slate-900 p-2 rounded-xl border border-slate-700">
          <button onClick={() => setActiveTab('live')} className={`flex-1 py-3 px-2 rounded-lg font-black uppercase text-xs sm:text-sm tracking-tighter ${activeTab === 'live' ? 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>🔴 Live ({liveGamesCount}/2)</button>
          <button onClick={() => setActiveTab('orari')} className={`flex-1 py-3 px-2 rounded-lg font-black uppercase text-xs sm:text-sm tracking-tighter ${activeTab === 'orari' ? 'bg-cyan-500 text-slate-900 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>📅 Calendario</button>
          <button onClick={() => setActiveTab('roster')} className={`flex-1 py-3 px-2 rounded-lg font-black uppercase text-xs sm:text-sm tracking-tighter ${activeTab === 'roster' ? 'bg-orange-500 text-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>🏀 Roster</button>
        </div>
        
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {games.map((game) => (
              <div key={game.id} className={`bg-slate-900 p-4 rounded-xl border-2 flex flex-col gap-4 ${game.status === 'in_corso' ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-slate-800'}`}>
                <div className="flex justify-between items-center bg-black p-4 rounded-lg border-2 border-cyan-900 relative">
                  <span className="absolute top-2 left-2 text-[10px] text-cyan-500 font-mono font-bold uppercase">{game.match_time || '--:--'}</span>
                  <span className="absolute top-2 right-2 text-[9px] bg-orange-500 text-black px-1.5 py-0.5 rounded font-black uppercase">CAMPO {game.court || '-'}</span>
                  
                  <div className="text-center w-1/3 mt-4"><p className="text-[10px] text-slate-400 uppercase font-bold truncate">{game.home_team.name}</p><p className="text-4xl font-black text-orange-500">{game.home_score}</p></div>
                  <div className="text-center w-1/3 flex flex-col items-center gap-2 mt-4">
                    <span className="text-[9px] font-black text-cyan-400 uppercase">{game.status.replace('_', ' ')}</span>
                    {game.status === 'programmata' && (<button onClick={() => updateStatus(game.id, 'in_corso')} disabled={liveGamesCount >= 2} className={`text-[10px] font-black py-2 px-2 rounded w-full uppercase ${liveGamesCount >= 2 ? 'bg-slate-800 text-slate-600' : 'bg-orange-500 text-black'}`}>Avvia</button>)}
                    {game.status === 'in_corso' && (<button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[10px] font-black py-2 px-2 rounded w-full uppercase">Termina</button>)}
                  </div>
                  <div className="text-center w-1/3 mt-4"><p className="text-[10px] text-slate-400 uppercase font-bold truncate">{game.away_team.name}</p><p className="text-4xl font-black text-orange-500">{game.away_score}</p></div>
                </div>
                {game.status === 'in_corso' && (
                  <div className="flex justify-between gap-4">
                    <div className="flex gap-1 w-1/2 justify-start">
                      <button onClick={() => updateScore(game.id, 'home', -1, game.home_score)} className="bg-slate-800 border border-slate-700 text-pink-500 font-black w-10 h-10 rounded-lg">-1</button>
                      <button onClick={() => updateScore(game.id, 'home', 1, game.home_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+1</button>
                      <button onClick={() => updateScore(game.id, 'home', 2, game.home_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+2</button>
                    </div>
                    <div className="flex gap-1 w-1/2 justify-end">
                      <button onClick={() => updateScore(game.id, 'away', -1, game.away_score)} className="bg-slate-800 border border-slate-700 text-pink-500 font-black w-10 h-10 rounded-lg">-1</button>
                      <button onClick={() => updateScore(game.id, 'away', 1, game.away_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+1</button>
                      <button onClick={() => updateScore(game.id, 'away', 2, game.away_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+2</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orari' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 rounded-2xl border-4 border-cyan-500 p-6 shadow-[8px_8px_0px_0px_rgba(249,115,22,1)]">
              <h2 className="text-xl font-black text-white uppercase mb-4 tracking-widest flex items-center gap-2">➕ Aggiungi Partita</h2>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_auto] gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-black text-cyan-500 uppercase mb-1">Squadra Casa</label>
                  <select value={newGame.home_id} onChange={(e) => setNewGame({...newGame, home_id: e.target.value})} className="w-full bg-black border border-slate-700 text-white p-2 rounded-lg text-sm outline-none focus:border-cyan-500">
                    <option value="">Seleziona...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>[{t.group_name}] {t.name}</option>)}
                  </select>
                </div>
                <div className="text-center font-black text-slate-600 hidden md:block pb-2 italic">VS</div>
                <div>
                  <label className="block text-[10px] font-black text-cyan-500 uppercase mb-1">Squadra Trasferta</label>
                  <select value={newGame.away_id} onChange={(e) => setNewGame({...newGame, away_id: e.target.value})} className="w-full bg-black border border-slate-700 text-white p-2 rounded-lg text-sm outline-none focus:border-cyan-500">
                    <option value="">Seleziona...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>[{t.group_name}] {t.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="w-24">
                    <label className="block text-[10px] font-black text-cyan-500 uppercase mb-1">Ora</label>
                    <input type="time" value={newGame.time} onChange={(e) => setNewGame({...newGame, time: e.target.value})} className="w-full bg-black border border-slate-700 text-white p-2 rounded-lg text-sm outline-none focus:border-cyan-500" />
                  </div>
                  <div className="w-16">
                    <label className="block text-[10px] font-black text-cyan-500 uppercase mb-1">Campo</label>
                    <select value={newGame.court} onChange={(e) => setNewGame({...newGame, court: e.target.value})} className="w-full bg-black border border-slate-700 text-white p-2 rounded-lg text-sm outline-none focus:border-cyan-500 font-bold">
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                  </div>
                </div>
                <button onClick={createGame} className="bg-orange-500 hover:bg-orange-600 text-black font-black px-4 rounded-lg uppercase text-xs h-[38px] w-full md:w-auto">Crea</button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <h3 className="bg-slate-800 p-3 text-xs font-black uppercase text-slate-400">Match Esistenti (Modifica Orari e Campo)</h3>
              {games.map((game) => (
                <div key={game.id} className="flex justify-between items-center p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <input type="time" value={game.match_time || ''} onChange={(e) => setGames(games.map(g => g.id === game.id ? {...g, match_time: e.target.value} : g))} onBlur={(e) => saveMatchTime(game.id, e.target.value)} className="bg-black border border-cyan-900 text-cyan-400 font-mono text-xs sm:text-sm p-1.5 rounded outline-none w-[90px] sm:w-[110px]" />
                    <select value={game.court || 'A'} onChange={(e) => updateCourt(game.id, e.target.value)} className="bg-black border border-orange-900 text-orange-500 font-black text-xs sm:text-sm p-1.5 rounded outline-none w-[45px] sm:w-[50px] text-center">
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                    <span className="text-[10px] sm:text-xs font-black uppercase truncate text-slate-300 ml-1">{game.home_team.name} <span className="text-slate-600 italic">vs</span> {game.away_team.name}</span>
                  </div>
                  <button onClick={() => deleteGame(game.id)} className="text-slate-600 hover:text-pink-500 ml-2 sm:ml-4 p-2">❌</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {teams.map(team => (
              <div key={team.id} className="bg-slate-900 rounded-xl border-2 border-orange-500/50 p-4">
                <h3 className="text-sm font-black text-white uppercase mb-3 flex justify-between">{team.name} <span className="text-orange-500">GIRONE {team.group_name}</span></h3>
                <div className="bg-slate-800/50 rounded-lg p-3 min-h-[60px] mb-3 border border-slate-700">
                  <ul className="space-y-1">
                    {team.players.map((p: any) => (
                      <li key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-b border-slate-700/50 last:border-0">
                        {editingPlayer?.id === p.id ? (
                          <div className="flex-1 flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={editingPlayer?.name || ''} 
                              onChange={(e) => setEditingPlayer(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="flex-1 bg-black border border-cyan-500 text-white p-1 rounded outline-none text-xs uppercase"
                              autoFocus
                            />
                            <button onClick={saveEditPlayer} className="bg-cyan-500 text-black px-2 py-1 rounded font-black uppercase text-[10px]">Salva</button>
                            <button onClick={() => setEditingPlayer(null)} className="text-slate-500 hover:text-slate-300">❌</button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-slate-200 uppercase">{p.name}</span>
                            <div className="flex gap-4">
                              <button onClick={() => setEditingPlayer({ id: p.id, name: p.name })} className="text-slate-500 hover:text-cyan-400 transition-colors" title="Modifica Giocatore">✏️</button>
                              <button onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-pink-500 transition-colors" title="Rimuovi Giocatore">❌</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-1.5">
                  <input type="text" placeholder="Nome Giocatore" className="flex-1 bg-black border border-slate-700 text-white p-2 rounded text-xs outline-none focus:border-orange-500 uppercase" value={playerForms[team.id]?.name || ''} onChange={(e) => setPlayerForms({...playerForms, [team.id]: { name: e.target.value }})} />
                  <button onClick={() => addPlayer(team.id)} className="bg-orange-500 text-black font-black px-3 rounded uppercase text-[10px]">Add</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(236,72,153,1)] flex flex-col">
            <h3 className={`text-2xl font-black uppercase mb-2 ${modal.type === 'confirm' ? 'text-pink-500' : 'text-orange-500'}`}>{modal.title}</h3>
            <p className="text-slate-300 font-bold mb-8 text-sm">{modal.message}</p>
            <div className="flex justify-end gap-3 mt-auto">
              {modal.type === 'confirm' && (<button onClick={closeModal} className="bg-slate-800 border-2 border-slate-700 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-black uppercase text-xs transition-colors">Annulla</button>)}
              <button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className={`${modal.type === 'confirm' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-cyan-500 hover:bg-cyan-600 text-slate-900'} text-white px-4 py-2 rounded-lg font-black uppercase text-xs transition-colors shadow-lg`}>
                {modal.type === 'confirm' ? 'Conferma' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}