/**
 * Layout Manager
 * Handles advanced layout options like reverse order, horizontal mode, etc.
 */

export interface LayoutOptions {
    reverseLineOrder?: boolean;
    horizontal?: boolean;
    singleChatter?: string;
    lastEmoteBackground?: boolean;
}

export class LayoutManager {
    private options: LayoutOptions = {};
    private container: HTMLElement | null = null;

    /**
     * Set layout options
     */
    setOptions(options: LayoutOptions): void {
        this.options = { ...this.options, ...options };
        this.applyLayout();
    }

    /**
     * Set container element
     */
    setContainer(container: HTMLElement): void {
        this.container = container;
        this.applyLayout();
    }

    /**
     * Apply layout based on current options
     */
    private applyLayout(): void {
        if (!this.container) return;

        // Apply reverse line order
        if (this.options.reverseLineOrder) {
            this.container.style.display = 'flex';
            this.container.style.flexDirection = 'column-reverse';
        } else {
            this.container.style.display = 'block';
            this.container.style.flexDirection = 'row';
        }

        // Apply horizontal mode
        if (this.options.horizontal) {
            this.container.style.display = 'flex';
            this.container.style.flexDirection = 'row';
            this.container.style.flexWrap = 'wrap';
            this.container.style.alignItems = 'flex-start';
        }
    }

    /**
     * Check if message should be shown based on single chatter mode
     */
    shouldShowMessage(username: string): boolean {
        if (!this.options.singleChatter) {
            return true;
        }

        return username.toLowerCase() === this.options.singleChatter.toLowerCase();
    }

    /**
     * Apply last emote background effect
     */
    applyLastEmoteBackground(messageElement: HTMLElement): void {
        if (!this.options.lastEmoteBackground) {
            return;
        }

        // Find all emotes in message
        const emotes = messageElement.querySelectorAll('.emote');
        if (emotes.length === 0) {
            return;
        }

        const lastEmote = emotes[emotes.length - 1] as HTMLElement;
        
        // Check if message ends with this emote
        const messageText = messageElement.textContent || '';
        const trimmed = messageText.trim();
        
        // Get emote alt text from img element if it exists
        const emoteImg = lastEmote.querySelector('img');
        const emoteAlt = emoteImg ? emoteImg.getAttribute('alt') || '' : '';
        
        if (trimmed.endsWith(emoteAlt)) {
            lastEmote.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            lastEmote.style.borderRadius = '4px';
            lastEmote.style.padding = '2px';
        }
    }

    /**
     * Get layout classes for container
     */
    getContainerClasses(): string[] {
        const classes: string[] = [];

        if (this.options.reverseLineOrder) {
            classes.push('reverse-order');
        }

        if (this.options.horizontal) {
            classes.push('horizontal');
        }

        return classes;
    }

    /**
     * Get CSS for layout
     */
    getLayoutCSS(): string {
        let css = '';

        if (this.options.reverseLineOrder) {
            css += `
                #chat_container.reverse-order {
                    display: flex;
                    flex-direction: column-reverse;
                }
            `;
        }

        if (this.options.horizontal) {
            css += `
                #chat_container.horizontal {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    align-items: flex-start;
                }
                
                #chat_container.horizontal .chat_line {
                    margin-right: 15px;
                    margin-bottom: 5px;
                }
            `;
        }

        if (this.options.lastEmoteBackground) {
            css += `
                .emote.last-emote-bg {
                    background-color: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    padding: 2px;
                }
            `;
        }

        return css;
    }

    /**
     * Inject layout CSS into document
     */
    injectCSS(): void {
        const css = this.getLayoutCSS();
        if (!css) return;

        const styleId = 'chatis-layout-styles';
        let style = document.getElementById(styleId);

        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        style.textContent = css;
    }
}

// Singleton instance
export const layoutManager = new LayoutManager();
