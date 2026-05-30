// Bot filtering and command detection utilities

const COMMAND_PREFIXES = ['!', '/', '.', '$', '-', '?'];

export class BotFilterService {
    private botNames: Set<string> = new Set();

    constructor(botNames: string[] = []) {
        this.setBotNames(botNames);
    }

    setBotNames(botNames: string[]) {
        this.botNames = new Set(botNames.map(bot => bot.toLowerCase()));
    }

    addCustomBot(username: string) {
        this.botNames.add(username.toLowerCase());
    }

    removeCustomBot(username: string) {
        this.botNames.delete(username.toLowerCase());
    }

    isBot(username: string): boolean {
        username = username.toLowerCase();
        return this.botNames.has(username);
    }

    isCommand(message: string): boolean {
        const trimmed = message.trim();
        if (!trimmed) return false;

        // Check if starts with command prefix
        if (!COMMAND_PREFIXES.some(prefix => trimmed.startsWith(prefix))) {
            return false;
        }

        // Check if it's a single word command (no spaces or only spaces at end)
        const firstWord = trimmed.split(/\s+/)[0];
        return firstWord.length > 1; // More than just the prefix
    }

    shouldHideMessage(username: string, message: string, options: {
        hideBots?: boolean;
        hideCommands?: boolean;
    } = {}): boolean {
        const { hideBots = false, hideCommands = false } = options;

        if (hideBots && this.isBot(username)) {
            return true;
        }

        if (hideCommands && this.isCommand(message)) {
            return true;
        }

        return false;
    }
}

export const botFilterService = new BotFilterService();
