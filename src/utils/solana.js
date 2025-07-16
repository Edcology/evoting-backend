import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor'
import fs from 'fs'
import path from 'path';
import dotenv from 'dotenv';
import { SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

dotenv.config();

// Configure Solana connection based on environment
const getConnection = () => {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  return new Connection(clusterApiUrl(network));
};


// Generate a new Solana wallet
const generateWallet = () => {
  const keypair = Keypair.generate();
  const secretKey = Buffer.from(keypair.secretKey).toString('hex');
  const publicKey = keypair.publicKey.toString();
  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: Buffer.from(keypair.secretKey).toString('hex'),
  };
};

// Create anchor provider from keypair
const createProvider = (keypairOrSecret) => {
  const connection = getConnection();
  
  // Handle both keypair object and secret key string
  let wallet;
  if (typeof keypairOrSecret === 'string') {
    // Convert hex string back to Uint8Array
    const secretKey = Buffer.from(keypairOrSecret, 'hex');
    wallet = new anchor.Wallet(Keypair.fromSecretKey(secretKey));
  } else {
    wallet = new anchor.Wallet(keypairOrSecret);
  }
  
  return new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: 'processed' }
  );
};

// Load the evoting program
const loadProgram = (provider) => {
  // Read the IDL file (we'll need to generate this from the smart contract)
  const idl = JSON.parse(fs.readFileSync('src/utils/evoting.json', 'utf8'));
  
  // Get program ID from .env or default to the one in the code
  const programId = new PublicKey(process.env.PROGRAM_ID || 'Kah4xoymyxGidXqMENUpn4LGPUHukzXyfM7K1iPAVEr');
  
  return new anchor.Program(idl, provider);
};

// Find the PDA for the election account
const findElectionPDA = (programId) => {
  // Ensure programId is a PublicKey
  const programPublicKey = programId instanceof PublicKey 
    ? programId 
    : new PublicKey(programId);

  return PublicKey.findProgramAddressSync(
    [Buffer.from("election_v6")],
    programPublicKey
  );
};

