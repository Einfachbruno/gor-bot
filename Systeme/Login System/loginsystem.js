// ============================================================
//  AOC Star Wars RP – Login-System
//  Datei:   System/LoginSystem/loginSystem.js
//  Zweck:   Wird von der index.js als Modul geladen und
//           registriert alle Login-relevanten Events selbst.
// ============================================================

const { EmbedBuilder } = require("discord.js");
const config           = require("../../config.json");

// ============================================================
//  ROLLEN-IDs (aus config.json gelesen)
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
 * aus config.roles besitzt (powerLevel > 0 ODER committee-Rolle).
 * @param   {import("discord.js").GuildMember} member
 * @returns {boolean}
 */
function hasTeamRole(member) {
    return Object.keys(config.roles).some((id) => member.roles.cache.has(id));
}

// ============================================================
//  LOGIN-EMBED  (grün)
// ============================================================
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

// ============================================================
//  AFK-LOGOUT-EMBED  (orange)
// ============================================================
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
                value:  "Inaktivität (Maus 10 Minuten unbewegt / Status manuell geändert)",
                inline: false,
            },
            { name: "Uhrzeit", value: getGermanTime(), inline: true }
        )
        .setFooter({ text: config.serverName })
        .setTimestamp();
}

// ============================================================
//  HANDLER: !login  (wird von messageCreate aufgerufen)
// ============================================================
async function handleLogin(message) {
    const member = message.member;

    // ----------------------------------------------------------
    //  SCHRITT A – Team-Rollen-Prüfung
    // ----------------------------------------------------------
    if (!hasTeamRole(member)) {
        await message.reply(
            "❌ Du gehörst nicht zum Team und kannst dich nicht einloggen!"
        );
        return;
    }

    // ----------------------------------------------------------
    //  SCHRITT B – Bereits eingeloggt?
    // ----------------------------------------------------------
    if (member.roles.cache.has(ROLE_EINGELOGGT)) {
        await message.reply("ℹ️ Du bist bereits eingeloggt!");
        return;
    }

    // ----------------------------------------------------------
    //  SCHRITT C – Rollen tauschen
    // ----------------------------------------------------------
    try {
        await member.roles.add(ROLE_EINGELOGGT);
        await member.roles.remove(ROLE_AUSGELOGGT);
        console.log(`[LoginSystem] ✅ ${member.user.tag} hat sich eingeloggt (${getGermanTime()})`);
    } catch (err) {
        console.error(`[LoginSystem] ❌ Rollen-Fehler bei ${member.user.tag}:`, err);
        await message.reply(
            "❌ Beim Zuweisen deiner Rollen ist ein Fehler aufgetreten. " +
            "Bitte wende dich an einen Administrator."
        );
        return;
    }

    // ----------------------------------------------------------
    //  SCHRITT D – !login-Nachricht nach 3 Sekunden löschen
    // ----------------------------------------------------------
    setTimeout(async () => {
        try { await message.delete(); } catch { /* bereits gelöscht / keine Berechtigung */ }
    }, 3_000);

    // ----------------------------------------------------------
    //  SCHRITT E – Login-Bestätigung per PN
    //  SCHRITT F – Fallback-Nachricht, falls PN blockiert
    // ----------------------------------------------------------
    try {
        await member.send({ embeds: [buildLoginEmbed(member)] });
    } catch {
        // PN blockiert → temporäre öffentliche Meldung (5 s)
        try {
            const fallback = await message.channel.send(
                `⚠️ ${member}, dein Login war erfolgreich, aber ich konnte dir keine PN senden ` +
                `(Privatsphäre-Einstellungen?).`
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
//  HANDLER: presenceUpdate  (AFK-Logout)
// ============================================================
async function handlePresenceUpdate(oldPresence, newPresence) {

    // ----------------------------------------------------------
    //  SCHRITT A – Grundlegende Filter
    // ----------------------------------------------------------
    if (!newPresence)                return;
    if (!newPresence.member)         return;
    if (newPresence.member.user.bot) return;

    const member    = newPresence.member;
    const newStatus = newPresence.status; // "online" | "idle" | "dnd" | "offline"

    // ----------------------------------------------------------
    //  SCHRITT B – Nur eingeloggte Mitglieder verarbeiten
    // ----------------------------------------------------------
    if (!member.roles.cache.has(ROLE_EINGELOGGT)) return;

    // ----------------------------------------------------------
    //  SCHRITT C – Inaktivitäts-Erkennung
    //  idle    = Discord setzt nach ~10 Min. Maus-Inaktivität
    //  offline = Nutzer offline oder unsichtbar
    // ----------------------------------------------------------
    if (newStatus !== "idle" && newStatus !== "offline") return;

    console.log(
        `[LoginSystem] 🔄 AFK-Logout: ${member.user.tag} | ` +
        `Status: ${newStatus} | Uhrzeit: ${getGermanTime()}`
    );

    // ----------------------------------------------------------
    //  SCHRITT D – Rollen zurücktauschen
    // ----------------------------------------------------------
    try {
        await member.roles.remove(ROLE_EINGELOGGT);
        await member.roles.add(ROLE_AUSGELOGGT);
        console.log(`[LoginSystem] ✅ Rollen für ${member.user.tag} zurückgetauscht.`);
    } catch (err) {
        console.error(`[LoginSystem] ❌ Rollen-Fehler bei AFK-Logout (${member.user.tag}):`, err);
        return;
    }

    // ----------------------------------------------------------
    //  SCHRITT E – AFK-Logout-Embed per PN
    // ----------------------------------------------------------
    await member.send({ embeds: [buildAfkEmbed(member)] }).catch((err) => {
        console.warn(
            `[LoginSystem] ⚠️  AFK-PN nicht zustellbar (${member.user.tag}): ${err.message}`
        );
    });
}

// ============================================================
//  MODUL-EXPORT
//  Registriert alle Events direkt auf dem übergebenen Client.
//  Aufruf in index.js: require("./System/LoginSystem/loginSystem")(client)
// ============================================================
module.exports = function registerLoginSystem(client) {
    console.log("[LoginSystem] 🔧 Registriere Events …");

    // --- Text-Command-Handler (!login) -----------------------
    client.on("messageCreate", async (message) => {
        if (message.author.bot)             return;
        if (!message.content.startsWith("!")) return;

        const command = message.content.slice(1).trim().split(/\s+/)[0].toLowerCase();

        if (command === "login") {
            await handleLogin(message);
        }
    });

    // --- Presence-Handler (AFK-Logout) -----------------------
    client.on("presenceUpdate", async (oldPresence, newPresence) => {
        await handlePresenceUpdate(oldPresence, newPresence);
    });

    console.log("[LoginSystem] ✅ Login-System erfolgreich geladen.");
};