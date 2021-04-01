var appRouter = function (app) {

    app.post("/", function(req, res) {
        var num = req.body.num;
        res.status(200).send({status: "ClaimPaid",
                                claimable: false
                            });
    });

    app.post("/contracts/claim", function(req, res) {
        const HDWalletProvider = require('truffle-hdwallet-provider');
        const Web3 = require('web3');
        const compiledContract = require('../compile');
        const interface = compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].interface;
        const bytecode = '0x'+compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].bytecode;
        req.setTimeout(300000);
        res.setHeader('Content-Type', 'application/json');

        const provider = new HDWalletProvider(
            ['Mnemonic'],
            ['Connection_URL']
        );

        const web3 = new Web3(provider);
        const callMethod = async () => {
            const accounts = await web3.eth.getAccounts();
            const result = await await new web3.eth.Contract(JSON.parse(interface), req.body.address).methods.processClaim().send({from: accounts[0], gas: 3000000});
            console.log(result)
            if (result.status == true) {
                res.status(200).send({status: "ClaimPaid",
                    claimable: false
                });
            } else {
                res.status(422).send({error: "An error occured, please try again later."
                });
            }
        };
        callMethod();
    });

    app.post("/contracts/status", function(req, res) {
        const request = require('request-promise');
        const HDWalletProvider = require('truffle-hdwallet-provider');
        const Web3 = require('web3');
        const compiledContract = require('../compile');
        const interface = compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].interface;
        const bytecode = '0x'+compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].bytecode;
        req.setTimeout(300000);
        res.setHeader('Content-Type', 'application/json');

        const provider = new HDWalletProvider(
            ['Mnemonic'],
            ['Connection_URL']
        );

        const web3 = new Web3(provider);
        function sleep(ms){
            return new Promise(resolve=>{
                setTimeout(resolve,ms)
            })
        }

        const callMethod = async () => {
            let toClaim = false;
            let amount = 0;
            const accounts = await web3.eth.getAccounts();
            const result = await new web3.eth.Contract(JSON.parse(interface), req.body.address).methods.status().call({from: accounts[0] });
            const myDeployedContract = new web3.eth.Contract(JSON.parse(interface), req.body.address);
            if (result == "Created") {
                res.status(202).send({status: result,
                    claimable: false,
                    message: "We are calculating the status of your flight, please check back later."
                    });
                const callOraclize = async () => {
                    await myDeployedContract.methods.checkStatus().send({from: accounts[0], value: 10000000000000000, gas: 3000000});
                    await myDeployedContract.methods.checkDelay().send({from: accounts[0], value: 10000000000000000, gas: 3000000});
                }
                callOraclize();
            } else {
                const flightStatus = await myDeployedContract.methods.latestFlightStatus().call({from: accounts[0] });
                const flightDelay = await myDeployedContract.methods.minutesOfFlightDelay().call({from: accounts[0] });
                if ((flightStatus == "L") && (flightDelay == null)) {
                    await myDeployedContract.methods.checkDelay().send({from: accounts[0], value: 10000000000000000, gas: 3000000});
                    await sleep(90000);
                    const finalFlightDelay = await myDeployedContract.methods.minutesOfFlightDelay().call({from: accounts[0] });
                    if (finalFlightDelay == null) {
                        res.status(202).send({status: result,
                            claimable: false,
                            message: "We are calculating the delay of your flight, please check back later."
                        });
                    }
                }
                const finalStatus = await myDeployedContract.methods.status().call({from: accounts[0] });
                const finalFlightDelay = await myDeployedContract.methods.minutesOfFlightDelay().call({from: accounts[0] });
                const isClaimable = await myDeployedContract.methods.claimable().call({from: accounts[0] });
                let reimbursementAmount = 0;
                if (finalStatus == "EligibleForClaim") {
                    const locationOfTerm = await myDeployedContract.methods.locationOfCorrespondingTerm().call({from: accounts[0] });
                    console.log(locationOfTerm);
                    if (locationOfTerm == 0) {
                        reimbursementAmount = 150
                    } else if (locationOfTerm == 1) {
                        reimbursementAmount = 250;
                    } else {
                        reimbursementAmount = 500;
                    }
                }
                    res.status(200).send({status: finalStatus,
                        claimable: isClaimable,
                        delay: finalFlightDelay,
                        amount: reimbursementAmount
                    });
            }
        };
        callMethod();
    });

    app.post("/contracts", function(req, res) {
        const request = require('request-promise');
        const HDWalletProvider = require('truffle-hdwallet-provider');
        const Web3 = require('web3');
        const compiledContract = require('../compile');
        const interface = compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].interface;
        const bytecode = '0x'+compiledContract.contracts['TravelInsurance.sol:TravelInsurance'].bytecode;
        req.setTimeout(300000);
        res.setTimeout(300000);
        res.setHeader('Content-Type', 'application/json');
        let contractAddress;
        let flightId;
        let depCity;
        let arrCity;

        const provider = new HDWalletProvider(
          ['Mnemonic'],
          ['Connection_URL']
        );

        const web3 = new Web3(provider);
        const api = {
            base_url: "https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/status/",
            app_id: api.app_id,
            app_key: api.app_key,
          }
        //request to determine flight id from flight stats
        request({
            url: api.base_url + req.body.airline + "/" + req.body.flightno + "/dep/" + req.body.year + "/" + req.body.month + "/" + req.body.day,
            qs: {
                appId: api.app_id,
                appKey: api.app_key,
                utc: false
            },
            method: 'GET',
            json: true
          })
          .then(response => {
            if (!Array.isArray(response.flightStatuses) || !response.flightStatuses.length) {
                res.status(400).send({
                    message: "Either the Flight Number is wrong, or the flight is happening in more than 2 days from now."
                });
            } else {
                flightId = response.flightStatuses[0].flightId.toString();
                depCity = response.appendix.airports[0].city;
                arrCity = response.appendix.airports[1].city;

                const deploy = async () => {
                    const accounts = await web3.eth.getAccounts();
                    console.log('Deploying from address ', accounts[0]);
                    req.body.airline += req.body.flightno;
                    const result = await new web3.eth.Contract(JSON.parse(interface))
                        .deploy({data: bytecode, arguments: ['f9a034532b994125493FbAfCd8D186AB81387c97', req.body.email, req.body.airline, req.body.full_name, flightId]})
                        .send ({ gas: 6000000, from: accounts[0] });
                    console.log('Contract deployed to ', result.options.address);
                    res.status(201).send({address: result.options.address,
                                        status: "Created",
                                        flightno: req.body.airline,
                                        date: req.body.month + "/" + req.body.day + "/" + req.body.year,
                                        full_name: req.body.full_name,
                                        from: depCity,
                                        to: arrCity,
                                        email: req.body.email,
                                        ti: req.body.ti,
                                        claimable: false,
                                        url: "https://kovan.etherscan.io/address/" + result.options.address
                                    });
                };
                deploy();
            }
            return request;
        });
    });
  }

  module.exports = appRouter;
