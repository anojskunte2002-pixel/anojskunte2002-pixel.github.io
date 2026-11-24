self.__ARKA_SW_BUILD__ = {"version":"15e5d09ccad7","precache":["/index.html","/assets/index-BpfFS58Q.js","/assets/AddManyPage-bD11UFUA.js","/assets/AdminControls-Cdue76lx.js","/assets/ChecklistPage-CXKHUagE.js","/assets/CloseMonthPage-CXQfDAww.js","/assets/DataHealthPage-DrEGVsR2.js","/assets/DataModeAdmin-BVmkB-Nh.js","/assets/EmailOutboxPanel-BR48zP83.js","/assets/FilterSheet-tl4W7jRu.js","/assets/FitLayout-CJb4SrEO.js","/assets/FitOverviewPage-CaFeeWP2.js","/assets/FitPlantPage-BqaXo2_z.js","/assets/GeneratedReports-3D6YXpnL.js","/assets/LivePage-CLQUk-i7.js","/assets/ManualEntryPage-BQPsqQ7B.js","/assets/MonthPlanPage-Bxr3HgMP.js","/assets/PeoplePanel-C4RlbxLM.js","/assets/PlantDetails-C27nq7Qc.js","/assets/PlantLayoutPage-B8fwofMF.js","/assets/PmChecklist-BfJC7AXk.js","/assets/PulsePage-C_2zjfom.js","/assets/QcPages-BuuTYy-W.js","/assets/ReportsAdmin-DIDVgUV8.js","/assets/ReportsPage-DIY1VhvM.js","/assets/RevenuePage-B5gvqfau.js","/assets/ScoreParts-D_0rRhjj.js","/assets/SolarField-BPYUIAcG.js","/assets/SourceNotice-BRRW2Vmw.js","/assets/SwipeScroller-tt8pjOIT.js","/assets/TargetsPage-B5sIrLFE.js","/assets/TicketingAdmin-h3-qJlh5.js","/assets/TicketsPage-BmwjWTMf.js","/assets/UsagePanel-DxYDLln5.js","/assets/activity-D0Nn5Dnm.js","/assets/api-CgdSGtPC.js","/assets/arrow-up-CA81szEK.js","/assets/arrow-up-right-DppDnOfb.js","/assets/bell-Drk_dii4.js","/assets/changeLogs-b3bzi-8B.js","/assets/chartKit-CS_njUo-.js","/assets/check-Derbf5jH.js","/assets/chevron-down-BdXGlOwY.js","/assets/chevron-left-C80-H6DX.js","/assets/circle-check-DVP99sMU.js","/assets/circle-dashed-BAj8ibZY.js","/assets/dist-BOZwMTBF.js","/assets/dist-DML_qDC4.js","/assets/file-spreadsheet-iFnKGQc_.js","/assets/inbox-Bpx6mkmC.js","/assets/indian-rupee-CbT2J32x.js","/assets/lib-gUkHk9Pb.js","/assets/manualApi-CILRFie5.js","/assets/map-pin-7SCGiOyH.js","/assets/media-1pklzRpa.js","/assets/metrics-CKthF1p6.js","/assets/minus-lESiBSHZ.js","/assets/phone-DjDu0PTi.js","/assets/plus-DqIiwwNP.js","/assets/power-DUbsqqA4.js","/assets/primitives-Dm7HniUc.js","/assets/rows-3-nlBrvvXN.js","/assets/schemas-Ca6HJBLY.js","/assets/search-CPbdN-M0.js","/assets/sliders-horizontal-CaYmht45.js","/assets/trending-up-CFGpB4gD.js","/assets/trophy-DpIhM5Qf.js","/assets/ui-CAR8uuBm.js","/assets/ui-VLbgUypZ.js","/assets/useMutation-THd-vuKy.js","/assets/users-CTKx-YN4.js","/assets/utils-CXCrHMtn.js","/assets/index-Bsu_FNY2.css","/favicon.svg","/ticketing-manifest.json"]};
// The Tickets page's service worker: it lets the page open on a phone with no signal.
//
// This one file is both the worker and its tests' subject. `npm run build` turns it into
// /ticketing-sw.js (portal/vite-plugin-ticketing-sw.ts: types stripped, the build's file list put
// in front as self.__ARKA_SW_BUILD__). In the app and in tests it is a plain module: the last
// lines only wire the events when it really runs as a service worker.
//
// What it does, and only that:
//  - registered with scope /ticketing (offlineCache.ts), so the browser hands it the Tickets
//    page and nothing else; every other module's page never passes through it;
//  - on install, keeps this build's app shell (index.html and every hashed bundle) in a cache
//    named after the build;
//  - a navigation to /ticketing or /ticketing/... goes to the network first, and only when the
//    network fails is the kept index.html served, so the app starts and reads its kept tickets;
//  - a GET for one of the kept shell files is answered from the cache (they are hashed, so
//    they never change), falling back to the network;
//  - everything else (every API call, every POST/PUT/PATCH/DELETE, other sites) is not touched
//    at all: the browser fetches it as if there were no worker, and nothing of it is kept.
//    Ticket data is kept by the query cache instead (offlineCache.ts), cleared on sign-out.
//  - a new build's worker waits (no skipWaiting) and takes over once no Tickets tab is using
//    the old one; it then drops the old build's cache. A page left open on the old build keeps
//    finding its own bundles in the old cache until then.
//  - shows the ticket push alerts this device turned on (pushDevice.ts; arka/modules/tickets/
//    push.py): each as a notification titled with the ticket's code, repeats about one ticket
//    replacing each other (tag), and a tap opens the ticket in an Arka tab already open, or in
//    a new one. It only ever opens a page of this site's Tickets.
const TICKETING_PATH = "/ticketing";
const WORKER_URL = "/ticketing-sw.js";
const MANIFEST_URL = "/ticketing-manifest.json";
const SHELL_URL = "/index.html";
const CACHE_PREFIX = "arka-tickets-shell-";
/** /ticketing and anything under it; not /ticketing-sw.js or /ticketingx. */
function inTicketingScope(pathname) {
	return pathname === TICKETING_PATH || pathname.startsWith(`${TICKETING_PATH}/`);
}
function cacheName(build) {
	return `${CACHE_PREFIX}${build.version}`;
}
/** The heart of the worker, kept pure so it can be tested: which requests it answers, and how. */
function route(request, origin, precache) {
	if (request.method.toUpperCase() !== "GET") return "network";
	let url;
	try {
		url = new URL(request.url);
	} catch {
		return "network";
	}
	if (url.origin !== origin) return "network";
	if (request.mode === "navigate") return inTicketingScope(url.pathname) ? "shell" : "network";
	// Only the build's own files, matched without a query string; never index.html as a
	// subresource and never an API path (none is in the list).
	if (url.pathname !== SHELL_URL && !url.search && precache.has(url.pathname)) return "precached";
	return "network";
}
/** The build block, checked: anything malformed means "keep nothing". */
function readBuild(raw) {
	if (typeof raw !== "object" || raw === null) return {
		version: "none",
		precache: []
	};
	const version = "version" in raw && typeof raw.version === "string" ? raw.version : "none";
	const list = "precache" in raw && Array.isArray(raw.precache) ? raw.precache : [];
	const precache = list.filter((p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("//"));
	return {
		version,
		precache
	};
}
/** Keeps every shell file; one that cannot be fetched fails the install, so the old build stays. */
async function precacheShell(scope, build) {
	const cache = await scope.caches.open(cacheName(build));
	for (const path of build.precache) {
		const response = await scope.fetch(path, {
			cache: "reload",
			credentials: "same-origin"
		});
		if (!response.ok) throw new Error(`could not keep ${path}: ${response.status}`);
		await cache.put(path, response);
	}
}
/** Drops the caches of earlier builds of this worker (never anyone else's). */
async function dropOldShells(scope, build) {
	const keep = cacheName(build);
	const names = await scope.caches.keys();
	await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== keep).map((n) => scope.caches.delete(n)));
}
/** The answer for a request the worker handles; null for one it leaves to the browser. */
function answer(scope, build, request, precache) {
	const how = route(request, scope.location.origin, precache);
	if (how === "network") return null;
	const kept = (path) => scope.caches.open(cacheName(build)).then((c) => c.match(path));
	if (how === "shell") {
		return scope.fetch(request).catch(async (error) => {
			const shell = await kept(SHELL_URL);
			if (shell) return shell;
			throw error;
		});
	}
	const path = new URL(request.url).pathname;
	return kept(path).then((hit) => hit ?? scope.fetch(request));
}
function install(scope, build) {
	const precache = new Set(build.precache);
	scope.addEventListener("install", (event) => {
		event.waitUntil(precacheShell(scope, build));
	});
	scope.addEventListener("activate", (event) => {
		event.waitUntil(dropOldShells(scope, build));
	});
	scope.addEventListener("fetch", (event) => {
		const reply = answer(scope, build, event.request, precache);
		if (reply) event.respondWith(reply);
	});
}
// --- Push alerts -------------------------------------------------------------------------
const ALERT_ICON = "/favicon.svg";
/** The Tickets page path a link points to, on this site whatever host the server named;
*  anything outside the Tickets page opens the Tickets page itself. */
function alertPath(link, origin) {
	if (typeof link !== "string" || !link) return TICKETING_PATH;
	let url;
	try {
		url = new URL(link, origin);
	} catch {
		return TICKETING_PATH;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return TICKETING_PATH;
	return inTicketingScope(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : TICKETING_PATH;
}
const text = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
/** The server's message (push.payload), checked: an unreadable one still shows a plain alert. */
function readAlert(raw, origin) {
	const data = typeof raw === "object" && raw !== null ? raw : {};
	return {
		title: text(data.title, 120) || "Arka ticket alert",
		body: text(data.body, 600),
		path: alertPath(data.url, origin),
		tag: text(data.tag, 64) || "arka-ticket"
	};
}
function showAlert(scope, data) {
	let raw = null;
	try {
		raw = data?.json() ?? null;
	} catch {
		raw = null;
	}
	const alert = readAlert(raw, scope.location.origin);
	return scope.registration.showNotification(alert.title, {
		body: alert.body,
		tag: alert.tag,
		// A second alert about the same ticket replaces the first, and still rings.
		renotify: true,
		icon: ALERT_ICON,
		badge: ALERT_ICON,
		data: { path: alert.path }
	});
}
/** A tap: an open Tickets tab goes to the ticket and comes forward; else a new window opens. */
async function openAlert(scope, notificationData) {
	const data = typeof notificationData === "object" && notificationData !== null ? notificationData : {};
	const path = alertPath(data.path, scope.location.origin);
	const target = new URL(path, scope.location.origin).href;
	const windows = await scope.clients.matchAll({
		type: "window",
		includeUncontrolled: true
	});
	const open = windows.find((w) => {
		try {
			const url = new URL(w.url);
			return url.origin === scope.location.origin && inTicketingScope(url.pathname);
		} catch {
			return false;
		}
	});
	if (open) {
		try {
			await open.focus();
			if (open.navigate) await open.navigate(target);
			return;
		} catch {}
	}
	await scope.clients.openWindow(target);
}
function installPush(scope) {
	scope.addEventListener("push", (event) => {
		event.waitUntil(showAlert(scope, event.data));
	});
	scope.addEventListener("notificationclick", (event) => {
		event.notification.close();
		event.waitUntil(openAlert(scope, event.notification.data));
	});
}
function isPushScope(scope) {
	return typeof scope === "object" && scope !== null && "registration" in scope && "clients" in scope;
}
/** True only inside a real service worker (a window has no skipWaiting or registration). */
function isWorkerScope(scope) {
	return typeof scope === "object" && scope !== null && "skipWaiting" in scope && "registration" in scope && "caches" in scope && "addEventListener" in scope;
}
const here = globalThis;
if (isWorkerScope(here)) {
	install(here, readBuild(here.__ARKA_SW_BUILD__));
	if (isPushScope(here)) installPush(here);
}
