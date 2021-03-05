var express = require('express');

var rlp = require('rlp');
var Web3 = require('web3');
var dw3 = new Web3("https://rpc.deveth.org/");

const lib = require("../scripts/lib");
 
const mpt = require('merkle-patricia-tree');
const Trie = mpt.BaseTrie;

// BRIDGESALE=0x5FbDB2315678afecb367f032d93F642f64180aa3 BRIDGE=0x8168a8c43F1943EcC812ef1b8dE19a897c16488e npx hardhat run scripts/bridgesale.js --network cheapeth

const bridgeAddress = process.env['BRIDGE'];
console.log("Using bridge at address", bridgeAddress);

var bridgeSaleAddress = process.env['BRIDGESALE'];
var Bridge, BridgeSale;

async function main() {
  if (bridgeSaleAddress == null) {
    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(bridgeAddress, "0xd000000000000000000000000000000000000b1e");
    bridgeSaleAddress = BridgeSale.address;
  } else {
    BridgeSale = await ethers.getContractAt("BridgeSale", bridgeSaleAddress)
	}

  console.log("BridgeSale deployed at", bridgeSaleAddress);
  Bridge = await ethers.getContractAt("Bridge", bridgeAddress);
}

var app = express();
app.set('view engine', 'pug')

/*app.get('/', function(req, res) {
  res.sendFile('sale.html', { root: 'static' });
});*/

app.get('/', async function(req, res) {
  const bridgeHash = await Bridge.getLongestChainEndpoint();
  const bridgeBlock = (await Bridge.getHeader(bridgeHash))[1];
  res.render('index', { title: 'cheapETH Bridge', bridgeBlock: bridgeBlock, bridgeAddress: bridgeAddress, bridgeSaleAddress: bridgeSaleAddress })
});

app.get('/:transaction', async function(req, res) {
  const bridgeHash = await Bridge.getLongestChainEndpoint();
  const bridgeBlock = (await Bridge.getHeader(bridgeHash))[1];
  const tx = req.params.transaction;

	const txn = await dw3.eth.getTransaction(tx);
	console.log(txn);
	const block = await dw3.eth.getBlock(txn.blockNumber)
	//console.log(block);

	const txtrie = await lib.getTransactionTrie(dw3, txn.blockNumber, tx);
	const proof = await Trie.createProof(txtrie.trie, txtrie.key);
	//console.log(proof)

	var parameters = [lib.getBlockRlp(block), lib.getTransactionRlp(txn), txn['from'], txtrie.key, rlp.encode(proof)];

	const iface = new ethers.utils.Interface(["function redeemDeposit(bytes,bytes,address,bytes,bytes)"]);
	const enc = iface.encodeFunctionData('redeemDeposit', parameters);
	console.log(enc);

  res.render('index', { title: 'cheapETH Bridge', bridgeBlock: bridgeBlock, bridgeAddress: bridgeAddress, bridgeSaleAddress: bridgeSaleAddress,
		tx: tx, hexdata: enc, from: txn.from })
});

/*app.get('/api/:account', async (req, res) => {
  const bridgeHash = await Bridge.getLongestChainEndpoint();
  const bridgeBlock = (await Bridge.getHeader(bridgeHash))[1];
  const address = req.params.account;

  dw3.eth.getPastLogs({fromBlock: bridgeBlock-100, toBlock: bridgeBlock, address: address});

  res.render('account', {"address": address, "fromBlock": bridgeBlock-100, "toBlock": bridgeBlock })
});*/

/*app.get('/api/tx/:account/:transaction', async (req, res) => {
  const address = req.params.account;
  const tx = req.params.transaction;
	const gtx = dw3.eth.getTransaction(tx);
	console.log(gtx);

  res.render('transaction', {"transaction": tx, "address": address })
});*/

main()
  .then(() => app.listen(9001, () => {
    console.log("listening on 9001");
  }))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

