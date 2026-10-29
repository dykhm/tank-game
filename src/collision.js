function overlap(a, b) {
	const dx = a.position.x - b.position.x;
	const dy = a.position.y - b.position.y;
	const radius = a.radius + b.radius;

	return dx * dx + dy * dy <= radius * radius;
}

const RULES = [
	[
		"bullet",
		"homingMissile",
		(bullet, missile, world) => {
			bullet.dead = true;
			missile.dead = true;
			world.score++;
		},
	],
	[
		"bullet",
		"tank",
		(bullet, tank) => {
			if (bullet.owner === tank) return; 
			bullet.dead = true;
			tank.takeDamage();
		},
	],
	[
		"homingMissile",
		"tank",
		(missile, tank) => {
			missile.dead = true;
			tank.takeDamage();
		},
	],
	[
		"pickup",
		"tank",
		(item, tank) => {
			item.dead = true;
			item.get("pickup").effect(tank);
		},
	],
];

export function resolveCollisions(world) {
	for (const [kindA, kindB, onHit] of RULES) {
		for (const a of world.ofKind(kindA)) {
			for (const b of world.ofKind(kindB)) {
				if (!a.dead && !b.dead && overlap(a, b)) {
					onHit(a, b, world);
				}
			}
		}
	}
}