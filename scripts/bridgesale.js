const rlp = require('rlp');
const Web3 = require('web3');
const dw3 = new Web3('https://rpc.deveth.org/');

const { sleep, ...lib } = require('../scripts/lib');

const mpt = require('merkle-patricia-tree');
const Trie = mpt.BaseTrie;

// TXID=0x854d68f9fb192ae55028dde6e4c4bbae453f9d8ca589a4fc8721e70c7c6ae7e5 BRIDGESALE=0x610510c0D13Adf82FF4e2C67a38698a080FefaD7 BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e npx hardhat run scripts/bridgesale.js --network cheapeth

const bridgeAddress = process.env['BRIDGE'];
console.log(`Using bridge at address ${bridgeAddress}`);

const DOOBIE = '0xD000000000000000000000000000000000000B1e';
let bridgeSaleAddress = process.env['BRIDGESALE'];

/**
 * Check if transaction has already been claimed
 * @return {bool} is transaction claimed
 */
async function claimTransaction(BridgeSale, Bridge, txId) {
  const txn = await dw3.eth.getTransaction(txId);
  console.log(`CLAIMING ${txId} FROM ${txn.from}`);

  const claimed = await BridgeSale.isTransactionClaimed(txId);
  if (claimed) {
    console.log('already claimed in contract');
    return true;
  }

  const bridgeHash = await Bridge.getLongestChainEndpoint();
  const bridgeBlock = (await Bridge.getHeader(bridgeHash))[1];

  if (txn.blockNumber + 5 > bridgeBlock) {
    console.log('too early');
    return false;
  }

  console.log(txn);

  const block = await dw3.eth.getBlock(txn.blockNumber);
  const txtrie = await lib.getTransactionTrie(dw3, txn.blockNumber, txId);
  const proof = await Trie.createProof(txtrie.trie, txtrie.key);
  const ret = await BridgeSale.redeemDeposit(
    lib.getBlockRlp(block),
    lib.getTransactionRlp(txn),
    txn['from'],
    txtrie.key,
    rlp.encode(proof)
  );
  console.log(ret);
  return true;
}

/**
 * Get bridge sale
 * retrieves bridge sale from address or new deployment
 * @return {Contract} bridge sale contract
 */
async function getBridgeSale() {
  if (bridgeSaleAddress != null) {
    return await ethers.getContractAt('BridgeSale', bridgeSaleAddress);
  }
  const [deployer] = await ethers.getSigners();
  const BridgeSaleFactory = await ethers.getContractFactory('BridgeSale');
  const BridgeSale = await BridgeSaleFactory.deploy(bridgeAddress, DOOBIE, 787);

  bridgeSaleAddress = BridgeSale.address;

  await deployer.sendTransaction({
    to: bridgeSaleAddress,
    value: ethers.utils.parseUnits('0.01', 18),
  });
}

async function main() {
  const BridgeSale = await getBridgeSale();
  console.log(`BridgeSale deployed at ${bridgeSaleAddress}`);

  const Bridge = await ethers.getContractAt('Bridge', bridgeAddress);

  let back = 30;
  const claimedAll = {};

  while (true) {
    const longestCommitedChainHash = await Bridge.getLongestChainEndpoint();
    const hdr = await Bridge.getHeader(longestCommitedChainHash);
    const blockNumber = hdr['blockNumber'].toNumber();
    console.log(
      'getting previous blocks:',
      blockNumber - back,
      blockNumber - 5
    );

    for (let i = blockNumber - back; i < blockNumber - 5; i++) {
      const block = await dw3.eth.getBlock(i);
      block.transactions.forEach(async function (tx) {
        const txn = await dw3.eth.getTransaction(tx);
        if (txn.to == DOOBIE && claimedAll[txn.hash]) {
          claimedAll[txn.hash] = claimTransaction(BridgeSale, Bridge, txn.hash);
        }
      });
    }

    back = 15;
    await sleep(5000);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error)
  .then(() => process.exit(1));
