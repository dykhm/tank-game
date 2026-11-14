import { resolve } from "node:path";

function readPort(value = "3000") {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid PORT: "${value}" (need an integer 1-65535)`);
	}
	return port;
}

function readLogDir(value = "logs") {
	if (value.trim() === "") throw new Error("LOG_DIR must not be empty");
	return resolve(value);
}

export const config = {
	port: readPort(process.env.PORT),
	logDir: readLogDir(process.env.LOG_DIR),
	clientDir: resolve(import.meta.dirname, "../client/dist"),
};