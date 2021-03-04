var express = require('express');

const bridgeAddress = process.env['BRIDGE'];
console.log("Using bridge at address", bridgeAddress);

var bridgeSaleAddress = process.env['BRIDGESALE'];
var Bridge, BridgeSale;

async function main() {
  if (bridgeSaleAddress == null) {
    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(bridgeAddress, "0xd000000000000000000000000000000000000b1e");
    bridgeSaleAddress = BridgeSale.address;
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

app.get('/api/:account', (req, res) => {
  const address = req.params.account;
  res.send("<h3>Claimable transactions for "+address+"</h3>")
});

main()
  .then(() => app.listen(9001, () => {
    console.log("listening on 9001");
  }))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

