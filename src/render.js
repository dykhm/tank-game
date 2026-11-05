const lerp = (a, b, t) => a + (b - a) * t;

const TELEPORT_DISTANCE = 50;

function renderPosition(entity, alpha) {
	const { previousPosition: from, position: to } = entity;

	if (from.distanceTo(to) > TELEPORT_DISTANCE) {
		return { x: to.x, y: to.y };
	}
	return { x: lerp(from.x, to.x, alpha), y: lerp(from.y, to.y, alpha) };
}

const CELL = 48;
const SPRITE = { tank: 0, bullet: 1, homingMissile: 2, heal: 3, homingAmmo: 4 };

function drawSprite(ctx, sheet, name, position, size, angle = 0) {
	ctx.save();
	ctx.translate(position.x, position.y);
	ctx.rotate(angle);
	ctx.drawImage(sheet, SPRITE[name] * CELL, 0, CELL, CELL, -size / 2, -size / 2, size, size);
	ctx.restore();
}

function drawExplosion(ctx, explosion) {
	for (const p of explosion.particles) {
		ctx.beginPath();
		ctx.arc(p.position.x, p.position.y, 2 + p.life * 3, 0, Math.PI * 2);
		ctx.fillStyle = "orange";
		ctx.fill();
	}
}

export function render(ctx, world, alpha, width, height, sheet) {
	ctx.clearRect(0, 0, width, height);

	for (const e of world) {
		if (e.kind === "explosion") {
			drawExplosion(ctx, e);
			continue;
		}

		const position = renderPosition(e, alpha);
		if (e.kind === "tank") {
			const angle = lerp(e.previousAngle, e.angle, alpha);
			drawSprite(ctx, sheet, "tank", position, 48, angle);
		} else if (e.kind === "pickup") {
			drawSprite(ctx, sheet, e.get("pickup").sprite, position, e.radius * 3);
		} else {
			drawSprite(ctx, sheet, e.kind, position, e.radius * 3);
		}
	}
}
