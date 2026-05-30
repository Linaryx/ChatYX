/**
 * Twitch Bits/Cheers system types
 */

export interface BitsTier {
    min_bits: number;
    id: string;
    color: string;
    images: {
        dark: {
            animated: {
                '1': string;
                '2': string;
                '4': string;
            };
            static: {
                '1': string;
                '2': string;
                '4': string;
            };
        };
        light: {
            animated: {
                '1': string;
                '2': string;
                '4': string;
            };
            static: {
                '1': string;
                '2': string;
                '4': string;
            };
        };
    };
    can_cheer: boolean;
    show_in_bits_card: boolean;
}

export interface CheerEmote {
    prefix: string;
    tiers: BitsTier[];
    type: 'global_first_party' | 'global_third_party' | 'channel_custom' | 'display_only' | 'sponsored';
    order: number;
    last_updated: string;
    is_charitable: boolean;
}

export interface CheerEmotesResponse {
    data: CheerEmote[];
}

export interface ParsedCheer {
    prefix: string;
    amount: number;
    color: string;
    emoteUrl: string;
    tier: BitsTier;
}

export interface CheerMatch {
    text: string;
    index: number;
    parsed: ParsedCheer;
}
