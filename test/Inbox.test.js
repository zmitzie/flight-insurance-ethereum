const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const { interface, bytecode } = require('../compile')

const web3 = new Web3(ganache.provider());

let accounts;
let inbox;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    //Use on of those accounts to deploy the contract
    inbox = await new web3.eth.Contract(JSON.parse(interface))
        .deploy({data: bytecode, arguments: ['Hi'] })
        .send({ from: accounts[0], gas: '1000000' })

});

describe('Inbox', () => {
    it('deploys a contract', () => {
        assert.ok(inbox.options.address);
    })

    it('has a default message', async () => {
        //message function comes from the contract
        const message = await inbox.methods.message().call();
        assert.equal(message, "Hi");
    })

    it('can change the message', async () => {
        //message function comes from the contract
        await inbox.methods.setMessage('Test').send({ from: accounts[0], gas: '1000000' });
        const message = await inbox.methods.message().call();
        assert.equal(message, "Test");
    })
});
