import {
    Cluster,
    // PublicKey,
} from '@solana/web3.js';

export class WalletAccount {
    public pubkey: string;
    public cluster: Cluster;
    public chain: BlockChain;

    constructor(pubkey: string, cluster: Cluster, chain: BlockChain ) {
        this.pubkey = pubkey;
        this.cluster = cluster;
        this.chain = chain;
    }

    /**
     * WalletAccount from DID string
     *
     * @param did eg: "did:sol:devnet:HBExLbKMTYxGTdpcUDEjEtWy5iiAu4e2gHbGzX2BrqNN",
     * @returns {WalletAccount}
     */
    static ofDid(did: string): WalletAccount {
        const [, chain, cluster, , pubkey] = did.split(":");
        return new WalletAccount(pubkey, cluster as Cluster, chain as BlockChain);
    }
}

export enum BlockChain {
    Solana = 'sol',
    Ethereum = 'eth',
}
