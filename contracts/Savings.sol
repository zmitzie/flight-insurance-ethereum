pragma solidity ^0.4.17;

contract Savings {
    address public admin;
    address public user;
    uint256 private totalAmount; //in wei
    uint256 private amountPerCycle; //in wei
    uint256 public deposits = 0;
    uint256[] private maxTimestamps;
    bool public active = true;

    function Savings(address userAddress, uint _totalAmount, uint _amountPerCycle, uint256[] _unixTimestamps) public {
        admin = msg.sender;
        user = userAddress;
        totalAmount = _totalAmount;
        amountPerCycle = _amountPerCycle;
        uint256 i = 0;
        while (i < _unixTimestamps.length) {
            maxTimestamps.push(_unixTimestamps[i]);
            i++;
        }
    }

    function () payable {
        require(msg.value >= amountPerCycle);
        if(!active) {
            msg.sender.transfer(msg.value);
        }
        //check if the deposit was made on time
        if (now > maxTimestamps[deposits]) {
            msg.sender.transfer(msg.value);
            setExpired();
        } else {
            deposits++;
            if (this.balance >= totalAmount) {
                user.transfer(this.balance);
                active = false;
            }
        }
        
    }

    function checkValidity() public restricted returns (bool valid) {
        if (!active) {
            return false;
        } else {
            if (now > maxTimestamps[maxTimestamps.length - 1])  {
                setExpired();
                return false;
            } else {
                return true;
            }
        }
    }

    function setExpired() private {
        active = false;
        //if some deposits were made, return them to the pool account
        if (deposits > 0) {
            admin.transfer(this.balance);
        }

    }

    modifier restricted() {
        require(msg.sender == admin);
        _;
    }
}
