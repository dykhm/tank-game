import { HEIGHT, PICKUP_TYPES, WIDTH } from "../../shared/index.js";

const CELL = 48;
const SPRITE = { tank: 0, bullet: 1, missile: 2, heal: 3, homingAmmo: 4 };

function drawSprite(ctx, sheet, name, x, y, size, angle = 0) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.drawImage(sheet, SPRITE[name] * CELL, 0, CELL, CELL, -size / 2, -size / 2, size, size);
	ctx.restore();
}

export function render(ctx, view, sheet, names, width, height) {
	ctx.clearRect(0, 0, width, height);

	const scale = Math.min(width / WIDTH, height / HEIGHT);
	ctx.save();
	ctx.translate((width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2);
	ctx.scale(scale, scale);
	ctx.strokeStyle = "rgb(40, 12, 163)";
	ctx.strokeRect(0, 0, WIDTH, HEIGHT);

	if (view) {
		for (const p of view.pickups) drawSprite(ctx, sheet, PICKUP_TYPES[p.type], p.x, p.y, 30);
		for (const m of view.missiles) drawSprite(ctx, sheet, "missile", m.x, m.y, 30);
		for (const b of view.bullets) drawSprite(ctx, sheet, "bullet", b.x, b.y, 9);

		ctx.font = "12px 'Zen Dots'";
		ctx.textAlign = "center";
		for (const t of view.tanks) {
			if (t.dead) continue;
			drawSprite(ctx, sheet, "tank", t.x, t.y, 48, t.angle);
			ctx.fillStyle = t.own ? "rgb(40, 12, 163)" : "rgb(116, 24, 24)";
			ctx.fillText(names.get(t.id) ?? `#${t.id}`, t.x, t.y - 34);
		}
	}
	ctx.restore();
}