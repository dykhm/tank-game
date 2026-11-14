export class GameSocket extends EventTarget {
	#url;
	#ws = null;
	#queue = [];
	#attempt = 0;
	#closed = false;

	constructor(url) {
		super();
		this.#url = url;
		this.#connect();
	}

	#connect() {
		const ws = new WebSocket(this.#url);
		this.#ws = ws;

		ws.addEventListener("open", () => {
			this.#attempt = 0;
			this.dispatchEvent(new Event("open"));
			for (const data of this.#queue.splice(0)) ws.send(data);
		});

		ws.addEventListener("message", (e) => {
			this.dispatchEvent(new CustomEvent("message", { detail: JSON.parse(e.data) }));
		});

		ws.addEventListener("close", (e) => {
			if (this.#closed || e.code >= 4000) {
				this.dispatchEvent(new CustomEvent("close", { detail: e.code }));
				return;
			}
			const delay = Math.min(30000, 500 * 2 ** this.#attempt++); 
			setTimeout(() => this.#connect(), delay);
		});
	}

	send(obj) {
		const data = JSON.stringify(obj);
		if (this.#ws.readyState === WebSocket.OPEN) this.#ws.send(data);
		else this.#queue.push(data);
	}

	close() {
		this.#closed = true;
		this.#ws.close(1000);
	}
}