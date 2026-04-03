'use client';

import { useEffect, useState } from 'react';
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
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void; }>({ isOpen: false, title: '', message: '', type: 'alert' });

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
    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    const channelPlayers = supabase.channel('realtime-players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchData(); }).subscribe();
    
    return () => { supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); supabase.removeChannel(channelPlayers); };
  }, []);

  const showAlert = (title: string, message: string) => setModal({ isOpen: true, title, message, type: 'alert' });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModal({ ...modal, isOpen: false });

  const updateScore = async (gameId: number, teamType: 'home' | 'away', pointsToAdd: number, currentScore: number) => {
    const field = teamType === 'home' ? 'home_score' : 'away_score';
    const newScore = Math.max(0, currentScore + pointsToAdd);
    await supabase.from('games').update({ [field]: newScore }).eq('id', gameId);
    fetchData();
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
    await supabase.from('games').update({ status: newStatus }).eq('id', gameId);
    fetchData();
  };

  const createGame = async () => {
    if (!newGame.home_id || !newGame.away_id) return showAlert("Attenzione", "Seleziona entrambe le squadre!");
    await supabase.from('games').insert({ home_team_id: parseInt(newGame.home_id), away_team_id: parseInt(newGame.away_id), match_time: newGame.time, court: newGame.court, status: 'programmata' });
    setNewGame({ ...newGame, home_id: '', away_id: '' });
    fetchData();
  };

  const deleteGame = (id: number) => {
    showConfirm("Elimina Partita", "Sicuro di voler cancellare questo match?", async () => {
      await supabase.from('games').delete().eq('id', id); fetchData(); closeModal();
    });
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
    showConfirm("Rimuovi", "Eliminare il giocatore?", async () => {
      await supabase.from('players').delete().eq('id', id); fetchData(); closeModal();
    });
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-cyan-400 font-bold uppercase tracking-widest">Caricamento...</div>;

  const liveGames = games.filter(g => g.status === 'in_corso');
  const scheduledGames = games.filter(g => g.status === 'programmata');
  const nextGames = scheduledGames.slice(0, 2);

  return (
    <main className="min-h-screen bg-[#0f172a] p-3 md:p-8 font-sans text-slate-200 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {activeTab !== 'admin' && (
          <div className="text-center mb-8 pt-4 animate-fade-in">
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter transform -skew-x-6 leading-[0.85]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 drop-shadow-lg block italic">FIUME</span>
              <span className="text-orange-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] block mt-2">STREET WEEK</span>
            </h1>
            <p className="mt-4 text-pink-500 font-black tracking-[0.3em] text-2xl">2026</p>
          </div>
        )}

        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-pink-500 uppercase flex items-center gap-2 mb-4 border-b-2 border-slate-800 pb-2">
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span> Live Now
              </h2>
              {liveGames.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nessun match in corso</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveGames.map(game => (
                    <div key={game.id} className="bg-slate-900 border-2 border-pink-500 rounded-xl p-4 flex justify-between items-center relative overflow-hidden shadow-[6px_6px_0px_0px_rgba(236,72,153,1)]">
                      <div className="absolute top-0 right-0 bg-orange-500 text-black font-black text-[9px] px-2 py-1 rounded-bl-lg uppercase">CAMPO {game.court}</div>
                      <div className="text-center w-2/5 mt-2"><p className="text-[10px] text-cyan-400 uppercase font-bold truncate">{game.home_team.name}</p><p className="text-4xl font-black text-white">{game.home_score}</p></div>
                      <div className="text-center w-1/5 text-pink-500 font-black text-lg animate-pulse">VS</div>
                      <div className="text-center w-2/5 mt-2"><p className="text-[10px] text-cyan-400 uppercase font-bold truncate">{game.away_team.name}</p><p className="text-4xl font-black text-white">{game.away_score}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {nextGames.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest">🔜 Prossime Partite</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextGames.map(game => (
                    <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_25px] items-center gap-2 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="font-mono font-black text-orange-500 text-xs">{game.match_time}</div>
                      <div className="text-right font-bold text-slate-300 text-[10px] uppercase truncate">{game.home_team.name}</div>
                      <div className="text-center text-slate-600 font-black italic text-[10px] px-1">VS</div>
                      <div className="text-left font-bold text-slate-300 text-[10px] uppercase truncate">{game.away_team.name}</div>
                      <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded">{game.court}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'gironi' && (
          <section className="animate-fade-in pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map((group) => (
              <div key={group} className="bg-slate-900 rounded-2xl border-4 border-cyan-500 shadow-[6px_6px_0px_0px_rgba(249,115,22,1)] overflow-hidden">
                <div className="bg-cyan-500 text-slate-900 p-2 text-center"><h3 className="text-xl font-black uppercase">GIRONE {group}</h3></div>
                <div className="p-3 flex flex-col gap-2">
                  {teams.filter((t) => t.group_name === group).map((team, index) => (
                    <details key={team.id} className="bg-slate-800/50 rounded-lg border border-slate-700">
                      <summary className="p-3 font-bold text-slate-200 flex justify-between items-center list-none cursor-pointer">
                        <div className="flex items-center gap-2 w-1/2">
                          <span className="text-orange-500 font-black text-xs">{index + 1}.</span>
                          <span className="uppercase text-[10px] font-black truncate">{team.name}</span>
                        </div>
                        <div className="flex w-1/2 justify-end gap-2 text-[10px] text-center font-mono">
                          <span className="text-slate-400 w-4">{team.wins}</span><span className="text-slate-400 w-4">{team.losses}</span><span className="text-cyan-500 w-6">{team.pf}</span><span className="text-orange-400 w-6 font-black">{team.points}</span>
                        </div>
                      </summary>
                      <div className="p-3 bg-slate-900/80 border-t border-slate-700">
                        <ul className="grid grid-cols-2 gap-2">
                          {team.players.map((player: any) => (
                            <li key={player.id} className="text-slate-300 flex items-center gap-1.5 text-[10px] font-bold">
                              <span className="bg-pink-500 w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(236,72,153,0.8)]"></span>
                              <span className="uppercase">{player.name}</span>
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

        {activeTab === 'calendario' && (
          <section className="animate-fade-in pt-4 bg-slate-900/80 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {games.map((game, i) => (
              <div key={game.id} className={`grid grid-cols-[45px_1fr_auto_1fr_25px] items-center gap-2 p-4 ${i !== games.length - 1 ? 'border-b border-slate-800' : ''}`}>
                <div className="font-mono font-black text-pink-500 text-xs">{game.match_time}</div>
                <div className="text-right font-black text-cyan-400 text-[10px] uppercase truncate">{game.home_team.name}</div>
                <div className="flex justify-center items-center">
                  {game.status === 'finita' ? (
                    <div className="bg-slate-800 border-2 border-slate-700 px-2 py-1 rounded text-white font-black text-xs">{game.home_score} - {game.away_score}</div>
                  ) : <div className="text-slate-600 font-black italic text-[10px]">VS</div>}
                </div>
                <div className="text-left font-black text-cyan-400 text-[10px] uppercase truncate">{game.away_team.name}</div>
                <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[10px] px-1.5 py-0.5 rounded">{game.court}</span></div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'admin' && (
          <section className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-black text-orange-500 uppercase border-b-2 border-orange-500 pb-2">Control Panel</h2>
            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button onClick={() => setActiveAdminSubTab('live')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'live' ? 'bg-pink-500 text-white' : 'text-slate-500'}`}>🔴 Live</button>
              <button onClick={() => setActiveAdminSubTab('orari')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'orari' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500'}`}>📅 Orari</button>
              <button onClick={() => setActiveAdminSubTab('roster')} className={`flex-1 py-2 rounded-lg font-black uppercase text-[10px] ${activeAdminSubTab === 'roster' ? 'bg-orange-500 text-slate-900' : 'text-slate-500'}`}>🏀 Roster</button>
            </div>

            {activeAdminSubTab === 'live' && (
              <div className="grid grid-cols-1 gap-4">
                {games.map(game => (
                  <div key={game.id} className={`bg-slate-900 p-4 rounded-xl border-2 ${game.status === 'in_corso' ? 'border-pink-500 shadow-lg' : 'border-slate-800 opacity-80'}`}>
                    <div className="flex justify-between items-center bg-black p-3 rounded-lg mb-3">
                      <div className="text-center w-1/3"><p className="text-[9px] text-slate-500 uppercase">{game.home_team.name}</p><p className="text-3xl font-black text-orange-500">{game.home_score}</p></div>
                      <div className="text-center w-1/3">
                        <span className="text-[8px] font-black text-cyan-400 block mb-1 uppercase">{game.status.replace('_', ' ')}</span>
                        {game.status === 'programmata' && <button onClick={() => updateStatus(game.id, 'in_corso')} className="bg-orange-500 text-black text-[9px] font-black px-3 py-1 rounded">START</button>}
                        {game.status === 'in_corso' && <button onClick={() => updateStatus(game.id, 'finita')} className="bg-pink-600 text-white text-[9px] font-black px-3 py-1 rounded">END</button>}
                      </div>
                      <div className="text-center w-1/3"><p className="text-[9px] text-slate-500 uppercase">{game.away_team.name}</p><p className="text-3xl font-black text-orange-500">{game.away_score}</p></div>
                    </div>
                    {game.status === 'in_corso' && (
                      <div className="flex justify-between">
                        <div className="flex gap-1"><button onClick={() => updateScore(game.id, 'home', 1, game.home_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+1</button><button onClick={() => updateScore(game.id, 'home', 2, game.home_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+2</button></div>
                        <div className="flex gap-1"><button onClick={() => updateScore(game.id, 'away', 1, game.away_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+1</button><button onClick={() => updateScore(game.id, 'away', 2, game.away_score)} className="bg-slate-700 text-cyan-400 font-black w-10 h-10 rounded-lg">+2</button></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeAdminSubTab === 'orari' && (
              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-cyan-500">
                  <h3 className="text-xs font-black uppercase mb-3">Nuova Partita</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select value={newGame.home_id} onChange={(e) => setNewGame({...newGame, home_id: e.target.value})} className="bg-black text-white p-2 rounded text-xs border border-slate-700">
                      <option value="">Casa...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={newGame.away_id} onChange={(e) => setNewGame({...newGame, away_id: e.target.value})} className="bg-black text-white p-2 rounded text-xs border border-slate-700">
                      <option value="">Ospiti...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input type="time" value={newGame.time} onChange={(e) => setNewGame({...newGame, time: e.target.value})} className="bg-black text-white p-2 rounded text-xs flex-1 border border-slate-700" />
                    <button onClick={createGame} className="bg-orange-500 text-black font-black px-4 rounded text-xs">Crea</button>
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl overflow-hidden">
                  {games.map(game => (
                    <div key={game.id} className="flex justify-between items-center p-3 border-b border-slate-800 last:border-0">
                      <span className="text-[10px] font-black uppercase text-slate-300">{game.match_time} | {game.home_team.name} - {game.away_team.name}</span>
                      <button onClick={() => deleteGame(game.id)} className="text-slate-600">❌</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeAdminSubTab === 'roster' && (
              <div className="grid grid-cols-1 gap-6">
                {teams.map(team => (
                  <div key={team.id} className="bg-slate-900 rounded-xl border-2 border-orange-500/30 p-4">
                    <h3 className="text-[10px] font-black text-white uppercase mb-3 flex justify-between">{team.name} <span>GIRONE {team.group_name}</span></h3>
                    <ul className="mb-4 space-y-1">
                      {team.players.map((p: any) => (
                        <li key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-b border-slate-800">
                          {editingPlayer?.id === p.id ? (
                            <div className="flex-1 flex gap-1">
                              <input value={editingPlayer?.name || ''} onChange={(e) => setEditingPlayer(prev => prev ? {...prev, name: e.target.value} : null)} className="bg-black text-white p-1 rounded w-full text-[10px] uppercase" />
                              <button onClick={saveEditPlayer} className="bg-cyan-500 text-black px-2 py-1 rounded font-black text-[9px]">OK</button>
                            </div>
                          ) : (
                            <><span className="uppercase">{p.name}</span><div className="flex gap-3"><button onClick={() => setEditingPlayer({id: p.id, name: p.name})} className="text-slate-500">✏️</button><button onClick={() => deletePlayer(p.id)} className="text-slate-500">❌</button></div></>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-1.5">
                      <input placeholder="Nuovo Giocatore" className="flex-1 bg-black text-white p-2 rounded text-[10px] outline-none uppercase border border-slate-800" value={playerForms[team.id]?.name || ''} onChange={(e) => setPlayerForms({...playerForms, [team.id]: { name: e.target.value }})} />
                      <button onClick={() => addPlayer(team.id)} className="bg-orange-500 text-black font-black px-3 rounded text-[10px]">ADD</button>
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
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center w-1/5 ${activeTab === 'home' ? 'text-pink-500' : 'text-slate-500'}`}><span className="text-xl">🔥</span><span className="text-[8px] font-black uppercase italic">Live</span></button>
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center w-1/5 ${activeTab === 'gironi' ? 'text-cyan-400' : 'text-slate-500'}`}><span className="text-xl">📊</span><span className="text-[8px] font-black uppercase italic">Gironi</span></button>
          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center w-1/5 ${activeTab === 'calendario' ? 'text-orange-500' : 'text-slate-500'}`}><span className="text-xl">📅</span><span className="text-[8px] font-black uppercase italic">Orari</span></button>
          <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center w-1/5 ${activeTab === 'admin' ? 'text-orange-500' : 'text-slate-500'}`}><span className="text-xl">⚙️</span><span className="text-[8px] font-black uppercase italic">Admin</span></button>
        </div>
      </nav>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-4 border-cyan-500 rounded-2xl p-6 max-w-sm w-full shadow-[8px_8px_0px_0px_rgba(236,72,153,1)]">
            <h3 className="text-2xl font-black uppercase mb-2 text-pink-500">{modal.title}</h3>
            <p className="text-slate-300 font-bold mb-8 text-sm">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' && <button onClick={closeModal} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-black uppercase text-xs">No</button>}
              <button onClick={() => { if (modal.type === 'confirm' && modal.onConfirm) modal.onConfirm(); else closeModal(); }} className="bg-cyan-500 text-slate-900 px-4 py-2 rounded-lg font-black uppercase text-xs">Si</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}