const { expect } = require('chai');
const lib = require('../scripts/lib');

const Web3 = require('web3');
const w3 = new Web3('https://bsc-dataseed.binance.org/');

describe('BridgeBinance contract', function () {
  // deploying at latest so the getValidators() call works
  beforeEach(async function () {
    genesis_block = await w3.eth.getBlock('latest');
    //console.log(genesis_block);
    STARTBLOCK = genesis_block.number;

    // https://bscscan.com/address/0x0000000000000000000000000000000000001000
    const validatorsRaw = await w3.eth.call(
      {
        to: '0x0000000000000000000000000000000000001000',
        data: Web3.utils.soliditySha3('getValidators()').slice(0, 10),
      },
      STARTBLOCK
    );

    validators = w3.eth.abi.decodeParameter('address[]', validatorsRaw);
    BridgeBinanceFactory = await ethers.getContractFactory('BridgeBinance');
  });

  it('Find genesis block', async function () {
    Bridge = await BridgeBinanceFactory.deploy(
      lib.getBlockRlp(genesis_block),
      validators
    );

    const block = await Bridge.getBlockByNumber(STARTBLOCK);
    console.log(block);
  });

  it('Look for not found block', async function () {
    Bridge = await BridgeBinanceFactory.deploy(
      lib.getBlockRlp(genesis_block),
      validators
    );

    await expect(Bridge.getBlockByNumber(1337)).to.be.revertedWith(
      'block not found'
    );
  });
});
