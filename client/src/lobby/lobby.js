import { fetchJson } from "../assets/assets";

const INTERVAL = 5000;

export class Lobby extends EventTarget {
	#timer = null;
	#controller = null;

	start() {
		this.#controller = new AbortController();
		this.refresh();
		this.#timer = setInterval(() => this.refresh(), INTERVAL);
	}

	stop() {
		clearInterval(this.#timer);
		this.#controller.abort(); 
	}

	async refresh() {
		const signal = this.#controller.signal;
		try {
			const rooms = await fetchJson("/api/rooms", signal);
			this.dispatchEvent(new CustomEvent("rooms", { detail: rooms }));
		} catch (err) {
			if (signal.aborted) return; 
			this.dispatchEvent(new CustomEvent("failed", { detail: err }));
		}
	}

		async join(name, room) {
		this.stop();
		try {
			const res = await fetch("/api/rooms", {
				method: "POST",
				body: JSON.stringify({ id: room.id }),
			});
			if (!res.ok) throw new Error(res.status);
		} catch (err) {
			this.start();
			this.dispatchEvent(new CustomEvent("failed", { detail: err }));
			return;
		}
		this.dispatchEvent(new CustomEvent("join", { detail: { name, room } }));
	}
}
