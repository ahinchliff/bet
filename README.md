# Bet

My first solidity project. Smart contracts to allow anyone to permissionlessly bet against the house.

## Quick Start

`yarn && yarn test`

## Logic

- A "game" is a future event that has a binary outcome. "Max Verstappen will win the 2021 British Grand Prix".
- The house sets the price of tickets that, depending on the outcome, will either be worth $1 or $0.
- Once an outcome is set users can claim their winnings. Those with losing tickets dont need to take any action.
- If an game is cancelled users can claim back what they have spent on tickets.

## Future improvements

- The house is currently able to drain the contract. A future update could make it so the house can only claim what they have won.
- Currently users can only play against the house. Would be interesting to let players "mint" and see their own tickets.
