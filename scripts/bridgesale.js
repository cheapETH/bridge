var express = require('express');

const bridgeAddress = process.env['BRIDGE'];
console.log("Using bridge at address", bridgeAddress);

var bridgeSaleAddress = process.env['BRIDGESALE'];

async function main() {
  if (bridgeSaleAddress == null) {
    const BridgeSaleFactory = await ethers.getContractFactory("BridgeSale");
    BridgeSale = await BridgeSaleFactory.deploy(bridgeAddress, "0xd000000000000000000000000000000000000b1e");
    bridgeSaleAddress = BridgeSale.address;
  }

  console.log("BridgeSale deployed at", bridgeSaleAddress);
}

var app = express();
app.get('/', function(req, res) {
  res.sendFile('sale.html');
});

main()
  .then(() => app.listen(9001, () => {
    console.log("listening on 9001");
  }))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

