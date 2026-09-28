import "./style.css";

import { createInput } from "./input";
import { createLoop } from "./loop";
import { integrate } from "./physics";
import { render } from "./render";

const canvas = document.querySelector(".game");
const ctx = canvas.getContext("2d");

const dpr = window.devicePixelRatio || 1;

canvas.width = window.innerWidth * dpr;
canvas.height = window.innerHeight * dpr;

canvas.style.width = `${window.innerWidth}px`;
canvas.style.height = `${window.innerHeight}px`;

ctx.scale(dpr, dpr);

const tank = {
	y: window.innerHeight / 2,
	x: window.innerWidth / 2,
	vx: 0,
	vy: 0,
	angle: 0,
};

const previousTank = {
	x: tank.x,
	y: tank.y,
	angle: tank.angle,
};

const input = createInput();

createLoop(
	(dt) => {
		previousTank.x = tank.x;
		previousTank.y = tank.y;
		previousTank.angle = tank.angle;

		integrate(tank, input, dt);
	},

	(alpha) => {
		render(
			ctx,
			tank,
			previousTank,
			window.innerWidth,
			window.innerHeight,
			alpha,
		);
	},
);