// Initialize a new election
const initializeElection = async (adminSecretKey, posts) => {
  try {
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const provider = createProvider(adminKeypair);
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Format posts for the contract
    const formattedPosts = posts.map(post => ({
      title: post.title,
      candidates: post.candidates
    }));
    
    // Execute the initialize election instruction
    const tx = await program.methods
      .initElection(formattedPosts)
      .accounts({
        election: electionPDA,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    return { success: true, tx, electionPDA: electionPDA.toString() };
  } catch (error) {
    console.error("Error initializing election:", error);
    return { success: false, error: error.message };
  }
};

// Start an election
const startElection = async (adminSecretKey) => {
  try {
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const provider = createProvider(adminKeypair);
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Execute the start election instruction
    const tx = await program.methods
      .startElection()
      .accounts({
        election: electionPDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();
    
    return { success: true, tx };
  } catch (error) {
    console.error("Error starting election:", error);
    return { success: false, error: error.message };
  }
};

// End an election
const endElection = async (adminSecretKey) => {
  try {
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const provider = createProvider(adminKeypair);
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Execute the end election instruction
    const tx = await program.methods
      .endElection()
      .accounts({
        election: electionPDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();
    
    return { success: true, tx };
  } catch (error) {
    console.error("Error ending election:", error);
    return { success: false, error: error.message };
  }
};

// Close an election
const closeElection = async (adminSecretKey) => {
  try {
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const provider = createProvider(adminKeypair);
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Execute the close election instruction
    const tx = await program.methods
      .closeElection()
      .accounts({
        election: electionPDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();
    
    return { success: true, tx };
  } catch (error) {
    console.error("Error closing election:", error);
    return { success: false, error: error.message };
  }
};

// Submit a vote
const submitVote = async (voterSecretKey, postIndex, candidateIndex) => {
  try {
    const voterKeypair = Keypair.fromSecretKey(Buffer.from(voterSecretKey, 'hex'));
    const provider = createProvider(voterKeypair);
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Execute the vote instruction
    const tx = await program.methods
      .vote(postIndex, candidateIndex)
      .accounts({
        election: electionPDA,
        voter: provider.wallet.publicKey,
      })
      .rpc();
    
    return { success: true, tx };
  } catch (error) {
    console.error("Error submitting vote:", error);
    return { success: false, error: error.message };
  }
};

// Get election state
const getElectionState = async () => {
  try {
    // Use a default provider for read-only operations
    const connection = getConnection();
    // Create a read-only wallet/provider
    const provider = new anchor.AnchorProvider(
      connection, 
      new anchor.Wallet(Keypair.generate()), 
      { commitment: 'processed' }
    );
    
    const program = loadProgram(provider);
    
    // Get the election PDA using the program's public key
    const [electionPDA] = findElectionPDA(program.programId);
    
    // Fetch the election account data
    const electionAccount = await program.account.election.fetch(electionPDA);
    
    return {
      success: true,
      data: {
        posts: electionAccount.posts,
        votedPosts: electionAccount.votedPosts,
        isActive: electionAccount.isActive,
        admin: electionAccount.admin.toString()
      }
    };
  } catch (error) {
    console.error("Error fetching election state:", error);
    return { success: false, error: error.message };
  }
};


// Airdrop SOL from admin to multiple wallets
const sendSolToWallets = async (adminSecretKey, walletAddresses, amount = 0.01) => {
  try {
    const connection = getConnection();
    // If your adminSecretKey is hex, use Buffer.from(adminSecretKey, 'hex')
    // If it's base58, use bs58.decode(adminSecretKey)
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const results = [];

    for (const address of walletAddresses) {
      try {
        const recipient = new PublicKey(address);
        const transaction = new anchor.web3.Transaction().add(
          SystemProgram.transfer({
            fromPubkey: adminKeypair.publicKey,
            toPubkey: recipient,
            lamports: amount * LAMPORTS_PER_SOL,
          })
        );
        const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);
        results.push({ address, success: true, signature });
      } catch (error) {
        results.push({ address, success: false, error: error.message });
      }
    }
    return results;
  } catch (error) {
    return [{ success: false, error: error.message }];
  }
};

// Send SOL from admin to a specific wallet
const sendSolToWallet = async (adminSecretKey, recipientAddress, amount = 0.0021) => {
  try {
    const connection = getConnection();
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecretKey, 'hex'));
    const recipient = new PublicKey(recipientAddress);

    const transaction = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: recipient,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );
    const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);
    return { success: true, signature };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Send all SOL (minus fee) from user wallet to a specific admin wallet
const sendAllSolFromUserToAdmin = async (userSecretKey, adminPublicKey) => {
  try {
    const connection = getConnection();
    const userKeypair = Keypair.fromSecretKey(Buffer.from(userSecretKey, 'hex'));
    const adminPubkey = new PublicKey(adminPublicKey);

    // Get user's current balance
    const balance = await connection.getBalance(userKeypair.publicKey);

    // Prepare dummy transfer for fee estimation
    const dummyIx = SystemProgram.transfer({
      fromPubkey: userKeypair.publicKey,
      toPubkey: adminPubkey,
      lamports: 1,
    });
    const dummyTx = new anchor.web3.Transaction().add(dummyIx);
    dummyTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    dummyTx.feePayer = userKeypair.publicKey;
    const messageV0 = dummyTx.compileMessage();
    const { value: fee } = await connection.getFeeForMessage(messageV0);

    // Calculate amount to send: all balance minus fee
    const amountToSend = balance - fee;

    if (amountToSend <= 0) {
      return { success: false, error: 'Insufficient balance to send.' };
    }

    // Create the real transaction with the correct amount
    const realTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: adminPubkey,
        lamports: amountToSend,
      })
    );
    realTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    realTx.feePayer = userKeypair.publicKey;

    const tx = await sendAndConfirmTransaction(
      connection,
      realTx,
      [userKeypair]
    );

    return { success: true, tx };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// User sends 90% of their balance to the admin wallet
const sendBackToAdmin = async (userSecretKey, adminPublicKey, percent = 0.9) => {
  try {
    const connection = getConnection();
    const userKeypair = Keypair.fromSecretKey(Buffer.from(userSecretKey, 'hex'));
    const adminPubkey = new PublicKey(adminPublicKey);

    // Get user's current balance
    const balance = await connection.getBalance(userKeypair.publicKey);

    // Prepare transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: userKeypair.publicKey,
      toPubkey: adminPubkey,
      lamports: 1, // placeholder, will set actual amount after fee calculation
    });

    // Create a transaction with a dummy amount for fee estimation
    const transaction = new anchor.web3.Transaction().add(transferIx);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userKeypair.publicKey;

    // Get the fee for this transaction
    const messageV0 = transaction.compileMessage();
    const { value: fee } = await connection.getFeeForMessage(messageV0);

    // Calculate amount to send: all balance minus fee
    let amountToSend = Math.floor(balance * percent);
    if (balance - amountToSend < fee) {
      amountToSend = balance - fee;
    }

    if (amountToSend <= 0) {
      return { success: false, error: 'Insufficient balance to send.' };
    }

    // Create the real transaction with the correct amount
    const realTransaction = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: adminPubkey,
        lamports: amountToSend,
      })
    );
    realTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    realTransaction.feePayer = userKeypair.publicKey;

    const tx = await sendAndConfirmTransaction(
      connection,
      realTransaction,
      [userKeypair]
    );

    return { success: true, tx };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  generateWallet,
  initializeElection,
  startElection,
  endElection,
  closeElection,
  submitVote,
  getElectionState,
  sendSolToWallets,
  sendSolToWallet,
  sendAllSolFromUserToAdmin,
  sendBackToAdmin,
};