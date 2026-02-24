export interface Env {
  GAME_KV: KVNamespace;
}

interface Player {
  name: string;
  color: string;
  joined: boolean;
}

interface PlacedAtom {
  id: number;
  element: string;
  x: number;
  y: number;
  placedBy: number;
  bonds: number[];
  timestamp: string;
}

interface Ping {
  from: number;
  atomId: number;
  reaction: string;
  timestamp: string;
}

interface GameState {
  id: string;
  code: string;
  name: string;
  players: [Player | null, Player | null];
  currentTurn: number;
  atoms: PlacedAtom[];
  pings: Ping[];
  achievements: string[];
  formula: string;
  totalMass: number;
  createdAt: string;
  updatedAt: string;
  status: "waiting" | "active" | "complete";
}

function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const TTL = 2592000; // 30 days

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (path === "/api/create" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const code = generateCode();
      const game: GameState = {
        id: crypto.randomUUID(),
        code,
        name: (body.name as string) || "Our Molecule",
        players: [
          {
            name: (body.playerName as string) || "Player 1",
            color: (body.playerColor as string) || "#39FF14",
            joined: true,
          },
          null,
        ],
        currentTurn: 0,
        atoms: [],
        pings: [],
        achievements: [],
        formula: "",
        totalMass: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "waiting",
      };
      await env.GAME_KV.put(`game:${code}`, JSON.stringify(game), { expirationTtl: TTL });
      return new Response(JSON.stringify({ code, game }), { headers: CORS });
    }

    const gameMatch = path.match(/^\/api\/game\/([A-Z0-9]{6})(\/\w+)?$/);
    if (!gameMatch) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: CORS });
    }
    const code = gameMatch[1];
    const action = gameMatch[2];
    const key = `game:${code}`;

    if (request.method === "GET" && !action) {
      const raw = await env.GAME_KV.get(key);
      if (!raw) {
        return new Response(JSON.stringify({ error: "Game not found" }), { status: 404, headers: CORS });
      }
      return new Response(raw, { headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
    }

    const raw = await env.GAME_KV.get(key);
    if (!raw) {
      return new Response(JSON.stringify({ error: "Game not found" }), { status: 404, headers: CORS });
    }
    const game: GameState = JSON.parse(raw);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (action === "/join") {
      if (game.players[1] !== null) {
        return new Response(JSON.stringify({ error: "Game full" }), { status: 400, headers: CORS });
      }
      game.players[1] = {
        name: (body.playerName as string) || "Player 2",
        color: (body.playerColor as string) || "#06B6D4",
        joined: true,
      };
      game.status = "active";
      game.updatedAt = new Date().toISOString();
      await env.GAME_KV.put(key, JSON.stringify(game), { expirationTtl: TTL });
      return new Response(JSON.stringify(game), { headers: CORS });
    }

    if (action === "/move") {
      if (game.status !== "active") {
        return new Response(JSON.stringify({ error: "Game not active" }), { status: 400, headers: CORS });
      }
      if (body.slot !== game.currentTurn) {
        return new Response(JSON.stringify({ error: "Not your turn" }), { status: 403, headers: CORS });
      }
      const atom = body.atom as PlacedAtom | undefined;
      if (!atom || !atom.element) {
        return new Response(JSON.stringify({ error: "Invalid atom" }), { status: 400, headers: CORS });
      }
      atom.id = game.atoms.length;
      atom.timestamp = new Date().toISOString();
      atom.placedBy = body.slot as number;

      if (typeof body.bondToId === "number" && game.atoms[body.bondToId]) {
        atom.bonds = [body.bondToId];
        game.atoms[body.bondToId].bonds.push(atom.id);
      } else {
        atom.bonds = [];
      }

      game.atoms.push(atom);
      game.currentTurn = game.currentTurn === 0 ? 1 : 0;
      game.formula = (body.formula as string) ?? game.formula;
      game.totalMass = (body.totalMass as number) ?? game.totalMass;
      const newAch = (body.newAchievements as string[]) ?? [];
      if (newAch.length) game.achievements.push(...newAch);
      game.updatedAt = new Date().toISOString();
      await env.GAME_KV.put(key, JSON.stringify(game), { expirationTtl: TTL });
      return new Response(JSON.stringify(game), { headers: CORS });
    }

    if (action === "/ping") {
      const ping: Ping = {
        from: body.slot as number,
        atomId: body.atomId as number,
        reaction: (body.reaction as string) ?? "💚",
        timestamp: new Date().toISOString(),
      };
      game.pings.push(ping);
      game.updatedAt = new Date().toISOString();
      await env.GAME_KV.put(key, JSON.stringify(game), { expirationTtl: TTL });
      return new Response(JSON.stringify(game), { headers: CORS });
    }

    if (action === "/finish") {
      game.status = "complete";
      game.updatedAt = new Date().toISOString();
      await env.GAME_KV.put(key, JSON.stringify(game), { expirationTtl: TTL });
      return new Response(JSON.stringify(game), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  },
};
