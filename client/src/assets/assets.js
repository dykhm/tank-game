const TIMEOUT = 4000;

class HttpError extends Error {
	constructor(status) {
		super(`HTTP ${status}`);
		this.name = "HttpError";
		this.status = status;
	}
}

const sleep = (ms, signal) =>
	new Promise((resolve, reject) => {
		const id = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(id);
				reject(signal.reason);
			},
			{ once: true },
		);
	});

export async function fetchOk(url, signal) {
	const signals = [AbortSignal.timeout(TIMEOUT)];
	if (signal) signals.push(signal);

	const res = await fetch(url, { signal: AbortSignal.any(signals) });
	if (!res.ok) throw new HttpError(res.status);
	return res;
}

export async function fetchJson(url, signal) {
	const res = await fetchOk(url, signal);
	return res.json();
}

async function withRetry(fn, signal, tries = 3) {
	for (let i = 0; ; i++) {
		try {
			return await fn();
		} catch (err) {
			const aborted = signal?.aborted;
			const is4xx = err.status >= 400 && err.status < 500;
			const brokenJson = err instanceof SyntaxError;
			if (aborted || is4xx || brokenJson || i === tries - 1) throw err;

			await sleep(2 ** i * 200 + Math.random() * 200, signal);
		}
	}
}

export const loadJson = (url, signal) =>
	withRetry(() => fetchJson(url, signal), signal);

export const loadImage = (url, signal) =>
	withRetry(async () => {
		const res = await fetchOk(url, signal);
		return createImageBitmap(await res.blob());
	}, signal);

export const loadAudio = (url, signal) =>
	withRetry(async () => {
		const res = await fetchOk(url, signal);
		const data = await res.arrayBuffer();
		return new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
	}, signal);

export async function loadAll(manifest, signal, onProgress) {
	const tasks = [
		...Object.entries(manifest.images).map(([name, url]) => [
			"images",
			name,
			() => loadImage(url, signal),
		]),
		...Object.entries(manifest.sounds).map(([name, url]) => [
			"sounds",
			name,
			() => loadAudio(url, signal),
		]),
	];

	const assets = { images: {}, sounds: {} };
	let done = 0;

	await Promise.all(
		tasks.map(async ([group, name, load]) => {
			assets[group][name] = await load();
			done++;
			onProgress(done / tasks.length);
		}),
	);

	return assets;
}
