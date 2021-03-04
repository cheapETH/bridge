// Send your devETH to the 0xd000000000000000000000000000000000000b1e to smoke it.
// Smoke 1000 devETH, earn 1 cheapETH!
// After the bridgesale is live

// https://expedition.dev/tx/0x5a7a930b16020723a05a9e467749a7ef5c1316e5a97eab2651c586a9deb4547d?rpcUrl=https%3A%2F%2Frpc.deveth.org
// 0x7536e392c8598ba8781160cadfbda0f72a0416ee -> 0xd000000000000000000000000000000000000b1e

const { expect } = require("chai");
const lib = require("../scripts/lib");

const mpt = require('merkle-patricia-tree');
const Trie = mpt.BaseTrie;

var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://rpc.deveth.org/");
var bombDelayFromParent = 900000000;

const startBlock = 11982090;
const saleBlock = 11982094;

var saleFrom = "0x7536e392c8598ba8781160cadfbda0f72a0416ee";
var saleTxid = "0x5a7a930b16020723a05a9e467749a7ef5c1316e5a97eab2651c586a9deb4547d";

async function do_add_block(Bridge, bn) {
  add_block = await w3.eth.getBlock(bn);
  var add_block_rlp = lib.getBlockRlp(add_block);
  const ret = await Bridge.submitHeader(add_block_rlp);
  expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(true);
}

describe("BridgeSale contract", function() {
  before(async function () {
    const BridgeFactory = await ethers.getContractFactory("Bridge");

    const genesis_block = await w3.eth.getBlock(startBlock);
    Bridge = await BridgeFactory.deploy(lib.getBlockRlp(genesis_block), bombDelayFromParent);
    expect(await Bridge.isHeaderStored(genesis_block['hash'])).to.equal(true);

    var hdrs = [];
    for (var i = 1; i < 16; i++) {
      add_block = await w3.eth.getBlock(startBlock+i);
      var add_block_rlp = lib.getBlockRlp(add_block);
      hdrs.push(add_block_rlp);
    }
    await Bridge.submitHeaders(hdrs);

    saleBlockData = await w3.eth.getBlock(saleBlock);
  });

  it("Sale block is present with correct hash", async function() {
    expect(await Bridge.isHeaderStored(saleBlockData['hash'])).to.equal(true);

    var bbn = await Bridge.getBlockByNumber(saleBlock);
    expect(bbn['hash']).to.equal(saleBlockData['hash']);
  });

  it("Transaction hash is correct", async function() {
    txn = await w3.eth.getTransaction(saleTxid);
    const txn_rlp = lib.getTransactionRlp(txn);
    expect(txn['hash']).to.equal(w3.utils.soliditySha3(txn_rlp));
  });

  it("Confirm transaction in block with proof", async function() {
    const txtrie = await lib.getTransactionTrie(w3, saleBlock, saleTxid);
    const trie = txtrie.trie;

    expect(lib.toHexString(trie.root)).to.equal(saleBlockData['transactionsRoot']);

    const proof = await Trie.createProof(trie, txtrie.key);
    const value = await Trie.verifyProof(trie.root, txtrie.key, proof)
    expect(lib.toHexString(value)).to.equal(lib.toHexString(txtrie.value));
  });

  it("Do BridgeSale", async function() {
    const [owner] = await ethers.getSigners();
    const provider = owner.provider;

    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(Bridge.address, "0xd000000000000000000000000000000000000b1e");

    // fund the bridgesale with 1 ETH
    await owner.sendTransaction({to: BridgeSale.address, value: ethers.utils.parseUnits("1.0", 18)});
    const bsBalance = await provider.getBalance(BridgeSale.address);

    // get the path and rlpEncodedNodes
    const txtrie = await lib.getTransactionTrie(w3, saleBlock, saleTxid);
    const proof = await Trie.createProof(txtrie.trie, txtrie.key);

    // submit the transaction to claim
    txn = await w3.eth.getTransaction(saleTxid);

    const startBalance = await provider.getBalance(saleFrom);
    expect(startBalance).to.equal(0);
    await BridgeSale.redeemDeposit(lib.getBlockRlp(saleBlockData), lib.getTransactionRlp(txn), txn['from'], txtrie.key, rlp.encode(proof));
    const endBalance = await provider.getBalance(saleFrom);

    // 0.01 on deveth = 0.00001 on cheapEth
    expect(endBalance).to.equal(ethers.utils.parseUnits("0.00001", 18));
  });

});


