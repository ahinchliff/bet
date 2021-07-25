// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";

enum Direction {
    notSet,
    positive,
    negative
}

enum Status {
    open,
    forcedClose,
    cancelled
}

struct DirectionStruct {
    uint256 positive;
    uint256 negative;
}

struct Game {
    uint256 id;
    string name;
    Direction outcome;
    uint256 closesAt;
    Status status;
    DirectionStruct prices;
    DirectionStruct ticketsOutstanding;
    DirectionStruct maxQuantity;
    mapping(address => DirectionStruct) balances;
    mapping(address => uint256) totalSpentInCents;
}

contract Pavilion is Ownable {
    IERC20Metadata private _currency;
    uint256 public lastGameId;
    mapping(uint256 => Game) public games;

    event NewGame(uint256 id, string name, uint256 closesAt);

    constructor(address currencyAddress) {
        lastGameId = 0;
        _currency = IERC20Metadata(currencyAddress);
    }

    function createGame(
        string calldata name,
        uint256 closesAt,
        uint256 positivePrice,
        uint256 negativePrice,
        uint256 positiveMaxQuantity,
        uint256 negativeMaxQuantity
    ) public onlyOwner {
        require(closesAt > block.timestamp, "Should be in the future");

        lastGameId++;
        Game storage game = games[lastGameId];

        game.id = lastGameId;
        game.closesAt = closesAt;
        game.name = name;
        game.status = Status.open;
        game.prices.positive = positivePrice;
        game.prices.negative = negativePrice;
        game.maxQuantity.positive = positiveMaxQuantity;
        game.maxQuantity.negative = negativeMaxQuantity;

        emit NewGame(lastGameId, name, closesAt);
    }

    function getBalance(
        uint256 gameId,
        address add,
        Direction direction
    ) public view returns (uint256) {
        return
            direction == Direction.positive
                ? games[gameId].balances[add].positive
                : games[gameId].balances[add].negative;
    }

    function getTotalSpent(uint256 gameId, address add)
        public
        view
        returns (uint256)
    {
        return games[gameId].totalSpentInCents[add];
    }

    function setGameStatus(uint256 gameId, Status status) public onlyOwner {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");

        game.status = status;
    }

    function setGamePrices(
        uint256 gameId,
        uint256 positivePrice,
        uint256 negativePrice
    ) public onlyOwner {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");

        game.prices.positive = positivePrice;
        game.prices.negative = negativePrice;
    }

    function setGameMaxQuantity(
        uint256 gameId,
        uint256 positiveMaxQuantity,
        uint256 negativeMaxQuanity
    ) public onlyOwner {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");

        game.maxQuantity.positive = positiveMaxQuantity;
        game.maxQuantity.negative = negativeMaxQuanity;
    }

    function setGameOutcome(uint256 gameId, Direction outcome)
        public
        onlyOwner
    {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");

        game.outcome = outcome;
    }

    function withdraw(uint256 amount) public onlyOwner {
        _currency.transfer(msg.sender, amount);
    }

    function buyTickets(
        uint256 gameId,
        Direction direction,
        uint256 amount,
        uint256 price
    ) public {
        require(direction != Direction.notSet, "direction 0 not valid");

        Game storage game = games[gameId];

        require(game.id != 0, "game not found");
        require(game.status == Status.open, "game not open");
        require(game.outcome == Direction.notSet, "outcome already set");
        require(block.timestamp < game.closesAt, "past closesAt");

        uint256 maxQuantity = direction == Direction.positive
            ? game.maxQuantity.positive
            : game.maxQuantity.negative;

        uint256 ticketsOutstanding = direction == Direction.positive
            ? game.ticketsOutstanding.positive
            : game.ticketsOutstanding.negative;

        require(
            ticketsOutstanding + amount <= maxQuantity,
            "total tickets > ticket limit"
        );

        uint256 ticketPrice = direction == Direction.positive
            ? game.prices.positive
            : game.prices.negative;

        require(price == ticketPrice, "price != ticketPrice");

        uint256 costInCents = price * amount;
        uint256 costInCurrency = centsToCurrencyPrecision(costInCents);

        _currency.transferFrom(msg.sender, address(this), costInCurrency);

        increaseBalanceBy(gameId, msg.sender, direction, amount);
        game.totalSpentInCents[msg.sender] += costInCents;
    }

    function claimRefund(uint256 gameId) public {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");
        require(game.status == Status.cancelled, "game not cancelled");

        uint256 totalSpentInCents = game.totalSpentInCents[msg.sender];

        require(totalSpentInCents > 0, "nothing to claim");

        uint256 costInCurrency = centsToCurrencyPrecision(totalSpentInCents);

        _currency.transfer(msg.sender, costInCurrency);

        game.totalSpentInCents[msg.sender] = 0;
    }

    function claimWinnings(uint256 gameId) public {
        Game storage game = games[gameId];

        require(game.id != 0, "game not found");
        require(game.status != Status.cancelled, "game cancelled");
        require(game.outcome != Direction.notSet, "outcome not set");

        uint256 winningTickets = game.outcome == Direction.positive
            ? game.balances[msg.sender].positive
            : game.balances[msg.sender].negative;

        require(winningTickets > 0, "nothing to claim");

        uint256 valueInCurrency = centsToCurrencyPrecision(
            winningTickets * 100
        );

        _currency.transfer(msg.sender, valueInCurrency);

        decreaseBalanceBy(gameId, msg.sender, game.outcome, winningTickets);
    }

    function increaseBalanceBy(
        uint256 gameId,
        address account,
        Direction direction,
        uint256 amount
    ) private {
        if (direction == Direction.positive) {
            games[gameId].balances[account].positive += amount;
        } else {
            games[gameId].balances[account].negative += amount;
        }
    }

    function decreaseBalanceBy(
        uint256 gameId,
        address account,
        Direction direction,
        uint256 amount
    ) private {
        if (direction == Direction.positive) {
            games[gameId].balances[account].positive -= amount;
        } else {
            games[gameId].balances[account].negative -= amount;
        }
    }

    function centsToCurrencyPrecision(uint256 amount)
        private
        view
        returns (uint256)
    {
        return amount * (10**(_currency.decimals() - 2));
    }
}
