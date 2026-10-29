const lerp = (a, b, t) => a + (b - a) * t;

const TELEPORT_DISTANCE = 50;

function renderPosition(entity, alpha) {
	const { previousPosition: from, position: to } = entity;

	if (from.distanceTo(to) > TELEPORT_DISTANCE) {
		return { x: to.x, y: to.y };
	}
	return { x: lerp(from.x, to.x, alpha), y: lerp(from.y, to.y, alpha) };
}

function circle(ctx, position, radius, color) {
	ctx.beginPath();
	ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
}

function drawTank(ctx, tank, alpha) {
	const { x, y } = renderPosition(tank, alpha);
	const angle = lerp(tank.previousAngle, tank.angle, alpha);

	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);

	ctx.lineWidth = 2;
	ctx.strokeStyle = "black";
	ctx.strokeRect(-16, -23, 32, 46);

	ctx.fillStyle = "#0F2070";
	ctx.fillRect(-15, -22, 30, 44);

	ctx.strokeRect(-8, -12, 16, 23);

	ctx.fillStyle = "black";
	ctx.fillRect(-20, -19, 5, 40);
	ctx.fillRect(15, -19, 5, 40);
	ctx.fillRect(-2, -38, 5, 40);

	ctx.restore();
}

const drawers = {
	tank: drawTank,
	bullet: (ctx, e, alpha) =>
		circle(
			ctx,
			renderPosition(e, alpha),
			e.radius,
			e.has("homing") ? "dodgerblue" : "orange",
		),
	homingMissile: (ctx, e, alpha) =>
		circle(ctx, renderPosition(e, alpha), e.radius, "red"),
	pickup: (ctx, e, alpha) =>
		circle(ctx, renderPosition(e, alpha), e.radius, e.get("pickup").color),
	explosion: (ctx, e) => {
		for (const p of e.particles) {
			circle(ctx, p.position, 2 + p.life * 3, "orange");
		}
	},
};

export function render(ctx, world, alpha, width, height) {
	ctx.clearRect(0, 0, width, height);

	for (const entity of world) {
		drawers[entity.kind](ctx, entity, alpha);
	}
}