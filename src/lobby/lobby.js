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

	join(name, room) {
		this.stop();
		this.dispatchEvent(new CustomEvent("join", { detail: { name, room } }));
	}
}
