// https://expedition.dev/tx/0x0208134aa28fc60d6a09bb30f56c00d2532a4abf040aeed51cefd98044b3c534?rpcUrl=https%3A%2F%2Frpc.deveth.org%2F
// 0x383cd82ad79be9e6a4ba03d3c2ae4575456a2f20 -> 0x7536e392c8598ba8781160cadfbda0f72a0416ee

const { expect } = require("chai");
const lib = require("../scripts/lib");

var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://rpc.deveth.org/");
var bombDelayFromParent = 900000000;

var finalBlock = 11946735;
var saleBlock = 11946739;

var saleTxid = "0x0208134aa28fc60d6a09bb30f56c00d2532a4abf040aeed51cefd98044b3c534";

async function do_add_block(Bridge, bn) {
  add_block = await w3.eth.getBlock(bn);
  var add_block_rlp = rlp.encode(lib.getBlockParts(add_block));
  const ret = await Bridge.submitHeader(add_block_rlp);
  expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(true);
}

describe("BridgeSale contract", function() {
  before(async function () {
    const [owner] = await ethers.getSigners();
    const BridgeFactory = await ethers.getContractFactory("Bridge");

    const genesis_block = await w3.eth.getBlock(finalBlock);
    Bridge = await BridgeFactory.deploy(rlp.encode(lib.getBlockParts(genesis_block)), bombDelayFromParent);
    expect(await Bridge.isHeaderStored(genesis_block['hash'])).to.equal(true);

    var hdrs = [];
    for (var i = 1; i < 16; i++) {
      add_block = await w3.eth.getBlock(finalBlock+i);
      var add_block_rlp = rlp.encode(lib.getBlockParts(add_block));
      hdrs.push(add_block_rlp);
    }
    await Bridge.submitHeaders(hdrs);

    saleBlockData = await w3.eth.getBlock(saleBlock);
    console.log(saleBlockData);
  });

  /*it("Get proof", async function() {
    var ret = await w3.eth.getProof("0x7536e392c8598ba8781160cadfbda0f72a0416ee", [], saleBlock);
    console.log(ret);
  });*/

  it("Sale block is present with correct hash", async function() {
    expect(await Bridge.isHeaderStored(saleBlockData['hash'])).to.equal(true);

    var bbn = await Bridge.getBlockByNumber(saleBlock);
    expect(bbn['hash']).to.equal(saleBlockData['hash']);
  });

  it("Deploy BridgeSale contract", async function() {
    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(Bridge.address, "0x7536e392c8598ba8781160cadfbda0f72a0416ee");
    //console.log(BridgeSale);



    BridgeSaleFactory.redeemDeposit(getBlockRlp(saleBlockData),


  });

});


