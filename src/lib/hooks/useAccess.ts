import {useWallet} from "@solana/wallet-adapter-react";
import {useMultisig} from "../../hooks/useServices";

export const useAccess = () => {
    const {publicKey} = useWallet();
    const {data: multisig} = useMultisig();

    if (!multisig || !publicKey) {
        return false;
    }

    const inMultisig = multisig.keys.find(key => key.equals(publicKey));
    return !!inMultisig;
};