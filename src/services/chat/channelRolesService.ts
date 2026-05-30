import { log, LOG_CATEGORIES } from "~/utils/logger";
// Сервис для загрузки ролей пользователей канала (модераторы, VIP, founders)

export interface ChannelRole {
    id: string;
    login: string;
    displayName: string;
    grantedAt?: string;
    entitlementStart?: string;
    isSubscribed?: boolean;
}

export interface ChannelRolesData {
    mods: Map<string, ChannelRole>;
    vips: Map<string, ChannelRole>;
    founders: Map<string, ChannelRole>;
}

class ChannelRolesService {
    private channelRoles: Map<string, ChannelRolesData> = new Map();

    async loadChannelRoles(channelName: string): Promise<void> {
        try {
            const [modsVipsData, foundersData] = await Promise.all([
                this.loadModsAndVips(channelName),
                this.loadFounders(channelName)
            ]);

            this.channelRoles.set(channelName.toLowerCase(), {
                mods: modsVipsData.mods,
                vips: modsVipsData.vips,
                founders: foundersData
            });
        } catch (error) {
            log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load channel roles", error);
        }
    }

    private async loadModsAndVips(channelName: string): Promise<{ mods: Map<string, ChannelRole>, vips: Map<string, ChannelRole> }> {
        const mods = new Map<string, ChannelRole>();
        const vips = new Map<string, ChannelRole>();

        try {
            const response = await fetch(`https://api.ivr.fi/v2/twitch/modvip/${encodeURIComponent(channelName)}?skipCache=true`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (Array.isArray(data.mods)) {
                    data.mods.forEach((mod: any) => {
                        mods.set(mod.login.toLowerCase(), {
                            id: mod.id,
                            login: mod.login,
                            displayName: mod.displayName,
                            grantedAt: mod.grantedAt
                        });
                    });
                }
                
                if (Array.isArray(data.vips)) {
                    data.vips.forEach((vip: any) => {
                        vips.set(vip.login.toLowerCase(), {
                            id: vip.id,
                            login: vip.login,
                            displayName: vip.displayName,
                            grantedAt: vip.grantedAt
                        });
                    });
                }
            }
        } catch (error) {
            log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load mods and vips", error);
        }

        return { mods, vips };
    }

    private async loadFounders(channelName: string): Promise<Map<string, ChannelRole>> {
        const founders = new Map<string, ChannelRole>();

        try {
            const response = await fetch(`https://api.ivr.fi/v2/twitch/founders/${encodeURIComponent(channelName)}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (Array.isArray(data.founders)) {
                    data.founders.forEach((founder: any) => {
                        founders.set(founder.login.toLowerCase(), {
                            id: founder.id,
                            login: founder.login,
                            displayName: founder.displayName,
                            entitlementStart: founder.entitlementStart,
                            isSubscribed: founder.isSubscribed
                        });
                    });
                }
            }
        } catch (error) {
            log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load founders", error);
        }

        return founders;
    }

    isModerator(channelName: string, username: string): boolean {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.mods.has(username.toLowerCase()) || false;
    }

    isVIP(channelName: string, username: string): boolean {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.vips.has(username.toLowerCase()) || false;
    }

    isFounder(channelName: string, username: string): boolean {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.founders.has(username.toLowerCase()) || false;
    }

    getModeratorData(channelName: string, username: string): ChannelRole | undefined {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.mods.get(username.toLowerCase());
    }

    getVIPData(channelName: string, username: string): ChannelRole | undefined {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.vips.get(username.toLowerCase());
    }

    getFounderData(channelName: string, username: string): ChannelRole | undefined {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles?.founders.get(username.toLowerCase());
    }

    getAllModerators(channelName: string): ChannelRole[] {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles ? Array.from(roles.mods.values()) : [];
    }

    getAllVIPs(channelName: string): ChannelRole[] {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles ? Array.from(roles.vips.values()) : [];
    }

    getAllFounders(channelName: string): ChannelRole[] {
        const roles = this.channelRoles.get(channelName.toLowerCase());
        return roles ? Array.from(roles.founders.values()) : [];
    }

    clearChannelRoles(channelName: string): void {
        this.channelRoles.delete(channelName.toLowerCase());
    }

    clearAll(): void {
        this.channelRoles.clear();
    }
}

export const channelRolesService = new ChannelRolesService();
