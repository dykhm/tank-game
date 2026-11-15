export class GameSocket extends EventTarget {
	#url;
	#ws = null;
	#queue = [];
	#attempt = 0;
	#closed = false;
	#sim;

	bytesIn = 0;
	bytesOut = 0;

	constructor(url, sim = {}) {
		super();
		this.#url = url;
		this.#sim = { lag: 0, jitter: 0, loss: 0, ...sim };
		this.#connect();
	}

	#simulate(fn) {
		const { lag, jitter, loss } = this.#sim;
		if (loss > 0 && Math.random() < loss) return;
		const delay = lag / 2 + Math.random() * jitter;
		if (delay <= 0) fn();
		else setTimeout(fn, delay);
	}

	#connect() {
		const ws = new WebSocket(this.#url);
		ws.binaryType = "arraybuffer";
		this.#ws = ws;

		ws.addEventListener("open", () => {
			this.#attempt = 0;
			this.dispatchEvent(new Event("open"));
			for (const data of this.#queue.splice(0)) ws.send(data);
		});

		ws.addEventListener("message", (e) => {
			if (typeof e.data === "string") {
				this.bytesIn += e.data.length;
				const message = JSON.parse(e.data);
				const emit = () => this.dispatchEvent(new CustomEvent("message", { detail: message }));
				if (message.type === "snap") this.#simulate(emit);
				else emit();
			} else {
				this.bytesIn += e.data.byteLength;
				this.#simulate(() => this.dispatchEvent(new CustomEvent("binary", { detail: e.data })));
			}
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

	#transmit(data) {
		this.bytesOut += typeof data === "string" ? data.length : data.byteLength;
		if (this.#ws.readyState === WebSocket.OPEN) this.#ws.send(data);
		else if (typeof data === "string") this.#queue.push(data);
	}

	send(obj) {
		this.#transmit(JSON.stringify(obj));
	}

	sendGame(data) {
		this.#simulate(() => this.#transmit(data));
	}

	close() {
		this.#closed = true;
		this.#ws.close(1000);
	}
}