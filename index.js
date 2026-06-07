const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const Gamedig = require('gamedig');

// ==================== HIER DEINE DATEN EINTRAGEN ====================
const BOT_TOKEN = 'MTUxMzI2ODg2NjUxMDM1NjYzMA.GfZNdB.pJ_ggeIZXRCEQXecmKtv7X_kJnVfhF4Gas3Zn0'; 
const SERVER_IP = '87.106.91.35'; // Eure Linux-Server IP, oder die vom GMod Server falls anders
const SERVER_PORT = 27015;        // Der Standard-Port für Garry's Mod
// ====================================================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Erfolgreich eingeloggt als ${client.user.tag}!`);
    console.log(`Ueberwache den GMod-Server auf IP: ${SERVER_IP}:${SERVER_PORT}`);
    
    // Alle 30 Sekunden die Spielerzahl aktualisieren
    setInterval(updatePlayerCount, 30000);
    updatePlayerCount(); // Direkt beim Start einmal ausführen
});

function updatePlayerCount() {
    Gamedig.query({
        type: 'garrysmod',
        host: SERVER_IP,
        port: parseInt(SERVER_PORT)
    }).then((state) => {
        // Ändert den Discord-Status zu: "Schaut zu: X/Y Spielern"
        client.user.setActivity(`${state.players.length}/${state.maxplayers} Spielern auf AOC`, { 
            type: ActivityType.Watching 
        });
        console.log(`Status aktualisiert: ${state.players.length}/${state.maxplayers} Spieler online.`);
    }).catch((error) => {
        console.log("Fehler beim Abrufen des GMod-Servers (Evtl. ist der Server noch offline): " + error.message);
        client.user.setActivity('Warte auf Server... ❌', { type: ActivityType.Watching });
    });
}

client.login(BOT_TOKEN);