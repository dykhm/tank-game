import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export function createMatchLog(file) {
	const source = new Readable({ objectMode: true, read() {} });
	const toNdjson = new Transform({
		writableObjectMode: true,
		transform(event, _encoding, callback) {
			callback(null, `${JSON.stringify(event)}\n`);
		},
	});
	const done = pipeline(source, toNdjson, createWriteStream(file, { flags: "a" }));
	done.catch((err) => console.error("log error:", err.message));

	return {
		write: (event) => source.push({ time: Date.now(), ...event }),
		end: () => source.push(null),
		done,
	};
}