import { log, LOG_CATEGORIES } from "~/utils/logger";

// 7TV cosmetics / paint loader and cache.
export interface PaintGradient {
    function: 'LINEAR_GRADIENT' | 'RADIAL_GRADIENT' | 'URL' | 'linear-gradient' | 'radial-gradient' | 'url';
    canvas_repeat?: string;
    size?: [number, number];
    at?: [number, number];
    repeat?: boolean;
    stops: Array<{
        at: number;
        color: number;
    }>;
    angle?: number;
    image_url?: string;
    shape?: string;
}

export interface PaintShadow {
    x_offset: number;
    y_offset: number;
    radius: number;
    color: number;
}

export interface PaintText {
    weight?: number;
    stroke?: {
        width: number;
        color: number;
    };
    shadows?: PaintShadow[];
    transform?: string;
}

export interface Paint {
    id: string;
    name: string;
    color: number;
    // Поддержка как старого формата (прямые поля), так и нового (массив gradients)
    function?: 'LINEAR_GRADIENT' | 'RADIAL_GRADIENT' | 'URL' | 'linear-gradient' | 'radial-gradient' | 'url';
    angle?: number;
    repeat?: boolean;
    stops?: Array<{
        at: number;
        color: number;
    }>;
    shape?: string;
    image_url?: string;
    // Новый формат с массивом градиентов
    gradients?: PaintGradient[];
    shadows: PaintShadow[];
    // Настройки текста
    text?: PaintText;
}

export interface UserCosmetics {
    [username: string]: string[]; // username -> paint IDs
}

export interface Cosmetics {
    [id: string]: Paint; // paint ID -> paint object
}

class SevenTVCosmeticsService {
    private cosmetics: Cosmetics = {};
    private userCosmetics: UserCosmetics = {};
    private paintCSSCache: Map<string, any> = new Map();
    private paintStylesheet: CSSStyleSheet | null = null;
    private channelCache: Set<string> = new Set(); // Кэш загруженных каналов

    async loadCosmetics(channelId: string): Promise<void> {
        // Избегаем повторной загрузки
        if (this.channelCache.has(channelId)) return;
        
        try {
            await this.loadChannelUserPaints(channelId);
            this.channelCache.add(channelId);
        } catch (error) {
            log.error(LOG_CATEGORIES.PAINTS, "Failed to load cosmetics", error);
        }
    }

    private async loadChannelUserPaints(channelId: string): Promise<void> {
        try {
            const response = await fetch(`https://7tv.io/v3/users/twitch/${channelId}`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Проверяем style.paint_id для канала
                if (data.user?.style?.paint_id) {
                    const channelUsername = data.username || data.display_name;
                    this.addUserCosmetic(channelUsername, data.user.style.paint_id);
                } else if (data.cosmetics?.length) {
                    const channelUsername = data.username || data.display_name;
                    data.cosmetics.forEach((cosmetic: any) => {
                        if (cosmetic.kind === 'PAINT') {
                            this.addUserCosmetic(channelUsername, cosmetic.id);
                        }
                    });
                }
            }
        } catch (error) {
            log.error(LOG_CATEGORIES.PAINTS, "Failed to load channel user paints", error);
        }
    }

    addUserCosmetic(username: string, paintId: string): void {
        if (!this.userCosmetics[username]) {
            this.userCosmetics[username] = [];
        }
        
        if (!this.userCosmetics[username].includes(paintId)) {
            this.userCosmetics[username].push(paintId);
            this.paintCSSCache.delete(username);
        }
    }

    // Метод для обновления paint через WebSocket
    updatePaint(id: string, data: any): void {
        this.addCosmetic(id, data);
        this.clearPaintCache(id);
    }

