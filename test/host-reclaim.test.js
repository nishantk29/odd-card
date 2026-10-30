// Regression (engine-1030 audit O1): the Host's phone lost its seat (storage cleared, a bad token). Before this fix the host
// key could not make anyone Host again, rejoining was refused once the game had started, and the room was stuck for good.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoom, reduce, viewForPlayer } from '../public/js/room.js';

let s = 11; const rng = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
function room4() {
  const room = newRoom('ODDHK', 'key-1');
  const host = reduce(room, {}, { type: 'join', name: 'Hana', hostKey: 'key-1' }, rng).data;
  const ids = [host.playerId];
  for (const n of ['Ben', 'Cal', 'Dee']) ids.push(reduce(room, {}, { type: 'join', name: n }, rng).data.playerId);
  return { room, host, ids, as: (i, m) => reduce(room, { playerId: ids[i] }, m, rng) };
}

test('mid-game: the host key takes the Host seat back with a new token, and the round goes on', () => {
  const { room, host, ids, as } = room4();
  assert.ok(as(0, { type: 'start' }).ok);
  assert.ok(as(0, { type: 'begin' }).ok);
  assert.equal(room.phase, 'clues');
  const back = reduce(room, {}, { type: 'join', name: 'anything', hostKey: 'key-1' }, rng);
  assert.ok(back.ok, back.error);
  assert.equal(back.data.playerId, host.playerId, 'the same seat, not a new player');
  assert.equal(back.data.host, true);
  assert.notEqual(back.data.token, host.token, 'a new token: the lost one stops working');
  assert.equal(room.players.length, 4);
  assert.equal(room.players.find((p) => p.id === host.playerId).token, back.data.token);
  // the Host can move the room on again
  while (room.phase === 'clues') assert.ok(reduce(room, { playerId: back.data.playerId }, { type: 'clueDone' }, rng).ok);
  assert.ok(reduce(room, { playerId: back.data.playerId }, { type: 'closeVote' }, rng).ok);
  assert.equal(viewForPlayer(room, back.data.playerId).me.host, true);
  assert.ok(ids.length === 4);
});

test('lobby: the host key takes the seat back instead of a refused duplicate name', () => {
  const { room, host } = room4();
  const back = reduce(room, {}, { type: 'join', name: 'Hana', hostKey: 'key-1' }, rng);
  assert.ok(back.ok, back.error);
  assert.equal(back.data.playerId, host.playerId);
  assert.equal(room.players.filter((p) => p.host).length, 1);
});

test('a wrong host key gets nothing: mid-game join is still refused, claimHost is refused', () => {
  const { room, as } = room4();
  as(0, { type: 'start' });
  assert.ok(reduce(room, {}, { type: 'join', name: 'Eve', hostKey: 'nope' }, rng).error);
  assert.ok(as(1, { type: 'claimHost', hostKey: 'nope' }).error);
  assert.ok(as(1, { type: 'claimHost' }).error);
  assert.equal(room.players.find((p) => p.host).name, 'Hana');
});

test('claimHost: a seated player holding the host key becomes the only Host, mid-game', () => {
  const { room, ids, as } = room4();
  as(0, { type: 'start' });
  assert.ok(as(2, { type: 'claimHost', hostKey: 'key-1' }).ok);
  assert.deepEqual(room.players.filter((p) => p.host).map((p) => p.id), [ids[2]]);
  assert.ok(as(2, { type: 'begin' }).ok, 'the new Host can move the room on');
  assert.ok(as(0, { type: 'closeVote' }).error, 'the old seat is a player now');
  assert.ok(as(2, { type: 'claimHost', hostKey: 'key-1' }).ok, 'claiming again is a no-op');
});

test('an ended room stays ended', () => {
  const { room, as } = room4();
  as(0, { type: 'start' }); as(0, { type: 'end' });
  assert.ok(as(1, { type: 'claimHost', hostKey: 'key-1' }).error);
});

test('an ended room: the host key does not reopen a seat', () => {
  const { room, as } = room4();
  as(0, { type: 'start' }); as(0, { type: 'end' });
  assert.ok(reduce(room, {}, { type: 'join', name: 'Hana', hostKey: 'key-1' }, rng).error);
});
