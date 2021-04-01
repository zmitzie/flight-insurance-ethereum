const path = require('path');
const fs = require('fs');
const solc = require('solc');

const InboxPath = path.resolve(__dirname, 'contracts', 'TravelInsurance.sol');
const OraclizePath = path.resolve(__dirname, 'contracts', 'usingOraclize.sol');


const input = {
    'usingOraclize.sol': fs.readFileSync(OraclizePath, 'utf8'),
    'TravelInsurance.sol': fs.readFileSync(InboxPath, 'utf8')
}

//const InboxPath = path.resolve(__dirname, 'contracts', 'TravelInsurance.sol');
//const source = fs.readFileSync(InboxPath, 'utf8');

module.exports = solc.compile({sources: input}, 1);