/**
 * Layout Manager
 * Handles advanced layout options like reverse order, horizontal mode, etc.
 */

export interface LayoutOptions {
    reverseLineOrder?: boolean;
    horizontal?: boolean;
    singleChatter?: string;
}

function parseAllowedChatters(raw: string): string[] {
    return raw
        .split(/[\s,]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
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

        const allowedChatters = parseAllowedChatters(this.options.singleChatter);
        if (allowedChatters.length === 0) {
            return true;
        }

        return allowedChatters.includes(username.toLowerCase());
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

        return css;
    }

    /**
     * Inject layout CSS into document
     */
    injectCSS(): void {
        const css = this.getLayoutCSS();
        if (!css) return;

        const styleId = 'chatyx-layout-styles';
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
