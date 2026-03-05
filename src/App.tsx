import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Circle, 
  Square, 
  Triangle, 
  User, 
  Send, 
  Skull, 
  RotateCcw, 
  Trophy,
  Play,
  ShieldAlert,
  Dices,
  Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GameState, Player, Card, Shape, ServerMessage, ClientMessage } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SHAPE_ICONS = {
  triangle: <Triangle className="w-8 h-8" />,
  circle: <Circle className="w-8 h-8" />,
  square: <Square className="w-8 h-8" />,
  wild: <Sparkles className="w-8 h-8 text-yellow-400" />
};

export default function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [claimedShape, setClaimedShape] = useState<Shape>('triangle');
  const [rouletteAnim, setRouletteAnim] = useState<{ active: boolean; survived: boolean | null }>({ active: false, survived: null });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState?.history]);

  const connect = () => {
    if (!name) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'JOIN', name }));
    };

    socket.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'INIT') {
        setGameState(msg.state);
        setMyPlayerId(msg.playerId);
        setJoined(true);
      } else if (msg.type === 'UPDATE') {
        setGameState(msg.state);
      } else if (msg.type === 'ROULETTE_RESULT') {
        setRouletteAnim({ active: true, survived: msg.survived });
        setTimeout(() => setRouletteAnim({ active: false, survived: null }), 3000);
      } else if (msg.type === 'ERROR') {
        alert(msg.message);
      }
    };

    setWs(socket);
  };

  const send = (msg: ClientMessage) => {
    ws?.send(JSON.stringify(msg));
  };

  const me = gameState?.players.find(p => p.id === myPlayerId);
  const isMyTurn = gameState?.currentTurn === myPlayerId;

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#151619] border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)]">
              <Skull className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">LIAR'S SHAPE BAR</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">Bluff your way to survival.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Alias</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
            </div>
            <button 
              onClick={connect}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              ENTER THE BAR
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-bottom border-white/5 bg-[#151619]/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <Skull className="w-6 h-6 text-red-500" />
          <span className="font-bold tracking-widest text-sm uppercase">Liar's Shape Bar</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {gameState?.players.map(p => (
              <div 
                key={p.id} 
                className={cn(
                  "w-8 h-8 rounded-full border-2 border-[#151619] flex items-center justify-center text-[10px] font-bold uppercase",
                  p.isAlive ? "bg-zinc-800" : "bg-red-900/50 grayscale",
                  p.id === gameState.currentTurn && "ring-2 ring-red-500"
                )}
                title={p.name}
              >
                {p.name[0]}
              </div>
            ))}
          </div>
          {gameState?.status === 'waiting' && !me?.isReady && (
            <button 
              onClick={() => send({ type: 'READY' })}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-all"
            >
              READY
            </button>
          )}
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden">
        {/* Table Area */}
        <div className="flex-1 relative flex items-center justify-center p-8">
          {/* The Table */}
          <div className="relative w-full max-w-2xl aspect-square lg:aspect-video bg-[#1a1b1e] rounded-[100px] border-4 border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex items-center justify-center">
            
            {/* Center Info */}
            <div className="text-center">
              <AnimatePresence mode="wait">
                {gameState?.status === 'playing' && (
                  <motion.div 
                    key="playing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="space-y-4"
                  >
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Current Target</div>
                    <div className="flex items-center justify-center gap-4">
                      {gameState.targetShape ? (
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 animate-pulse">
                          {SHAPE_ICONS[gameState.targetShape as keyof typeof SHAPE_ICONS]}
                        </div>
                      ) : (
                        <div className="text-gray-600 italic">Waiting for first play...</div>
                      )}
                    </div>
                    {gameState.lastPlay && (
                      <div className="text-sm text-gray-400">
                        Last play: <span className="text-white font-bold">{gameState.lastPlay.claimedCount}</span> cards
                      </div>
                    )}
                  </motion.div>
                )}

                {gameState?.status === 'roulette' && (
                  <motion.div 
                    key="roulette"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="text-red-500 font-black text-4xl tracking-tighter uppercase italic">Russian Roulette</div>
                    <div className="relative w-32 h-32">
                      <motion.div 
                        animate={rouletteAnim.active ? { rotate: 360 * 5 } : {}}
                        transition={{ duration: 2, ease: "circOut" }}
                        className="w-full h-full border-4 border-white/10 rounded-full flex items-center justify-center"
                      >
                        <RotateCcw className="w-12 h-12 text-white/20" />
                        {/* Chamber indicators */}
                        {[...Array(6)].map((_, i) => (
                          <div 
                            key={i}
                            className="absolute w-4 h-4 bg-white/10 rounded-full"
                            style={{ 
                              transform: `rotate(${i * 60}deg) translateY(-48px)` 
                            }}
                          />
                        ))}
                      </motion.div>
                    </div>
                    <div className="text-lg font-bold">
                      {gameState.players.find(p => p.id === gameState.roulettePlayerId)?.name}'s turn to pull the trigger
                    </div>
                    {gameState.roulettePlayerId === myPlayerId && !rouletteAnim.active && (
                      <button 
                        onClick={() => send({ type: 'SPIN_ROULETTE' })}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl animate-bounce"
                      >
                        PULL TRIGGER
                      </button>
                    )}
                  </motion.div>
                )}

                {gameState?.status === 'gameover' && (
                  <motion.div 
                    key="gameover"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <Trophy className="w-20 h-20 text-yellow-500" />
                    <div className="text-3xl font-black uppercase tracking-widest">Game Over</div>
                    <div className="text-xl text-gray-400">
                      Winner: <span className="text-white font-bold">{gameState.players.find(p => p.id === gameState.winner)?.name}</span>
                    </div>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-4 text-xs font-bold text-gray-500 hover:text-white underline uppercase tracking-widest"
                    >
                      Play Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Players around the table */}
            {gameState?.players.map((p, i) => {
              const angle = (i / gameState.players.length) * 2 * Math.PI;
              const x = Math.cos(angle) * 40;
              const y = Math.sin(angle) * 40;
              return (
                <div 
                  key={p.id}
                  className="absolute transition-all duration-500"
                  style={{ left: `${50 + x}%`, top: `${50 + y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                    p.id === gameState.currentTurn ? "bg-red-500/10 border-red-500/50 scale-110" : "bg-black/40 border-white/5",
                    !p.isAlive && "opacity-50 grayscale"
                  )}>
                    <div className="relative">
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center font-bold">
                        {p.name[0]}
                      </div>
                      {!p.isAlive && <Skull className="absolute -top-1 -right-1 w-5 h-5 text-red-600" />}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider max-w-[80px] truncate">{p.name}</div>
                    <div className="flex gap-1">
                      {[...Array(p.hand.length)].map((_, j) => (
                        <div key={j} className="w-1.5 h-3 bg-white/20 rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Roulette Result Overlay */}
          <AnimatePresence>
            {rouletteAnim.active && (
              <motion.div 
                initial={{ opacity: 0, scale: 2 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
              >
                <div className={cn(
                  "text-8xl font-black uppercase italic tracking-tighter",
                  rouletteAnim.survived ? "text-green-500" : "text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]"
                )}>
                  {rouletteAnim.survived ? "CLICK" : "BANG!"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History / Chat Sidebar */}
        <div className="w-full lg:w-80 border-l border-white/5 bg-[#151619] flex flex-col">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Log</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">
            {gameState?.history.map((h, i) => (
              <div key={i} className="text-gray-400 border-l border-white/10 pl-2 py-1">
                {h}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Player Controls */}
      <footer className="bg-[#151619] border-t border-white/10 p-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
          
          {/* Hand */}
          <div className="flex-1 flex flex-wrap gap-3">
            {me?.hand.map((card) => (
              <motion.button
                key={card.id}
                whileHover={{ y: -10 }}
                onClick={() => {
                  if (selectedCards.includes(card.id)) {
                    setSelectedCards(selectedCards.filter(id => id !== card.id));
                  } else if (selectedCards.length < 3) {
                    setSelectedCards([...selectedCards, card.id]);
                  }
                }}
                className={cn(
                  "w-16 h-24 rounded-xl border-2 flex items-center justify-center transition-all relative overflow-hidden",
                  selectedCards.includes(card.id) 
                    ? "bg-red-600 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                    : "bg-zinc-900 border-white/10 hover:border-white/30"
                )}
              >
                <div className="absolute top-2 left-2 text-[8px] font-bold opacity-50 uppercase">{card.shape}</div>
                {SHAPE_ICONS[card.shape as keyof typeof SHAPE_ICONS]}
              </motion.button>
            ))}
            {me?.hand.length === 0 && gameState?.status === 'playing' && (
              <div className="text-gray-600 italic text-sm">No cards left. Wait for next round.</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4 min-w-[300px]">
            {isMyTurn && gameState?.status === 'playing' && (
              <div className="space-y-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Your Action</span>
                  <div className="flex gap-2">
                    {gameState.lastPlay && (
                      <button 
                        onClick={() => send({ type: 'CHALLENGE' })}
                        className="bg-white text-black text-xs font-black px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                      >
                        CHALLENGE
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {!gameState.targetShape ? (
                    (['triangle', 'circle', 'square'] as Shape[]).map(s => (
                      <button 
                        key={s}
                        onClick={() => setClaimedShape(s)}
                        className={cn(
                          "flex-1 p-2 rounded-lg border flex items-center justify-center transition-all",
                          claimedShape === s ? "bg-red-600 border-white" : "bg-zinc-800 border-white/5"
                        )}
                      >
                        {SHAPE_ICONS[s as keyof typeof SHAPE_ICONS]}
                      </button>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-gray-500 uppercase">Claiming:</span>
                      {SHAPE_ICONS[gameState.targetShape as keyof typeof SHAPE_ICONS]}
                    </div>
                  )}
                </div>

                <button 
                  disabled={selectedCards.length === 0}
                  onClick={() => {
                    send({ 
                      type: 'PLAY_CARDS', 
                      cardIds: selectedCards, 
                      claimedShape: gameState.targetShape || claimedShape 
                    });
                    setSelectedCards([]);
                  }}
                  className="w-full bg-red-600 disabled:bg-zinc-800 disabled:text-gray-600 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  PLAY {selectedCards.length} CARDS
                </button>
              </div>
            )}
            {!isMyTurn && gameState?.status === 'playing' && (
              <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5 animate-pulse">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Waiting for</div>
                <div className="text-sm font-bold">{gameState.players.find(p => p.id === gameState.currentTurn)?.name}</div>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
