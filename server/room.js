import { EventEmitter } from "node:events";

const MAX_BUFFERED = 64 * 1024; 

export class Room extends EventEmitter {
	members = new Map(); 

	constructor({ id, name, max, arena }) {
		super();
		Object.assign(this, { id, name, max, arena });
	}

	join(ws, name) {
		this.members.set(ws, name);
		this.emit("join", { name });
		this.broadcast({ type: "joined", name, players: [...this.members.values()] });
	}

	leave(ws) {
		const name = this.members.get(ws);
		if (name === undefined) return;
		this.members.delete(ws);
		this.emit("leave", { name });
		this.broadcast({ type: "left", name });
		if (this.members.size === 0) this.emit("empty");
	}

	chat(ws, text) {
		const name = this.members.get(ws);
		this.emit("chat", { name, text });
		this.broadcast({ type: "chat", name, text });
	}

	broadcast(message) {
		const data = JSON.stringify(message);
		for (const ws of this.members.keys()) {
			if (ws.readyState !== ws.OPEN) continue;
			if (ws.bufferedAmount > MAX_BUFFERED) continue; 
			ws.send(data);
		}
	}
}