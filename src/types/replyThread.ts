/**
 * Reply Threading Types
 * TypeScript interfaces for Twitch reply thread support
 */

/**
 * Reply thread information from IRC tags
 */
export interface ReplyThread {
    /** ID of the parent message being replied to */
    parentMsgId: string;
    
    /** Display name of parent message author */
    parentDisplayName: string;
    
    /** Username of parent message author */
    parentUserLogin: string;
    
    /** Text content of parent message */
    parentMsgBody: string;
    
    /** User ID of parent message author */
    parentUserId: string;
}

/**
 * Message with reply thread information
 */
export interface MessageWithReply {
    id: string;
    username: string;
    displayName: string;
    text: string;
    color: string;
    reply?: ReplyThread;
}

/**
 * Reply header display options
 */
export interface ReplyHeaderOptions {
    /** Show parent message preview */
    showPreview: boolean;
    
    /** Maximum length of parent message preview */
    maxPreviewLength: number;
    
    /** Show parent author avatar */
    showAvatar: boolean;
    
    /** Enable click to scroll to parent */
    enableScrollTo: boolean;
}
