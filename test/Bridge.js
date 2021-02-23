const { expect } = require("chai");

var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://node.cheapeth.org/rpc");
var toHex = function(x) { return (x==0) ? "0x" : w3.utils.toHex(x) };

const FORKBLOCK = 11818960;

function getBlockParts(block) {
  return [
    block['parentHash'],
    block['sha3Uncles'],
    block['miner'],
    block['stateRoot'],
    block['transactionsRoot'],
    block['receiptsRoot'],
    block['logsBloom'],
    toHex(block['difficulty']),
    toHex(block['number']),
    toHex(block['gasLimit']),
    toHex(block['gasUsed']),
    toHex(block['timestamp']),
    block['extraData'],
    block['mixHash'],
    block['nonce']
  ];
}

describe("Bridge contract", function() {
  it("Javascript block hash is correct", async function() {
    block = await w3.eth.getBlock(FORKBLOCK-100)
    var dat = rlp.encode(getBlockParts(block));
    expect(w3.utils.soliditySha3(dat) == block['hash']);
  });

  it("Bridge adds block", async function() {
    genesis_block = await w3.eth.getBlock(FORKBLOCK-101)
    add_block = await w3.eth.getBlock(FORKBLOCK-100)

    const [owner] = await ethers.getSigners();
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    const Bridge = await BridgeFactory.deploy(genesis_block['hash'], genesis_block['number']);

    expect(await Bridge.isHeaderStored(genesis_block['hash']));
    expect(await !Bridge.isHeaderStored(add_block['hash']));

    var add_block_rlp = rlp.encode(getBlockParts(add_block));
    const ret = await Bridge.submitHeader(add_block_rlp);
    //console.log(ret);

    expect(await Bridge.isHeaderStored(add_block['hash']));

    //console.log(hardhatBridge);
  });
});






