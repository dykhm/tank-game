import { defineConfig } from "vite";

const rooms = [
	{ id: "easy", name: "Easy", max: 4, arena: { missileInterval: 4, maxMissiles: 3 } },
	{ id: "normal", name: "Normal", max: 4, arena: { missileInterval: 2.5, maxMissiles: 5 } },
	{ id: "hard", name: "Hard", max: 8, arena: { missileInterval: 1.2, maxMissiles: 10 } },
];

export default defineConfig({
	plugins: [
		{
			name: "rooms-api",
			configureServer(server) {
				server.middlewares.use("/api/rooms", (req, res) => {
					const data = rooms.map((r) => ({
						...r,
						players: Math.floor(Math.random() * (r.max + 1)),
					}));
					setTimeout(() => {
						res.setHeader("Content-Type", "application/json");
						res.end(JSON.stringify(data));
					}, Number(process.env.DELAY) || 0);
				});
			},
		},
	],
});
