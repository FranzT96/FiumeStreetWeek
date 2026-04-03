'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase';

export default function Home() {
  const [teams, setTeams] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('home'); 
  const supabase = createClient();
  const groups = ['A', 'B', 'C', 'D'];

  const fetchData = async () => {
    const { data: teamsData } = await supabase.from('teams').select('*, players(*)').order('points', { ascending: false }).order('wins', { ascending: false });
    const { data: gamesData } = await supabase.from('games').select('id, home_score, away_score, status, match_time, court, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)').order('match_time').order('id');
    if (teamsData) setTeams(teamsData);
    if (gamesData) setGames(gamesData);
  };

  useEffect(() => {
    fetchData();
    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    const channelPlayers = supabase.channel('realtime-players').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchData(); }).subscribe();
    
    return () => { supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); supabase.removeChannel(channelPlayers); };
  }, []);

  const liveGames = games.filter(g => g.status === 'in_corso');
  const scheduledGames = games.filter(g => g.status === 'programmata');
  const nextGames = scheduledGames.slice(0, 2); 

  return (
    <main className="min-h-screen bg-[#0f172a] p-3 md:p-8 font-sans text-slate-200 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {(activeTab === 'home' || activeTab === 'playoff') && (
          <div className="text-center mb-8 pt-4 animate-fade-in">
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter transform -skew-x-6 leading-[0.85]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 drop-shadow-lg block italic">FIUME</span>
              <span className="text-orange-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] block mt-2">STREET WEEK</span>
            </h1>
            <p className="mt-4 text-pink-500 font-black tracking-[0.3em] text-2xl">2026</p>
          </div>
        )}

        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-pink-500 uppercase flex items-center gap-2 mb-4 border-b-2 border-slate-800 pb-2">
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span> Live Now
              </h2>
              {liveGames.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-inner">
                  <span className="text-4xl mb-4 block">🏀</span>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nessun match in corso</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveGames.map(game => (
                    <div key={game.id} className="bg-slate-900 border-2 border-pink-500 rounded-xl p-4 sm:p-6 flex justify-between items-center shadow-[6px_6px_0px_0px_rgba(236,72,153,1)] relative overflow-hidden">
                      {/* BADGE CAMPO */}
                      <div className="absolute top-0 right-0 bg-orange-500 text-black font-black text-[9px] px-2 py-1 rounded-bl-lg uppercase tracking-widest">CAMPO {game.court || '-'}</div>
                      <div className="text-center w-2/5 mt-2"><p className="text-[10px] sm:text-sm text-cyan-400 uppercase font-bold mb-1 truncate">{game.home_team.name}</p><p className="text-4xl sm:text-5xl font-black text-white">{game.home_score}</p></div>
                      <div className="text-center w-1/5 text-pink-500 font-black text-lg sm:text-xl animate-pulse italic mt-2">VS</div>
                      <div className="text-center w-2/5 mt-2"><p className="text-[10px] sm:text-sm text-cyan-400 uppercase font-bold mb-1 truncate">{game.away_team.name}</p><p className="text-4xl sm:text-5xl font-black text-white">{game.away_score}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {nextGames.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest">🔜 Prossime Partite</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nextGames.map(game => (
                    // AGGIUNTA COLONNA CAMPO
                    <div key={game.id} className="grid grid-cols-[45px_1fr_auto_1fr_25px] sm:grid-cols-[60px_1fr_auto_1fr_30px] items-center gap-2 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="font-mono font-black text-orange-500 text-xs sm:text-base">{game.match_time || '--:--'}</div>
                      <div className="text-right font-bold text-slate-300 text-[10px] sm:text-sm uppercase truncate">{game.home_team.name}</div>
                      <div className="text-center text-slate-600 font-black italic text-[10px] px-1">VS</div>
                      <div className="text-left font-bold text-slate-300 text-[10px] sm:text-sm uppercase truncate">{game.away_team.name}</div>
                      <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[10px] sm:text-xs px-1.5 py-0.5 rounded">{game.court || '-'}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: GIRONI */}
        {activeTab === 'gironi' && (
          <section className="animate-fade-in pt-4">
            <h2 className="text-xl sm:text-2xl font-black text-cyan-400 uppercase mb-4 border-b-2 border-slate-800 pb-2 tracking-widest text-center">Classifiche Gironi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map((group) => (
                <div key={group} className="bg-slate-900 rounded-2xl border-4 border-cyan-500 shadow-[6px_6px_0px_0px_rgba(249,115,22,1)] overflow-hidden">
                  <div className="bg-cyan-500 text-slate-900 p-2 border-b-4 border-slate-900 text-center"><h3 className="text-xl font-black uppercase">GIRONE {group}</h3></div>
                  <div className="p-3 flex flex-col gap-2">
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-black text-slate-500 uppercase px-2 pb-2 border-b border-slate-800">
                      <span className="w-1/2">Squadra</span>
                      <div className="flex w-1/2 justify-end gap-1 sm:gap-2 text-center"><span className="w-4 sm:w-5">V</span><span className="w-4 sm:w-5">P</span><span className="w-6 sm:w-7 text-cyan-500">PF</span><span className="w-6 sm:w-7 text-cyan-500">PS</span><span className="w-6 sm:w-8 text-orange-500">PT</span></div>
                    </div>
                    {teams.filter((t) => t.group_name === group).map((team, index) => (
                      <details key={team.id} className="bg-slate-800/50 rounded-lg group cursor-pointer border border-slate-700">
                        <summary className="p-2 sm:p-3 font-bold text-slate-200 flex justify-between items-center list-none hover:bg-slate-700/50 rounded-lg transition-colors">
                          <div className="flex items-center gap-2 w-1/2">
                            <span className="text-orange-500 font-black text-xs shrink-0">{index + 1}.</span>
                            <span className="uppercase tracking-wide text-[10px] sm:text-xs font-black truncate group-open:whitespace-normal group-open:overflow-visible leading-tight transition-all">{team.name}</span>
                          </div>
                          <div className="flex w-1/2 justify-end gap-1 sm:gap-2 text-[10px] sm:text-xs text-center font-mono shrink-0">
                            <span className="text-slate-400 w-4 sm:w-5">{team.wins}</span><span className="text-slate-400 w-4 sm:w-5">{team.losses}</span><span className="text-cyan-500 w-6 sm:w-7">{team.pf}</span><span className="text-cyan-500 w-6 sm:w-7">{team.ps}</span><span className="text-orange-400 w-6 sm:w-8 font-black">{team.points}</span>
                          </div>
                        </summary>
                        
                        <div className="p-3 bg-slate-900/80 text-sm border-t border-slate-700">
                          <h4 className="text-cyan-500 text-[10px] font-black uppercase mb-3 tracking-widest flex items-center gap-2">ROSTER <span className="h-[1px] flex-1 bg-slate-800"></span></h4>
                          {team.players && team.players.length > 0 ? (
                            <ul className="grid grid-cols-2 gap-x-2 gap-y-2">
                              {team.players.map((player: any) => (
                                <li key={player.id} className="text-slate-300 flex items-center gap-1.5 text-[10px] sm:text-xs font-bold truncate">
                                  <span className="bg-pink-500 w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px_rgba(236,72,153,0.8)]"></span>
                                  <span className="truncate uppercase">{player.name}</span>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-slate-600 italic text-[10px]">Roster non pervenuto.</p>}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: CALENDARIO */}
        {activeTab === 'calendario' && (
          <section className="animate-fade-in pt-4">
            <h2 className="text-xl sm:text-2xl font-black text-orange-500 uppercase mb-4 border-b-2 border-slate-800 pb-2 tracking-widest text-center">Calendario</h2>
            <div className="bg-slate-900/80 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {games.map((game, i) => (
                // AGGIUNTA COLONNA CAMPO
                <div key={game.id} className={`grid grid-cols-[45px_1fr_auto_1fr_25px] sm:grid-cols-[60px_1fr_auto_1fr_30px] items-center gap-2 sm:gap-4 p-3 sm:p-5 ${i !== games.length - 1 ? 'border-b border-slate-800' : ''} hover:bg-slate-800/30 transition-colors`}>
                  <div className="font-mono font-black text-pink-500 text-xs sm:text-lg tracking-tighter">{game.match_time || '--:--'}</div>
                  <div className="text-right font-black text-cyan-400 text-[10px] sm:text-sm uppercase leading-tight pr-1 sm:pr-2 break-words">{game.home_team.name}</div>
                  <div className="flex justify-center items-center whitespace-nowrap">
                    {game.status === 'finita' ? (
                      <div className="bg-slate-800 border-2 border-slate-700 px-2 py-1 rounded-md text-white font-black text-[11px] sm:text-lg shadow-lg">{game.home_score} - {game.away_score}</div>
                    ) : game.status === 'in_corso' ? (
                      <div className="text-[9px] sm:text-xs font-black bg-pink-500 text-white px-2 py-1 rounded-md uppercase animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.5)]">LIVE</div>
                    ) : (<div className="text-slate-600 font-black italic text-[10px] sm:text-xs uppercase tracking-widest px-1">VS</div>)}
                  </div>
                  <div className="text-left font-black text-cyan-400 text-[10px] sm:text-sm uppercase leading-tight pl-1 sm:pl-2 break-words">{game.away_team.name}</div>
                  {/* BADGE CAMPO */}
                  <div className="flex justify-center"><span className="bg-orange-500 text-black font-black text-[10px] sm:text-sm px-1.5 py-0.5 rounded shadow-sm">{game.court || '-'}</span></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: PLAYOFF */}
        {activeTab === 'playoff' && (
          <section className="animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase mb-4 border-b-2 border-slate-800 pb-2 tracking-widest text-center italic underline decoration-pink-500 decoration-4">Playoff 🏆</h2>
            <div className="border-4 border-dashed border-slate-800 bg-slate-900/50 rounded-[2rem] h-64 sm:h-80 flex flex-col items-center justify-center text-center p-6">
              <div className="text-5xl sm:text-7xl mb-4 animate-bounce">🏀</div>
              <h3 className="text-lg sm:text-2xl font-black text-slate-400 uppercase tracking-tighter">Tabellone Finale</h3>
              <p className="text-slate-600 mt-2 font-bold uppercase text-[10px] sm:text-xs tracking-widest">Disponibile al termine dei gironi</p>
            </div>
          </section>
        )}

      </div>

      <nav className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t-4 border-cyan-500 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto p-2 sm:p-3">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-1 sm:p-2 w-1/4 rounded-2xl transition-all ${activeTab === 'home' ? 'text-pink-500 bg-slate-800 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xl sm:text-2xl mb-1">🔥</span><span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest italic">Live</span></button>
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center p-1 sm:p-2 w-1/4 rounded-2xl transition-all ${activeTab === 'gironi' ? 'text-cyan-400 bg-slate-800 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xl sm:text-2xl mb-1">📊</span><span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest italic">Gironi</span></button>
          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center p-1 sm:p-2 w-1/4 rounded-2xl transition-all ${activeTab === 'calendario' ? 'text-orange-500 bg-slate-800 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xl sm:text-2xl mb-1">📅</span><span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest italic">Calendario</span></button>
          <button onClick={() => setActiveTab('playoff')} className={`flex flex-col items-center p-1 sm:p-2 w-1/4 rounded-2xl transition-all ${activeTab === 'playoff' ? 'text-white bg-slate-800 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xl sm:text-2xl mb-1">🏆</span><span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest italic">Playoff</span></button>
        </div>
      </nav>
    </main>
  );
}