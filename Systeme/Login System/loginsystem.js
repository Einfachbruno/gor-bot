// ============================================================
//  GOR Star Wars RP – Login-System
//  Datei:   System/LoginSystem/loginSystem.js
//  Zweck:   Wird von der index.js als Modul geladen und
//           registriert alle Login-relevanten Events selbst.
// ============================================================

const { EmbedBuilder } = require("discord.js");
const config           = require("../../config.json");

// ============================================================
//  ROLLEN-IDs (dynamisch aus config.json gelesen)
// ============================================================
const ROLE_EINGELOGGT = Object.entries(config.statusRoles)
    .find(([, v]) => v.name === "Eingeloggt")?.[0];

const ROLE_AUSGELOGGT = Object.entries(config.statusRoles)
    .find(([, v]) => v.name === "Ausgeloggt")?.[0];

// Sicherheitsprüfung beim Laden des Moduls
if (!ROLE_EINGELOGGT || !ROLE_AUSGELOGGT) {
    throw new Error(
        "[LoginSystem] Konnte 'Eingeloggt'- oder 'Ausgeloggt'-Rolle nicht in config.json finden!"
    );
}

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

/**
 * Gibt die aktuelle Uhrzeit in der deutschen Zeitzone zurück.
 * @returns {string}  z. B. "14:35:07"
 */
function getGermanTime() {
    return new Date().toLocaleTimeString("de-DE", {
        timeZone: "Europe/Berlin",
        hour:     "2-digit",
        minute:   "2-digit",
        second:   "2-digit",
    });
}

/**
 * Prüft, ob ein GuildMember mindestens eine Team-Rolle
 * aus config.roles besitzt.
 * @param   {import("discord.js").GuildMember} member
 * @returns {boolean}
 */
function hasTeamRole(member) {
    return Object.keys(config.roles).some((id) => member.roles.cache.has(id));
}

// ============================================================
//  EMBEDS
// ============================================================

/** Grünes Login-Embed für die PN */
function buildLoginEmbed(member) {
    return new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("📥 Dienst erfolgreich angetreten")
        .setDescription(
            `Willkommen im Dienst, **${member.displayName}**!\n` +
            `Du bist jetzt offiziell auf **${config.serverName}** eingeloggt.`
        )
        .addFields(
            { name: "Status",  value: "🟢 Eingeloggt / Im Dienst", inline: true },
            { name: "Uhrzeit", value: getGermanTime(),              inline: true }
        )
        .setFooter({ text: config.serverName })
        .setTimestamp();
}

/** Rotes Logout-Embed für die PN */
function buildLogoutEmbed(member) {
    return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("📤 Dienst erfolgreich beendet")
        .setDescription(
            `Auf Wiedersehen, **${member.displayName}**!\n` +
            `Du wurdest erfolgreich von **${config.serverName}** ausgeloggt.`
        )
        .addFields(
            { name: "Status",  value: "🔴 Ausgeloggt / Außer Dienst", inline: true },
            { name: "Uhrzeit", value: getGermanTime(),                 inline: true }
        )
        .setFooter({ text: config.serverName })
        .setTimestamp();
}

/** Oranges AFK-Logout-Embed für die PN */
function buildAfkEmbed(member) {
    return new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle("⏳ Automatischer AFK-Logout")
        .setDescription(
            `Du wurdest automatisch aus dem Dienst auf **${config.serverName}** abgemeldet,\n` +
            `da dein Discord-Status als inaktiv oder offline erkannt wurde.`
        )
        .addFields(
            {
                name:   "Grund",
                value:  "Inaktivität (Maus ~10 Minuten unbewegt / Status manuell geändert)",
                inline: false,
            },
            { name: "Uhrzeit", value: getGermanTime(), inline: true }
        )
        .setFooter({ text: config.serverName })
        .setTimestamp();
}

// ============================================================
//  HANDLER: !login
// ============================================================
async function handleLogin(message) {
    const member = message.member;

    // SCHRITT A – Team-Rollen-Prüfung
    if (!hasTeamRole(member)) {
        await message.reply("❌ Du gehörst nicht zum Team und kannst dich nicht einloggen!");
        return;
    }

    // SCHRITT B – Bereits eingeloggt?
    if (member.roles.cache.has(ROLE_EINGELOGGT)) {
        await message.reply("ℹ️ Du bist bereits eingeloggt!");
        return;
    }

    // SCHRITT C – Rollen tauschen
    try {
        await member.roles.add(ROLE_EINGELOGGT);
        await member.roles.remove(ROLE_AUSGELOGGT);
        console.log(`[LoginSystem] ✅ ${member.user.tag} hat sich eingeloggt (${getGermanTime()})`);
    } catch (err) {
        console.error(`[LoginSystem] ❌ Rollen-Fehler bei ${member.user.tag}:`, err);
        await message.reply("❌ Beim Zuweisen deiner Rollen ist ein Fehler aufgetreten. Bitte wende dich an einen Administrator.");
        return;
    }

    // SCHRITT D – Nachricht nach 3 Sekunden löschen
    setTimeout(async () => {
        try { await message.delete(); } catch { /* ignorieren */ }
    }, 3_000);

    // SCHRITT E – Login-PN senden  |  SCHRITT F – Fallback
    try {
        await member.send({ embeds: [buildLoginEmbed(member)] });
    } catch {
        try {
            const fallback = await message.channel.send(
                `⚠️ ${member}, dein Login war erfolgreich, aber ich konnte dir keine PN senden (Privatsphäre-Einstellungen?).`
            );
            setTimeout(async () => {
                try { await fallback.delete(); } catch { /* ignorieren */ }
            }, 5_000);
        } catch (err) {
            console.error("[LoginSystem] ❌ Fallback-Nachricht fehlgeschlagen:", err);
        }
    }
}

