pragma solidity ^0.4.2;
//use 0.4.20

import "usingOraclize.sol";

contract TravelInsurance is usingOraclize {
    address owner;
    address clientAddress;
    string email;
    string flightNum;
    string fullName;
    string public status = "Created"; //Created, EligibleForClaim, PendingManualApprovalOfClaim, NotEligibleForClaim, ClaimPaid

    bool termsSet = true;
    bool public claimable = false;

    string public flightId;
    string public latestFlightStatus;

    uint public minutesOfFlightDelay;
    uint8 public locationOfCorrespondingTerm;

    uint16[] public cDeductibleAmounts = [0, 0, 0];
    uint16[] cPayableAmounts = [150, 250, 500];
    uint16[] cMinutesDelay = [120, 240, 350];
    //bool[] cAutomaticPayments = [false, false, false];

    event newOraclizeQuery(string description);
    event newFlightStatus(string price);
    event newDelay(string price);
    enum oraclizeState { ForActual, ForExpected }

    struct oraclizeCallback {
        oraclizeState oState;
    }
    mapping (bytes32 => oraclizeCallback) public oraclizeCallbacks;

    //constructor
    function TravelInsurance(address _clientAddress, string _email, string _flightNum, string _fullName, string _flightId) public payable {
        owner = msg.sender;
        clientAddress = _clientAddress;
        email = _email;
        flightNum = _flightNum;
        fullName = _fullName;
        flightId = _flightId;
        clientAddress = _clientAddress;
    }

    function compareStrings (string a, string b) view returns (bool){
        return keccak256(a) == keccak256(b);
    }
   /*
    function setContractTerms(uint8 _noOfcontractTerms, uint16[] _cDeductibleAmounts, uint16[] _cPayableAmounts, uint16[] _cMinutesDelay, bool[] _cAutomaticPayments) onlyOwner setTermsOnce {
        //Create arrays with terms of the travel insurance
        //eg 3, [0, 0, 0], [150, 250, 500], [120, 240, 350], [true, false, false]
        uint8 i = 0;
        while (i < _noOfcontractTerms) {
            cDeductibleAmounts.push(_cDeductibleAmounts[i]);
            cPayableAmounts.push(_cPayableAmounts[i]);
            cMinutesDelay.push(_cMinutesDelay[i]);
            cAutomaticPayments.push(_cAutomaticPayments[i]);
            i++;
        }
        termsSet = true;
    }
    */

    function __callback(bytes32 myid, string result) {
        require (msg.sender == oraclize_cbAddress());
        oraclizeCallback memory o = oraclizeCallbacks[myid];
        if (o.oState == oraclizeState.ForActual) {
            newFlightStatus(result);
            latestFlightStatus = result;
            // if status is cancelled, diverted, process full payout
            if (compareStrings(latestFlightStatus, "C")) {
                claimable = true;
                minutesOfFlightDelay = 999;
                locationOfCorrespondingTerm = 2;
                status = "EligibleForClaim";
            }
            if (compareStrings(latestFlightStatus, "D")) {
                claimable = true;
                minutesOfFlightDelay = 999;
                locationOfCorrespondingTerm = 2;
                status = "EligibleForClaim";
            }
        }
        else if(o.oState == oraclizeState.ForExpected) {
            newDelay(result);
            //if status is landed, check for delays using the same oraclize URL
            if (compareStrings(latestFlightStatus, "L")) {
                //if there is no delay
                if (compareStrings(result, "")){
                    status = "NotEligibleForClaim";
                    refundToOwner();
                }
                else {
                    minutesOfFlightDelay = parseInt(result);
                    checkEligibility();
                }
            }
        }
    }

    function checkStatus() payable {
        newOraclizeQuery("Oraclize query was sent, waiting for the answer for getting actual flight details..");
        bytes32 queryId = oraclize_query("URL", strConcat("json(https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/status/", flightId, "?appId=['AppID']&appKey=['AppKey']&utc=false).flightStatus.status"));
        oraclizeCallbacks[queryId] = oraclizeCallback(oraclizeState.ForActual);
    }

    function checkDelay() payable {
        newOraclizeQuery("Oraclize query was sent, waiting for the answer for getting actual flight details..");
        bytes32 queryId = oraclize_query("URL", strConcat("json(https://api.flightstats.com/flex/flightstatus/rest/v2/json/flight/status/", flightId, "?appId=['AppID']&appKey=['AppKey']&utc=false).flightStatus.delays.arrivalGateDelayMinutes"));
        oraclizeCallbacks[queryId] = oraclizeCallback(oraclizeState.ForExpected);
    }

    //function modifier
    modifier onlyOwner() {
        if (msg.sender != owner) throw;
        _;
    }

    modifier setTermsOnce() {
        if (termsSet == true) throw;
        _;
    }

    function processClaim() public returns (bool success) {
        if (claimable != true) throw;
            setNotClaimable();
            setStatusPaid();
            return true;
    }

    function withdraw() internal returns (bool success) {
        if(!clientAddress.send(this.balance)) throw;
        return true;
    }

    function refundToOwner() internal {
        owner.transfer(this.balance);

    }

    function checkEligibility() internal {
        uint8 i = 0;
        while (i < cMinutesDelay.length) {
                if (cMinutesDelay.length - 1 == i) { //last time looping
                    if (minutesOfFlightDelay >= cMinutesDelay[i]) {
                        setStatusEligibleForClaim();
                        break;
                    }
                    break;
                }

            	if (minutesOfFlightDelay < cMinutesDelay[i+1]) {
                    if (minutesOfFlightDelay > cMinutesDelay[i]) {
                        setStatusEligibleForClaim();
                        break;
                    }
                }
            	i++;
            }
        if (claimable == false) {
            setStatusNotEligibleForClaim();
        }
    }

    function setStatusPaid() internal {
        status = "ClaimPaid";
    }

    function setStatusEligibleForClaim() internal {
        status = "EligibleForClaim";
        claimable = true;
    }

    function setStatusPendingManualApprovalOfClaim() internal {
        status = "PendingManualApprovalOfClaim";
    }

    function setStatusNotEligibleForClaim() internal {
        status = "NotEligibleForClaim";
    }

    function setNotClaimable() internal {
        claimable = false;
    }

    //Standard kill() function to recover funds

    function kill() {
        if (msg.sender == owner)  // only allow this action if the account sending the signal is the creator
            suicide(owner);       // kills this contract and sends remaining funds back to creator
    }
}
