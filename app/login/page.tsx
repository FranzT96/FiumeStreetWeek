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
    // Peschiamo match_time e ordiniamo cronologicamente
    const { data: gamesData } = await supabase.from('games').select('id, home_score, away_score, status, match_time, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)').order('match_time').order('id');
    if (teamsData) setTeams(teamsData);
    if (gamesData) setGames(gamesData);
  };

  useEffect(() => {
    fetchData();
    const channelGames = supabase.channel('realtime-games').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, () => { fetchData(); }).subscribe();
    const channelTeams = supabase.channel('realtime-teams').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => { fetchData(); }).subscribe();
    return () => { supabase.removeChannel(channelGames); supabase.removeChannel(channelTeams); };
  }, []);

  // Smistamento Partite
  const liveGames = games.filter(g => g.status === 'in_corso');
  // Le partite programmate sono quelle non iniziate, prendiamo le prime 2 per il blocco "Next"
  const scheduledGames = games.filter(g => g.status === 'programmata');
  const nextGames = scheduledGames.slice(0, 2); 

  return (
    <main className="min-h-screen bg-[#0f172a] p-4 md:p-8 font-sans text-slate-200 pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="text-center mb-10 pt-4">
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter transform -skew-x-6 leading-[0.85]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 drop-shadow-lg block">
              FIUME
            </span>
            <span className="text-orange-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] block mt-2">
              STREET WEEK
            </span>
          </h1>
          <p className="mt-6 text-pink-500 font-black tracking-widest text-2xl">2026</p>
        </div>

        {/* TAB 1: HOME (LIVE E PROSSIME) */}
        {activeTab === 'home' && (
          <section className="animate-fade-in space-y-12">
            
            {/* Blocco Live */}
            <div>
              <h2 className="text-2xl font-black text-pink-500 uppercase flex items-center gap-2 mb-6 border-b-2 border-slate-800 pb-2">
                <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></span> Live Now
              </h2>
              {liveGames.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <span className="text-4xl mb-4 block">😴</span>
                  <p className="text-slate-400 font-bold">Nessuna partita in corso.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {liveGames.map(game => (
                    <div key={game.id} className="bg-slate-900 border-2 border-pink-500 rounded-xl p-6 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(236,72,153,1)]">
                      <div className="text-center w-2/5">
                        <p className="text-sm text-cyan-400 uppercase font-bold mb-2 truncate">{game.home_team.name}</p>
                        <p className="text-5xl font-black text-white">{game.home_score}</p>
                      </div>
                      <div className="text-center w-1/5 text-pink-500 font-black text-xl animate-pulse">VS</div>
                      <div className="text-center w-2/5">
                        <p className="text-sm text-cyan-400 uppercase font-bold mb-2 truncate">{game.away_team.name}</p>
                        <p className="text-5xl font-black text-white">{game.away_score}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blocco Prossime Partite */}
            {nextGames.length > 0 && (
              <div>
                <h2 className="text-xl font-black text-slate-400 uppercase flex items-center gap-2 mb-4">
                  🔜 Coming Up Next
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nextGames.map(game => (
                    <div key={game.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center">
                      <div className="w-[20%] text-orange-500 font-mono font-bold text-lg">{game.match_time}</div>
                      <div className="w-[35%] text-right font-bold text-slate-300 text-sm truncate pr-3">{game.home_team.name}</div>
                      <div className="w-[10%] text-center text-slate-600 text-xs font-bold">VS</div>
                      <div className="w-[35%] text-left font-bold text-slate-300 text-sm truncate pl-3">{game.away_team.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: GIRONI (Rimasto Invariato) */}
        {activeTab === 'gironi' && (
          <section className="animate-fade-in">
            <h2 className="text-2xl font-black text-cyan-400 uppercase mb-6 border-b-2 border-slate-800 pb-2">Classifiche</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {groups.map((group) => (
                <div key={group} className="bg-slate-900 rounded-xl border-2 border-cyan-500 overflow-hidden">
                  <div className="bg-cyan-500 text-slate-900 p-2 border-b-2 border-slate-900">
                    <h3 className="text-xl font-black text-center uppercase">Girone {group}</h3>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between text-[10px] sm:text-xs font-bold text-slate-500 uppercase px-3 pb-1 border-b border-slate-800">
                      <span className="w-1/2">Squadra</span>
                      <div className="flex w-1/2 justify-end gap-2 text-center">
                        <span className="w-5 sm:w-6">V</span>
                        <span className="w-5 sm:w-6">P</span>
                        <span className="w-6 sm:w-8 text-cyan-600">PF</span>
                        <span className="w-6 sm:w-8 text-cyan-600">PS</span>
                        <span className="w-6 sm:w-8 text-orange-500">PT</span>
                      </div>
                    </div>

                    {teams.filter((t) => t.group_name === group).map((team, index) => (
                      <details key={team.id} className="bg-slate-800 rounded-lg group cursor-pointer border border-slate-700">
                        <summary className="p-2 sm:p-3 font-bold text-slate-200 flex justify-between items-center list-none hover:bg-slate-700 rounded-lg transition-colors">
                          <div className="flex items-center gap-2 w-1/2 truncate">
                            <span className="text-orange-500 w-3 sm:w-4 text-xs sm:text-sm">{index + 1}.</span>
                            <span className="uppercase tracking-wide text-xs sm:text-sm truncate">{team.name}</span>
                          </div>
                          <div className="flex w-1/2 justify-end gap-2 text-xs sm:text-sm text-center font-mono">
                            <span className="text-slate-400 w-5 sm:w-6">{team.wins}</span>
                            <span className="text-slate-400 w-5 sm:w-6">{team.losses}</span>
                            <span className="text-cyan-500 w-6 sm:w-8">{team.pf}</span>
                            <span className="text-cyan-500 w-6 sm:w-8">{team.ps}</span>
                            <span className="text-orange-400 w-6 sm:w-8 font-black">{team.points}</span>
                          </div>
                        </summary>
                        <div className="p-3 bg-slate-900 text-sm border-t border-slate-700">
                          <h4 className="text-cyan-500 text-xs font-bold uppercase mb-2">Roster:</h4>
                          {team.players && team.players.length > 0 ? (
                            <ul className="grid grid-cols-2 gap-2">
                              {team.players.map((player: any) => (
                                <li key={player.id} className="text-slate-300 flex items-center gap-2 text-xs">
                                  <span className="bg-slate-700 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">{player.number || '-'}</span>
                                  {player.name}
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-slate-600 italic text-xs">Roster non inserito.</p>}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: CALENDARIO (Con colonna Orario) */}
        {activeTab === 'calendario' && (
          <section className="animate-fade-in">
            <h2 className="text-2xl font-black text-orange-500 uppercase mb-6 border-b-2 border-slate-800 pb-2">Tutte le Partite</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {games.map((game, i) => (
                <div key={game.id} className={`flex justify-between items-center p-4 ${i !== games.length - 1 ? 'border-b border-slate-800' : ''}`}>
                  
                  {/* Colonna Orario a sinistra */}
                  <div className="w-[15%] text-left font-mono font-bold text-pink-500 text-xs sm:text-base">
                    {game.match_time}
                  </div>

                  <div className="w-[30%] text-right font-bold text-cyan-300 text-xs sm:text-base truncate pr-2 sm:pr-4">{game.home_team.name}</div>
                  
                  <div className="w-[25%] sm:w-[20%] text-center flex flex-col justify-center items-center">
                    {game.status === 'finita' ? (
                      <span className="bg-slate-800 text-white px-2 py-1 rounded font-black text-sm sm:text-lg">{game.home_score} - {game.away_score}</span>
                    ) : game.status === 'in_corso' ? (
                      <span className="text-[10px] sm:text-xs font-bold bg-pink-900/50 text-pink-500 px-2 py-1 rounded border border-pink-800 uppercase animate-pulse">In Corso</span>
                    ) : (
                      <span className="text-[10px] sm:text-xs font-bold text-slate-500 px-2 py-1 uppercase">Vs</span>
                    )}
                  </div>
                  
                  <div className="w-[30%] text-left font-bold text-cyan-300 text-xs sm:text-base truncate pl-2 sm:pl-4">{game.away_team.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: PLAYOFF */}
        {activeTab === 'playoff' && (
          <section className="animate-fade-in opacity-80">
            <h2 className="text-2xl font-black text-white uppercase mb-6 border-b-2 border-slate-800 pb-2">Fase Finale</h2>
            <div className="border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-2xl h-64 flex flex-col items-center justify-center text-center p-8 mx-4">
              <span className="text-5xl mb-4">🏆</span>
              <h3 className="text-xl font-bold text-slate-300 uppercase">Tabellone Playoff</h3>
              <p className="text-slate-500 mt-2 text-sm">Gli incroci verranno sbloccati al termine della fase a gironi.</p>
            </div>
          </section>
        )}

      </div>

      {/* --- BOTTOM NAVIGATION BAR (Rinominato Calendario) --- */}
      <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t-2 border-cyan-900 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto p-2">
          
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-2 w-1/4 rounded-xl transition-all ${activeTab === 'home' ? 'text-pink-500 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="text-xl mb-1">🔥</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
          </button>
          
          <button onClick={() => setActiveTab('gironi')} className={`flex flex-col items-center p-2 w-1/4 rounded-xl transition-all ${activeTab === 'gironi' ? 'text-cyan-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="text-xl mb-1">📊</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Gironi</span>
          </button>

          <button onClick={() => setActiveTab('calendario')} className={`flex flex-col items-center p-2 w-1/4 rounded-xl transition-all ${activeTab === 'calendario' ? 'text-orange-500 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="text-xl mb-1">📅</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Calendario</span>
          </button>

          <button onClick={() => setActiveTab('playoff')} className={`flex flex-col items-center p-2 w-1/4 rounded-xl transition-all ${activeTab === 'playoff' ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="text-xl mb-1">🏆</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Playoff</span>
          </button>

        </div>
      </nav>
    </main>
  );
}