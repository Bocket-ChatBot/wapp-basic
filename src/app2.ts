import { useMultiFileAuthState, DisconnectReason, Browsers, WAMessage, fetchLatestBaileysVersion } from 'baileys';
import makeWASocket from '@adiwajshing/baileys'
import P from 'pino'
import { Boom } from '@hapi/boom';
import path from 'path';

// Directorio para guardar el estado de la sesión
const authPath = path.resolve(__dirname, '..', 'auth');

// Función principal para conectar el bot
async function connectToWhatsApp(): Promise<void> {
    console.log(`authPath is:`, authPath);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    
    // Fetch the latest Baileys version to ensure compatibility
    const { version } = await fetchLatestBaileysVersion();

    console.log(`Usando la versión de Baileys: ${version.join('.')}`);

    const sock = makeWASocket({
        auth: state,
        // logger: P(), // you can configure this as much as you want, even including streaming the logs to a ReadableStream for upload or saving to a file
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        version,
    });

    // Eventos de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect.error as any))?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('La conexión se cerró debido a', lastDisconnect.error, ', reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Conexión abierta. ¡El bot está listo!');
        }
    });

    // Eventos de mensajes
    sock.ev.on('messages.upsert', async ({ messages }) => {
        console.log('Nuevo mensaje recibido:', JSON.stringify(messages, undefined, 2));

        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            const messageText: string = (msg.message as any).conversation || (msg.message as any).extendedTextMessage?.text || ' ';
            console.log(`Mensaje de ${msg.key.remoteJid}: ${messageText}`);
        }
    });

    // Guardar las credenciales
    sock.ev.on('creds.update', saveCreds);
}

// Ejecutar la función
connectToWhatsApp();