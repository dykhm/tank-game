const $ = (selector) => document.querySelector(selector);

export function startChat(socket) {
	const log = $("#chat-log");
	const input = $("#chat-input");
	$("#chat").hidden = false;

	const add = (text) => {
		const line = document.createElement("div");
		line.textContent = text;
		log.append(line);
		log.scrollTop = log.scrollHeight;
	};

	socket.addEventListener("message", (e) => {
		const m = e.detail;
		if (m.type === "joined") add(`${m.name} joined (${m.players.length} in room)`);
		if (m.type === "left") add(`${m.name} left`);
		if (m.type === "chat") add(`${m.name}: ${m.text}`);
	});
	socket.addEventListener("close", (e) => add(`Disconnected (code ${e.detail})`));

	input.addEventListener("keydown", (e) => {
		e.stopPropagation();
		const text = input.value.trim();
		if (e.key === "Enter" && text) {
			socket.send({ type: "chat", text });
			input.value = "";
		}
	});
	input.addEventListener("keyup", (e) => e.stopPropagation());

	$("#leave").addEventListener("click", () => {
		socket.close();
		location.reload();
	});
}