// ============================================================
//  HANDLER: !logout
// ============================================================
async function handleLogout(message) {
    const member = message.member;

    // SCHRITT A – Team-Rollen-Prüfung
    if (!hasTeamRole(member)) {
        await message.reply("❌ Du gehörst nicht zum Team und kannst dich nicht ausloggen!");
        return;
    }

    // SCHRITT B – Bereits ausgeloggt?
    if (!member.roles.cache.has(ROLE_EINGELOGGT)) {
        await message.reply("ℹ️ Du bist bereits ausgeloggt!");
        return;
    }

    // SCHRITT C – Rollen tauschen
    try {
        await member.roles.remove(ROLE_EINGELOGGT);
        await member.roles.add(ROLE_AUSGELOGGT);
        console.log(`[LoginSystem] 🔴 ${member.user.tag} hat sich ausgeloggt (${getGermanTime()})`);
    } catch (err) {
        console.error(`[LoginSystem] ❌ Rollen-Fehler bei ${member.user.tag}:`, err);
        await message.reply("❌ Beim Entfernen deiner Rollen ist ein Fehler aufgetreten. Bitte wende dich an einen Administrator.");
        return;
    }

    // SCHRITT D – Nachricht nach 3 Sekunden löschen
    setTimeout(async () => {
        try { await message.delete(); } catch { /* ignorieren */ }
    }, 3_000);

    // SCHRITT E – Logout-PN senden  |  Fallback bei blockierten PNs
    try {
        await member.send({ embeds: [buildLogoutEmbed(member)] });
    } catch {
        try {
            const fallback = await message.channel.send(
                `⚠️ ${member}, dein Logout war erfolgreich, aber ich konnte dir keine PN senden (Privatsphäre-Einstellungen?).`
            );
            setTimeout(async () => {
                try { await fallback.delete(); } catch { /* ignorieren */ }
            }, 5_000);
        } catch (err) {
            console.error("[LoginSystem] ❌ Fallback-Nachricht fehlgeschlagen:", err);
        }
    }
}

// ============================================================
//  HANDLER: presenceUpdate – Automatischer AFK-Logout
//
//  WIE ES FUNKTIONIERT:
//  Discord setzt den Status eines Users nach ~10 Minuten
//  ohne Mausbewegung automatisch auf "idle". Der Bot reagiert
//  auf diesen Statuswechsel über das presenceUpdate-Event.
//
//  EINSCHRÄNKUNG:
//  Dies ist eine Discord-seitige Funktion. Der Bot kann
//  die Maus nicht selbst überwachen. Nutzer auf "Unsichtbar"
//  werden sofort ausgeloggt (Status = "offline").
// ============================================================
async function handlePresenceUpdate(oldPresence, newPresence) {

    // Grundlegende Filter: Bots & ungültige Presences ignorieren
    if (!newPresence)                return;
    if (!newPresence.member)         return;
    if (newPresence.member.user.bot) return;

    const member    = newPresence.member;
    const newStatus = newPresence.status; // "online" | "idle" | "dnd" | "offline"

    // Nur eingeloggte Mitglieder verarbeiten
    if (!member.roles.cache.has(ROLE_EINGELOGGT)) return;

    // Nur bei idle (~10 Min. inaktiv) oder offline/unsichtbar reagieren
    if (newStatus !== "idle" && newStatus !== "offline") return;

    console.log(
        `[LoginSystem] 🔄 AFK-Logout: ${member.user.tag} | ` +
        `Status: ${newStatus} | Uhrzeit: ${getGermanTime()}`
    );

    // Rollen zurücktauschen
    try {
        await member.roles.remove(ROLE_EINGELOGGT);
        await member.roles.add(ROLE_AUSGELOGGT);
        console.log(`[LoginSystem] ✅ AFK-Rollen für ${member.user.tag} zurückgetauscht.`);
    } catch (err) {
        console.error(`[LoginSystem] ❌ AFK Rollen-Fehler (${member.user.tag}):`, err);
        return;
    }

    // AFK-Embed per PN – Fehler abfangen damit der Bot stabil bleibt
    await member.send({ embeds: [buildAfkEmbed(member)] }).catch((err) => {
        console.warn(`[LoginSystem] ⚠️  AFK-PN nicht zustellbar (${member.user.tag}): ${err.message}`);
    });
}

// ============================================================
//  MODUL-EXPORT
//  Registriert alle Events auf dem übergebenen Client.
//  Aufruf in index.js: require("./System/LoginSystem/loginSystem")(client)
// ============================================================
module.exports = function registerLoginSystem(client) {
    console.log("[LoginSystem] 🔧 Registriere Events …");

    // Text-Commands: !login und !logout
    client.on("messageCreate", async (message) => {
        if (message.author.bot)              return;
        if (!message.content.startsWith("!")) return;

        const command = message.content.slice(1).trim().split(/\s+/)[0].toLowerCase();

        if (command === "login")  await handleLogin(message);
        if (command === "logout") await handleLogout(message);
    });

    // Presence-Tracking für automatischen AFK-Logout
    client.on("presenceUpdate", async (oldPresence, newPresence) => {
        await handlePresenceUpdate(oldPresence, newPresence);
    });

    console.log("[LoginSystem] ✅ Login-System erfolgreich geladen.");
};
