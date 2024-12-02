const connectWalletBtn = document.getElementById('connectWallet');
const searchAbandonedBtn = document.getElementById('searchAbandoned');
const redeemSelectedBtn = document.getElementById('redeemSelected');
const accountsDiv = document.getElementById('accounts');
const statusMessage = document.getElementById('status-message');

let connection = null; // Global connection variable
let provider = null;
let walletPublicKey = null;
let abandonedAccounts = [];


// Check for Solana wallet provider
function getProvider() {
    try {
        if ("solana" in window) {
            const provider = window.solana;

            // Log the provider type, if available
            console.log("Solana provider detected:", provider);
            return provider;
        } else {
            console.warn("No Solana wallet provider found. Redirecting to Solana wallet options.");
            window.open("https://solana.com/wallet-guide", "_blank"); // Redirect to a wallet guide
            return null;
        }
    } catch (error) {
        console.error("An error occurred while checking for the Solana provider:", error);
        return null;
    }
}


// Connect to wallet
async function connectWallet() {
    provider = getProvider();
    if (provider) {
        try {
            const resp = await provider.connect();
            walletPublicKey = resp.publicKey.toString();
            searchAbandonedBtn.disabled = false;
            accountsDiv.innerHTML = `<p>Connected wallet: ${walletPublicKey}</p>`;
            console.log("Wallet connected:", walletPublicKey);
        } catch (err) {
            console.error("Wallet connection failed", err);
        }
    }
}



async function searchAbandonedAccounts() {
    if (!walletPublicKey) {
        console.error("Wallet public key is not available.");
        return;
    }

    try {
        const response = await fetch('/get-token-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletPublicKey }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error("Error fetching token accounts:", data.error);
            accountsDiv.innerHTML = "<p>Error fetching token accounts. Please try again later.</p>";
            return;
        }

        // Render abandoned accounts
        abandonedAccounts = data.abandonedAccounts;
        accountsDiv.innerHTML = "<h2>Abandoned Token Accounts</h2>";

        if (abandonedAccounts.length === 0) {
            accountsDiv.innerHTML += `<p>No abandoned token accounts found.</p>`;
        } else {
            abandonedAccounts.forEach(account => {
                const pubkey = account.pubkey;
                const rent = account.rent || 0; // Ensure rent is available

                // Securely create DOM elements
                const card = document.createElement("div");
                card.className = "card mt-2";

                const cardBody = document.createElement("div");
                cardBody.className = "card-body";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "account-checkbox";
                checkbox.value = pubkey;
                checkbox.setAttribute("data-rent", rent); // Add rent as data attribute

                const pubkeyText = document.createElement("p");
                pubkeyText.textContent = `Token Address: ${pubkey}`;

                const rentText = document.createElement("p");
                rentText.textContent = `Reclaimable Rent: ${rent.toFixed(4)} SOL`;

                cardBody.append(checkbox, pubkeyText, rentText);
                card.appendChild(cardBody);
                accountsDiv.appendChild(card);
            });

            document.querySelectorAll(".account-checkbox").forEach(checkbox => {
                checkbox.addEventListener("change", updateTotals);
            });
        }

        redeemSelectedBtn.disabled = abandonedAccounts.length === 0;
    } catch (error) {
        console.error("Unexpected error:", error);
        accountsDiv.innerHTML = "<p>Error fetching token accounts. Please try again later.</p>";
    }
}




// Update totals for rent and network fees
function updateTotals() {
    const selectedAccounts = Array.from(document.querySelectorAll(".account-checkbox:checked"));

    const totalRent = selectedAccounts.reduce((total, checkbox) => {
        return total + parseFloat(checkbox.getAttribute("data-rent"));
    }, 0);

    const networkFee = selectedAccounts.length * 0.000005;

    const totalsDiv = document.getElementById("totals");
    if (!totalsDiv) {
        const newTotalsDiv = document.createElement("div");
        newTotalsDiv.id = "totals";
        newTotalsDiv.className = "mt-4";
        newTotalsDiv.innerHTML = `
            <h3>Summary</h3>
            <p><strong>Total Rent Reclaimable:</strong> <span id="total-rent">${totalRent.toFixed(4)} SOL</span></p>
            <p><strong>Estimated Network Fee:</strong> <span id="network-fee">${networkFee.toFixed(6)} SOL</span></p>
        `;
        accountsDiv.appendChild(newTotalsDiv);
    } else {
        document.getElementById("total-rent").textContent = totalRent.toFixed(4) + " SOL";
        document.getElementById("network-fee").textContent = networkFee.toFixed(6) + " SOL";
    }
}




// async function redeemSelectedAccounts() {
//     const selectedAccounts = Array.from(document.querySelectorAll(".account-checkbox:checked")).map(
//         checkbox => checkbox.value
//     );

