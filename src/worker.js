// Cloudflare Worker: the API + WebSocket entry points for Phones mode. Static files come from Workers Static Assets.
import { DurableObject } from 'cloudflare:workers';
import { newRoom, reduce, broadcastPlan, socketsToDrop } from '../public/js/room.js';
import { handleAiInternal } from './ai.js';
import { askRule } from './ask.js';
import { RULES_INDEX, RULES_HASH } from './rules-index.js';

const AI_SITE = 'odd';
const AI_GAME = 'The Odd Card';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O look-alikes
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_MSG = 4 * 1024;

const randCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => CODE_CHARS[x % CODE_CHARS.length]).join('');
const randKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create' && request.method === 'POST') {
      for (let i = 0; i < 5; i++) {
        const code = randCode();
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const res = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, hostKey: randKey() }) });
        if (res.status === 200) return json(await res.json());
      }
      return json({ error: 'Couldn’t create a room. Try again.' }, 503);
    }

    const exists = url.pathname.match(/^\/api\/room\/([A-Za-z]{6})$/);
    if (exists) {
      const stub = env.ROOM.get(env.ROOM.idFromName(exists[1].toUpperCase()));
      const res = await stub.fetch('https://room/exists');
      return json({ exists: res.status === 200 }); // 200 either way, so a wrong code never logs a console error
    }

    const ws = url.pathname.match(/^\/ws\/([A-Za-z]{6})$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
      const stub = env.ROOM.get(env.ROOM.idFromName(ws[1].toUpperCase()));
      return stub.fetch(request);
    }

    // Ask a rule (server only, no UI yet). Reads the rules text, never a room. Any failure answers { answer: null }.
    if (url.pathname === '/api/ask' && request.method === 'POST') {
      let q = ''; try { const t = await request.text(); if (t.length <= 2048) q = String(JSON.parse(t)?.q ?? ''); } catch { /* bad body: answer null */ }
      const r = await askRule(env, { site: AI_SITE, game: AI_GAME, index: RULES_INDEX, rulesVersion: RULES_HASH, question: q });
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }

    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.ready = ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || null; });
  }

  // A failed write must never swallow a move: retry once, then keep going from memory (every phone is showing it).
  async save() {
    this.room.updated = Date.now();
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.ctx.storage.put('room', this.room);
        await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
        return true;
      } catch (e) { console.error(`save failed (attempt ${attempt}) for room ${this.room.code}:`, e?.message || e); }
    }
    return false;
  }

  async alarm() { await this.ctx.storage.deleteAll(); this.room = null; }

  async fetch(request) {
    await this.ready;
    const aiInternal = await handleAiInternal(this.ctx.storage, request); // reserved budget and cache instances only
    if (aiInternal) return aiInternal;
    const url = new URL(request.url);
    if (url.pathname === '/init') {
      if (this.room) return new Response('exists', { status: 409 });
      const { code, hostKey } = await request.json();
      this.room = newRoom(code, hostKey);
      await this.save();
      return new Response(JSON.stringify({ code, hostKey }), { status: 200 });
    }
    if (url.pathname === '/exists') return new Response(null, { status: this.room ? 200 : 404 });
    if (!this.room) return new Response('Room not found', { status: 404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ who: null });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  sockets() { return this.ctx.getWebSockets().map(ws => ({ ws, ...ws.deserializeAttachment() })); }
  connectedIds() { return new Set(this.sockets().filter(s => s.playerId).map(s => s.playerId)); }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* socket gone */ } }

  // Cut off sockets still bound to a seat that was removed.
  drop(playerId, exceptWs = null) {
    for (const ws of socketsToDrop(this.sockets(), playerId, exceptWs)) {
      ws.serializeAttachment({ who: null });
      this.send(ws, { type: 'fatal', error: 'The Host removed you from the room.', clear: true });
      try { ws.close(1008, 'seat gone'); } catch { /* already closed */ }
    }
  }

  broadcast() {
    for (const { ws, msgs } of broadcastPlan(this.room, this.sockets(), this.connectedIds())) for (const m of msgs) this.send(ws, m);
  }

  async webSocketMessage(ws, raw) {
    await this.ready;
    if (!this.room) { this.send(ws, { type: 'fatal', error: 'This room has expired.' }); ws.close(1000, 'gone'); return; }
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const att = ws.deserializeAttachment() || { who: null };

    if (msg.type === 'hello') { // handshake
      if (msg.playerId) {
        const p = this.room.players.find(x => x.id === msg.playerId);
        if (!p || p.token !== msg.token) { this.send(ws, { type: 'fatal', error: 'Couldn’t rejoin the room. Join again with your name.', clear: true }); ws.close(1008, 'bad token'); return; }
        ws.serializeAttachment({ who: 'player', playerId: p.id });
      } else if (msg.join) {
        const res = reduce(this.room, {}, { type: 'join', name: msg.join, hostKey: msg.hostKey });
        if (res.error) { this.send(ws, { type: 'error', error: res.error }); return; }
        await this.save();
        ws.serializeAttachment({ who: 'player', playerId: res.data.playerId });
        this.send(ws, { type: 'joined', ...res.data });
      } else { this.send(ws, { type: 'lobby', phase: this.room.phase, count: this.room.players.length }); return; }
      this.broadcast();
      return;
    }
    if (att.who !== 'player') return;

    const res = reduce(this.room, { playerId: att.playerId }, msg);
    if (res.error) { this.send(ws, { type: 'error', error: res.error }); return; }
    await this.save();
    if (msg.type === 'kick') this.drop(msg.id);
    this.broadcast();
  }

  async webSocketClose(ws) { try { ws.close(); } catch { /* already closed */ } await this.ready; this.broadcast(); }
  async webSocketError() { await this.ready; this.broadcast(); }
}
