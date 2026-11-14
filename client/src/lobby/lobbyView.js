const $ = (selector) => document.querySelector(selector);

export function createLobbyView(lobby) {
	const select = $("#room");
	let rooms = [];

	lobby.addEventListener("rooms", (event) => {
		rooms = event.detail;

		const selected = select.value; 
		select.replaceChildren(
			...rooms.map((r) => new Option(`${r.name} (${r.players}/${r.max})`, r.id)),
		);
		if (selected) select.value = selected;

		$("#join").disabled = rooms.length === 0;
		$("#lobby-status").textContent = "";
	});

	lobby.addEventListener("failed", (event) => {
		const { name, message } = event.detail;
		$("#lobby-status").textContent = `Rooms error: ${name} ${message}. Retrying...`;
	});

	$("#join").addEventListener("click", () => {
		const room = rooms.find((r) => r.id === select.value);
		lobby.join($("#name").value.trim() || "Player", room);
	});
}
