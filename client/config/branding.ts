/** The client's own name: the browser tab, the login screen's fallback, the plugin list. */
export const CLIENT_NAME = "Realm of Eeshwar";

/** The tab title for a server: its name, followed by the client's unless they are the same. */
export function pageTitle(serverName: string): string {
    const name = serverName.trim();
    if (!name || name === CLIENT_NAME) return CLIENT_NAME;
    return `${name} - ${CLIENT_NAME}`;
}