//     if (!selectedAccounts.length) {
//         statusMessage.innerHTML = `
//             <div style='color:red'>No accounts selected for redemption.</div>
//         `;
//         return;
//     }

//     if (!provider) {
//         statusMessage.innerHTML = `
//             <div style='color:red'>Wallet not connected. Please connect your wallet and try again.</div>
//         `;
//         return;
//     }

//     // Show spinner and update status message
//     document.getElementById("loading-spinner").style.display = "block";
//     statusMessage.innerHTML = `
//         <div style='color:blue'>Transaction in progress... Please wait.</div>
//     `;

//     try {
//         const response = await fetch('/redeem', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ publicKey: walletPublicKey, selectedAccounts }),
//         });

//         const result = await response.json();

//         if (result.error) {
//             statusMessage.innerHTML = `
//                 <div style='color:red'>Error: ${result.error}</div>
//             `;
//             return;
//         }

//         // Decode transaction
//         const decodedTransaction = Uint8Array.from(atob(result.transaction), char => char.charCodeAt(0));
//         const transaction = solanaWeb3.Transaction.from(decodedTransaction);

//         // Request the wallet to sign the transaction
//         const signedTransaction = await provider.signTransaction(transaction);

//         // Send the signed transaction back to the backend for submission
//         const submissionResponse = await fetch('/submit-transaction', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ signedTransaction: Array.from(signedTransaction.serialize()) }),
//         });

//         const submissionResult = await submissionResponse.json();

//         if (submissionResult.error) {
//             statusMessage.innerHTML = `
//                 <div style='color:red'>Error submitting transaction: ${submissionResult.error}</div>
//             `;
//         } else {
//             const txid = submissionResult.txid;
//             statusMessage.innerHTML = `
//                 <div style='color:green'>
//                     Transaction successful! Transaction ID: <a href="https://explorer.solana.com/tx/${txid}?cluster=mainnet-beta" target="_blank">${txid}</a>
//                 </div>
//             `;
//         }
//     } catch (error) {
//         statusMessage.innerHTML = `
//             <div style='color:red'>Transaction failed: ${error.message}</div>
//         `;
//     } finally {
//         document.getElementById("loading-spinner").style.display = "none";
//     }
// }
async function redeemSelectedAccounts() {
    const selectedAccounts = Array.from(document.querySelectorAll(".account-checkbox:checked")).map(
        checkbox => checkbox.value
    );

    if (!selectedAccounts.length) {
        statusMessage.innerHTML = `
            <div style='color:red'>No accounts selected for redemption.</div>
        `;
        return;
    }

    if (!provider) {
        statusMessage.innerHTML = `
            <div style='color:red'>Wallet not connected. Please connect your wallet and try again.</div>
        `;
        return;
    }

    // Show spinner and update status message
    document.getElementById("loading-spinner").style.display = "block";
    statusMessage.innerHTML = `
        <div style='color:blue'>Transaction in progress... Please wait.</div>
    `;

    try {
        // Step 1: Request the backend to prepare a transaction
        const response = await fetch('/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicKey: walletPublicKey, selectedAccounts }),
        });

        const result = await response.json();

        if (result.error) {
            statusMessage.innerHTML = `
                <div style='color:red'>Error: ${result.error}</div>
            `;
            return;
        }

        // Step 2: Decode and sign the transaction
        const decodedTransaction = Uint8Array.from(atob(result.transaction), char => char.charCodeAt(0));
        const transaction = solanaWeb3.Transaction.from(decodedTransaction);

        const signedTransaction = await provider.signTransaction(transaction);

        // Step 3: Submit the signed transaction
        const submissionResponse = await fetch('/submit-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedTransaction: Array.from(signedTransaction.serialize()) }),
        });

        const submissionResult = await submissionResponse.json();

        if (submissionResult.success && submissionResult.txid) {
            // Display success message with transaction ID
            statusMessage.innerHTML = `
                <div style='color:green'>
                    Transaction successful! Transaction ID: <a href="https://explorer.solana.com/tx/${submissionResult.txid}?cluster=mainnet-beta" target="_blank">${submissionResult.txid}</a>
                </div>
            `;
        } else {
            // Display backend error message
            throw new Error(submissionResult.error || "Unknown error occurred");
        }
    } catch (error) {
        statusMessage.innerHTML = `
            <div style='color:red'>Transaction failed: ${error.message}</div>
        `;
    } finally {
        document.getElementById("loading-spinner").style.display = "none";
    }
}





// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
searchAbandonedBtn.addEventListener('click', searchAbandonedAccounts);
redeemSelectedBtn.addEventListener('click', redeemSelectedAccounts);
