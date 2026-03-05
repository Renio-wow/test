import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import { GameState, Player, Card, Shape, ClientMessage, ServerMessage } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const games = new Map<string, GameState>();
  const clients = new Map<WebSocket, { playerId: string; roomId: string }>();

  function createDeck(): Card[] {
    const deck: Card[] = [];
    const shapes: Shape[] = ['triangle', 'circle', 'square'];
    shapes.forEach(shape => {
      for (let i = 0; i < 5; i++) {
        deck.push({ id: nanoid(), shape });
      }
    });
    for (let i = 0; i < 2; i++) {
      deck.push({ id: nanoid(), shape: 'wild' });
    }
    return deck.sort(() => Math.random() - 0.5);
  }

  function broadcast(roomId: string, message: ServerMessage) {
    const msgStr = JSON.stringify(message);
    clients.forEach((info, ws) => {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    });
  }

  function nextTurn(game: GameState) {
    const alivePlayers = game.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      game.status = 'gameover';
      game.winner = alivePlayers[0]?.id || null;
      return;
    }
    const currentIndex = game.players.findIndex(p => p.id === game.currentTurn);
    let nextIndex = (currentIndex + 1) % game.players.length;
    while (!game.players[nextIndex].isAlive) {
      nextIndex = (nextIndex + 1) % game.players.length;
    }
    game.currentTurn = game.players[nextIndex].id;
  }

  function dealCards(game: GameState) {
    const deck = createDeck();
    game.players.forEach(p => {
      if (p.isAlive) {
        p.hand = deck.splice(0, 5);
      }
    });
  }

  function resetRound(game: GameState) {
    game.targetShape = null;
    game.lastPlay = null;
    dealCards(game);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      const message: ClientMessage = JSON.parse(data.toString());
      
      if (message.type === 'JOIN') {
        const roomId = message.roomId || 'default';
        let game = games.get(roomId);
        if (!game) {
          game = {
            id: roomId,
            players: [],
            status: 'waiting',
            currentTurn: '',
            targetShape: null,
            lastPlay: null,
            history: [],
            winner: null,
            roulettePlayerId: null
          };
          games.set(roomId, game);
        }

        if (game.status !== 'waiting' && !game.players.find(p => p.id === clients.get(ws)?.playerId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Game already in progress' }));
          return;
        }

        const playerId = nanoid();
        const newPlayer: Player = {
          id: playerId,
          name: message.name,
          hand: [],
          isAlive: true,
          chambers: Array(6).fill(false).map((_, i) => i === 0), // Simplified: bullet is at index 0, we shuffle later
          currentChamber: 0,
          isReady: false
        };
        // Shuffle bullet
        newPlayer.chambers.sort(() => Math.random() - 0.5);

        game.players.push(newPlayer);
        clients.set(ws, { playerId, roomId });

        ws.send(JSON.stringify({ type: 'INIT', state: game, playerId }));
        broadcast(roomId, { type: 'UPDATE', state: game });
      }

      const clientInfo = clients.get(ws);
      if (!clientInfo) return;
      const game = games.get(clientInfo.roomId);
      if (!game) return;
      const player = game.players.find(p => p.id === clientInfo.playerId);
      if (!player) return;

      if (message.type === 'READY') {
        player.isReady = true;
        if (game.players.length >= 2 && game.players.every(p => p.isReady)) {
          game.status = 'playing';
          game.currentTurn = game.players[0].id;
          dealCards(game);
        }
        broadcast(game.id, { type: 'UPDATE', state: game });
      }

      if (message.type === 'PLAY_CARDS') {
        if (game.currentTurn !== player.id || game.status !== 'playing') return;
        
        const playedCards = player.hand.filter(c => message.cardIds.includes(c.id));
        player.hand = player.hand.filter(c => !message.cardIds.includes(c.id));

        if (game.targetShape && message.claimedShape !== game.targetShape) {
           // Should not happen with UI constraints but for safety
        }
        game.targetShape = message.claimedShape;
        game.lastPlay = {
          playerId: player.id,
          cards: playedCards,
          claimedCount: playedCards.length
        };
        game.history.push(`${player.name} played ${playedCards.length} cards as ${message.claimedShape}`);
        
        nextTurn(game);
        broadcast(game.id, { type: 'UPDATE', state: game });
      }

      if (message.type === 'CHALLENGE') {
        if (game.currentTurn !== player.id || !game.lastPlay || game.status !== 'playing') return;

        const lastPlayer = game.players.find(p => p.id === game.lastPlay!.playerId)!;
        const isLying = game.lastPlay.cards.some(c => c.shape !== game.targetShape && c.shape !== 'wild');

        game.history.push(`${player.name} challenged ${lastPlayer.name}!`);
        
        if (isLying) {
          game.history.push(`${lastPlayer.name} was caught lying!`);
          game.roulettePlayerId = lastPlayer.id;
        } else {
          game.history.push(`${lastPlayer.name} was telling the truth!`);
          game.roulettePlayerId = player.id;
        }
        
        game.status = 'roulette';
        broadcast(game.id, { type: 'UPDATE', state: game });
      }

      if (message.type === 'SPIN_ROULETTE') {
        if (game.status !== 'roulette' || game.roulettePlayerId !== player.id) return;

        const hasBullet = player.chambers[player.currentChamber];
        const survived = !hasBullet;
        const chamber = player.currentChamber;
        
        player.currentChamber++;
        
        if (hasBullet) {
          player.isAlive = false;
          game.history.push(`BANG! ${player.name} is out.`);
        } else {
          game.history.push(`Click... ${player.name} survived.`);
        }

        broadcast(game.id, { type: 'ROULETTE_RESULT', playerId: player.id, survived, chamber });
        
        setTimeout(() => {
          const alivePlayers = game.players.filter(p => p.isAlive);
          if (alivePlayers.length <= 1) {
            game.status = 'gameover';
            game.winner = alivePlayers[0]?.id || null;
          } else {
            game.status = 'playing';
            game.roulettePlayerId = null;
            resetRound(game);
            // Set turn to the one who survived or the next alive player
            game.currentTurn = survived ? player.id : alivePlayers[0].id;
          }
          broadcast(game.id, { type: 'UPDATE', state: game });
        }, 3000);
      }
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      if (info) {
        const game = games.get(info.roomId);
        if (game) {
          game.players = game.players.filter(p => p.id !== info.playerId);
          if (game.players.length === 0) {
            games.delete(info.roomId);
          } else {
            broadcast(info.roomId, { type: 'UPDATE', state: game });
          }
        }
        clients.delete(ws);
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
}

startServer();
