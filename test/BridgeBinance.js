const { expect } = require("chai");
const lib = require("../scripts/lib");
var utils = require('ethereumjs-util');
var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://bsc-dataseed.binance.org/");

const sampleRlp = '0xf9021938a06a2d1e604855bb8a0a54a4e6d17dfd3b534297765c6db78e83582368a7817e20a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794ea0a6e3c511bbd10f4519ece37dc24887e11b55da02efef6cc93385f05233ede5d749d2cd04eb38b045130c4ba1efc72e83b07503ea056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002830174018401c9c38080845f4e27a7a0d883010002846765746888676f312e31332e34856c696e757800000000000000a00000000000000000000000000000000000000000000000000000000000000000880000000000000000';
const sampleHeader = {
  "parentHash":"0x6a2d1e604855bb8a0a54a4e6d17dfd3b534297765c6db78e83582368a7817e20",
  "sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
  "miner":"0xea0a6e3c511bbd10f4519ece37dc24887e11b55d",
  "stateRoot":"0x2efef6cc93385f05233ede5d749d2cd04eb38b045130c4ba1efc72e83b07503e",
  "transactionsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
  "receiptsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
  "logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "difficulty":"0x2",
  "number":"0x17401",
  "gasLimit":"0x1c9c380",
  "gasUsed":"0x0",
  "timestamp":"0x5f4e27a7",
  "extraData":"0xd883010002846765746888676f312e31332e34856c696e757800000000000000edaa5052b9f0cca12979353619ce2d5d1f466e5d0f1a3c71cb2967c7bc7e780006d219d50c12dcff52836af3157f196f7cf83a4cbe61dc26d88a9b3b02791e9e00",
  "mixHash":"0x0000000000000000000000000000000000000000000000000000000000000000",
  "nonce":"0x0000000000000000",
  "hash":"0x70903a8bb10d0e87065497525b06273c5f38eb7b6d554857bcbdf38b33157539"
};
const buf2hex = (x) => '0x'+x.toString('hex');
const hex2buf = (x) => new Buffer(x.slice(2), 'hex');
function handleRlpHeader(rlpHeader) {
  let decoded = rlp.decode(rlpHeader);
  const signature = decoded[12].slice(decoded[12].length - 65);
  decoded[12] = decoded[12].slice(0, decoded[12].length - 65);
  return {signature, rlp: rlp.encode([0x38, ...decoded]) };
}
function parseSig(sig) {
  const r = sig.slice(0, 32);
  const s = sig.slice(32,64);
  // this is fucking retarded
  let v = sig.slice(64, 65).readInt8() + 27; 
  v = v.toString();
  v = Buffer.from(v);
  return {r,s,v};
}
describe("handleRlpHeader", function() {
  it("Correctly encodes sample header", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    expect(buf2hex(rlp)).to.equal(sampleRlp);
  });
  it("Correctly extracts the signature", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    expect(buf2hex(signature)).to.equal('0xedaa5052b9f0cca12979353619ce2d5d1f466e5d0f1a3c71cb2967c7bc7e780006d219d50c12dcff52836af3157f196f7cf83a4cbe61dc26d88a9b3b02791e9e00');
  });
  it("Hash of rlp encoded payload is correct", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    const keccak256 = Web3.utils.sha3(rlp);
    expect(keccak256).to.equal('0xf472a3e5116fa0e1310e40f570943c453df78050ba57aa7486269bd8876094e9');
  });
  it("Correctly recovers pubkey", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    //const msg = Web3.utils.sha3(rlp);
    const {r,s,v} = parseSig(signature);
    console.log({r,s,v});
    const msg = Buffer.from('f472a3e5116fa0e1310e40f570943c453df78050ba57aa7486269bd8876094e9', 'hex')
    utils.ecrecover(msg, v, r, s);
  })
});

describe("BridgeBinance contract", function() {
  // deploying at latest so the getValidators() call works
  beforeEach(async function () {
    genesis_block = await w3.eth.getBlock('latest');
    //console.log(genesis_block);
    STARTBLOCK = genesis_block.number;

    // https://bscscan.com/address/0x0000000000000000000000000000000000001000
    const validatorsRaw = await w3.eth.call({
      to: "0x0000000000000000000000000000000000001000",
      data: Web3.utils.soliditySha3("getValidators()").slice(0,10)}, STARTBLOCK);
    validators = w3.eth.abi.decodeParameter('address[]', validatorsRaw);
    // Validators should be sorted for correct block diffuculty calculation;
    validators = [...validators]
      .sort((a,b) => parseInt(a, 16) - parseInt(b, 16));
    //console.log(genesis_block);
    //console.log(validators);
    BridgeBinanceFactory = await ethers.getContractFactory("BridgeBinance");
  });

  it("Find genesis block", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    const block = await Bridge.getBlockByNumber(STARTBLOCK);
    console.log(block);
  });

  it("Does something", async function() {
    const add_block = await w3.eth.getBlock(STARTBLOCK-100);
    const block_rlp_headers = lib.getBlockRlp(add_block);
    //const pub =  await w3.eth.personal.ecRecover(sha3, '0x'+sig.toString('hex'));
    console.log();
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    await Bridge.submitHeader(block_rlp_headers);
  });

  it("Look for not found block", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    await expect(Bridge.getBlockByNumber(1337)).to.be.revertedWith("block not found");
  });
});
