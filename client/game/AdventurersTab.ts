/**
 * Opens the adventurers page (public/adventurers.html) in its own tab beside the game, once per
 * browser session, when the game is served by the dev server (`yarn start`, also in a codespace,
 * where the server cannot open a tab for you).
 *
 * Browsers block a tab opened without a click. Then a small link stays in the corner until it is
 * used or closed; allowing pop-ups for the site once makes it open by itself from then on.
 * REACT_APP_OPEN_ADVENTURERS=0 turns it off.
 */
const OPENED_KEY = "eeshwar:adventurers-opened";
const TAB_NAME = "eeshwar-adventurers";

function pageUrl(): string {
    const base = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
    return `${base}/adventurers.html`;
}

function alreadyOpened(): boolean {
    try {
        return window.sessionStorage.getItem(OPENED_KEY) === "1";
    } catch {
        return false;
    }
}

function markOpened(): void {
    try {
        window.sessionStorage.setItem(OPENED_KEY, "1");
    } catch {
        // No storage (private mode): it may open again next load.
    }
}

function showLink(): void {
    const box = document.createElement("div");
    box.style.cssText =
        "position:fixed;top:8px;right:8px;z-index:10000;display:flex;gap:6px;align-items:center;" +
        "padding:6px 10px;background:#3e3529;border:1px solid #5a4d3c;border-radius:4px;" +
        "font:13px sans-serif;color:#ff981f;box-shadow:0 2px 6px rgba(0,0,0,.5)";
    const link = document.createElement("a");
    link.href = pageUrl();
    link.target = TAB_NAME;
    link.textContent = "Avonturiers bekijken";
    link.style.cssText = "color:#ff981f;text-decoration:underline;cursor:pointer";
    const close = document.createElement("button");
    close.textContent = "×";
    close.title = "Sluiten";
    close.style.cssText = "background:none;border:0;color:#c8b28c;font-size:16px;cursor:pointer;padding:0 2px";
    const remove = () => box.remove();
    link.addEventListener("click", () => {
        markOpened();
        remove();
    });
    close.addEventListener("click", remove);
    box.append(link, close);
    document.body.appendChild(box);
}

export function openAdventurersBesideGame(): void {
    if (process.env.NODE_ENV !== "development" || process.env.REACT_APP_OPEN_ADVENTURERS === "0") return;
    if (alreadyOpened()) return;
    const tab = window.open(pageUrl(), TAB_NAME);
    if (tab) {
        markOpened();
        // Keep the game in front.
        window.focus();
        return;
    }
    showLink();
}
