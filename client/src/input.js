const BINDINGS = {
	up: ["KeyW", "ArrowUp"],
	down: ["KeyS", "ArrowDown"],
	left: ["KeyA", "ArrowLeft"],
	right: ["KeyD", "ArrowRight"],
	fire: ["Space"],
};

const actionByKey = {};
for (const [action, codes] of Object.entries(BINDINGS)) {
	for (const code of codes) {
		actionByKey[code] = action;
	}
}

export function createInput(onPress = () => {}) {
	const pressed = new Set();

	window.addEventListener("keydown", (event) => {
		const action = actionByKey[event.code];
		if (!action) return;

		event.preventDefault();
		pressed.add(event.code);

		if (!event.repeat) {
			onPress(action);
		}
	});
	window.addEventListener("keyup", (event) => pressed.delete(event.code));
	window.addEventListener("blur", () => pressed.clear());

	return (action) => BINDINGS[action].some((code) => pressed.has(code));
}