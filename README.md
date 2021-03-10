# Bridge


The ETH chain and the cheapETH chain. We can assume the ETH chain has ~1000x more value than the cheapETH chain.

We have two chains (lol two chainz: https://www.youtube.com/watch?v=4dfSrP1CbeQ)

In order to move value between chains, we need a trusted way to get the state of each chain on to the other chain.

Thanks to Optimism for most of the Solidity libraries (https://github.com/ethereum-optimism/contracts)


### == L1 -> L2 Bridge ==

L1 (ETH) is secured by proof of work. Generating a fake proof of work chain is very expensive.

## How it works:

1. Deploy contract on L2 with a checkpoint hash of an ETH block. You can manually audit this, the same way you would audit the contract address.
2. Anyone can submit future block headers of the main chain, the contract validates that they are correct and have the right difficultly. 
3. If someone submits a longer chain, the contract follows that chain. (block reorg)

Think like we are running a "light node" on cheapETH itself. The key part is that the cheapETH contract validates the difficult operation.


### == L2 -> L1 Bridge ==

This direction is harder for two reasons. One, we can't trust the cheapETH proof of work, since it's much weaker than the Eth proof of work. And two, the gas fees to run the L1 -> L2 bridge are very expensive, since we must submit every block header if we want to verify the blockchain. Not acceptable for L1.

The first iteration of the L2 -> L1 bridge will be effectively a multisig with trusted node operators. We'll create a token on L1 that entitles you to be a node operator. As a node operator, you'll submit your belief in the state of L2 to a contract in L2. While anyone can submit this signature to L2, the L1 Bridge contract will only validate signatures from those that have the token on L1.

The L1 Bridge contract can have the L2 states submitted to it, the contract will confirm that those addresses possess the magic token, and when, say 30% confirm the state (can change with moving average), it's treated as the truth and can be used to prove transactions.

Really, we have to modify L2 go-ethereum to not allow chain reorgs lower than the trusted state, say 100 blocks back, but with small amounts of value, we can put this off until later. All exchanges have this same problem. This contract would also track the location of the tokens, if you transfer it on L1, you can prove the transfer on L2 with the L1 -> L2 bridge.


### == Checkpointing to prevent reorgs, before any serious cross chain value lockup ==

Checkpointer contract:
* Save signed block hash 100+ (max 255 for reexec) blocks ago
* This will allow withdrawals in 30 minutes, and won't allow chain reorgs before that
* By default, sign every 10 blocks, aka blocks with mod 0? Verifiers can save more (anyone can be a verifier)
  * If you want to access something in an unsigned block on the main chain, build 10 backward
* This won't allow reorgs longer than 100 blocks, but will force a canonical chain
* Modify geth to look in the checkpointer contract for the checkpoints
  * Designated proof of stake, your cTH balance determines your trust to geth back 100 blocks
  * Call a method "trust" from the wallet with an address to add your cTH to the votes for the checkpoint
    * Careful, too many addresses with trust might be slow, though I think we can track this well in geth

### == Bridges ==

- [X] BridgeEthash (done) -- for mainnet (or deveth for testing)
  - [ ] TODO: fix the lookback problem
- [ ] BridgeBinance (WIP) -- for binance smart chain
- [ ]  BridgeAuthority -- sign the block hash from a trusted address, simplest. anyone can build backward off it
  * Ideally, we implement the same proof of stake for the checkpointer here
(The key thing is that they implement a "getBlockByNumber" function that returns the hash and the depth)

### == Bridge Users ==

* BridgeSale -- convert 1 currency into another at a fixed exchange rate (only one side needs a contract)
  * deprecate this, it's useless without an exchange rate, though it was a fun experiment
* CrossWrap/CrossDeposit -- convert value into a wrapped token on the other side and back (both sides need a contract)
  * CrossWrap (ERC20): Send value to CrossDeposit on cTH chain, redeem minted wcTH on main chain
  * CrossDeposit:      Burn wcTH on the main chain (send to 0), get value on the cTH chain (this is mostly the bridgesale)
  * Anyone can run a "relayer", this is all trustless.

### == Terms ==

You deposit your cTH into other chains, this is slow. You withdraw back into cTH, this is fast.

### == The Dream ==
* wcTH token on ethereum and wcTH token on binance smart chain, movable in and out of cTH
  * cTH chain is not a store of value!
* Do this, don't do any crowdsales
* This also gives cheapETH a real use as a bridge currency and compute
* To deploy on each chain
  * cheapETH
    * BridgeEthash
      * CrossDeposit
    * BridgeBinance
      * CrossDeposit
    * Checkpointer (to prevent reorgs, needed before BridgeAuthority)
  * main chain
    * BridgeAuthority
      * CrossWrap
  * binance smart chain
    * BridgeAuthority
      * CrossWrap

### == Building ==

Going to try the fancy infrastructure instead of rolling my own in Python

Using yarn, hardhat, and waffle

```bash
# npx hardhat compile
```


### == Testing == 

```bash
npx hardhat test
```


### == Deploying == 

```bash
# npx hardhat run scripts/bridge.js --network cheapeth
```

### == Deploying Sale ==

```bash
# BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e npx hardhat run scripts/bridgesale.js --network cheapeth
```

### == Running Sale ==

```bash
# BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e NETWORK=deveth npx hardhat run scripts/bridge.js --network cheapeth
# BRIDGESALE=0x811F7Df7Ca943A5aa17314fF025bC9368E6686C6 BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e npx hardhat run scripts/bridgesale.js --network cheapeth
```


