export type Account = {
	user_id: string;
	displayname: string;
	avatar_url: string | null;
	ens: number;
	wallet_address: string;
};

export interface ISdnUserSummary {
    user_id: string;
    display_name: string;
    wallet_address: string;
    avatar: string;
    ens: boolean;
    source?: 'web' | 'iOS' | 'Android';
}

export type PeerMeta = {
	name: string;
    url: string;
    icons: string[];
    description?: string;
}

export type LinkWallet = {
	message: string;
	address: string;
	token: string;
	peerMeta: PeerMeta;
}