    async loadUserPaints(username: string, userId?: string): Promise<void> {
        if (!userId) return;
        
        try {
            const response = await fetch(`https://7tv.io/v3/users/twitch/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.user?.style?.paint_id) {
                    this.addUserCosmetic(username, data.user.style.paint_id);
                } else if (data.cosmetics?.length) {
                    data.cosmetics.forEach((cosmetic: any) => {
                        if (cosmetic.kind === 'PAINT') {
                            this.addUserCosmetic(username, cosmetic.id);
                        }
                    });
                }
            }
        } catch (error) {
            log.error(LOG_CATEGORIES.PAINTS, `Failed to load user paints for ${username}`, error);
        }
    }

    removeUserCosmetic(username: string, paintId: string): void {
        const userPaints = this.userCosmetics[username];
        if (userPaints) {
            const index = userPaints.indexOf(paintId);
            if (index > -1) {
                userPaints.splice(index, 1);
                this.paintCSSCache.delete(username);
            }
        }
    }

    addCosmetic(id: string, data: any): void {
        if (!data || typeof data !== 'object') return;
        
        this.cosmetics[id] = {
            id,
            name: data.name || `Paint ${id}`,
            color: data.color || 0xFFFFFFFF,
            function: data.function,
            angle: data.angle,
            repeat: data.repeat,
            stops: data.stops || [],
            shape: data.shape,
            image_url: data.image_url,
            gradients: data.gradients || [],
            shadows: data.shadows || [],
            text: data.text
        };
    }

    removeCosmetic(id: string): void {
        delete this.cosmetics[id];
        this.clearPaintCache(id);
    }

    private clearPaintCache(paintId: string): void {
        // Очищаем кэш для всех пользователей, использующих этот paint
        for (const [username, paintIds] of Object.entries(this.userCosmetics)) {
            if (paintIds.includes(paintId)) {
                this.paintCSSCache.delete(username);
            }
        }
    }

    getPaintsForUser(username: string): Paint[] {
        const paintIds = this.userCosmetics[username] || [];
        return paintIds.map(id => this.cosmetics[id]).filter(Boolean);
    }

    getNamepaintsFor(username: string): Paint[] {
        return this.getPaintsForUser(username);
    }

    private getPaintStylesheet(): CSSStyleSheet | null {
        if (this.paintStylesheet) return this.paintStylesheet;

        const style = document.createElement('style');
        style.id = 'chatyx-seventv-paint-styles';
        document.head.appendChild(style);

        return (this.paintStylesheet = style.sheet ?? null);
    }

    calculatePaintCSS(username: string): any {
        // Проверяем кэш
        if (this.paintCSSCache.has(username)) {
            return this.paintCSSCache.get(username);
        }

        const paints = this.getPaintsForUser(username);
        
        if (!paints.length) {
            this.paintCSSCache.set(username, null);
            return null;
        }

        const paint = paints[0];
        this.updatePaintStyle(paint);
        
        const result = {
            paintId: paint.id,
            useGlobalCSS: true
        };

        if (this.paintCSSCache.size >= 2000) {
            const firstKey = this.paintCSSCache.keys().next().value;
            if (firstKey !== undefined) this.paintCSSCache.delete(firstKey);
        }
        this.paintCSSCache.set(username, result);
        return result;
    }

    // Создание CSS правил для paint
    private updatePaintStyle(paint: Paint, remove = false): void {
        const sheet = this.getPaintStylesheet();
        if (!sheet) return;

        // Конвертируем v2 формат в v3
        if (!paint.gradients?.length && paint.function && paint.stops?.length) {
            paint.gradients = [{
                function: paint.function,
                canvas_repeat: '',
                size: [1, 1],
                shape: paint.shape,
                image_url: paint.image_url,
                stops: paint.stops,
                repeat: paint.repeat ?? false,
                angle: paint.angle,
                at: [0, 0]
            }];
        }

        const gradients = (paint.gradients ?? []).map(g => this.createGradientFromPaint(g));
        const filter = this.createFilterString(paint.shadows);
        const defaultColor = paint.color ? this.getCSSColorFromInt(paint.color) : '';

        const selector = `.chatyx-seventv-paint[data-seventv-paint-id="${paint.id}"]`;
        const text = this.generateCSSText(selector, gradients, defaultColor, filter);

        this.updateCSSRule(sheet, selector, text, remove);
    }

    private createFilterString(shadows: PaintShadow[]): string {
        if (!shadows?.length) return '';
        return shadows.map(v => this.createFilterDropshadow(v)).join(' ');
    }

    private generateCSSText(selector: string, gradients: [string, string, string, string][], defaultColor: string, filter: string): string {
        const gradientStrings = gradients.map(v => v[0]);
        const backgroundSize = gradients.map(v => v[2]).filter(s => s).join(', ') || 'cover';
        const backgroundPosition = gradients.map(v => v[1]).filter(p => p).join(', ') || 'center';
        const backgroundRepeat = gradients.map(v => v[3]).join(', ');
        
        return `${selector} {
  background: ${gradientStrings.join(', ')};
  background-image: ${gradientStrings.join(', ')};
  background-size: ${backgroundSize};
  background-position: ${backgroundPosition};
  background-repeat: ${backgroundRepeat};
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke-width: 0px;
  -webkit-text-stroke-color: transparent;
  ${defaultColor ? `color: ${defaultColor} !important;` : 'color: transparent;'}
  filter: ${filter || 'none'};
}`;
    }

    private updateCSSRule(sheet: CSSStyleSheet, selector: string, text: string, remove: boolean): void {
        let currentIndex = -1;
        
        for (let i = 0; i < sheet.cssRules.length; i++) {
            const rule = sheet.cssRules[i];
            if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
                currentIndex = i;
                break;
            }
        }
        
        if (remove) return;

        if (currentIndex >= 0) {
            sheet.deleteRule(currentIndex);
            sheet.insertRule(text, currentIndex);
        } else {
            sheet.insertRule(text, sheet.cssRules.length);
        }
    }

    // Создание градиента из paint
    private createGradientFromPaint(gradient: any): [string, string, string, string] {
        const result = ['', '', '', ''] as [string, string, string, string];
        const args = [] as string[];
        
        switch (gradient.function) {
            case 'LINEAR_GRADIENT':
                args.push(`${gradient.angle ?? 0}deg`);
                break;
            case 'RADIAL_GRADIENT':
                args.push(gradient.shape ?? 'circle');
                break;
            case 'URL':
                {
                    const safeImageUrl = this.sanitizeCssImageUrl(gradient.image_url ?? '');
                    if (!safeImageUrl) {
                        result[0] = 'none';
                        return result;
                    }
                    args.push(`"${safeImageUrl}"`);
                }
                break;
        }
        
        if (gradient.function !== 'URL') {
            const funcPrefix = gradient.repeat ? 'repeating-' : '';
            for (const stop of gradient.stops) {
                const color = this.getCSSColorFromInt(stop.color);
                args.push(`${color} ${stop.at * 100}%`);
            }
            result[0] = `${funcPrefix}${gradient.function.toLowerCase().replace('_', '-')}(${args.join(', ')})`;
        } else {
            result[0] = `url(${args[0]})`;
        }

        result[1] = gradient.at?.length === 2 ? `${gradient.at[0] * 100}% ${gradient.at[1] * 100}%` : '';
        result[2] = gradient.size?.length === 2 ? `${gradient.size[0] * 100}% ${gradient.size[1] * 100}%` : '';
        result[3] = gradient.canvas_repeat ?? 'unset';

        return result;
    }

    private sanitizeCssImageUrl(value: string): string {
        try {
            const url = new URL(value, window.location.origin);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
            return url.href.replace(/"/g, '%22');
        } catch {
            return '';
        }
    }

    // Создание drop-shadow фильтра
    private createFilterDropshadow(shadow: any): string {
        return `drop-shadow(${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px ${this.getCSSColorFromInt(shadow.color)})`;
    }

    // Конвертация цвета из int в CSS
    private getCSSColorFromInt(num: number): string {
        const r = (num >>> 24) & 0xff;
        const g = (num >>> 16) & 0xff;
        const b = (num >>> 8) & 0xff;
        const a = num & 0xff;
        
        return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    }

    getCosmetics(): Cosmetics {
        return this.cosmetics;
    }

    getUserCosmetics(): UserCosmetics {
        return this.userCosmetics;
    }

    // Получение цвета из paint в CSS формате
    getPaintColor(paint: Paint): string {
        if (!paint?.color) return '#ffffff';
        return this.getCSSColorFromInt(paint.color);
    }

    // Очистка всех кэшей
    clearAllCaches(): void {
        this.paintCSSCache.clear();
        this.channelCache.clear();
    }
}

export const sevenTVCosmeticsService = new SevenTVCosmeticsService();
