var express = require('express');

var rlp = require('rlp');
var Web3 = require('web3');
var dw3 = new Web3("https://rpc.deveth.org/");

const lib = require("../scripts/lib");
 
const mpt = require('merkle-patricia-tree');
const Trie = mpt.BaseTrie;

// TXID=0x854d68f9fb192ae55028dde6e4c4bbae453f9d8ca589a4fc8721e70c7c6ae7e5 BRIDGESALE=0x610510c0D13Adf82FF4e2C67a38698a080FefaD7 BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e npx hardhat run scripts/bridgesale.js --network cheapeth

const bridgeAddress = process.env['BRIDGE'];
console.log("Using bridge at address", bridgeAddress);

var txId = process.env['TXID'];

var bridgeSaleAddress = process.env['BRIDGESALE'];
var Bridge, BridgeSale;

async function main() {
  if (bridgeSaleAddress == null) {
    const [deployer] = await ethers.getSigners();
    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(bridgeAddress, "0xd000000000000000000000000000000000000b1e", 787);
    bridgeSaleAddress = BridgeSale.address;
    await deployer.sendTransaction({to: BridgeSale.address, value: ethers.utils.parseUnits("0.01", 18)});
  } else {
    BridgeSale = await ethers.getContractAt("BridgeSale", bridgeSaleAddress)
	}

  console.log("BridgeSale deployed at", bridgeSaleAddress);
  Bridge = await ethers.getContractAt("Bridge", bridgeAddress);

	if (txId != null) {
		const bridgeHash = await Bridge.getLongestChainEndpoint();
		const bridgeBlock = (await Bridge.getHeader(bridgeHash))[1];

		const txn = await dw3.eth.getTransaction(txId);
		console.log(txn);
		const block = await dw3.eth.getBlock(txn.blockNumber)
		//console.log(block);

		const txtrie = await lib.getTransactionTrie(dw3, txn.blockNumber, txId);
		const proof = await Trie.createProof(txtrie.trie, txtrie.key);
		//console.log(proof)

    await BridgeSale.redeemDeposit(lib.getBlockRlp(block), lib.getTransactionRlp(txn), txn['from'], txtrie.key, rlp.encode(proof));
	}
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

