import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, LAMPORTS_PER_SOL, PublicKey, TransactionSignature } from '@solana/web3.js';
import { FC, useCallback, useMemo } from 'react';
import { notify } from "../utils/notifications";
import useUserSOLBalanceStore from '../stores/useUserSOLBalanceStore';
import { generateSigner, publicKey, some, transactionBuilder } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchCandyMachine, mintV2, mplCandyMachine, safeFetchCandyGuard } from '@metaplex-foundation/mpl-candy-machine';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import bs58 from 'bs58';

export const CandyMint: FC = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { getUserSOLBalance } = useUserSOLBalanceStore();

    const quickNodeEndpoint = clusterApiUrl('devnet');
    const candyMachineAddress = publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    const treasury = publicKey(process.env.NEXT_PUBLIC_TREASURY);

    /**
     * @description create Umi instance
     */
    const umi = useMemo(() =>
        createUmi(quickNodeEndpoint)
            .use(walletAdapterIdentity(wallet))
            .use(mplCandyMachine())
            .use(mplTokenMetadata()),
        [wallet, mplCandyMachine, walletAdapterIdentity, quickNodeEndpoint, createUmi]
    )

    const onClick = useCallback(async () => {
        if (!wallet.publicKey) {
            console.log('error', 'Wallet not connected!');
            notify({ type: 'error', message: 'error', description: 'Wallet not connected!' });
            return;
        }

        // fetch candy machine
        const candyMachine = await fetchCandyMachine(umi, candyMachineAddress);

        // fetch candy guard
        const candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);

        try {
            // Mint from the candy machine
            const nftMint = generateSigner(umi);
            const transaction = await transactionBuilder()
                .add(setComputeUnitLimit(umi, { units: 800_000 }))
                .add(
                    mintV2(umi, {
                        candyMachine: candyMachine.publicKey,
                        candyGuard: candyGuard?.publicKey,
                        nftMint,
                        collectionMint: candyMachine.collectionMint,
                        collectionUpdateAuthority: candyMachine.authority,
                        mintArgs: {
                            solPayment: some({ destination: treasury }),
                        }
                    })
                );
            const { signature } = await transaction.sendAndConfirm(umi, {
                confirm: { commitment: "confirmed" },
            })
            const txid = bs58.encode(signature);
            console.log('success', `Mint successful!`)
            notify({ type: 'success', message: 'Mint successful!', txid: "" });
            getUserSOLBalance(wallet.publicKey, connection);
        } catch (error: any) {
            notify({ type: 'error', message: `Mint failed!`, description: error?.message });
            console.log('error', `Mint failed! ${error?.message}`);
        }
    }, [wallet, connection, getUserSOLBalance, umi, candyMachineAddress, treasury]);

    return (

        <div className="flex flex-row justify-center">
            <div className="relative group items-center">
                <div className="m-1 absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 
                    rounded-lg blur opacity-20 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>

                <button
                    className="px-8 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                    onClick={onClick}
                >
                    <span>Mint NFT</span>

                </button>
            </div>
        </div>


    );
};

