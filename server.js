const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { createCloseAccountInstruction } = require('@solana/spl-token');

const app = express(); // Initialize Express app
const PORT = process.env.PORT || 3000;
//const SOLANA_RPC_URL = "https://stylish-warmhearted-reel.solana-mainnet.quiknode.pro/9092df975d66506de8e9ab550843942015d39dbf/";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const DEVELOPER_WALLET = process.env.DEVELOPER_WALLET;
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Define helper function calculateTotalRent BEFORE /redeem route
async function calculateTotalRent(connection, selectedAccounts) {
    let totalRent = 0;
    for (const account of selectedAccounts) {
        try {
            const accountInfo = await connection.getAccountInfo(new PublicKey(account));
            if (accountInfo) {
                totalRent += accountInfo.lamports / 1e9; // Convert lamports to SOL
            }
        } catch (error) {
            console.error(`Error fetching account info for ${account}:`, error);
        }
    }
    return totalRent;
}

app.post('/redeem', async (req, res) => {
    try {
        const { publicKey, selectedAccounts } = req.body;

        if (!publicKey || !selectedAccounts || selectedAccounts.length === 0) {
            return res.status(400).json({ error: "Invalid input data." });
        }

        // Initialize connection to the Solana blockchain
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        console.log("Connection initialized:", connection);

        const userPublicKey = new PublicKey(publicKey);
        const developerWallet = new PublicKey(DEVELOPER_WALLET);

        console.log("Fetching latest blockhash...");
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        console.log("Fetched blockhash:", blockhash);

        // Calculate total rent reclaimable
        const totalRent = await calculateTotalRent(connection, selectedAccounts);
        console.log("Total Rent Reclaimable:", totalRent);

        const dAppFee = totalRent * 0.01; // Charge 1% fee

        // Build transaction
        const transaction = new Transaction();
        for (const account of selectedAccounts) {
            const accountPublicKey = new PublicKey(account);
            transaction.add(
                createCloseAccountInstruction(accountPublicKey, userPublicKey, userPublicKey)
            );
        }
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: userPublicKey,
                toPubkey: developerWallet,
                lamports: Math.floor(dAppFee * 1e9), // Convert SOL to lamports
            })
        );

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;

        // Serialize and send the transaction back to the user for signing
        res.json({ success: true, transaction: transaction.serialize({ verifySignatures: false }).toString("base64") });
    } catch (error) {
        console.error("Error in /redeem endpoint:", error);
        res.status(500).json({ error: "Failed to process redemption request." });
    }
});

app.post('/get-token-accounts', async (req, res) => {
    try {
        const { walletPublicKey } = req.body;

        console.log(walletPublicKey);

        if (!walletPublicKey) {
            return res.status(400).json({ error: "Wallet public key is required." });
        }

        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        const walletPublicKeyObj = new PublicKey(walletPublicKey);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKeyObj, {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });

        const abandonedAccounts = tokenAccounts.value
            .filter(accountInfo => {
                const balance = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
                return balance === 0; // Only abandoned accounts
            })
            .map(accountInfo => {
                const pubkey = accountInfo.pubkey.toBase58(); // Public key of the token account
                const rentLamports = accountInfo.account.lamports || 0; // Rent in lamports

                return {
                    pubkey,
                    rent: rentLamports / 1e9, // Convert lamports to SOL
                };
            });

        res.json({ success: true, abandonedAccounts });
    } catch (error) {
        console.error("Error in /get-token-accounts:", error);
        res.status(500).json({ error: "Failed to fetch token accounts." });
    }
});


app.post('/submit-transaction', async (req, res) => {
    try {
        const { signedTransaction } = req.body;

        if (!signedTransaction) {
            return res.status(400).json({ error: "Signed transaction is required." });
        }

        // Initialize connection to Solana
        const connection = new Connection(SOLANA_RPC_URL, "confirmed");
        console.log("Submitting transaction...");

        // Convert signed transaction from array back to Uint8Array
        const serializedTransaction = new Uint8Array(signedTransaction);
        const txid = await connection.sendRawTransaction(serializedTransaction);

        console.log("Transaction submitted:", txid);

        // Optionally confirm the transaction
        const confirmation = await connection.confirmTransaction(txid, "finalized");
        if (confirmation.value && confirmation.value.err) {
            throw new Error("Transaction confirmation failed");
        }

        res.json({ success: true, txid });
    } catch (error) {
        console.error("Error submitting transaction:", error.message);
        res.status(500).json({ error: error.message || "Failed to submit transaction." });
    }
});





app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
