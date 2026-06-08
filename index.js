require('dotenv').config({ path: __dirname + '/.env' });
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { GameDig } = require('gamedig');

// ==================== HIER DEINE DATEN EINTRAGEN ====================
const BOT_TOKEN  = process.env.DISCORD_TOKEN;
const SERVER_IP  = '194.69.160.28';
const SERVER_PORT = 27015;
// ====================================================================

// ============================================================
//  CLIENT – Intents erweitert für das Login-System
//  GuildMessages, MessageContent, GuildMembers und
//  GuildPresences sind zwingend für !login & AFK-Tracking.
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

// ============================================================
//  SYSTEM-MODULE laden
//  Pfad exakt an Pterodactyl angepasst (/Systeme/Login System/)
// ============================================================
try {
    // Versuch 1: Falls die Datei am Ende ein großes S hat (loginSystem.js)
    require('./Systeme/Login System/loginSystem')(client);
    console.log("✅ Login-System erfolgreich geladen!");
} catch (error1) {
    try {
        // Versuch 2: Falls die Datei am Ende komplett kleingeschrieben ist (loginsystem.js)
        require('./Systeme/Login System/loginsystem')(client);
        console.log("✅ Login-System erfolgreich geladen (kleingeschrieben)!");
    } catch (error2) {
        console.error("⚠️ Fehler beim Laden des Login-Systems!");
        console.error("Details Versuch 1:", error1.message);
        console.error("Details Versuch 2:", error2.message);
    }
}

// ============================================================
//  READY-EVENT (clientReady verhindert die Deprecation-Warnung)
// ============================================================
client.once('clientReady', () => {
    console.log(`✅ Erfolgreich eingeloggt als ${client.user.tag}!`);
    console.log(`📡 Ueberwache den GMod-Server auf IP: ${SERVER_IP}:${SERVER_PORT}`);

    // Alle 30 Sekunden die Spielerzahl aktualisieren
    setInterval(updatePlayerCount, 30000);
    updatePlayerCount(); // Direkt beim Start einmal ausführen
});

// ============================================================
//  GAMEDIG – Spielerzahl-Abfrage
// ============================================================
function updatePlayerCount() {
    GameDig.query({
        type: 'garrysmod',
        host: SERVER_IP,
        port: parseInt(SERVER_PORT),
    })
    .then((state) => {
        client.user.setActivity(
            `${state.players.length}/${state.maxplayers} Spielern auf AOC`,
            { type: ActivityType.Watching }
        );
        console.log(`🎮 Status aktualisiert: ${state.players.length}/${state.maxplayers} Spieler online.`);
    })
    .catch((error) => {
        console.log('⚠️ Fehler beim Abrufen des GMod-Servers (Evtl. ist der Server noch offline): ' + error.message);
        client.user.setActivity('Warte auf Server... ❌', { type: ActivityType.Watching });
    });
}

// ============================================================
//  BOT LOGIN
// ============================================================
client.login(BOT_TOKEN);
